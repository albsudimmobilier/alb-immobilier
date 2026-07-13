import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async (req, context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const demande_id = url.searchParams.get('demande_id');
    const courtier_id = url.searchParams.get('courtier_id');

    if (!demande_id || !courtier_id) {
      return new Response('Missing parameters', { status: 400 });
    }

    // Récupérer la demande
    const { data: demande, error: demandeError } = await supabase
      .from('demandes_financement')
      .select('*')
      .eq('id', demande_id)
      .single();

    if (demandeError || !demande) {
      return new Response('Demande not found', { status: 404 });
    }

    // Vérifier si le lead est déjà remporté (2 courtiers acceptés)
    if (demande.courtier_ids_acceptes && demande.courtier_ids_acceptes.length >= 2) {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head><title>Lead remporté</title></head>
        <body style="font-family: Arial; text-align: center; padding: 3rem;">
          <h1>⏰ Trop tard!</h1>
          <p>Ce lead a déjà été remporté par d'autres courtiers.</p>
        </body>
        </html>
      `, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }

    // Initialiser courtier_ids_acceptes s'il n'existe pas
    const acceptedIds = demande.courtier_ids_acceptes || [];
    if (!acceptedIds.includes(courtier_id)) {
      acceptedIds.push(courtier_id);
    }

    // Mettre à jour la demande
    const newStatus = acceptedIds.length >= 2 ? 'remportee' : 'acceptee_courtier';
    const { error: updateError } = await supabase
      .from('demandes_financement')
      .update({
        courtier_ids_acceptes: acceptedIds,
        statut: newStatus
      })
      .eq('id', demande_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response('Update failed', { status: 500 });
    }

    // Récupérer les infos des courtiers acceptés
    const { data: courtierAcceptes } = await supabase
      .from('profiles')
      .select('id, prenom, nom, email, telephone')
      .in('id', acceptedIds);

    // Récupérer TOUS les courtiers du département pour les notifier
    const department = parseInt(demande.code_postal.substring(0, 2));
    const { data: allCourtiers } = await supabase
      .from('profiles')
      .select('id, email, prenom, nom, zones_intervention')
      .eq('role', 'courtier')
      .eq('statut_verifie', true);

    const filteredCourtiers = allCourtiers?.filter(c => {
      const zones = c.zones_intervention ? c.zones_intervention.split(',').map(z => parseInt(z.trim())) : [];
      return zones.includes(department);
    }) || [];

    // 1️⃣ NOTIFIER TOUS LES COURTIERS que le lead a été remporté
    const courtierWinnerNames = courtierAcceptes.map(c => c.prenom + ' ' + c.nom).join(' et ');
    const templateNotifyCourtiers = 125; // Template "Lead remporté par X"

    const notifyPromises = filteredCourtiers.map(courtier =>
      fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: [{ email: courtier.email, name: courtier.prenom + ' ' + courtier.nom }],
          templateId: templateNotifyCourtiers,
          params: {
            COURTIER_PRENOM: courtier.prenom,
            COURTIER_GAGNANT: courtierWinnerNames,
            CLIENT_NOM: demande.nom,
            CLIENT_CP: demande.code_postal,
            BUDGET_MAX: demande.budget_max.toLocaleString('fr-FR'),
            SENDER: 'ALB Sud Immobilier'
          }
        })
      })
    );

    // 2️⃣ EMAIL AU PARTICULIER avec le(s) courtier(s) gagnant(s)
    const templateNotifyParticulier = 126; // Template "Courtiers gagnants vont vous contacter"
    
    const courtierDetailsHtml = courtierAcceptes.map(c => 
      `<p><strong>${c.prenom} ${c.nom}</strong><br>📞 ${c.telephone}</p>`
    ).join('');

    const notifyParticulierPromise = fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: [{ email: demande.email, name: demande.nom + ' ' + demande.prenom }],
        templateId: templateNotifyParticulier,
        params: {
          CLIENT_PRENOM: demande.prenom,
          COURTIER_GAGNANTS: courtierWinnerNames,
          COURTIER_DETAILS: courtierDetailsHtml,
          BUDGET_MAX: demande.budget_max.toLocaleString('fr-FR'),
          SENDER: 'ALB Sud Immobilier'
        }
      })
    });

    await Promise.all([...notifyPromises, notifyParticulierPromise]);

    // Page de confirmation pour le courtier
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lead accepté - ALB Immobilier</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 3rem; background: linear-gradient(135deg, #4B1A3E 0%, #6b2d5f 100%); color: white; }
          .container { max-width: 600px; margin: 0 auto; background: white; color: #333; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
          h1 { color: #4B1A3E; margin-bottom: 1rem; }
          p { line-height: 1.6; color: #666; }
          .success { font-size: 48px; margin-bottom: 1rem; }
          .info-box { background: #e8f5e9; border-left: 4px solid #2E7D32; padding: 1rem; margin: 1.5rem 0; text-align: left; }
          .info-box strong { color: #2E7D32; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✅</div>
          <h1>Lead accepté!</h1>
          <p>Vous avez remporté ce lead. Les informations du client vous ont été envoyées par email.</p>
          <div class="info-box">
            <strong>Client:</strong> ${demande.prenom} ${demande.nom}<br>
            <strong>Email:</strong> ${demande.email}<br>
            <strong>Téléphone:</strong> ${demande.telephone}<br>
            <strong>Code postal:</strong> ${demande.code_postal}<br>
            <strong>Budget:</strong> ${demande.budget_max.toLocaleString('fr-FR')} €
          </div>
          <p><small>Vous et les autres courtiers avez reçu une notification. À vous de jouer! 🚀</small></p>
        </div>
      </body>
      </html>
    `, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  } catch (err) {
    console.error('Error:', err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
};

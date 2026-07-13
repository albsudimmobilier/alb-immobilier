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

    // Ajouter le courtier aux rejetes
    const rejetes = demande.courtier_ids_rejetes || [];
    if (!rejetes.includes(courtier_id)) {
      rejetes.push(courtier_id);
    }

    // Mettre à jour la demande
    const { error: updateError } = await supabase
      .from('demandes_financement')
      .update({
        courtier_ids_rejetes: rejetes
      })
      .eq('id', demande_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response('Update failed', { status: 500 });
    }

    // Envoyer email de confirmation au courtier
    const { data: courtier } = await supabase
      .from('profiles')
      .select('email, prenom, nom')
      .eq('id', courtier_id)
      .single();

    if (courtier && courtier.email) {
      const templateRefusConfirm = 127; // Template "Refus enregistré"
      
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: [{ email: courtier.email, name: courtier.prenom + ' ' + courtier.nom }],
          templateId: templateRefusConfirm,
          params: {
            COURTIER_PRENOM: courtier.prenom,
            CLIENT_NOM: demande.nom,
            CLIENT_CP: demande.code_postal,
            SENDER: 'ALB Sud Immobilier'
          }
        })
      });
    }

    // Page de confirmation pour le courtier
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lead refusé - ALB Immobilier</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 3rem; background: linear-gradient(135deg, #4B1A3E 0%, #6b2d5f 100%); color: white; }
          .container { max-width: 600px; margin: 0 auto; background: white; color: #333; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
          h1 { color: #4B1A3E; margin-bottom: 1rem; }
          p { line-height: 1.6; color: #666; }
          .icon { font-size: 48px; margin-bottom: 1rem; }
          .info-box { background: #f5f5f5; border-left: 4px solid #B28E3D; padding: 1rem; margin: 1.5rem 0; text-align: left; }
          .info-box strong { color: #4B1A3E; }
          .btn { display: inline-block; margin-top: 1rem; padding: 12px 24px; background: linear-gradient(135deg, #4B1A3E, #6b2d5f); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
          .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(75, 26, 62, 0.3); }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">❌</div>
          <h1>Refus enregistré</h1>
          <p>Votre refus a bien été pris en compte.</p>
          <div class="info-box">
            <strong>Lead:</strong> ${demande.nom} (${demande.code_postal})<br>
            <strong>Budget:</strong> ${demande.budget_max.toLocaleString('fr-FR')} €<br>
            <strong>Statut:</strong> ✅ Les autres courtiers peuvent toujours accepter
          </div>
          <p>Vous n'avez aucune action supplémentaire à faire.<br>
          Une confirmation par email vous a été envoyée.</p>
          <a href="/dashboard-courtier.html" class="btn">Retour au tableau de bord</a>
        </div>
      </body>
      </html>
    `, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  } catch (err) {
    console.error('Error:', err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
};

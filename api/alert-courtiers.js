import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { demande_id, department, demande } = await req.json();

    // Récupérer tous les courtiers du département
    const { data: courtiers, error: courtiersError } = await supabase
      .from('profiles')
      .select('id, email, prenom, nom, zones_intervention')
      .eq('role', 'courtier')
      .eq('statut_verifie', true);

    if (courtiersError || !courtiers || courtiers.length === 0) {
      console.error('No courtiers found:', courtiersError);
      return new Response('No courtiers found', { status: 404 });
    }

    // Filtrer les courtiers par département
    const filteredCourtiers = courtiers.filter(c => {
      const zones = c.zones_intervention ? c.zones_intervention.split(',').map(z => parseInt(z.trim())) : [];
      return zones.includes(department);
    });

    // Envoyer email alerte à chaque courtier avec lien d'acceptation
    const templateId = 124; // Template "Alerte demande financement - Boutons voir/accepter/refuser"
    
    const emailPromises = filteredCourtiers.map(courtier => {
    // Créer les 3 liens/boutons
      const domain = new URL(req.url).origin;
      const viewLink = `${domain}/.netlify/functions/view-lead?demande_id=${demande_id}&courtier_id=${courtier.id}`;
      const acceptLink = `${domain}/.netlify/functions/accept-lead?demande_id=${demande_id}&courtier_id=${courtier.id}`;
      const refuseLink = `${domain}/.netlify/functions/refuse-lead-email?demande_id=${demande_id}&courtier_id=${courtier.id}`;
      
      return fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: [{ email: courtier.email, name: courtier.prenom + ' ' + courtier.nom }],
          templateId: templateId,
          params: {
            COURTIER_PRENOM: courtier.prenom,
            CLIENT_NOM: demande.nom,
            CLIENT_PRENOM: demande.prenom,
            CLIENT_EMAIL: demande.email,
            CLIENT_TEL: demande.tel,
            CLIENT_CP: demande.cp,
            BUDGET_MAX: demande.budget_max.toLocaleString('fr-FR'),
            DEMANDE_ID: demande_id,
            VIEW_LINK: viewLink,
            ACCEPT_LINK: acceptLink,
            REFUSE_LINK: refuseLink,
            SENDER: 'ALB Sud Immobilier'
          }
        })
      });
    });

    const responses = await Promise.all(emailPromises);
    const failed = responses.filter(r => !r.ok).length;

    if (failed > 0) {
      console.warn(`Failed to send to ${failed}/${filteredCourtiers.length} courtiers`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      sent: filteredCourtiers.length - failed,
      total: filteredCourtiers.length 
    }), { status: 200 });

  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

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
    const { demande_id, courtier_id } = await req.json();

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

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Lead refusé. Les autres courtiers peuvent toujours l\'accepter.'
    }), { status: 200 });

  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

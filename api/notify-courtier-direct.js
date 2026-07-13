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
    const { courtier_id, demande } = await req.json();

    // Récupérer l'email du courtier
    const { data: courtier, error: courtierError } = await supabase
      .from('profiles')
      .select('email, prenom, nom')
      .eq('id', courtier_id)
      .single();

    if (courtierError || !courtier || !courtier.email) {
      console.error('Courtier not found:', courtierError);
      return new Response('Courtier not found', { status: 404 });
    }

    // Envoyer email Brevo au courtier
    const templateId = 123; // Template "Demande financement directe"
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
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
          SENDER: 'ALB Sud Immobilier'
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Brevo error:', error);
      return new Response('Email send failed', { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

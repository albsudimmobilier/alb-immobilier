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
    const { courtier_id, demande, pieces, mode } = await req.json();
    
    // 1️⃣ INSERT DANS SUPABASE
    const { data: demandeData, error: insertError } = await supabase
      .from('demandes_financement')
      .insert([{
        nom: demande.nom,
        prenom: demande.prenom,
        email: demande.email,
        telephone: demande.tel,
        code_postal: demande.cp,
        budget_max: demande.budget_max,
        endettement_ratio: demande.endettement,
        mensualite: demande.mensualite,
        montant_emprunt: demande.emprunt,
        courtier_id: courtier_id,
        pieces_fournies: pieces,
        statut: 'en_attente',
        mode: mode,
        consentement_recontact: true
      }])
      .select();
    
    if (insertError || !demandeData || !demandeData[0]) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Insert failed' }), { status: 500 });
    }
    
    // 2️⃣ RÉCUPÉRER COURTIER
    const { data: courtier } = await supabase
      .from('profiles')
      .select('email, prenom, nom')
      .eq('id', courtier_id)
      .single();
    
    if (!courtier || !courtier.email) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    
    // 3️⃣ ENVOYER MAIL
    const templateId = 8;
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
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
    
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

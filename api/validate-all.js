import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const brevoApiKey = process.env.BREVO_API_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function getFromEmailByType(profile) {
  if (profile.est_vendeur === true) return 'particulier-vendeur@albimmobilier.fr';
  if (profile.est_acquereur === true) return 'particulier-acquereur@albimmobilier.fr';
  if (profile.role === 'courtier') return 'courtier@albimmobilier.fr';
  if (profile.role === 'artisan') return 'artisan@albimmobilier.fr';
  if (profile.role === 'agent' || profile.role === 'mandataire') return 'agent-immobilier@albimmobilier.fr';
  return 'contact@albimmobilier.fr';
}

function isProProfile(profile) {
  return ['courtier', 'agent', 'artisan', 'mandataire'].includes(profile.role);
}

async function sendBrevoEmail(email, templateId, params, fromEmail) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': brevoApiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: [{ email }],
      from: { email: fromEmail, name: 'ALB Immobilier' },
      templateId: parseInt(templateId),
      params
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo error: ${errorText}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, type, action } = req.body;

    if (!id || !type || !action) {
      return res.status(400).json({ error: 'id, type et action requis' });
    }

    if (!['valider', 'refuser'].includes(action)) {
      return res.status(400).json({ error: 'action doit être "valider" ou "refuser"' });
    }

    if (type === 'avis') {
      const { error: updateError } = await supabase
        .from('avis')
        .update({ verifiee: action === 'valider' })
        .eq('id', id);

      if (updateError) throw new Error(`Supabase update error: ${updateError.message}`);

      return res.status(200).json({
        success: true,
        message: action === 'valider' ? 'Avis validé et visible sur la vitrine du pro' : 'Avis refusé et caché'
      });
    }

    if (!['vendeur', 'pro'].includes(type)) {
      return res.status(400).json({ error: 'Type de profil non reconnu' });
    }

    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !profile) {
      return res.status(404).json({ error: 'Profil non trouvé' });
    }

    const fromEmail = getFromEmailByType(profile);
    const isPro = isProProfile(profile);

    if (action === 'valider') {
      const updatePayload = { statut_verifie: true };

      // Pour un pro, on génère son PIN maintenant : c'est le moment où on le lui communique
      let pin = profile.pin;
      if (isPro) {
        pin = generatePin();
        updatePayload.pin = pin;
        updatePayload.pin_attempts = 0;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', id);

      if (updateError) throw new Error(`Supabase update error: ${updateError.message}`);

      if (isPro) {
        // Template "INVITE PROFIL PRO" — contient déjà PRENOM/EMAIL/PIN
        await sendBrevoEmail(profile.email, 20, {
          PRENOM: profile.prenom,
          EMAIL: profile.email,
          PIN: pin
        }, fromEmail);
      } else if (profile.est_vendeur) {
        await sendBrevoEmail(profile.email, 15, {
          PRENOM: profile.prenom,
          PIN: pin
        }, fromEmail);
      } else if (profile.est_acquereur) {
        await sendBrevoEmail(profile.email, 14, {
          PRENOM: profile.prenom,
          PIN: pin
        }, fromEmail);
      }

      return res.status(200).json({
        success: true,
        message: 'Profil validé et email envoyé'
      });
    } else {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ statut_verifie: false })
        .eq('id', id);

      if (updateError) throw new Error(`Supabase update error: ${updateError.message}`);

      const refusTemplateId = isPro ? 19 : 18;

      await sendBrevoEmail(profile.email, refusTemplateId, {
        PRENOM: profile.prenom
      }, fromEmail);

      return res.status(200).json({
        success: true,
        message: 'Profil refusé et email envoyé'
      });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

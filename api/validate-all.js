import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const brevoApiKey = process.env.BREVO_API_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// URL de l'espace personnel du pro (même page que celle utilisée après connexion
// et dans les autres emails transactionnels du projet)
const ESPACE_PRO_URL = 'https://reliable-crumble-6e286a.netlify.app/espace-alb.html';

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function getFromEmailByType(profile) {
  if (profile.est_vendeur === true) return 'particulier-vendeur@albimmobilier.fr';
  if (profile.est_acquereur === true) return 'particulier-acquereur@albimmobilier.fr';
  if (profile.role === 'courtier') return 'courtier@albimmobilier.fr';
  if (profile.role === 'artisan') return 'artisan@albimmobilier.fr';
  // "immo" regroupe agent immobilier + mandataire (même alias email pour les deux,
  // le détail est dans profile.sous_role_immo)
  if (profile.role === 'immo') return 'agent-immobilier@albimmobilier.fr';
  return 'contact@albimmobilier.fr';
}

function isProProfile(profile) {
  return ['courtier', 'artisan', 'immo'].includes(profile.role);
}

// Libellé humain du rôle, pour le merge tag {{ ROLE }} du template Bienvenue_Pro
function getRoleLabel(profile) {
  if (profile.role === 'courtier') return 'Courtier en immobilier';
  if (profile.role === 'artisan') return 'Artisan';
  if (profile.role === 'immo') {
    return profile.sous_role_immo === 'mandataire' ? 'Mandataire' : 'Agent immobilier';
  }
  return profile.role;
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

    if (!['valider', 'refuser', 'mettre_en_ligne'].includes(action)) {
      return res.status(400).json({ error: 'action doit être "valider", "refuser" ou "mettre_en_ligne"' });
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
        // Étape 2 (après l'appel de validation) : template "INVITE PROFIL PRO" — contient
        // déjà PRENOM/EMAIL/PIN. Le pro peut maintenant se connecter et compléter son
        // espace, mais il n'est pas encore visible sur la vitrine (voir action
        // "mettre_en_ligne" = étape 3, une fois son profil complété).
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
    } else if (action === 'mettre_en_ligne') {
      // Étape 3 : ne concerne que les pros, et seulement ceux déjà validés en étape 2
      if (!isPro) {
        return res.status(400).json({ error: 'La mise en ligne ne concerne que les professionnels' });
      }

      if (profile.statut_verifie !== true) {
        return res.status(400).json({ error: 'Ce profil doit d\'abord être validé par appel (étape 2) avant la mise en ligne' });
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profil_mis_en_ligne: true })
        .eq('id', id);

      if (updateError) throw new Error(`Supabase update error: ${updateError.message}`);

      const zones = Array.isArray(profile.zone_intervention) && profile.zone_intervention.length > 0
        ? profile.zone_intervention.join(', ')
        : 'Non spécifiée';

      // Template "Bienvenue_Pro" — le profil devient visible sur la vitrine publique
      await sendBrevoEmail(profile.email, 17, {
        PRENOM: profile.prenom,
        ROLE: getRoleLabel(profile),
        NOM_ENTREPRISE: profile.nom_entreprise || '',
        ZONES: zones,
        LIEN_PROFIL: ESPACE_PRO_URL,
        LIEN_ESPACE_PERSONNEL: ESPACE_PRO_URL
      }, fromEmail);

      return res.status(200).json({
        success: true,
        message: 'Profil mis en ligne sur la vitrine et email Bienvenue_Pro envoyé'
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

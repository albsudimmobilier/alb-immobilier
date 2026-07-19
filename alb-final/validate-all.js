const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const brevoKey = process.env.BREVO_API_KEY;

/**
 * Helper: Send email via Brevo template
 */
async function sendBrevoEmail(email, templateId, profileData) {
  const payload = {
    to: [{ email }],
    templateId: parseInt(templateId),
    params: {
      prenom: profileData.prenom,
      nom: profileData.nom,
      email: profileData.email,
      entreprise: profileData.nom_entreprise || '',
      siret: profileData.siret || ''
    }
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': brevoKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo error: ${errorText}`);
  }

  return response.json();
}

/**
 * Helper: Determine welcome template ID based on profile type
 * - Particulier vendeur: #15
 * - Particulier acheteur: #14
 * - Professionnels (courtier, artisan, agent, mandataire): #17
 */
function getTemplateIdByType(profile) {
  if (profile.est_vendeur === true) {
    return 15; // Vendeur particulier
  }

  if (profile.est_acquereur === true) {
    return 14; // Acheteur particulier
  }

  if (
    ['courtier', 'agent', 'artisan', 'mandataire'].includes(profile.role)
  ) {
    return 17; // Pro bienvenue
  }

  return null; // Unknown type
}

/**
 * Main handler: Validate or refuse profiles and reviews
 */
exports.handler = async (event) => {
  // Only POST allowed
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request
    const { id, type, action } = JSON.parse(event.body);

    // Validate required fields
    if (!id || !type || !action) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'id, type et action requis' })
      };
    }

    // Validate action values
    if (!['valider', 'refuser'].includes(action)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'action doit être "valider" ou "refuser"'
        })
      };
    }

    // ============================================================
    // VALIDATION DES AVIS (reviews)
    // ============================================================
    if (type === 'avis') {
      if (action === 'valider') {
        // Set review as verified (visible on pro profile)
        const { error: updateError } = await supabase
          .from('avis')
          .update({ verifiee: true })
          .eq('id', id);

        if (updateError) {
          throw new Error(`Supabase update error: ${updateError.message}`);
        }

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: 'Avis validé et visible sur la vitrine du pro'
          })
        };
      } else if (action === 'refuser') {
        // Set review as unverified (hidden)
        const { error: updateError } = await supabase
          .from('avis')
          .update({ verifiee: false })
          .eq('id', id);

        if (updateError) {
          throw new Error(`Supabase update error: ${updateError.message}`);
        }

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: 'Avis refusé et caché'
          })
        };
      }
    }

    // ============================================================
    // VALIDATION DES PROFILS (sellers and professionals)
    // ============================================================
    if (['vendeur', 'pro'].includes(type)) {
      // Step 1: Fetch profile
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !profile) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Profil non trouvé' })
        };
      }

      // ============================================================
      // VALIDER (approve)
      // ============================================================
      if (action === 'valider') {
        // Step 2a: Update profile status to verified
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            statut_verifie: true
          })
          .eq('id', id);

        if (updateError) {
          throw new Error(`Supabase update error: ${updateError.message}`);
        }

        // Step 3a: Determine welcome template and send email
        const templateId = getTemplateIdByType(profile);

        if (!templateId) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Type de profil non reconnu' })
          };
        }

        await sendBrevoEmail(profile.email, templateId, profile);

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: `Profil validé et email de bienvenue envoyé (template ${templateId})`
          })
        };
      }

      // ============================================================
      // REFUSER (refuse)
      // ============================================================
      else if (action === 'refuser') {
        // Step 2b: Update profile status to not verified
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            statut_verifie: false
          })
          .eq('id', id);

        if (updateError) {
          throw new Error(`Supabase update error: ${updateError.message}`);
        }

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: 'Profil refusé (reste en mémoire pour appel ultérieur)'
          })
        };
      }
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const brevoKey = process.env.BREVO_API_KEY;

// Fonction pour envoyer email Brevo
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
    const error = await response.text();
    throw new Error(`Brevo error: ${error}`);
  }

  return response.json();
}

// Fonction pour déterminer le template selon le type de profil
function getTemplateIdByType(profile) {
  if (profile.est_vendeur === true) return 15; // Vendeur particulier
  if (profile.est_acquereur === true) return 14; // Acheteur particulier
  if (['courtier', 'agent', 'artisan', 'mandataire'].includes(profile.role)) return 1; // Pro
  return null;
}

exports.handler = async (event) => {
  // Seulement POST accepté
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { id, type, action } = JSON.parse(event.body);

    if (!id || !type || !action) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'id, type et action requis' })
      };
    }

    if (!['valider', 'refuser'].includes(action)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'action doit être "valider" ou "refuser"' })
      };
    }

    // ===== VALIDATION DES AVIS =====
    if (type === 'avis') {
      if (action === 'valider') {
        const { error: updateError } = await supabase
          .from('avis')
          .update({
            verifiee: true
          })
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
        const { error: updateError } = await supabase
          .from('avis')
          .update({
            verifiee: false
          })
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

    // ===== VALIDATION DES PROFILS (vendeur/pro) =====
    if (['vendeur', 'pro'].includes(type)) {
      // Récupérer le profil
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

      if (action === 'valider') {
        // UPDATE : statut_verfie = true
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            statut_verfie: true,
            status_updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (updateError) {
          throw new Error(`Supabase update error: ${updateError.message}`);
        }

        // Déterminer le template et envoyer l'email
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

      } else if (action === 'refuser') {
        // UPDATE : statut_verfie = false
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            statut_verfie: false,
            status_updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (updateError) {
          throw new Error(`Supabase update error: ${updateError.message}`);
        }

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: 'Profil refusé (reste en mémoire)'
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

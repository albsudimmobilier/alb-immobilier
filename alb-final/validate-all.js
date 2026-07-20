const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const brevoKey = process.env.BREVO_API_KEY;

function getFromEmailByType(profile) {
  if (profile.est_vendeur === true) {
    return 'particulier-vendeur@albimmobilier.fr';
  }
  if (profile.est_acquereur === true) {
    return 'particulier-acquereur@albimmobilier.fr';
  }
  if (profile.role === 'courtier') {
    return 'courtier@albimmobilier.fr';
  }
  if (profile.role === 'artisan') {
    return 'artisan@albimmobilier.fr';
  }
  if (profile.role === 'agent' || profile.role === 'mandataire') {
    return 'agent-immobilier@albimmobilier.fr';
  }
  return 'contact@albimmobilier.fr';
}

async function sendBrevoEmail(email, templateId, profileData, fromEmail) {
  const payload = {
    to: [{ email }],
    from: { email: fromEmail, name: 'ALB Immobilier' },
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

function getTemplateIdByType(profile) {
  if (profile.est_vendeur === true) {
    return 15;
  }
  if (profile.est_acquereur === true) {
    return 14;
  }
  if (['courtier', 'agent', 'artisan', 'mandataire'].includes(profile.role)) {
    return 17;
  }
  return null;
}

exports.handler = async (event) => {
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

    if (type === 'avis') {
      if (action === 'valider') {
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

    if (['vendeur', 'pro'].includes(type)) {
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
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ statut_verifie: true })
          .eq('id', id);

        if (updateError) {
          throw new Error(`Supabase update error: ${updateError.message}`);
        }

        const templateId = getTemplateIdByType(profile);

        if (!templateId) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Type de profil non reconnu' })
          };
        }

        const fromEmail = getFromEmailByType(profile);
        await sendBrevoEmail(profile.email, templateId, profile, fromEmail);

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: `Profil validé et email de bienvenue envoyé (template ${templateId} via ${fromEmail})`
          })
        };
      } else if (action === 'refuser') {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ statut_verifie: false })
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

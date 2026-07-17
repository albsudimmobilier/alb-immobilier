const { createClient } = require('@supabase/supabase-js');
const brevo = require('./lib/brevo');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event) => {
  // Vérifier POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { email, profil, action } = JSON.parse(event.body);

    // Valider les paramètres
    if (!email || !profil || !action) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing parameters' }) };
    }

    if (!['valider', 'refuser'].includes(action)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action' }) };
    }

    // 1. Récupérer le profil en BD
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError || !profile) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Profile not found' }) };
    }

    // 2. Mettre à jour statut_verifie
    const newStatus = action === 'valider' ? true : false;
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ statut_verifie: newStatus })
      .eq('email', email);

    if (updateError) {
      return { statusCode: 500, body: JSON.stringify({ error: updateError.message }) };
    }

    // 3. Envoyer email selon action + profil
    let templateId = null;
    let prenom = profile.prenom || 'Utilisateur';

    if (action === 'valider') {
      if (profil === 'particulier_vendeur') {
        templateId = 16; // Bienvenue_Vendeur
      } else if (['courtier', 'agent-immobilier', 'artisan', 'mandataire'].includes(profil)) {
        templateId = 17; // Bienvenue_Pro
      }
    } else if (action === 'refuser') {
      if (profil === 'particulier_vendeur') {
        templateId = 18; // Refus_Vendeur
      } else if (['courtier', 'agent-immobilier', 'artisan', 'mandataire'].includes(profil)) {
        templateId = 19; // Refus_Pro
      }
    }

    if (!templateId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No template found for this profile type' }) };
    }

    // 4. Déterminer l'alias d'envoi
    let senderEmail = 'contact@albimmobilier.fr';
    if (profil === 'particulier_vendeur') {
      senderEmail = 'particulier-vendeur@albimmobilier.fr';
    } else if (profil === 'courtier') {
      senderEmail = 'courtier@albimmobilier.fr';
    } else if (profil === 'agent-immobilier') {
      senderEmail = 'agent-immobilier@albimmobilier.fr';
    } else if (profil === 'artisan') {
      senderEmail = 'artisan@albimmobilier.fr';
    } else if (profil === 'mandataire') {
      senderEmail = 'agent-immobilier@albimmobilier.fr';
    }

    // 5. Envoyer email via Brevo
    const sendResponse = await brevo.sendTemplateEmail({
      to: email,
      templateId: templateId,
      params: {
        PRENOM: prenom,
        NOM: profile.nom || '',
        EMAIL: email
      },
      senderEmail: senderEmail,
      senderName: 'ALB Immobilier'
    });

    if (!sendResponse.success) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Failed to send email: ' + sendResponse.error }) 
      };
    }

    // 6. Retour succès
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Profil ${action} et email envoyé`,
        email: email,
        profil: profil,
        action: action
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};

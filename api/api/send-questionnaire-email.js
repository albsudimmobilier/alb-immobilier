export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { nom_pro, email_pro, role, siret, zones } = req.body;

  try {
    // Email 1 : Envoyer questionnaire au pro
    await sendBrevoEmail({
      to: email_pro,
      templateName: 'Questionnaire_PRO',
      variables: {
        nom_pro,
      },
    });

    // Email 2 : Notifier Joce
    await sendBrevoEmail({
      to: 'contact@albimmobilier.fr',
      templateName: 'Nouveau_Pro_A_Valider',
      variables: {
        nom_pro,
        email_pro,
        role,
        siret,
        zones: zones.join(', '),
      },
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Emails sent' 
    });
  } catch (error) {
    console.error('Error sending emails:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function sendBrevoEmail({ to, templateName, variables }) {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoUrl = 'https://api.brevo.com/v3/smtp/email';

  const response = await fetch(brevoUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'api-key': brevoApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: [{ email: to }],
      templateId: getTemplateId(templateName),
      params: variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`Brevo error: ${response.statusText}`);
  }

  return response.json();
}

function getTemplateId(templateName) {
  const templates = {
    'Questionnaire_PRO': 1, // À remplacer avec l'ID réel de Brevo
    'Nouveau_Pro_A_Valider': 2, // À remplacer avec l'ID réel de Brevo
  };
  return templates[templateName];
}

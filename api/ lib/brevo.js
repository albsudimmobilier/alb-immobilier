const BREVO_API_URL = 'https://api.brevo.com/v3';

export async function sendBrevoEmail({
  to,
  subject,
  htmlContent,
  textContent = null,
  fromName = 'ALB Immobilier',
  fromEmail = 'contact@albimmobilier.fr',
  apiKey,
}) {
  const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      to: Array.isArray(to) ? to : [{ email: to }],
      from: { email: fromEmail, name: fromName },
      subject,
      htmlContent,
      textContent,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Brevo error: ${error.message || 'Unknown error'}`);
  }

  return response.json();
}

export async function createBrevoContact({
  email,
  firstName = null,
  lastName = null,
  attributes = {},
  listIds = [],
  apiKey,
}) {
  const body = {
    email,
    attributes: {
      PRENOM: firstName,
      NOM: lastName,
      ...attributes,
    },
  };

  if (listIds.length > 0) {
    body.listIds = listIds;
  }

  const response = await fetch(`${BREVO_API_URL}/contacts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    // Si le contact existe déjà, ce n'est pas une erreur
    if (error.code === 'duplicate_parameter') {
      return { message: 'Contact already exists' };
    }
    throw new Error(`Brevo error: ${error.message || 'Unknown error'}`);
  }

  return response.json();
}

export async function updateBrevoContact({
  email,
  attributes = {},
  apiKey,
}) {
  const response = await fetch(`${BREVO_API_URL}/contacts/${email}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({ attributes }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Brevo error: ${error.message || 'Unknown error'}`);
  }

  return response.json();
}

export async function addContactToList({
  email,
  listId,
  apiKey,
}) {
  const response = await fetch(`${BREVO_API_URL}/contacts/lists/${listId}/contacts/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      emails: [email],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Brevo error: ${error.message || 'Unknown error'}`);
  }

  return response.json();
}

// Templates d'emails pré-faits
export const emailTemplates = {
  welcomePro: (prenom, role) => ({
    subject: `Bienvenue sur ALB Immobilier ${prenom} !`,
    htmlContent: `
      <html>
        <body style="font-family: Montserrat, Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4B1A3E; font-size: 28px;">ALB Immobilier</h1>
          </div>
          
          <h2 style="color: #4B1A3E;">Bienvenue ${prenom} ! 🎉</h2>
          <p>Merci de rejoindre le réseau ALB Immobilier.</p>
          
          <p>En tant que ${role}, vous pouvez maintenant :</p>
          <ul>
            <li>Voir les annonces publiées par les particuliers</li>
            <li>Contacter les vendeurs/acheteurs directement</li>
            <li>Gérer vos demandes et projets</li>
            <li>Recevoir des alertes en temps réel</li>
          </ul>
          
          <p><a href="https://albimmobilier.fr/espace-perso" style="background-color: #4B1A3E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accéder à votre espace</a></p>
          
          <hr style="border: none; border-top: 1px solid #E0E0E0; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            © 2026 ALB Immobilier • L'immobilier, remis à l'humain
          </p>
        </body>
      </html>
    `,
  }),

  welcomeParticulier: (prenom) => ({
    subject: `Bienvenue sur ALB Immobilier ${prenom} !`,
    htmlContent: `
      <html>
        <body style="font-family: Montserrat, Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4B1A3E; font-size: 28px;">ALB Immobilier</h1>
          </div>
          
          <h2 style="color: #4B1A3E;">Bienvenue ${prenom} ! 🏠</h2>
          <p>Merci de nous faire confiance pour votre projet immobilier.</p>
          
          <p>Vous pouvez maintenant :</p>
          <ul>
            <li>Publier vos annonces (vente ou location)</li>
            <li>Consulter les professionnels du secteur</li>
            <li>Obtenir des devis et des financement</li>
            <li>Gérer vos demandes facilement</li>
          </ul>
          
          <p><a href="https://albimmobilier.fr/espace-perso" style="background-color: #4B1A3E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accéder à votre espace</a></p>
          
          <hr style="border: none; border-top: 1px solid #E0E0E0; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            © 2026 ALB Immobilier • L'immobilier, remis à l'humain
          </p>
        </body>
      </html>
    `,
  }),
};

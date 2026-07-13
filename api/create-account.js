import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const brevoApiKey = process.env.BREVO_API_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Générer PIN aléatoire
function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Envoyer email de bienvenue
async function sendWelcomeEmail(email, pin, prenom) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': brevoApiKey,
    },
    body: JSON.stringify({
      to: [{ email, name: prenom }],
      from: { email: 'contact@albimmobilier.fr', name: 'ALB Immobilier' },
      subject: 'Bienvenue sur ALB Immobilier!',
      htmlContent: `
        <html>
          <body style="font-family: Montserrat, Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4B1A3E; font-size: 28px;">ALB Immobilier</h1>
            </div>
            
            <div style="background-color: #F5F0EB; padding: 30px; border-radius: 8px;">
              <h2 style="color: #4B1A3E; margin-top: 0;">Bienvenue ${prenom}!</h2>
              <p style="color: #666; margin: 20px 0;">Votre compte ALB Immobilier a été créé avec succès.</p>
              
              <p style="color: #666; margin: 20px 0;">Voici votre code de connexion personnel :</p>
              
              <div style="background-color: #4B1A3E; color: #B28E3D; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 5px;">${pin}</p>
              </div>
              
              <p style="color: #999; font-size: 12px; margin-top: 20px;">⚠️ Ce code est personnel. Ne le partagez avec personne.</p>
              <p style="color: #999; font-size: 12px;">Vous pourrez le modifier dans votre espace personnel après connexion.</p>
            </div>
            
            <div style="margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
              <p>&copy; 2026 ALB Immobilier. Tous droits réservés.</p>
              <p>À la bien, toujours ✨</p>
            </div>
          </body>
        </html>
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Brevo error: ${error.message}`);
  }

  return response.json();
}

// Envoyer email de validation pour les pros
async function sendProValidationEmail(prenom, nom, email, siret, role, zones) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': brevoApiKey,
    },
    body: JSON.stringify({
      to: [{ email: 'contact@albimmobilier.fr', name: 'ALB Immobilier' }],
      from: { email: 'contact@albimmobilier.fr', name: 'ALB Immobilier' },
      subject: `Nouveau pro à valider: ${prenom} ${nom}`,
      htmlContent: `
        <html>
          <body style="font-family: Montserrat, Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Nouveau professionnel en attente de validation</h2>
            <p><strong>Nom :</strong> ${prenom} ${nom}</p>
            <p><strong>Email :</strong> ${email}</p>
            <p><strong>SIRET :</strong> ${siret}</p>
            <p><strong>Rôle :</strong> ${role}</p>
            <p><strong>Zones :</strong> ${zones || 'Non spécifiée'}</p>
            <p><a href="https://supabase.com">Valider dans Supabase</a></p>
          </body>
        </html>
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Brevo error: ${error.message}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prenom, nom, email, telephone, siret, role, zones, profil } = req.body;

    // Validation basique
    if (!prenom || !nom || !email || !profil) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Vérifier que l'email n'existe pas déjà
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingProfile) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    // Générer PIN
    const pin = generatePin();

    // Déterminer statut_verifie
    let statut_verifie = true; // true par défaut pour particuliers
    if (profil === 'pro') {
      statut_verifie = false; // false pour pros (en attente de validation)
    }

    // INSERT dans profiles
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert([
        {
          email,
          prenom,
          nom,
          telephone: telephone || null,
          pin,
          statut_verifie,
          siret: profil === 'pro' ? siret : null,
          role: profil === 'pro' ? role : null,
          zones: profil === 'pro' ? zones : null,
          est_vendeur: profil === 'particulier_vendeur',
          est_acheteur: profil === 'particulier_acheteur',
          est_pro: profil === 'pro',
        },
      ])
      .select('id')
      .single();

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return res.status(500).json({ error: 'Failed to create profile' });
    }

    // Envoyer email de bienvenue
    await sendWelcomeEmail(email, pin, prenom);

    // Si pro : envoyer email de validation à Joce
    if (profil === 'pro') {
      await sendProValidationEmail(prenom, nom, email, siret, role, zones);
    }

    return res.status(200).json({
      success: true,
      message: 'Account created successfully',
      userId: newProfile.id,
      email,
    });

  } catch (error) {
    console.error('Error in create-account:', error);
    return res.status(500).json({
      error: error.message || 'Failed to create account',
    });
  }
}

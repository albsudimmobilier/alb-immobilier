import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const brevoApiKey = process.env.BREVO_API_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Fonction pour envoyer l'email via Brevo
async function sendEmailViaBrevo(email, pin, fullName, isNewUser) {
  const greeting = isNewUser ? 'Bienvenue 🎉' : 'Bonne visite ✨';
  
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': brevoApiKey,
    },
    body: JSON.stringify({
      to: [{ email, name: fullName || email }],
      from: { email: 'contact@albimmobilier.fr', name: 'ALB Immobilier' },
      subject: `Votre code de connexion ALB Immobilier: ${pin}`,
      htmlContent: `
        <html>
        <body style="font-family: Montserrat, Arial; max-width: 680px; margin: 0 auto; padding: 20px;">
        
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4B1A3E; font-size: 28px;">${greeting}</h1>
          <p style="color: #B28E3D; font-size: 14px;">ALB SUD IMMOBILIER</p>
        </div>

        <div style="background-color: #F5F3EE; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
          <p style="color: #666; margin-bottom: 10px;">Votre code de connexion unique:</p>
          <div style="background-color: #4B1A3E; color: #B28E3D; padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin-bottom: 10px;">
            ${pin}
          </div>
          <p style="color: #666; font-size: 12px;">Ce code est personnel. Ne le partagez jamais.</p>
        </div>

        <div style="background-color: #4B1A3E; color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
          <h2 style="margin: 0; font-size: 18px;">Accédez à votre Espace ALB</h2>
          <p style="color: #B28E3D; margin: 10px 0; font-size: 12px;">La plateforme qui donne ENFIN du flow à l'immo ancien.</p>
        </div>

        <div style="background-color: #F9F7F4; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <p style="color: #666; margin: 0; font-size: 12px;"><strong>Comment ça marche ?</strong></p>
          <p style="color: #666; margin: 10px 0; font-size: 12px;">1️⃣ Entrez ce code dans l'application ALB</p>
          <p style="color: #666; margin: 10px 0; font-size: 12px;">2️⃣ Vous accédez à votre compte personnel</p>
          <p style="color: #666; margin: 10px 0; font-size: 12px;">3️⃣ Modifiez votre code PIN dans vos paramètres</p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
          <p style="margin: 0;">À la bien, toujours ✨</p>
          <p style="margin: 5px 0;">© 2026 ALB Sud Immobilier. Tous droits réservés.</p>
          <p style="margin: 5px 0;">contact@albimmobilier.fr · 07 45 60 28 05</p>
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

// Générer PIN 4-chiffres
function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // 1. Vérifier si l'utilisateur existe
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('pin, prenom, nom')
      .eq('email', email)
      .single();

    let pin;
    let isNewUser = false;

    if (fetchError || !profile) {
      // NOUVEL UTILISATEUR: générer un PIN et créer le profil
      isNewUser = true;
      pin = generatePin();
      const { error: createError } = await supabase
        .from('profiles')
        .insert([{ email, pin }]);
      if (createError) {
        return res.status(500).json({ error: 'Failed to create profile' });
      }
    } else if (profile.pin) {
      // UTILISATEUR EXISTANT: utiliser son PIN existant
      pin = profile.pin;
    } else {
      // UTILISATEUR EXISTANT SANS PIN: générer et sauvegarder
      isNewUser = false;
      pin = generatePin();
      await supabase
        .from('profiles')
        .update({ pin })
        .eq('email', email);
    }

    // 2. Envoyer l'email avec le PIN
    const fullName = profile ? `${profile.prenom} ${profile.nom}` : email;
    await sendEmailViaBrevo(email, pin, fullName, isNewUser);

    return res.status(200).json({
      message: 'PIN sent successfully',
      email,
      isNewUser,
    });
  } catch (error) {
    console.error('Error sending PIN:', error);
    return res.status(500).json({
      error: error.message || 'Failed to send PIN',
    });
  }
}

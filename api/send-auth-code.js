import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const brevoApiKey = process.env.BREVO_API_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Générer PIN aléatoire 4 chiffres
function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Envoyer email via Brevo
async function sendEmailViaBrevo(email, pin, userName) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': brevoApiKey,
    },
    body: JSON.stringify({
      to: [{ email, name: userName || email }],
      from: { email: 'contact@albimmobilier.fr', name: 'ALB Immobilier' },
      subject: `Votre code de connexion ALB Immobilier: ${pin}`,
      htmlContent: `
        <html>
          <body style="font-family: Montserrat, Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4B1A3E; font-size: 28px;">ALB Immobilier</h1>
            </div>
            
            <div style="background-color: #F5F0EB; padding: 30px; border-radius: 8px; text-align: center;">
              <h2 style="color: #4B1A3E; margin-top: 0;">Votre code de connexion</h2>
              <p style="color: #666; margin: 20px 0;">Utilisez ce code pour vous connecter à votre compte :</p>
              
              <div style="background-color: #4B1A3E; color: #B28E3D; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 5px;">${pin}</p>
              </div>
              
              <p style="color: #999; font-size: 12px; margin-top: 20px;">Ce code est personnel et ne doit pas être partagé.</p>
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Vérifier que le user existe
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, prenom, nom')
      .eq('email', email)
      .single();

    if (fetchError || !profile) {
      // Ne pas révéler si l'email existe (security)
      return res.status(200).json({
        message: 'Si cet email existe, vous recevrez un code par email',
        email,
      });
    }

    // Générer nouveau PIN
    const newPin = generatePin();

    // UPDATE profiles.pin avec le nouveau PIN
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ pin: newPin })
      .eq('email', email);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return res.status(500).json({ error: 'Failed to generate PIN' });
    }

    // Envoyer email avec le PIN
    const userName = profile.prenom ? `${profile.prenom} ${profile.nom}` : email;
    await sendEmailViaBrevo(email, newPin, userName);

    return res.status(200).json({
      message: 'Code PIN sent successfully',
      email,
    });

  } catch (error) {
    console.error('Error in send-auth-code:', error);
    return res.status(500).json({
      error: error.message || 'Failed to send auth code',
    });
  }
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const brevoApiKey = process.env.BREVO_API_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Générer PIN 4-chiffres
function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Envoyer email via Brevo
async function sendEmailViaBrevo(email, pin, fullName, isNewUser) {
  const greeting = isNewUser ? 'Bienvenue 🎉' : 'Bonne visite ✨';
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Montserrat, Arial, sans-serif; margin: 0; padding: 0; }
    .container { max-width: 680px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #4B1A3E; font-size: 28px; margin: 0; }
    .header p { color: #B28E3D; font-size: 14px; margin: 5px 0 0 0; }
    .pin-box { background-color: #F5F3EE; padding: 30px; border-radius: 8px; text-align: center; margin: 30px 0; }
    .pin-code { background-color: #4B1A3E; color: #B28E3D; padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 15px 0; }
    .pin-info { color: #666; font-size: 12px; }
    .section { background-color: #4B1A3E; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; }
    .section h2 { margin: 0; font-size: 18px; }
    .section p { color: #B28E3D; margin: 10px 0; font-size: 12px; }
    .steps { background-color: #F9F7F4; padding: 20px; border-radius: 8px; margin: 30px 0; }
    .steps p { color: #666; margin: 10px 0; font-size: 12px; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; }
    .footer p { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${greeting}</h1>
      <p>ALB SUD IMMOBILIER</p>
    </div>

    <div class="pin-box">
      <p class="pin-info">Votre code de connexion unique:</p>
      <div class="pin-code">${pin}</div>
      <p class="pin-info">Ce code est personnel. Ne le partagez jamais.</p>
    </div>

    <div class="section">
      <h2>Accédez à votre Espace ALB</h2>
      <p>La plateforme qui donne ENFIN du flow à l'immo ancien.</p>
    </div>

    <div class="steps">
      <p><strong>Comment ça marche ?</strong></p>
      <p>1️⃣ Entrez ce code dans l'application ALB</p>
      <p>2️⃣ Vous accédez à votre compte personnel</p>
      <p>3️⃣ Modifiez votre code PIN dans vos paramètres</p>
    </div>

    <div class="footer">
      <p>À la bien, toujours ✨</p>
      <p>© 2026 ALB Sud Immobilier. Tous droits réservés.</p>
      <p>contact@albimmobilier.fr · 07 45 60 28 05</p>
    </div>
  </div>
</body>
</html>
  `;

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
      htmlContent: htmlContent,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Brevo error: ${error.message}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Vérifier si user existe
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('pin, prenom, nom')
      .eq('email', email)
      .single();

    let pin;
    let isNewUser = false;

    if (fetchError || !profile) {
      // NOUVEL UTILISATEUR
      isNewUser = true;
      pin = generatePin();
      
      const { error: createError } = await supabase
        .from('profiles')
        .insert([{ email, pin }]);
      
      if (createError) {
        return res.status(500).json({ error: 'Failed to create profile' });
      }
    } else {
      // UTILISATEUR EXISTANT
      pin = profile.pin || generatePin();
      
      if (!profile.pin) {
        await supabase
          .from('profiles')
          .update({ pin })
          .eq('email', email);
      }
    }

    // Envoyer email
    const fullName = profile ? `${profile.prenom} ${profile.nom}` : email;
    await sendEmailViaBrevo(email, pin, fullName, isNewUser);

    return res.status(200).json({
      message: 'PIN sent successfully',
      email,
      isNewUser,
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to send PIN',
    });
  }
}

import { createClient } from '@supabase/supabase-js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function sendWelcomeEmail(email, pin, prenom, brevoApiKey) {
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
    const raw = await response.text();
    throw new Error(`Brevo error: ${raw}`);
  }

  return response.json();
}

async function sendProValidationEmail(prenom, nom, email, siret, role, zones, brevoApiKey) {
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
            <p><strong>Prénom :</strong> ${prenom}</p>
            <p><strong>Nom :</strong> ${nom}</p>
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
    const raw = await response.text();
    throw new Error(`Brevo error: ${raw}`);
  }

  return response.json();
}

export default async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ error: 'Missing Supabase environment variables' }, 500);
    }

    if (!brevoApiKey) {
      return json({ error: 'Missing BREVO_API_KEY' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();

    const { prenom, nom, email, telephone, siret, role, zones, profil } = body;

    if (!prenom || !nom || !email || !profil) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const { data: existingProfile, error: existingError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingError) {
      return json({ error: existingError.message }, 500);
    }

    if (existingProfile) {
      return json({ error: 'Cet email est déjà utilisé' }, 409);
    }

    const pin = generatePin();
    const statut_verifie = profil === 'pro' ? false : true;

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert([
        {
          email,
          telephone: telephone || null,
          pin,
          statut_verifie,
          siret: profil === 'pro' ? siret : null,
          role: profil === 'pro' ? role : null,
          zones: profil === 'pro' ? zones : null
        },
      ])
      .select('id')
      .single();

    if (insertError) {
      return json({ error: insertError.message || 'Failed to create profile' }, 500);
    }

    await sendWelcomeEmail(email, pin, prenom, brevoApiKey);

    if (profil === 'pro') {
      await sendProValidationEmail(prenom, nom, email, siret, role, zones, brevoApiKey);
    }

    return json({
      success: true,
      message: 'Account created successfully',
      userId: newProfile.id,
      email,
    }, 200);
  } catch (error) {
    return json({ error: error.message || 'Failed to create account' }, 500);
  }
};

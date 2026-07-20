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

function isProProfile(profil) {
  return ['agent', 'courtier', 'artisan', 'mandataire'].includes(profil);
}

function getFromEmail(profil) {
  if (profil === 'particulier_vendeur') {
    return 'particulier-vendeur@albimmobilier.fr';
  }
  if (profil === 'particulier_acquereur') {
    return 'particulier-acquereur@albimmobilier.fr';
  }
  if (profil === 'courtier') {
    return 'courtier@albimmobilier.fr';
  }
  if (profil === 'artisan') {
    return 'artisan@albimmobilier.fr';
  }
  if (profil === 'agent' || profil === 'mandataire') {
    return 'agent-immobilier@albimmobilier.fr';
  }
  return 'contact@albimmobilier.fr';
}

async function sendWelcomeTemplate(email, pin, prenom, templateId, fromEmail, brevoApiKey) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': brevoApiKey
    },
    body: JSON.stringify({
      to: [{ email, name: prenom }],
      from: { email: fromEmail, name: 'ALB Immobilier' },
      templateId: templateId,
      params: {
        PRENOM: prenom,
        PIN: pin
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo error: ${errorText}`);
  }

  return response.json();
}

async function sendProNotificationToJoce(prenom, nom, email, siret, role, zones, brevoApiKey) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': brevoApiKey
    },
    body: JSON.stringify({
      to: [{ email: 'contact@albimmobilier.fr', name: 'ALB Immobilier' }],
      from: { email: 'contact@albimmobilier.fr', name: 'ALB Immobilier' },
      templateId: 2,
      params: {
        PRENOM: prenom,
        NOM: nom,
        EMAIL: email,
        SIRET: siret || 'Non renseigné',
        ROLE: role,
        ZONES: zones || 'Non spécifiée'
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo error: ${errorText}`);
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
    const { prenom, nom, email, telephone, siret, zones, profil } = body;

    if (!prenom || !nom || !email || !telephone || !profil) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const isPro = isProProfile(profil);

    if (isPro && !siret) {
      return json({ error: 'Le SIRET est obligatoire pour les professionnels' }, 400);
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
    const tempPassword = crypto.randomUUID();
    const statut_verifie = profil === 'particulier_acquereur' ? true : false;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        prenom,
        nom,
        profil
      }
    });

    if (authError || !authData?.user?.id) {
      return json({ error: authError?.message || 'Failed to create auth user' }, 500);
    }

    const userId = authData.user.id;

    const profileData = {
      id: userId,
      prenom,
      nom,
      email,
      telephone: telephone || null,
      pin,
      siret: isPro ? siret : null,
      role: profil,
      statut_verifie,
      zone_intervention: zones ? [zones] : null
    };

    if (!isPro) {
      profileData.est_acquereur = profil === 'particulier_acquereur';
      profileData.est_vendeur = profil === 'particulier_vendeur';
    }

    const { error: profileInsertError } = await supabase
      .from('profiles')
      .insert(profileData);

    if (profileInsertError) {
      return json({ error: profileInsertError.message || 'Failed to create profile' }, 500);
    }

    try {
      const fromEmail = getFromEmail(profil);

      if (isPro) {
        await sendWelcomeTemplate(email, pin, prenom, 1, fromEmail, brevoApiKey);
        await sendProNotificationToJoce(prenom, nom, email, siret, profil, zones, brevoApiKey);
      } else if (profil === 'particulier_acquereur') {
        await sendWelcomeTemplate(email, pin, prenom, 14, fromEmail, brevoApiKey);
      } else if (profil === 'particulier_vendeur') {
        await sendWelcomeTemplate(email, pin, prenom, 15, fromEmail, brevoApiKey);
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);
    }

    return json({ success: true, message: 'Account created successfully', userId, email, profil }, 200);
  } catch (error) {
    return json({ error: error.message || 'Failed to create account' }, 500);
  }
};

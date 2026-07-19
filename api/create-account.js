import { createClient } from '@supabase/supabase-js';

/**
 * Helper: JSON response formatter
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Helper: Generate 4-digit PIN
 */
function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Helper: Check if profile is a professional
 */
function isProProfile(profil) {
  return ['agent', 'courtier', 'artisan', 'mandataire'].includes(profil);
}

/**
 * Helper: Get email alias for pro notification
 */
function getProEmail(profil) {
  switch (profil) {
    case 'courtier':
      return 'courtier@albimmobilier.fr';
    case 'artisan':
      return 'artisan@albimmobilier.fr';
    case 'agent':
    case 'mandataire':
      return 'agent-immobilier@albimmobilier.fr';
    default:
      return 'contact@albimmobilier.fr';
  }
}

/**
 * Helper: Send welcome email via Brevo template
 */
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

/**
 * Helper: Send pro registration notification to Joce
 */
async function sendProNotificationToJoce(
  prenom,
  nom,
  email,
  siret,
  role,
  zones,
  brevoApiKey
) {
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

/**
 * Main handler: Create account (auth + profile)
 */
export default async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // Get environment variables
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

    // Parse request body
    const body = await req.json();
    const { prenom, nom, email, telephone, siret, zones, profil } = body;

    // Validate required fields
    if (!prenom || !nom || !email || !telephone || !profil) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const isPro = isProProfile(profil);

    // SIRET is mandatory for professionals
    if (isPro && !siret) {
      return json(
        { error: 'Le SIRET est obligatoire pour les professionnels' },
        400
      );
    }

    // Check if email already exists
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

    // Generate PIN and temp password
    const pin = generatePin();
    const tempPassword = crypto.randomUUID();

    // Determine if profile should be auto-verified (only acheteur)
    const statut_verifie = profil === 'particulier_acquereur' ? true : false;

    // Step 1: Create auth user
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
      return json(
        { error: authError?.message || 'Failed to create auth user' },
        500
      );
    }

    const userId = authData.user.id;

    // Step 2: Build profile data based on type
    const profileData = {
      id: userId, // Link to auth user
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

    // Add particulier-specific fields
    if (!isPro) {
      profileData.est_acquereur = profil === 'particulier_acquereur';
      profileData.est_vendeur = profil === 'particulier_vendeur';
    }

    // Step 3: Insert profile (CREATE new row, not update)
    const { error: profileInsertError } = await supabase
      .from('profiles')
      .insert(profileData);

    if (profileInsertError) {
      return json(
        { error: profileInsertError.message || 'Failed to create profile' },
        500
      );
    }

    // Step 4: Send emails based on profile type
    try {
      if (isPro) {
        // PRO: Send template #1 (questionnaire) + notify Joce
        const proEmail = getProEmail(profil);
        await sendWelcomeTemplate(
          email,
          pin,
          prenom,
          1,
          proEmail,
          brevoApiKey
        );
        await sendProNotificationToJoce(
          prenom,
          nom,
          email,
          siret,
          profil,
          zones,
          brevoApiKey
        );
      } else if (profil === 'particulier_acquereur') {
        // ACHETEUR: Send template #14 (welcome buyer)
        await sendWelcomeTemplate(
          email,
          pin,
          prenom,
          14,
          'particulier-acquereur@albimmobilier.fr',
          brevoApiKey
        );
      } else if (profil === 'particulier_vendeur') {
        // VENDEUR: Send template #15 (welcome seller)
        await sendWelcomeTemplate(
          email,
          pin,
          prenom,
          15,
          'particulier-vendeur@albimmobilier.fr',
          brevoApiKey
        );
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Continue even if email fails - account is already created
    }

    return json(
      {
        success: true,
        message: 'Account created successfully',
        userId,
        email,
        profil
      },
      200
    );
  } catch (error) {
    return json(
      { error: error.message || 'Failed to create account' },
      500
    );
  }
};

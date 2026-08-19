import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

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

function mapToDbRole(profil) {
  if (profil === 'agent' || profil === 'mandataire') return 'immo';
  if (profil === 'particulier_acquereur' || profil === 'particulier_acheteur' || profil === 'particulier_vendeur') {
    return 'particulier';
  }
  return profil; // courtier, artisan
}

// Toujours utiliser contact@albimmobilier.fr comme sender (seule adresse DKIM certifiée)
function getFromEmail() {
  return 'contact@albimmobilier.fr';
}

// 🔧 CORRIGÉ : Variables minuscules pour correspondre aux templates Brevo
async function sendWelcomeTemplate(email, pin, prenom, templateId, brevoApiKey) {
  console.log(`[ALB DEBUG] Envoi template #${templateId} à ${email}`);

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': brevoApiKey
    },
    body: JSON.stringify({
      to: [{ email, name: prenom }],
      from: { email: 'contact@albimmobilier.fr', name: 'ALB Immobilier' },
      templateId: templateId,
      params: {
        prenom: prenom,
        pin: pin
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ALB ERROR] Brevo template #${templateId} failed: ${errorText}`);
    throw new Error(`Brevo error: ${errorText}`);
  }

  console.log(`[ALB DEBUG] Template #${templateId} envoyé avec succès à ${email}`);
  return response.json();
}

// 🔧 CORRIGÉ : Envoyer depuis contact@albimmobilier.fr + variables minuscules
async function sendProNotificationToJoce(prenom, nom, email, siret, role, zones, brevoApiKey) {
  console.log(`[ALB DEBUG] Envoi template #2 (Nouveau PRO) à Joce pour ${nom} (${role})`);

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
        prenom: prenom,
        nom: nom,
        email: email,
        siret: siret || 'Non renseigné',
        role: role,
        zones: zones || 'Non spécifiée'
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ALB ERROR] Brevo template #2 failed: ${errorText}`);
    throw new Error(`Brevo error: ${errorText}`);
  }

  console.log(`[ALB DEBUG] Template #2 envoyé à Joce`);
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
    const { prenom, nom, email, telephone, siret, zones, profil, profession } = body;

    console.log('[ALB DEBUG] Inscription reçue:', { prenom, nom, siret, profil, email });

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
      console.error('[ALB ERROR] Check existing profile failed:', existingError);
      return json({ error: existingError.message }, 500);
    }

    if (existingProfile) {
      return json({ error: 'Cet email est déjà utilisé' }, 409);
    }

    const pin = generatePin();
    const tempPassword = randomUUID();
    const isAcquereur = profil === 'particulier_acquereur' || profil === 'particulier_acheteur';
    const statut_verifie = isAcquereur ? true : false;

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
      console.error('[ALB ERROR] Auth creation failed:', authError);
      return json({ error: authError?.message || 'Failed to create auth user' }, 500);
    }

    const userId = authData.user.id;
    console.log(`[ALB DEBUG] Auth user créé: ${userId}`);

    const profileData = {
      id: userId,
      prenom,
      nom,
      email,
      telephone: telephone || null,
      pin,
      siret: isPro ? siret : null,
      role: mapToDbRole(profil),
      statut_verifie,
      zone_intervention: zones ? [zones] : null
    };

    if (isPro && (profil === 'agent' || profil === 'mandataire')) {
      profileData.sous_role_immo = profil;
    }

    if (isPro && profil === 'artisan' && Array.isArray(profession) && profession.length > 0) {
      profileData.profession = profession;
    }

    if (!isPro) {
      profileData.est_acquereur = isAcquereur;
      profileData.est_vendeur = profil === 'particulier_vendeur';
    }

    console.log('[ALB DEBUG] Profil à insérer:', profileData);

    const { error: profileInsertError } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' });

    if (profileInsertError) {
      console.error('[ALB ERROR] Insert profile failed:', profileInsertError);
      return json({ error: profileInsertError.message || 'Failed to create profile' }, 500);
    }

    console.log('[ALB DEBUG] Profil inséré avec succès');

    // 🔧 Envoi d'emails avec gestion d'erreur améliorée
    try {
      if (isPro) {
        // Template #1 : Questionnaire PRO au pro
        await sendWelcomeTemplate(email, pin, prenom, 1, brevoApiKey);

        // Template #2 : Nouveau PRO À Valider à Joce
        await sendProNotificationToJoce(prenom, nom, email, siret, profil, zones, brevoApiKey);
      } else if (isAcquereur) {
        // Template #14 : Bienvenue Acheteur
        await sendWelcomeTemplate(email, pin, prenom, 14, brevoApiKey);
      } else if (profil === 'particulier_vendeur') {
        // Template #15 : Inscription Vendeur
        await sendWelcomeTemplate(email, pin, prenom, 15, brevoApiKey);
      }
      console.log('[ALB DEBUG] Tous les emails envoyés avec succès');
    } catch (emailError) {
      console.error('[ALB ERROR] Email sending failed:', emailError.message);
      // ⚠️ On continue même si l'email échoue (le profil est créé)
      // Joce pourra renvoyer manuellement depuis Brevo si besoin
    }

    return json({ success: true, message: 'Account created successfully', userId, email, profil, pin }, 200);
  } catch (error) {
    console.error('[ALB ERROR] Fatal error:', error);
    return json({ error: error.message || 'Failed to create account' }, 500);
  }
};

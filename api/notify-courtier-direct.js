import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Formater la réponse JSON
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Générer un PIN aléatoire à 4 chiffres
 */
function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Trouver ou créer un profil particulier
 * @returns { id, pin, isNew }
 *   - id: UUID du profil Supabase
 *   - pin: Code PIN généré (null si profil existant)
 *   - isNew: true si profil vient d'être créé, false sinon
 */
async function findOrCreateParticulier({ nom, prenom, email, telephone, codePostal, objectif }) {
  // Chercher si le profil existe déjà
  const { data: existing, error: findError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (findError) throw new Error(findError.message);

  // Profil trouvé : le retourner sans créer de PIN
  if (existing) {
    return { id: existing.id, pin: null, isNew: false };
  }

  // Profil inexistant : générer un PIN et créer le profil
  const pin = generatePin();
  const { data: created, error: createError } = await supabase
    .from('profiles')
    .insert([{
      prenom,
      nom,
      email,
      telephone,
      code_postal: codePostal,
      role: 'particulier',
      est_acquereur: objectif !== 'renovation',
      pin,
    }])
    .select('id')
    .single();

  if (createError) throw new Error(createError.message);

  return { id: created.id, pin, isNew: true };
}

/**
 * Envoyer un email au particulier avec son PIN (template #14 Bienvenue_Acheteur)
 */
async function sendPinToParticulier(email, prenom, pin) {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: [{ email, name: prenom }],
        templateId: 14, // Bienvenue_Acheteur
        params: { prenom, pin }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brevo error: ${errorText}`);
    }

    console.log(`[ALB DEBUG] PIN envoyé au particulier ${email} via template #14`);
  } catch (error) {
    console.error(`[ALB ERROR] Échec envoi PIN: ${error.message}`);
    // Continuer même si l'email échoue - le profil est déjà créé
  }
}

/**
 * Envoyer une alerte au courtier de la nouvelle demande (template #8)
 */
async function sendAlertToCourtier(courtier, particulier, infos) {
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: [{
          email: courtier.email,
          name: `${courtier.prenom || ''} ${courtier.nom || ''}`.trim()
        }],
        templateId: 8, // Alerte demande financement
        params: {
          COURTIER_PRENOM: courtier.prenom || '',
          CLIENT_NOM: particulier.nom,
          CLIENT_PRENOM: particulier.prenom,
          CLIENT_EMAIL: particulier.email,
          CLIENT_TEL: particulier.telephone,
          CLIENT_CP: particulier.code_postal,
          BUDGET_MAX: infos.budget_max_declare.toLocaleString('fr-FR'),
          ENDDETTEMENT: infos.endettement_ratio.toFixed(1),
          MENSUALITE: infos.mensualite_totale.toLocaleString('fr-FR'),
          MODE: infos.mode,
          SENDER: 'ALB Sud Immobilier'
        }
      })
    });

    console.log(`[ALB DEBUG] Alerte envoyée au courtier ${courtier.email}`);
  } catch (error) {
    console.error(`[ALB ERROR] Échec envoi alerte courtier: ${error.message}`);
  }
}

/**
 * Handler principal pour créer une demande de financement
 */
export default async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const { courtier_ids = [], demande = {}, mode = 'direct' } = await req.json();

    // Extraire et nettoyer les données du particulier
    const nom = demande.nom?.trim() || '';
    const prenom = demande.prenom?.trim() || '';
    const email = demande.email?.trim() || '';
    const telephone = demande.tel?.trim() || demande.telephone?.trim() || '';
    const codePostal = demande.cp?.trim() || demande.codePostal?.trim() || '';

    // Email obligatoire
    if (!email) {
      return json({ error: 'Email requis' }, 400);
    }

    // Trouver ou créer le profil particulier
    const objectif = demande.objectif || 'achat';
    const { id: particulierId, pin: pinParticulier, isNew: isNewProfile } =
      await findOrCreateParticulier({ nom, prenom, email, telephone, codePostal, objectif });

    // Préparer les informations de la demande
    const infos = {
      nom,
      prenom,
      email,
      telephone,
      code_postal: codePostal,
      revenus_mensuels: Number(demande.revenus_mensuels ?? demande.revenus ?? 0),
      charges_mensuelles: Number(demande.charges_mensuelles ?? demande.charges ?? 0),
      apport: Number(demande.apport ?? 0),
      duree_emprunt: Number(demande.duree_emprunt ?? demande.duree ?? 25),
      objectif,
      budget_max_declare: Number(demande.budget_max_declare ?? demande.budget_max ?? 0),
      endettement_ratio: Number(demande.endettement_ratio ?? demande.endettement ?? 0),
      mensualite_totale: Number(demande.mensualite_totale ?? demande.mensualite ?? 0),
      montant_emprunt: Number(demande.montant_emprunt ?? demande.emprunt ?? 0),
      pieces_cochees: Array.isArray(demande.pieces_cochees) ? demande.pieces_cochees : [],
      mode,
      consentement_recontact: Boolean(demande.consentement_recontact ?? false),
      courtiers_selectionnes: Array.isArray(courtier_ids) ? courtier_ids.filter(Boolean) : [],
    };

    // Prendre le premier courtier sélectionné
    const premierCourtierId = infos.courtiers_selectionnes[0] || null;

    // Créer la demande de financement
    const { data: insertedRows, error: insertError } = await supabase
      .from('demandes_financement')
      .insert([{
        particulier_id: particulierId,
        origine: 'projet_financier',
        infos,
        courtier_assigne_id: premierCourtierId,
        statut: 'nouvelle',
      }])
      .select('*');

    if (insertError) {
      console.error('[ALB ERROR] Supabase insert error:', insertError);
      return json({ error: insertError.message }, 500);
    }

    const demandeCreated = insertedRows?.[0];

    // ===== ÉTAPE 1B : Envoyer le PIN au particulier si profil nouvellement créé =====
    if (isNewProfile && pinParticulier) {
      await sendPinToParticulier(email, prenom, pinParticulier);
    }

    // ===== Envoyer les alertes aux courtiers sélectionnés =====
    if (infos.courtiers_selectionnes.length > 0) {
      const { data: courtiers } = await supabase
        .from('profiles')
        .select('id, email, prenom, nom')
        .in('id', infos.courtiers_selectionnes);

      for (const courtier of courtiers || []) {
        if (!courtier?.email) continue;
        await sendAlertToCourtier(courtier, { nom, prenom, email, telephone, code_postal: codePostal }, infos);
      }
    }

    // Retourner la demande créée
    return json({ success: true, demand: demandeCreated }, 200);

  } catch (err) {
    console.error('[ALB ERROR] notify-courtier-direct error:', err);
    return json({ error: err.message || 'Internal server error' }, 500);
  }
};

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Constantes validation fichiers
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200 MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime',
  'application/pdf'
];

/**
 * Formater réponse JSON
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Trouver ou créer profil particulier
 */
async function findOrCreateParticulier({ nom, prenom, email, telephone, codePostal }) {
  const { data: existing, error: findError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (findError) throw new Error(findError.message);

  if (existing) {
    return { id: existing.id, isNew: false };
  }

  const { data: created, error: createError } = await supabase
    .from('profiles')
    .insert([{
      prenom,
      nom,
      email,
      telephone,
      code_postal: codePostal,
      role: 'particulier',
      est_acquereur: true,
    }])
    .select('id')
    .single();

  if (createError) throw new Error(createError.message);

  return { id: created.id, isNew: true };
}

/**
 * Valider et uploader fichiers vers Supabase Storage
 * Retourne array: [{ name, path, size, signedUrl, expiresAt }]
 */
async function uploadFilesToStorage(files, particulierId) {
  const uploadedFiles = [];
  let totalSize = 0;

  for (const file of files || []) {
    // Valider taille fichier
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Fichier ${file.name} dépasse 50 MB`);
    }

    totalSize += file.size;
    if (totalSize > MAX_TOTAL_SIZE) {
      throw new Error('Taille totale des fichiers dépasse 200 MB');
    }

    // Valider type MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(`Type fichier non autorisé: ${file.name}`);
    }

    // Générer chemin sécurisé: projets_travaux/{particulierId}/{timestamp}_{nomFichier}
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `projets_travaux/${particulierId}/${timestamp}_${sanitizedName}`;

    // Upload vers Storage (bucket privé)
    const { error: uploadError } = await supabase.storage
      .from('projets-travaux-files')
      .upload(filePath, file, {
        upsert: false,
        contentType: file.type,
        metadata: {
          particulierId,
          uploadedAt: new Date().toISOString(),
          originalName: file.name
        }
      });

    if (uploadError) {
      console.error(`[ALB ERROR] Upload failed for ${file.name}:`, uploadError);
      throw new Error(`Échec upload fichier: ${file.name}`);
    }

    // Générer signed URL (15 minutes d'expiration)
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from('projets-travaux-files')
      .createSignedUrl(filePath, 900); // 900 = 15 minutes

    if (urlError) {
      console.error(`[ALB ERROR] Signed URL failed for ${file.name}:`, urlError);
      throw new Error(`Échec génération URL fichier: ${file.name}`);
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    uploadedFiles.push({
      name: file.name,
      path: filePath,
      size: file.size,
      mimeType: file.type,
      signedUrl: signedUrl.signedUrl,
      expiresAt
    });

    console.log(`[ALB DEBUG] Fichier uploadé: ${file.name} (${file.size} bytes) -> ${filePath}`);
  }

  return uploadedFiles;
}

/**
 * Insérer références fichiers dans projets_travaux_files table
 */
async function insertFileReferences(projectId, particulierId, uploadedFiles) {
  if (!uploadedFiles || uploadedFiles.length === 0) return [];

  const fileRecords = uploadedFiles.map(f => ({
    projet_id: projectId,
    particulier_id: particulierId,
    file_path: f.path,
    file_name: f.name,
    file_size: f.size,
    mime_type: f.mimeType,
    signed_url: f.signedUrl,
    signed_url_expires_at: f.expiresAt
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('projets_travaux_files')
    .insert(fileRecords)
    .select('*');

  if (insertError) {
    console.error('[ALB ERROR] Insert file references error:', insertError);
    throw new Error(`Échec sauvegarde références fichiers: ${insertError.message}`);
  }

  console.log(`[ALB DEBUG] ${inserted.length} références fichiers insérées`);
  return inserted;
}

/**
 * Envoyer alerte aux artisans (template #9)
 */
async function sendAlertToArtisans(artisans, particulier, infos, uploadedFiles) {
  try {
    for (const artisan of artisans || []) {
      if (!artisan?.email) continue;

      // Description tronquée + note fichiers
      let description = infos.description.substring(0, 200);
      if (uploadedFiles && uploadedFiles.length > 0) {
        description += `\n\nFichiers joints: ${uploadedFiles.length}`;
      }

      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: [{
            email: artisan.email,
            name: `${artisan.prenom || ''} ${artisan.nom || ''}`.trim()
          }],
          templateId: 9, // Alerte demande travaux
          params: {
            ARTISAN_PRENOM: artisan.prenom || '',
            CLIENT_NOM: particulier.nom,
            CLIENT_PRENOM: particulier.prenom,
            CLIENT_EMAIL: particulier.email,
            CLIENT_TEL: particulier.telephone,
            CLIENT_CP: particulier.code_postal,
            CLIENT_LOCALISATION: infos.localisation,
            BUDGET: infos.budget.toLocaleString('fr-FR'),
            DESCRIPTION: description,
            DELAI: infos.delai,
            FICHIERS_COUNT: uploadedFiles ? uploadedFiles.length : 0,
            SENDER: 'ALB Sud Immobilier'
          }
        })
      });

      console.log(`[ALB DEBUG] Alerte travaux envoyée à ${artisan.email}`);
    }
  } catch (error) {
    console.error(`[ALB ERROR] Échec envoi alerte artisans: ${error.message}`);
  }
}

/**
 * Handler principal: créer demande travaux + upload fichiers + RLS
 */
export default async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // Parser FormData (Netlify gère auto)
    const formData = await req.formData();

    // Extraire champs formulaire
    const nom = formData.get('nom')?.trim() || '';
    const prenom = formData.get('prenom')?.trim() || '';
    const email = formData.get('email')?.trim() || '';
    const telephone = formData.get('telephone')?.trim() || '';
    const codePostal = formData.get('codePostal')?.trim() || '';
    const localisation = formData.get('localisation')?.trim() || '';
    const description = formData.get('description')?.trim() || '';
    const budget = Number(formData.get('budget') ?? 0);
    const delai = formData.get('delai') || 'moyen';
    const corpsMetier = formData.get('corps_metier') || '';

    // Extraire fichiers (nommés file_0, file_1, etc.)
    const files = [];
    let i = 0;
    while (formData.has(`file_${i}`)) {
      const file = formData.get(`file_${i}`);
      if (file instanceof File) {
        files.push(file);
      }
      i++;
    }

    // Valider champs obligatoires
    if (!email) return json({ error: 'Email requis' }, 400);
    if (!telephone) return json({ error: 'Téléphone requis' }, 400);
    if (!corpsMetier) return json({ error: 'Corps de métier requis' }, 400);

    // Trouver ou créer profil particulier
    const { id: particulierId, isNew: isNewProfile } =
      await findOrCreateParticulier({ nom, prenom, email, telephone, codePostal });

    console.log(`[ALB DEBUG] Particulier ${isNewProfile ? 'créé' : 'trouvé'}: ${particulierId}`);

    // Upload fichiers (si présents)
    let uploadedFiles = [];
    if (files.length > 0) {
      uploadedFiles = await uploadFilesToStorage(files, particulierId);
      console.log(`[ALB DEBUG] ${uploadedFiles.length} fichiers uploadés`);
    }

    // Préparer infos demande (sans les URLs signées — elles sont dans projets_travaux_files)
    const infos = {
      nom,
      prenom,
      email,
      telephone,
      code_postal: codePostal,
      localisation,
      description,
      budget,
      delai,
      corps_metier: corpsMetier,
      consentement_recontact: true,
      file_count: uploadedFiles.length
    };

    // Créer demande travaux
    const { data: insertedRows, error: insertError } = await supabase
      .from('projets_travaux')
      .insert([{
        particulier_id: particulierId,
        origine: 'formulaire_interactif',
        infos,
        statut: 'nouvelle',
        corps_metier_recherches: [corpsMetier],
      }])
      .select('*');

    if (insertError) {
      console.error('[ALB ERROR] Supabase insert error:', insertError);
      return json({ error: insertError.message }, 500);
    }

    const projetCreated = insertedRows?.[0];
    console.log(`[ALB DEBUG] Demande travaux créée: ${projetCreated?.id}`);

    // Insérer références fichiers dans projets_travaux_files (RLS protégé)
    if (uploadedFiles.length > 0) {
      await insertFileReferences(projetCreated.id, particulierId, uploadedFiles);
    }

    // Récupérer artisans avec ce corps_metier (version abstraite)
    const { data: artisans, error: artisansError } = await supabase
      .from('profiles')
      .select('id, email, prenom, nom')
      .eq('role', 'artisan')
      .eq('corps_metier', corpsMetier);

    if (artisansError) {
      console.error('[ALB ERROR] Fetch artisans error:', artisansError);
    }

    // Envoyer alertes artisans
    if (artisans && artisans.length > 0) {
      await sendAlertToArtisans(artisans, { nom, prenom, email, telephone, code_postal: codePostal }, infos, uploadedFiles);
      console.log(`[ALB DEBUG] ${artisans.length} artisans alertés`);
    } else {
      console.log(`[ALB DEBUG] Aucun artisan trouvé pour ${corpsMetier}`);
    }

    return json({ success: true, project: projetCreated }, 200);

  } catch (err) {
    console.error('[ALB ERROR] notify-artisans error:', err);
    return json({ error: err.message || 'Internal server error' }, 500);
  }
};

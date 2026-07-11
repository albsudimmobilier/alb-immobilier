// Client Supabase partagé par toutes les pages d'ALB Immobilier.
// Utilise uniquement la clé "publishable" (publique) : protégée par les
// règles RLS posées côté Supabase, jamais la clé secrète ici.

const SUPABASE_URL = "https://kutbxyinpokebjdemlnq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_wXbJu1TP2jZ05TcuMOut9Q_NcumnpIQ";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// ========== FONCTIONS RÉUTILISABLES ==========

async function albFetchPros(filters = {}) {
  let query = supabaseClient.from('profils_publics').select('*');
  if (filters.role) query = query.eq('role', filters.role);
  if (filters.zone) query = query.contains('zone_intervention', [filters.zone]);
  const { data, error } = await query.order('date_creation', { ascending: false });
  return { data, error };
}

async function albFetchAvisForPro(proId) {
  const { data, error } = await supabaseClient
    .from('avis')
    .select('id, auteur_id, note, commentaire, date_creation, statut_moderation')
    .eq('profil_note_id', proId)
    .eq('statut_moderation', 'approuvé')
    .order('date_creation', { ascending: false });
  return { data, error };
}

function albCalculateBadges(avis) {
  if (!avis || avis.length === 0) return { moyenne: null, count: 0, hasAlbBadge: false };
  const notes = avis.map(a => a.note);
  const moyenne = notes.reduce((s, n) => s + n, 0) / notes.length;
  const hasAlbBadge = moyenne >= 4.5 && avis.length >= 5;
  return { moyenne: parseFloat(moyenne.toFixed(1)), count: avis.length, hasAlbBadge };
}

async function albUploadPhoto(userId, file) {
  if (!file) return { error: { message: "Aucun fichier sélectionné" } };
  const filename = `${userId}-${Date.now()}.jpg`;
  const { data, error } = await supabaseClient.storage.from('pro-photos').upload(filename, file, { upsert: true });
  if (error) return { error };
  const { data: publicUrl } = supabaseClient.storage.from('pro-photos').getPublicUrl(filename);
  return { data: publicUrl.publicUrl, error: null };
}

async function albUpdateProfilePhoto(userId, photoUrl) {
  const { error } = await supabaseClient.from('profiles').update({ photo_url: photoUrl }).eq('id', userId);
  return { error };
}

async function albSubmitAvis(proId, note, commentaire) {
  if (!albUser) return { error: { message: "Non connecté" } };
  const { data, error } = await supabaseClient.from('avis').upsert({
    profil_note_id: proId, auteur_id: albUser.id, note,
    commentaire: commentaire || null, statut_moderation: 'en_attente',
    date_creation: new Date().toISOString()
  }, { onConflict: 'profil_note_id,auteur_id' });
  return { data, error };
}

async function albCreateDemandReleve(proProposantId, proProposéId) {
  const { data, error } = await supabaseClient.from('demandes_releve').insert({
    pro_proposant_id: proProposantId, pro_proposé_id: proProposéId, statut: 'en_attente'
  });
  return { data, error };
}

async function albFetchDemandesReleve(proId, statut = null) {
  let query = supabaseClient.from('demandes_releve').select('*').eq('pro_proposé_id', proId);
  if (statut) query = query.eq('statut', statut);
  const { data, error } = await query.order('created_at', { ascending: false });
  return { data, error };
}

async function albUpdateDemandReleve(demandeId, newStatut) {
  const { error } = await supabaseClient.from('demandes_releve')
    .update({ statut: newStatut, updated_at: new Date().toISOString() }).eq('id', demandeId);
  return { error };
}

async function albFetchProDetail(proId) {
  const { data: pro, error: proError } = await supabaseClient.from('profils_publics').select('*').eq('id', proId).single();
  if (proError) return { error: proError };
  const { data: avis, error: avisError } = await albFetchAvisForPro(proId);
  if (avisError) return { error: avisError };
  const badges = albCalculateBadges(avis);
  return { pro, avis: avis || [], badges };
}

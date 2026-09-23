// ============================================================
// alb-connexion.js — Connexion partagée par toutes les pages d'ALB Immobilier
// ------------------------------------------------------------
// À charger APRÈS la librairie Supabase :
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="alb-connexion.js"></script>
//
// Le code PIN n'est JAMAIS vérifié dans le navigateur : il est envoyé au
// guichet "alb-connexion" (serveur Supabase) qui le vérifie, puis ouvre une
// vraie session. Supabase sait alors qui est connecté sur toutes les pages.
// ============================================================

const ALB_SUPABASE_URL = "https://kutbxyinpokebjdemlnq.supabase.co";
const ALB_CLE_PUBLIQUE = "sb_publishable_wXbJu1TP2jZ05TcuMOut9Q_NcumnpIQ";
const ALB_GUICHET_CONNEXION = ALB_SUPABASE_URL + "/functions/v1/alb-connexion";

// Client Supabase unique, partagé par toute la page
window.albSupabase = window.supabase.createClient(ALB_SUPABASE_URL, ALB_CLE_PUBLIQUE, {
  auth: { persistSession: true, autoRefreshToken: true }
});

// Messages clairs pour chaque réponse du guichet
const ALB_MESSAGES = {
  IDENTIFIANTS_INCORRECTS: "L'e-mail ou le code PIN ne correspond pas. Prenez le temps de vérifier, on est là.",
  BLOQUE: "Par sécurité, votre compte est en pause pendant 15 minutes après plusieurs essais. Revenez un peu plus tard, tout sera prêt.",
  EMAIL_INVALIDE: "L'adresse e-mail ne semble pas complète. Pouvez-vous la vérifier ?",
  PIN_INVALIDE: "Votre code PIN doit contenir exactement 4 chiffres.",
  NOM_MANQUANT: "Indiquez-nous votre prénom et votre nom, pour qu'on sache à qui on parle.",
  TELEPHONE_INVALIDE: "Le numéro de téléphone ne semble pas complet. Pouvez-vous le vérifier ?",
  CGU_NON_ACCEPTEES: "Pour rejoindre ALB, merci d'accepter les conditions générales.",
  CASQUETTE_MANQUANTE: "Dites-nous ce qui vous amène : vous achetez, vous vendez, ou vous êtes professionnel ?",
  ENTREPRISE_MANQUANTE: "Indiquez-nous le nom de votre entreprise.",
  SIRET_INVALIDE: "Le numéro SIRET doit contenir 14 chiffres.",
  METIER_INVALIDE: "Choisissez votre métier dans la liste.",
  EMAIL_DEJA_UTILISE: "Vous faites déjà partie d'ALB avec cet e-mail ! Connectez-vous simplement.",
  ERREUR_SERVEUR: "Un petit souci technique nous empêche de continuer. Réessayez dans un instant.",
  RESEAU: "On n'arrive pas à joindre le serveur. Vérifiez votre connexion internet."
};

function albMessageErreur(code) {
  return ALB_MESSAGES[code] || ALB_MESSAGES.ERREUR_SERVEUR;
}

// Appel au guichet serveur
async function albAppelerGuichet(donnees) {
  try {
    const reponse = await fetch(ALB_GUICHET_CONNEXION, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": ALB_CLE_PUBLIQUE },
      body: JSON.stringify(donnees)
    });
    return await reponse.json();
  } catch (erreur) {
    console.error("[ALB DEBUG] guichet injoignable :", erreur);
    return { ok: false, code: "RESEAU" };
  }
}

// Échange le jeton à usage unique contre une vraie session
async function albOuvrirSession(jeton) {
  const { error } = await window.albSupabase.auth.verifyOtp({ token_hash: jeton, type: "magiclink" });
  if (error) {
    console.error("[ALB DEBUG] ouverture de session :", error);
    return { ok: false, message: albMessageErreur("ERREUR_SERVEUR") };
  }
  return { ok: true };
}

// Connexion avec e-mail + PIN
async function albSeConnecter(email, pin) {
  const resultat = await albAppelerGuichet({ action: "connexion", email, pin });
  if (!resultat.ok) return { ok: false, message: albMessageErreur(resultat.code) };
  return albOuvrirSession(resultat.jeton);
}

// Inscription (connecte automatiquement si tout est bon)
async function albSInscrire(donnees) {
  const resultat = await albAppelerGuichet({ action: "inscription", ...donnees });
  if (!resultat.ok) return { ok: false, message: albMessageErreur(resultat.code) };
  return albOuvrirSession(resultat.jeton);
}

// Déconnexion
async function albSeDeconnecter() {
  await window.albSupabase.auth.signOut();
}

// Renvoie le profil complet de la personne connectée (ou null)
async function albProfilConnecte() {
  const { data: session } = await window.albSupabase.auth.getSession();
  const utilisateur = session?.session?.user;
  if (!utilisateur) return null;

  const { data: profil, error } = await window.albSupabase
    .from("profiles")
    .select("*")
    .eq("id", utilisateur.id)
    .maybeSingle();

  if (error) {
    console.error("[ALB DEBUG] lecture du profil :", error);
    return null;
  }
  return profil;
}

// Les "casquettes" d'une personne (elle peut en avoir plusieurs)
function albCasquettes(profil) {
  if (!profil) return [];
  const casquettes = [];
  if (profil.est_acquereur) casquettes.push("acheteur");
  if (profil.est_vendeur) casquettes.push("vendeur");
  if (profil.role === "courtier") casquettes.push("courtier");
  if (profil.role === "artisan") casquettes.push("artisan");
  if (profil.role === "immo") casquettes.push(profil.sous_role_immo === "mandataire" ? "mandataire" : "agent");
  return casquettes;
}

// Protège le texte avant de l'afficher dans la page
function albEchapper(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

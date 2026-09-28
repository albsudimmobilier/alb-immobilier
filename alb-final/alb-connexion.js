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
  BLOQUE: "Par sécurité, votre compte est en pause pendant 15 minutes après plusieurs essais. Revenez un peu plus tard, ou cliquez sur « J'ai oublié mon code PIN ».",
  BLOQUE_LONG: "Par sécurité, votre compte est en pause pendant 24 heures après de nombreux essais. Jocelyne est prévenue et peut vous aider : 07 45 60 28 05. Vous pouvez aussi cliquer sur « J'ai oublié mon code PIN ».",
  LIEN_INVALIDE: "Ce lien n'est plus valable : il a peut-être déjà servi, ou son délai est dépassé. Pas de souci, demandez-en un nouveau.",
  NON_CONNECTE: "Votre session s'est terminée. Reconnectez-vous, puis recommencez.",
  RECONTACT_NON_ACCEPTE: "Pour vous accompagner, nous devons pouvoir vous recontacter : merci de cocher la case prévue.",
  METIER_AUTRE_MANQUANT: "Dites-nous quel est votre métier.",
  METIER_ARTISAN_MANQUANT: "Cochez au moins un corps de métier.",
  ARTISAN_AUTRE_MANQUANT: "Vous avez coché « Autre » : dites-nous quel est votre corps de métier.",
  AUTRE_A_PRECISER: "Vous avez coché « Autre » : dites-nous en quelques mots ce qui vous amène.",
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

// Appel au guichet serveur (si la personne est connectée, le guichet sait qui elle est)
async function albAppelerGuichet(donnees) {
  try {
    const entetes = { "Content-Type": "application/json", "apikey": ALB_CLE_PUBLIQUE };
    const { data: session } = await window.albSupabase.auth.getSession();
    if (session?.session?.access_token) entetes["Authorization"] = "Bearer " + session.session.access_token;
    const reponse = await fetch(ALB_GUICHET_CONNEXION, {
      method: "POST",
      headers: entetes,
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
  if (!resultat.ok) return { ok: false, code: resultat.code, message: albMessageErreur(resultat.code) };
  return albOuvrirSession(resultat.jeton);
}

// Inscription (connecte automatiquement si tout est bon)
async function albSInscrire(donnees) {
  const resultat = await albAppelerGuichet({ action: "inscription", ...donnees });
  if (!resultat.ok) return { ok: false, message: albMessageErreur(resultat.code) };
  const session = await albOuvrirSession(resultat.jeton);
  // Artisan : ses corps de métier sont enregistrés dès que son espace est ouvert
  if (session.ok && Array.isArray(donnees.metiers_artisan) && donnees.metiers_artisan.length) {
    const { error } = await albSupabase.rpc("alb_mes_metiers_inscription", {
      p_metiers: donnees.metiers_artisan, p_autre: donnees.artisan_autre || null
    });
    if (error) console.error("[ALB] Corps de métier :", error.message);
  }
  return session;
}

// ---------- Accès au compte ----------
// « J'ai oublié mon code PIN » : un lien valable 30 minutes part par e-mail
async function albPinOublie(email) {
  const resultat = await albAppelerGuichet({ action: "pin_oublie", email });
  return resultat.ok ? { ok: true } : { ok: false, message: albMessageErreur(resultat.code) };
}

// Lit un lien reçu par e-mail ou SMS (à qui il appartient, nouvelle adresse éventuelle)
async function albLireLien(jeton) {
  const resultat = await albAppelerGuichet({ action: "lire_lien", jeton });
  return resultat.ok ? resultat : { ok: false, message: albMessageErreur(resultat.code) };
}

// Utilise le lien : nouveau code PIN (et nouvelle adresse si Jocelyne l'a prévue), puis connexion
async function albUtiliserLien(jeton, pin) {
  const resultat = await albAppelerGuichet({ action: "utiliser_lien", jeton, pin });
  if (!resultat.ok) return { ok: false, message: albMessageErreur(resultat.code) };
  const session = await albOuvrirSession(resultat.jeton);
  return { ...session, email: resultat.email };
}

// Demande de changement d'adresse / « je n'ai plus accès » (Jocelyne rappelle)
async function albDemandeAcces(donnees) {
  const resultat = await albAppelerGuichet({ action: "demande_acces", ...donnees });
  return resultat.ok ? { ok: true } : { ok: false, message: albMessageErreur(resultat.code) };
}

// Changer son code PIN une fois connecté (pas besoin de l'ancien)
async function albChangerPin(pin) {
  const resultat = await albAppelerGuichet({ action: "changer_pin", pin });
  return resultat.ok ? { ok: true } : { ok: false, message: albMessageErreur(resultat.code) };
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

// ============================================================
// CGU et politique de confidentialité : lecture sans quitter la page
// ------------------------------------------------------------
// Tout lien vers les CGU ou la politique de confidentialité (pied de page,
// cases à cocher des formulaires…) s'ouvre dans une fenêtre par-dessus la
// page. Ce qui a déjà été rempli dans un formulaire reste donc intact.
// ============================================================
const ALB_DOCUMENTS = {
  cgu: { adresse: "cgu.html", titre: "Conditions générales" },
  confidentialite: { adresse: "confidentialite.html", titre: "Politique de confidentialité" }
};

// Reconnaît un lien vers l'un des deux documents (cgu, cgu.html, /cgu, https://albimmobilier.fr/cgu…)
function albDocumentDuLien(lien) {
  let adresse;
  try { adresse = new URL(lien.getAttribute("href") || "", window.location.href); } catch (e) { return null; }
  const memeSite = adresse.origin === window.location.origin || /(^|\.)albimmobilier\.fr$/.test(adresse.hostname);
  if (!memeSite) return null;
  const nom = adresse.pathname.split("/").pop().replace(/\.html$/, "");
  return ALB_DOCUMENTS[nom] || null;
}

// Crée la fenêtre une seule fois, avec ses propres styles (indépendants de la page)
function albFenetreDocument() {
  let fond = document.getElementById("alb-fenetre-document");
  if (fond) return fond;
  fond = document.createElement("div");
  fond.id = "alb-fenetre-document";
  fond.setAttribute("role", "dialog");
  fond.setAttribute("aria-modal", "true");
  fond.style.cssText = "display:none;position:fixed;inset:0;z-index:100000;background:rgba(40,20,35,.55);align-items:center;justify-content:center;padding:12px;";
  fond.innerHTML =
    '<div style="background:#FFFFFF;border-radius:12px;width:100%;max-width:860px;height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.25);font-family:Montserrat,Arial,sans-serif;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid #E8E6E1;">' +
        '<strong id="alb-document-titre" style="color:#5A3A6A;font-size:1.1rem;"></strong>' +
        '<button type="button" id="alb-document-fermer-x" aria-label="Fermer" style="background:none;border:none;font-size:1.8rem;line-height:1;color:#5A3A6A;cursor:pointer;">&times;</button>' +
      '</div>' +
      '<iframe id="alb-document-cadre" title="Document ALB Immobilier" style="flex:1;width:100%;border:none;background:#FFFFFF;"></iframe>' +
      '<div style="padding:12px 18px;border-top:1px solid #E8E6E1;text-align:center;">' +
        '<button type="button" id="alb-document-fermer" style="background:#B28E3D;color:#FFFFFF;border:none;border-radius:6px;padding:12px 24px;font-weight:600;font-size:1rem;cursor:pointer;font-family:inherit;">Revenir à la page</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(fond);
  const fermer = function () { fond.style.display = "none"; document.body.style.overflow = ""; };
  document.getElementById("alb-document-fermer").addEventListener("click", fermer);
  document.getElementById("alb-document-fermer-x").addEventListener("click", fermer);
  fond.addEventListener("click", function (e) { if (e.target === fond) fermer(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && fond.style.display !== "none") fermer(); });
  // Dans la fenêtre, on masque le menu et le pied de page du document
  document.getElementById("alb-document-cadre").addEventListener("load", function () {
    try {
      const doc = this.contentDocument;
      const style = doc.createElement("style");
      style.textContent = "header, footer, nav, .alb-header, .footer, .modal { display: none !important; } body { padding-top: 0 !important; }";
      doc.head.appendChild(style);
    } catch (e) { /* le document s'affiche tel quel */ }
  });
  return fond;
}

function albOuvrirDocument(doc) {
  const fond = albFenetreDocument();
  document.getElementById("alb-document-titre").textContent = doc.titre;
  document.getElementById("alb-document-cadre").src = doc.adresse;
  fond.style.display = "flex";
  document.body.style.overflow = "hidden";
}

document.addEventListener("click", function (e) {
  if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const lien = e.target.closest && e.target.closest("a[href]");
  if (!lien) return;
  const doc = albDocumentDuLien(lien);
  if (!doc) return;
  // Déjà sur la page du document : on laisse faire
  if (window.location.pathname.replace(/\.html$/, "").endsWith("/" + doc.adresse.replace(/\.html$/, ""))) return;
  e.preventDefault();
  albOuvrirDocument(doc);
});

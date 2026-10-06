// ============================================================
// gestion-site-1.js — Gestion du site, partie 1 sur 2
// (données, tableau de bord, annonces, visites)
// Chargé par gestion-site.html, avant gestion-site-2.js
// ============================================================
// ============================================================
// Gestion du site — réservée à Jocelyne
// Toutes les données passent par des fonctions Supabase qui
// vérifient d'abord que la personne connectée est administratrice.
// ============================================================

// Zones proposées (les filtres de « Nos pros ALB » se construisent tout seuls
// à partir des zones des pros en ligne, y compris les « autres zones »)
const ZONES_PAR_DEPARTEMENT = {
  'Var': ['Toulon et environs', 'Centre Var', 'Est Var/Golfe', 'Dracénie', 'Haut Var/Verdon'],
  'Bouches-du-Rhône': ['Marseille et environs', "Pays d'Aix", 'Aubagne/La Ciotat', 'Étang de Berre/Martigues', 'Salon/Pays d\'Arles']
};
const ZONES = [].concat.apply([], Object.values(ZONES_PAR_DEPARTEMENT));
const METIERS = { courtier: '🏦 Courtier', artisan: '🔨 Artisan', agent: '🏠 Agent immobilier', mandataire: '📋 Mandataire immobilier', autre: '🤝 Autre métier' };
// Corps de métier des artisans (mêmes codes que l'inscription)
const METIERS_ARTISAN = {
  macon: 'Maçon', renovation: 'Rénovation générale', plombier: 'Plombier', electricien: 'Électricien',
  peintre: 'Peintre', menuisier: 'Menuisier', couvreur: 'Couvreur', carreleur: 'Carreleur',
  chauffagiste: 'Chauffagiste', climaticien: 'Climaticien', pisciniste: 'Pisciniste', paysagiste: 'Paysagiste',
  terrassier: 'Terrassier – assainissement', facadier: 'Façadier – isolation RGE', autre: 'Autre'
};
function corpsDeMetierLisibles(m) {
  return (m.metiers_artisan || []).map(function (c) {
    return c === 'autre' ? (m.artisan_autre || 'Autre') : (METIERS_ARTISAN[c] || c);
  });
}
const ERREURS = {
  AVIS_INTROUVABLE: 'Cet avis est introuvable.',
  METIER_ARTISAN_MANQUANT: 'Coche au moins un corps de métier pour cet artisan.',
  ARTISAN_AUTRE_MANQUANT: 'Tu as coché « Autre » : écris le corps de métier.',
  ACCES_REFUSE: "Accès refusé : cette action est réservée à l'équipe ALB.",
  SUIVI_INTROUVABLE: 'Ce suivi est introuvable.',
  SIRET_MANQUANT: 'Indique le SIRET (14 chiffres) avant de valider.',
  SIRET_INVALIDE: 'Le SIRET doit contenir exactement 14 chiffres.',
  METIER_A_CHOISIR: "Choisis d'abord le métier de ce pro.",
  METIER_AUTRE_MANQUANT: 'Écris le nom du métier (il apparaîtra dans les filtres de « Nos pros ALB »).',
  PRO_NON_VALIDE: "Ce pro doit d'abord être validé.",
  PROFIL_INTROUVABLE: 'Ce profil est introuvable.',
  EMAIL_INVALIDE: "Cette adresse e-mail ne semble pas complète.",
  EMAIL_DEJA_UTILISE: "Cette adresse e-mail est déjà utilisée par un autre membre.",
  DATE_COMPROMIS_MANQUANTE: "Indique la date prévue de la signature chez le notaire (acte authentique).",
  ANNONCE_INTROUVABLE: 'Cette annonce est introuvable.',
  DPE_OBLIGATOIRE: 'Le DPE est obligatoire.',
  annonces_prix_positif: 'Le prix doit être supérieur à zéro.',
  annonces_honoraires_pro: "Une annonce de pro doit afficher ses honoraires."
};

let membres = [];
let demandesAcces = [];
let annonces = [];
let rappelsMandat = [];
let visites = [];
let conversations = [];
let filtreVisites = null;
let projets = [];
let filtreProjets = null;
let avis = [];
let renvois = [];
let filtreAvis = 'a_relire';
let filtreStatut = 'a_etudier';
let filtreType = 'tous';

function afficherMessage(id, type, texte) {
  const zone = document.getElementById(id);
  zone.className = 'message visible ' + type;
  zone.textContent = texte;
  if (id === 'message-general') window.scrollTo({ top: 0, behavior: 'smooth' });
}
function effacerMessage(id) { document.getElementById(id).className = 'message'; }

function messageErreur(erreur) {
  const texte = String(erreur?.message || erreur || '');
  const code = Object.keys(ERREURS).find(function (c) { return texte.includes(c); });
  return code ? ERREURS[code] : 'Un souci est survenu : ' + texte;
}

function dateLisible(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function metierDe(m) {
  if (m.role === 'courtier') return 'courtier';
  if (m.role === 'artisan') return 'artisan';
  if (m.role === 'immo') return m.sous_role_immo === 'mandataire' ? 'mandataire' : 'agent';
  if (m.role === 'autre') return 'autre';
  return null;
}

function etiquettesDe(m) {
  const liste = [];
  if (m.est_acquereur) liste.push('<span class="etiquette">🔎 Acheteur</span>');
  if (m.est_vendeur) liste.push('<span class="etiquette">🏡 Vendeur</span>');
  if (m.est_client_pro) liste.push('<span class="etiquette">🛠️ Client pro</span>');
  const metier = metierDe(m);
  if (metier && metier !== 'autre') liste.push('<span class="etiquette or">' + METIERS[metier] + '</span>');
  if (metier === 'artisan') corpsDeMetierLisibles(m).forEach(function (c) { liste.push('<span class="etiquette">' + albEchapper(c) + '</span>'); });
  if (m.metier_autre) liste.push('<span class="etiquette or">🤝 ' + albEchapper(m.metier_autre) + '</span>');
  if (m.besoin_autre) liste.push('<span class="etiquette">✨ Autre</span>');
  if (m.statut_verifie) liste.push('<span class="etiquette vert">✅ Validé</span>');
  if (m.profil_mis_en_ligne) liste.push('<span class="etiquette vert">🌐 En ligne</span>');
  if (m.statut === 'refuse') liste.push('<span class="etiquette rouge">Refusé</span>');
  if (m.est_admin) liste.push('<span class="etiquette">👑 Gestion du site</span>');
  return '<div class="etiquettes">' + liste.join('') + '</div>';
}

// Le petit mot laissé à l'inscription (ou l'ancien champ « Autre »)
function messageDe(m) {
  const texte = m.message_inscription || m.besoin_autre;
  return texte ? '<p class="ligne-info mot">💬 « ' + albEchapper(texte) + ' »</p>' : '';
}

function coordonnees(m) {
  const tel = (m.telephone || '').replace(/[^0-9+]/g, '');
  return (tel ? '<p class="ligne-info">📱 <a href="tel:' + albEchapper(tel) + '">' + albEchapper(m.telephone) + '</a></p>' : '') +
    '<p class="ligne-info">✉️ <a href="mailto:' + albEchapper(m.email) + '">' + albEchapper(m.email) + '</a></p>';
}

// ---------- Onglets ----------
function afficherOnglet(nom) {
  document.querySelectorAll('.onglet').forEach(function (b) { b.classList.toggle('actif', b.dataset.onglet === nom); });
  document.querySelectorAll('.panneau').forEach(function (p) { p.classList.toggle('actif', p.id === 'panneau-' + nom); });
  effacerMessage('message-general');
}

// Un clic sur une case jaune du tableau de bord ouvre l'onglet correspondant
document.addEventListener('click', function (e) {
  const compteur = e.target.closest && e.target.closest('.compteur[data-aller]');
  if (!compteur) return;
  afficherOnglet(compteur.dataset.aller);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---------- Connexion ----------
async function seConnecter(event) {
  event.preventDefault();
  effacerMessage('message-connexion');
  const bouton = document.getElementById('bouton-connexion');
  bouton.disabled = true;
  const resultat = await albSeConnecter(document.getElementById('connexion-email').value, document.getElementById('connexion-pin').value);
  bouton.disabled = false;
  if (!resultat.ok) { afficherMessage('message-connexion', 'erreur', resultat.message); return; }
  demarrer();
}

async function seDeconnecter() {
  await albSeDeconnecter();
  location.reload();
}

function montrer(zone) {
  ['zone-connexion', 'zone-refus', 'zone-gestion'].forEach(function (id) {
    document.getElementById(id).classList.toggle('cache', id !== zone);
  });
  document.getElementById('bouton-deconnexion').classList.toggle('cache', zone === 'zone-connexion');
}

async function demarrer() {
  const { data: session } = await albSupabase.auth.getSession();
  if (!session?.session) { montrer('zone-connexion'); return; }
  const { data: estAdmin } = await albSupabase.rpc('alb_est_admin');
  if (estAdmin !== true) { montrer('zone-refus'); return; }
  montrer('zone-gestion');
  await toutRecharger();
  // Arrivée depuis un e-mail (ex. : gestion-site.html#avis) : on ouvre directement le bon onglet
  const onglet = location.hash.slice(1);
  if (onglet && document.querySelector('.onglet[data-onglet="' + onglet.replace(/[^a-z-]/g, '') + '"]')) afficherOnglet(onglet);
}

// ---------- Données ----------
async function toutRecharger() {
  const [compteurs, liste, acces, lesAnnonces, lesMandats, lesVisites, lesConversations, lesProjets, lesAvis, lesRenvois] = await Promise.all([
    albSupabase.rpc('alb_gestion_compteurs'),
    albSupabase.rpc('alb_gestion_membres'),
    albSupabase.rpc('alb_gestion_demandes_acces'),
    albSupabase.rpc('alb_gestion_annonces'),
    albSupabase.rpc('alb_gestion_rappels_mandat'),
    albSupabase.rpc('alb_gestion_visites'),
    albSupabase.rpc('alb_gestion_conversations'),
    albSupabase.rpc('alb_gestion_projets'),
    albSupabase.rpc('alb_gestion_avis'),
    albSupabase.rpc('alb_gestion_renvois')
  ]);
  if (compteurs.error || liste.error) {
    afficherMessage('message-general', 'erreur', messageErreur(compteurs.error || liste.error));
    return;
  }
  membres = liste.data || [];
  demandesAcces = acces.data || [];
  annonces = lesAnnonces.data || [];
  rappelsMandat = lesMandats.data || [];
  visites = lesVisites.data || [];
  conversations = lesConversations.data || [];
  projets = lesProjets.data || [];
  avis = lesAvis.data || [];
  renvois = lesRenvois.data || [];
  afficherAvis();
  afficherRenvois();
  afficherDemandesAcces();
  afficherProjets();
  afficherMessages();
  afficherVisites();
  afficherAnnonces();
  afficherRappelsMandat();
  afficherCompteurs(compteurs.data || {});
  afficherAValider();
  afficherValides();
  afficherMembres();
}

function afficherCompteurs(c) {
  const valeurs = {
    'c-a-valider': c.pros_a_valider, 'c-en-ligne': c.pros_en_ligne, 'c-membres': c.membres, 'c-nouveaux': c.nouveaux_7_jours,
    'c-acheteurs': c.acheteurs, 'c-vendeurs': c.vendeurs, 'c-clients-pro': c.clients_pro, 'c-autres': c.autres,
    'c-courtiers': c.courtiers, 'c-artisans': c.artisans, 'c-agents': c.agents, 'c-mandataires': c.mandataires,
    'c-autres-metiers': c.autres_metiers, 'c-valides': c.pros_valides
  };
  Object.keys(valeurs).forEach(function (id) { document.getElementById(id).textContent = valeurs[id] ?? 0; });
  document.getElementById('pastille-a-valider').textContent = c.pros_a_valider ?? 0;
}

// ---------- Annonces ----------
const STATUTS_ANNONCE = {
  en_attente: '⏳ À étudier', disponible: '🌐 En ligne', en_pause: '⏸️ En pause', sous_offre: '🤝 Sous offre',
  compromis: '✍️ Sous compromis', vendu: '🎉 Vendu', refusee: '✗ Refusée'
};
const FILTRES_STATUT = [
  ['a_etudier', '⏳ À étudier', function (a) { return a.statut === 'en_attente'; }],
  ['points', '📆 Points à faire', function (a) { return a.point_a_faire; }],
  ['en_ligne', '🌐 En ligne', function (a) { return a.statut === 'disponible'; }],
  ['compromis', '✍️ Offre / compromis', function (a) { return a.statut === 'sous_offre' || a.statut === 'compromis'; }],
  ['pause', '⏸️ En pause', function (a) { return a.statut === 'en_pause'; }],
  ['vendues', '🎉 Vendues', function (a) { return a.statut === 'vendu'; }],
  ['refusees', '✗ Refusées', function (a) { return a.statut === 'refusee'; }],
  ['toutes', 'Toutes', function () { return true; }]
];
const FILTRES_TYPE = [['tous', 'Tous'], ['particulier', '🏡 Entre particuliers'], ['accompagnee', '🤝 Accompagnées']];

function prixLisible(n) { return Number(n || 0).toLocaleString('fr-FR') + ' €'; }

function afficherAnnonces() {
  const aEtudier = annonces.filter(function (a) { return a.statut === 'en_attente'; }).length;
  const points = annonces.filter(function (a) { return a.point_a_faire; }).length;
  const enLigne = annonces.filter(function (a) { return a.statut === 'disponible'; });
  const valeurs = {
    'c-ann-etudier': aEtudier, 'c-ann-points': points, 'c-ann-en-ligne': enLigne.length,
    'c-ann-compromis': annonces.filter(function (a) { return a.statut === 'sous_offre' || a.statut === 'compromis'; }).length,
    'c-ann-particuliers': enLigne.filter(function (a) { return a.type_vente === 'particulier'; }).length,
    'c-ann-accompagnees': enLigne.filter(function (a) { return a.type_vente === 'accompagnee'; }).length,
    'c-ann-vendues': annonces.filter(function (a) { return a.statut === 'vendu'; }).length,
    'c-mandats': rappelsMandat.length
  };
  Object.keys(valeurs).forEach(function (id) { document.getElementById(id).textContent = valeurs[id]; });
  document.getElementById('pastille-annonces').textContent = aEtudier + points;

  document.getElementById('filtres-statut').innerHTML = FILTRES_STATUT.map(function (f) {
    const nb = annonces.filter(f[2]).length;
    return '<button type="button" class="filtre' + (filtreStatut === f[0] ? ' actif' : '') + '" onclick="choisirFiltreStatut(\'' + f[0] + '\')">' + f[1] + ' <span class="nb">(' + nb + ')</span></button>';
  }).join('');
  document.getElementById('filtres-type').innerHTML = FILTRES_TYPE.map(function (f) {
    return '<button type="button" class="filtre' + (filtreType === f[0] ? ' actif' : '') + '" onclick="choisirFiltreType(\'' + f[0] + '\')">' + f[1] + '</button>';
  }).join('');

  const testStatut = (FILTRES_STATUT.find(function (f) { return f[0] === filtreStatut; }) || FILTRES_STATUT[0])[2];
  const recherche = (document.getElementById('recherche-annonces').value || '').trim().toLowerCase();
  const liste = annonces.filter(testStatut)
    .filter(function (a) { return filtreType === 'tous' || a.type_vente === filtreType; })
    .filter(function (a) {
      if (!recherche) return true;
      const p = a.proprietaire || {};
      return [a.titre, a.ville, a.code_postal, p.prenom, p.nom, p.nom_entreprise, p.email, p.telephone]
        .some(function (v) { return String(v || '').toLowerCase().includes(recherche); });
    });
  const zone = document.getElementById('liste-annonces');
  if (!liste.length) { zone.innerHTML = '<div class="carte vide">Aucune annonce ici pour le moment. 🌿</div>'; return; }
  zone.innerHTML = grouperParPersonne(liste, function (a) { return a.proprietaire || {}; }).map(function (g) {
    return '<div class="proprio' + (g.p.role === 'immo' ? ' pro' : '') + '">' + enteteProprio(g.p, g.items.length + ' bien' + (g.items.length > 1 ? 's' : '')) +
      '<div class="liste-fiches">' + g.items.map(ficheAnnonce).join('') + '</div></div>';
  }).join('');
}

// ---------- Rangement par personne (commun aux annonces et aux visites) ----------
function badgeQui(p) {
  if (p.role === 'immo') return p.sous_role_immo === 'mandataire'
    ? '<span class="badge-qui mandataire">📋 Mandataire</span>'
    : '<span class="badge-qui agent">🏠 Agent immobilier</span>';
  return '<span class="badge-qui particulier">🏡 Particulier</span>';
}
function lienTelephone(t) {
  const net = String(t || '').replace(/[^0-9+]/g, '');
  return net ? '<a href="tel:' + albEchapper(net) + '">📱 ' + albEchapper(t) + '</a>' : '';
}
function enteteProprio(p, compte) {
  return '<div class="proprio-tete">' + badgeQui(p) +
    '<span class="proprio-nom">' + albEchapper(((p.prenom || '') + ' ' + (p.nom || '')).trim() || 'Propriétaire inconnu') + '</span>' +
    (p.role === 'immo' && p.nom_entreprise ? '<span class="etiquette or">' + albEchapper(p.nom_entreprise) + '</span>' : '') +
    '<span class="compte">' + albEchapper(compte) + '</span>' +
    '<div class="proprio-coord">' + lienTelephone(p.telephone) +
      (p.email ? '<a href="mailto:' + albEchapper(p.email) + '">✉️ ' + albEchapper(p.email) + '</a>' : '') + '</div>' +
  '</div>';
}
function grouperParPersonne(liste, qui) {
  const groupes = [];
  const index = {};
  liste.forEach(function (x) {
    const p = qui(x);
    const cle = p.id || ('inconnu-' + (p.email || ''));
    if (!index[cle]) { index[cle] = { p: p, items: [] }; groupes.push(index[cle]); }
    index[cle].items.push(x);
  });
  // Les particuliers d'abord, puis les agents et mandataires ; par ordre alphabétique
  return groupes.sort(function (g1, g2) {
    const r1 = g1.p.role === 'immo' ? 1 : 0, r2 = g2.p.role === 'immo' ? 1 : 0;
    if (r1 !== r2) return r1 - r2;
    return String(g1.p.nom || '').localeCompare(String(g2.p.nom || ''), 'fr');
  });
}

function choisirFiltreStatut(f) { filtreStatut = f; afficherAnnonces(); }
function choisirFiltreType(f) { filtreType = f; afficherAnnonces(); }

function ficheAnnonce(a) {
  const p = a.proprietaire || {};
  const pro = a.type_vente === 'accompagnee';
  const tel = (p.telephone || a.telephone_annonce || '').replace(/[^0-9+]/g, '');
  const photos = (a.photos || []).map(function (u) { return '<a href="' + albEchapper(u) + '" target="_blank"><img src="' + albEchapper(u) + '" alt=""></a>'; }).join('');
  const videos = (a.videos || []).map(function (v, i) { return '<a href="' + albEchapper(v) + '" target="_blank">🎬 Vidéo ' + (i + 1) + '</a>'; }).join(' · ');
  const dispos = Array.isArray(a.disponibilites_visite) ? a.disponibilites_visite.length : 0;
  const bien = (a.type_bien === 'maison' ? 'Maison' : 'Appartement') + ' · ' + (a.surface_m2 || '?') + ' m²' +
    (a.nb_pieces ? ' · ' + a.nb_pieces + ' pièces' : '') + (a.surface_terrain_m2 ? ' · terrain ' + a.surface_terrain_m2 + ' m²' : '');
  const energie = (a.depenses_energie_min || a.depenses_energie_max)
    ? ' · énergie ' + (a.depenses_energie_min ? prixLisible(a.depenses_energie_min) : '?') + ' à ' + (a.depenses_energie_max ? prixLisible(a.depenses_energie_max) : '?') + '/an' : '';

  return '<div class="carte fiche" id="annonce-' + a.id + '">' +
    '<span class="badge-vente ' + (pro ? 'accompagnee' : 'particulier') + '">' + (pro ? '🤝 Vente accompagnée' + (a.agence_nom ? ' · ' + albEchapper(a.agence_nom) : '') : '🏡 Entre particuliers') + '</span>' +
    '<div class="etiquettes"><span class="etiquette' + (a.statut === 'en_attente' ? ' or' : a.statut === 'refusee' ? ' rouge' : a.statut === 'disponible' ? ' vert' : '') + '">' + (STATUTS_ANNONCE[a.statut] || albEchapper(a.statut)) + '</span></div>' +
    '<h3>' + albEchapper(a.titre) + '</h3>' +
    '<p class="prix-annonce">' + prixLisible(a.prix) + '</p>' +
    '<p class="ligne-info">📍 ' + albEchapper((a.code_postal || '') + ' ' + (a.ville || '')) + '</p>' +
    '<p class="ligne-info">🏠 ' + albEchapper(bien) + '</p>' +
    '<p class="ligne-info">⚡ DPE ' + albEchapper(a.dpe || '?') + ' · GES ' + albEchapper(a.ges || '?') + albEchapper(energie) + '</p>' +
    (pro && a.honoraires_texte ? '<p class="ligne-info">💶 Honoraires : ' + albEchapper(a.honoraires_texte) + '</p>' : '') +
    (photos ? '<div class="photos-annonce">' + photos + '</div>' : '<p class="ligne-info">📷 Aucune photo</p>') +
    (a.point_a_faire ? '<div class="point-a-faire">📆 <strong>Point mensuel à faire</strong> avec le propriétaire (prévu le ' + dateLisible(a.prochain_point_le) + ').</div>' : '') +
    (a.message_jocelyne ? '<p class="ligne-info mot">💬 « ' + albEchapper(a.message_jocelyne) + ' »</p>' : '') +
    '<details class="historique"><summary>📝 Description</summary><p style="white-space:pre-line;margin-top:6px;">' + albEchapper(a.description || '') + '</p></details>' +
    '<div class="prive"><div class="prive-titre">🔒 Jamais public</div>' +
      '<p class="ligne-info">👤 ' + albEchapper((p.prenom || '') + ' ' + (p.nom || '')) + (p.nom_entreprise ? ' · ' + albEchapper(p.nom_entreprise) : '') + '</p>' +
      (tel ? '<p class="ligne-info">📱 <a href="tel:' + albEchapper(tel) + '">' + albEchapper(p.telephone || a.telephone_annonce) + '</a></p>' : '') +
      (p.email ? '<p class="ligne-info">✉️ <a href="mailto:' + albEchapper(p.email) + '">' + albEchapper(p.email) + '</a></p>' : '') +
      (a.adresse ? '<p class="ligne-info">🏠 ' + albEchapper(a.adresse) + '</p>' : '<p class="ligne-info">🏠 Adresse non indiquée</p>') +
      (videos ? '<p class="ligne-info">' + videos + '</p>' : '') +
      (!pro ? '<p class="ligne-info">📅 ' + (dispos ? dispos + ' disponibilité' + (dispos > 1 ? 's' : '') + ' de visite' : 'Pas encore de disponibilités de visite') + '</p>' : '') +
      '<p class="ligne-info">' + (pro ? (a.certifie_mandat_detenu ? '✅ A certifié détenir un mandat de vente' : '') : (a.certifie_sans_exclusif ? '✅ A certifié ne pas être sous mandat exclusif' : '')) + '</p>' +
    '</div>' +
    '<p class="ligne-info">🗓️ Déposée le ' + dateLisible(a.date_creation) +
      (a.mis_en_ligne_le ? ' · en ligne depuis le ' + dateLisible(a.mis_en_ligne_le) : '') +
      (a.modifie_le ? ' · modifiée le ' + dateLisible(a.modifie_le) : '') + '</p>' +
    (a.statut === 'compromis' && a.date_fin_compromis ? '<p class="ligne-info">✍️ Acte prévu le ' + dateLisible(a.date_fin_compromis) + '</p>' : '') +
    (a.statut === 'refusee' && a.motif_refus ? '<p class="ligne-info">Motif du refus : ' + albEchapper(a.motif_refus) + '</p>' : '') +
    actionsAnnonce(a) +
    formulaireAnnonce(a) +
    historiqueAnnonce(a) +
  '</div>';
}

function actionsAnnonce(a) {
  const id = a.id;
  const btn = function (decision, texte, classe) {
    return '<button class="bouton ' + (classe || 'discret') + '" onclick="decisionAnnonce(\'' + id + '\', \'' + decision + '\', this)">' + texte + '</button>';
  };
  let html = '';
  if (a.statut === 'en_attente' || a.statut === 'refusee') {
    html = '<div class="actions">' + btn('mettre_en_ligne', '🌐 Mettre en ligne', 'vert') +
      (a.statut === 'en_attente' ? '<button class="bouton rouge" onclick="basculer(\'refus-' + id + '\')">✗ Refuser</button>' : '') +
      '<button class="bouton discret" onclick="basculer(\'modif-' + id + '\')">✏️ Corriger</button></div>' +
      '<div class="decision cache" id="refus-' + id + '"><div class="decision-titre">Pourquoi ? (il sera envoyé gentiment au propriétaire, facultatif)</div>' +
      '<textarea id="motif-' + id + '" maxlength="500" placeholder="Ex. : le bien est hors de notre zone pour le moment"></textarea>' +
      '<div class="actions">' + btn('refuser', 'Confirmer le refus', 'rouge') + '</div></div>';
  } else if (a.statut !== 'vendu') {
    html = '<div class="decision"><div class="decision-titre">📞 Après ton appel (point mensuel) :</div><div class="actions" style="margin-top:0;">' +
      (a.statut === 'disponible' ? btn('continuer', '✓ On continue', 'vert') : btn('reprendre', '▶️ Reprendre la diffusion', 'vert')) +
      (a.statut !== 'en_pause' ? btn('pause', '⏸️ Mettre en pause') : '') +
      (a.statut !== 'sous_offre' ? btn('sous_offre', '🤝 Sous offre') : '') +
      (a.statut !== 'compromis' ? '<button class="bouton discret" onclick="basculer(\'compromis-' + id + '\')">✍️ Sous compromis</button>' : '') +
      btn('vendu', '🎉 Vendu') +
      '</div>' +
      '<div class="cache" id="compromis-' + id + '" style="margin-top:8px;"><label class="petit-champ">Date prévue chez le notaire (acte)<input type="date" id="date-compromis-' + id + '"></label>' +
      '<div class="actions">' + btn('compromis', 'Confirmer : sous compromis') + '</div></div>' +
      '</div>' +
      '<div class="actions"><button class="bouton discret" onclick="basculer(\'modif-' + id + '\')">✏️ Corriger l\'annonce</button></div>';
  }
  return html;
}

function formulaireAnnonce(a) {
  const champ = function (nom, libelle, valeur, type) {
    return '<div class="champ"><label>' + libelle + '</label><input name="' + nom + '" ' + (type ? 'inputmode="' + type + '"' : '') + ' value="' + albEchapper(valeur ?? '') + '"></div>';
  };
  const lettres = function (nom, valeur) {
    return '<select name="' + nom + '">' + ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(function (l) { return '<option' + (l === valeur ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select>';
  };
  return '<form class="formulaire-fiche cache" id="modif-' + a.id + '" onsubmit="corrigerAnnonce(event, \'' + a.id + '\')">' +
    '<div class="grille">' +
      '<div class="champ large"><label>Titre</label><input name="titre" maxlength="120" value="' + albEchapper(a.titre || '') + '"></div>' +
      champ('prix', 'Prix (€)', a.prix, 'numeric') +
      '<div class="champ"><label>Type</label><select name="type_bien"><option value="maison"' + (a.type_bien === 'maison' ? ' selected' : '') + '>Maison</option><option value="appartement"' + (a.type_bien === 'appartement' ? ' selected' : '') + '>Appartement</option></select></div>' +
      champ('ville', 'Ville', a.ville) + champ('code_postal', 'Code postal', a.code_postal, 'numeric') +
      champ('surface_m2', 'Surface (m²)', a.surface_m2, 'decimal') + champ('nb_pieces', 'Pièces', a.nb_pieces, 'numeric') +
      champ('surface_terrain_m2', 'Terrain (m²)', a.surface_terrain_m2, 'numeric') +
      '<div class="champ"><label>DPE</label>' + lettres('dpe', a.dpe) + '</div>' +
      '<div class="champ"><label>GES</label>' + lettres('ges', a.ges) + '</div>' +
      champ('depenses_energie_min', 'Énergie : de (€/an)', a.depenses_energie_min, 'numeric') + champ('depenses_energie_max', 'à (€/an)', a.depenses_energie_max, 'numeric') +
      (a.type_vente === 'accompagnee' ? champ('agence_nom', 'Agence', a.agence_nom) + champ('honoraires_texte', 'Honoraires', a.honoraires_texte) : '') +
      '<div class="champ large"><label>Description</label><textarea name="description" maxlength="4000" rows="6">' + albEchapper(a.description || '') + '</textarea></div>' +
    '</div>' +
    '<div class="actions"><button class="bouton" type="submit">💾 Enregistrer</button><button class="bouton discret" type="button" onclick="basculer(\'modif-' + a.id + '\')">Annuler</button></div>' +
  '</form>';
}

function historiqueAnnonce(a) {
  const h = a.historique || [];
  if (!h.length) return '';
  return '<details class="historique"><summary>🕘 Historique de l\'annonce</summary><ul>' +
    h.map(function (e) { return '<li>' + dateLisible(e.le) + ' : ' + albEchapper(e.evenement) + (e.detail ? ' (' + albEchapper(e.detail) + ')' : '') + '</li>'; }).join('') +
    '</ul></details>';
}

function basculer(id) { document.getElementById(id).classList.toggle('cache'); }

const MESSAGES_DECISION = {
  mettre_en_ligne: '🌐 Annonce en ligne ! Le propriétaire reçoit son e-mail, et le premier point mensuel est prévu dans 30 jours.',
  refuser: "Annonce refusée. Le propriétaire reçoit un e-mail bienveillant. Elle reste dans l'onglet « Refusées ».",
  continuer: '✓ Noté : on continue. Prochain point dans 30 jours.',
  pause: "⏸️ Diffusion en pause : l'annonce n'est plus visible sur le site. Prochain point dans 30 jours.",
  reprendre: '▶️ Diffusion reprise. Prochain point dans 30 jours.',
  sous_offre: "🤝 Sous offre : l'annonce reste visible avec la mention « sous offre ».",
  compromis: "✍️ Sous compromis : l'annonce reste visible avec la mention « sous compromis ». Je te rappelle au plus tard le lendemain de l'acte.",
  vendu: "🎉 Vendu ! L'annonce quitte le site mais reste gardée ici, dans « Vendues »."
};

async function decisionAnnonce(id, decision, bouton) {
  if (decision === 'vendu' && !confirm('Confirmer : ce bien est vendu ? L\'annonce quittera le site (elle reste gardée ici).')) return;
  const date = decision === 'compromis' ? (document.getElementById('date-compromis-' + id).value || null) : null;
  if (decision === 'compromis' && !date) { afficherMessage('message-general', 'erreur', ERREURS.DATE_COMPROMIS_MANQUANTE); return; }
  const motif = decision === 'refuser' ? (document.getElementById('motif-' + id).value.trim() || null) : null;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_annonce_decision', { p_id: id, p_decision: decision, p_date_fin_compromis: date, p_motif: motif });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await toutRecharger();
  afficherMessage('message-general', decision === 'refuser' ? 'info' : 'succes', MESSAGES_DECISION[decision] || 'C\'est enregistré ✓');
}

async function corrigerAnnonce(event, id) {
  event.preventDefault();
  const f = event.target;
  const champs = {};
  Array.from(f.elements).forEach(function (el) {
    if (!el.name) return;
    const v = el.value.trim();
    if (v !== '') champs[el.name] = ['prix', 'surface_m2', 'nb_pieces', 'surface_terrain_m2', 'depenses_energie_min', 'depenses_energie_max'].includes(el.name)
      ? v.replace(/[^0-9.,]/g, '').replace(',', '.') : v;
  });
  const bouton = f.querySelector('button[type="submit"]');
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_annonce_modifier', { p_id: id, p_champs: champs });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await toutRecharger();
  afficherMessage('message-general', 'succes', '💾 Annonce corrigée. Si elle est en ligne, c\'est déjà visible sur le site.');
}

// ---------- Visites ----------
function jourIso(decalage) {
  const d = new Date(); d.setDate(d.getDate() + (decalage || 0));
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function momentVisite(jour, heure) {
  if (!jour) return '';
  const d = new Date(jour + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + (heure ? ' à ' + String(heure).replace(':', 'h') : '');
}
function sansReponseDepuis(v) {
  if (v.statut !== 'en_attente' && v.statut !== 'autre_moment') return 0;
  return Math.floor((Date.now() - new Date(v.modifie_le || v.cree_le).getTime()) / 86400000);
}
const FILTRES_VISITES = [
  ['demain', '📱 Demain (SMS)', function (v) { return v.statut === 'acceptee' && v.creneau_date === jourIso(1); }],
  ['a_traiter', '⏳ En attente de réponse', function (v) { return v.statut === 'en_attente' || v.statut === 'autre_moment'; }],
  ['a_venir', '✅ Confirmées à venir', function (v) { return v.statut === 'acceptee' && v.creneau_date >= jourIso(0); }],
  ['courtier', '🏦 Courtier demandé', function (v) { return v.courtier_souhaite; }],
  ['passees', '🕘 Passées', function (v) { return (v.statut === 'acceptee' && v.creneau_date && v.creneau_date < jourIso(0)) || v.statut === 'effectuee'; }],
  ['fermees', '✗ Refusées / annulées', function (v) { return v.statut === 'refusee' || v.statut === 'annulee'; }],
  ['toutes', 'Toutes', function () { return true; }]
];
const STATUTS_VISITE = {
  en_attente: '⏳ En attente de réponse du vendeur', autre_moment: '📅 Autre moment proposé, en attente de l\'acheteur',
  acceptee: '✅ Confirmée', refusee: '✗ Refusée par le vendeur', annulee: '✗ Annulée', effectuee: '🕘 Faite'
};

function choisirFiltreVisites(f) { filtreVisites = f; afficherVisites(); }

function afficherVisites() {
  const demain = visites.filter(FILTRES_VISITES[0][2]).length;
  const retard = visites.filter(function (v) { return sansReponseDepuis(v) >= 2; }).length;
  document.getElementById('pastille-visites').textContent = demain + retard;
  document.getElementById('c-vis-demain').textContent = demain;
  document.getElementById('c-vis-retard').textContent = retard;
  document.getElementById('c-vis-a-venir').textContent = visites.filter(FILTRES_VISITES[2][2]).length;
  document.getElementById('c-vis-courtiers').textContent = visites.filter(FILTRES_VISITES[3][2]).length;

  if (!filtreVisites) filtreVisites = demain ? 'demain' : 'a_traiter';
  document.getElementById('filtres-visites').innerHTML = FILTRES_VISITES.map(function (f) {
    return '<button type="button" class="filtre' + (filtreVisites === f[0] ? ' actif' : '') + '" onclick="choisirFiltreVisites(\'' + f[0] + '\')">' + f[1] + ' <span class="nb">(' + visites.filter(f[2]).length + ')</span></button>';
  }).join('');

  const test = (FILTRES_VISITES.find(function (f) { return f[0] === filtreVisites; }) || FILTRES_VISITES[1])[2];
  const recherche = (document.getElementById('recherche-visites').value || '').trim().toLowerCase();
  const liste = visites.filter(test).filter(function (v) {
    if (!recherche) return true;
    return [v.annonce.titre, v.annonce.ville, v.vendeur.prenom, v.vendeur.nom, v.vendeur.nom_entreprise, v.acheteur.prenom, v.acheteur.nom, v.acheteur.telephone, v.acheteur.email]
      .some(function (x) { return String(x || '').toLowerCase().includes(recherche); });
  });
  const zone = document.getElementById('liste-visites');
  if (!liste.length) { zone.innerHTML = '<div class="carte vide">Aucune visite ici pour le moment. 🌿</div>'; return; }

  zone.innerHTML = grouperParPersonne(liste, function (v) { return v.vendeur || {}; }).map(function (g) {
    // Dans chaque carte propriétaire : un bloc par bien, avec ses visites
    const parBien = [];
    const idx = {};
    g.items.forEach(function (v) {
      if (!idx[v.annonce.id]) { idx[v.annonce.id] = { a: v.annonce, visites: [] }; parBien.push(idx[v.annonce.id]); }
      idx[v.annonce.id].visites.push(v);
    });
    return '<div class="proprio' + (g.p.role === 'immo' ? ' pro' : '') + '">' +
      enteteProprio(g.p, g.items.length + ' visite' + (g.items.length > 1 ? 's' : '') + ' · ' + parBien.length + ' bien' + (parBien.length > 1 ? 's' : '')) +
      parBien.map(function (b) {
        return '<div class="bien-visites"><div class="bien-visites-titre">🏡 ' + albEchapper(b.a.titre) + ' · ' + prixLisible(b.a.prix) + ' · ' + albEchapper(b.a.ville || '') +
          (STATUTS_ANNONCE[b.a.statut] ? ' <span class="etiquette">' + STATUTS_ANNONCE[b.a.statut] + '</span>' : '') + '</div>' +
          b.visites.map(ligneVisite).join('') + '</div>';
      }).join('') +
    '</div>';
  }).join('');
}

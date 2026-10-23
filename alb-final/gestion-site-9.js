// ============================================================
// Gestion du site — partie 9 : 📅 Agenda, 📇 Carnet et 🚪 Départs
// Trois onglets ajoutés par ce fichier (rien à changer dans la page) :
//  • 📅 Agenda : les rendez-vous de Jocelyne + les dates du site
//    (visites, relances, fins de validité, fins de mandat, rappels,
//    contacts du carnet à relancer), en liste par jour.
//  • 📇 Carnet : les personnes qui ne sont pas (encore) inscrites sur
//    ALB Immobilier (pros rencontrés en visio, en salon, au téléphone…),
//    avec ses notes datées et la date à laquelle les relancer.
//  • 🚪 Départs : les membres qui demandent à quitter ALB Immobilier (depuis
//    leur espace) et les comptes fermés par Jocelyne. Sur chaque carte de
//    « Suivi des membres » : « 🚪 Fermer son compte ».
// Rien n'est envoyé à personne : ce sont ses outils à elle.
// Chargé par gestion-site.html, après gestion-site-8.js
// ============================================================

// ----- 📅 Agenda (nouvel onglet, juste après « Tableau de bord ») -----
// Les rendez-vous de Jocelyne (qu'elle ajoute elle-même) + les dates déjà
// connues du site, ajoutées toutes seules : visites confirmées, membres à
// relancer, fins de validité des papiers, fins de mandat, rappels datés.
// Affiché en liste par jour (aujourd'hui, demain, puis les jours suivants).
let agenda = { rdv: [], rappels: [] };
let agendaPeriode = 30;        // nombre de jours à venir affichés (0 = tout)
let agendaDatesSite = true;    // afficher aussi les dates du site
let agendaFormulaire = null;   // null, 'nouveau' ou l'id du rendez-vous en cours de modification
let agendaTheme = '';          // thème affiché ('' = tous les thèmes)
// Les thèmes de l'agenda : ce qu'une fondatrice a à gérer (emoji + couleur)
const THEMES_AGENDA = {
  'Pros': { e: '🤝', c: '#1E88E5' },
  'Particuliers': { e: '🏡', c: '#D81B60' },
  'Réseau et prospection': { e: '🌱', c: '#C78A00' },
  'Compta et factures': { e: '🧾', c: '#2E7D32' },
  'Banque et trésorerie': { e: '🏦', c: '#00838F' },
  'TVA et impôts': { e: '🏛️', c: '#827717' },
  'Juridique et administratif': { e: '⚖️', c: '#5E35B1' },
  'Assurances': { e: '🛡️', c: '#3949AB' },
  'Site ALB Immobilier': { e: '💻', c: '#546E7A' },
  'Communication et réseaux sociaux': { e: '📣', c: '#EC407A' },
  'Accompagnement et formation': { e: '🎓', c: '#7E57C2' },
  'Organisation et perso': { e: '🗂️', c: '#78909C' }
};
// Pour une tâche sans thème : on devine d'après le titre
const MOTS_THEMES = [
  ['TVA et impôts', /(tva|impôt|impot|cfe|urssaf)/i],
  ['Compta et factures', /(pennylane|factur|compta|advyse|justificatif|fournisseur)/i],
  ['Banque et trésorerie', /(qonto|banque|rib|trésorerie|virement|prélèvement|sepa)/i],
  ['Assurances', /(assurance|rc pro|mutuelle|prévoyance)/i],
  ['Juridique et administratif', /(juriste|avocat|contrat|kbis|statuts|rgpd|cgv|cgu|médiateur|greffe|charte)/i],
  ['Site ALB Immobilier', /(site|netlify|supabase|github|brevo|plateforme)/i],
  ['Communication et réseaux sociaux', /(post|linkedin|instagram|facebook|vidéo|video|flyer|publication)/i],
  ['Réseau et prospection', /(notaire|bni|issole|réseau|salon|rent|café pro|afterwork|prospect)/i],
  ['Accompagnement et formation', /(scale ?lab|coach|formation|masterclass|webinaire|mentor)/i],
  ['Pros', /(courtier|artisan|agent|mandataire|pros?\b)/i]
];
function themeDe(r) {
  if (r.theme && THEMES_AGENDA[r.theme]) return r.theme;
  const m = MOTS_THEMES.find(function (x) { return x[1].test((r.titre || '') + ' ' + (r.note || '')); });
  return m ? m[0] : 'Organisation et perso';
}
ERREURS.TITRE_MANQUANT = 'Écris un titre (ex. : « Café avec Pauline »).';
ERREURS.RDV_DATE_MANQUANTE = 'Choisis la date du rendez-vous.';
ERREURS.RDV_INTROUVABLE = 'Ce rendez-vous n\'existe plus.';

async function chargerAgenda() {
  const { data, error } = await albSupabase.rpc('alb_gestion_agenda');
  if (error) { console.error('[ALB DEBUG] agenda :', error); return; }
  agenda = data || { rdv: [], rappels: [] };
}

// Ajoute un onglet (et son panneau) juste après un autre onglet
function ajouterOnglet(nom, libelle, apres) {
  if (document.getElementById('panneau-' + nom)) return;
  const ongletAvant = document.querySelector('.onglet[data-onglet="' + apres + '"]');
  const panneauAvant = document.getElementById('panneau-' + apres);
  if (!ongletAvant || !panneauAvant) return;
  const onglet = document.createElement('button');
  onglet.type = 'button';
  onglet.className = 'onglet';
  onglet.dataset.onglet = nom;
  onglet.innerHTML = libelle + '<span class="pastille cache" id="pastille-' + nom + '">0</span>';
  onglet.onclick = function () { afficherOnglet(nom); };
  ongletAvant.parentNode.insertBefore(onglet, ongletAvant.nextSibling);
  const panneau = document.createElement('div');
  panneau.className = 'panneau';
  panneau.id = 'panneau-' + nom;
  panneauAvant.parentNode.insertBefore(panneau, panneauAvant.nextSibling);
}
function preparerOngletAgenda() {
  ajouterOnglet('agenda', '📅 Agenda', 'accueil');
  ajouterOnglet('carnet', '📇 Carnet', 'agenda');
  ajouterOnglet('departs', '🚪 Départs', 'membres');
}

function heureCourte(h) { return h ? String(h).slice(0, 5).replace(':', 'h') : ''; }
function nomAgenda(m) { return m ? ((m.prenom || '') + ' ' + (m.nom || '')).trim() || m.nom_entreprise || 'un membre' : 'un membre'; }

// Tout ce qui a une date, rangé dans une seule liste
function elementsAgenda() {
  const auj = jourIso(0);
  const liste = [];
  (agenda.rdv || []).forEach(function (r) {
    // Un rendez-vous ou une tâche pas fait dont la date est passée remonte à aujourd'hui, en retard
    const enRetard = !r.fait_le && r.le < auj;
    liste.push({ le: enRetard ? auj : r.le, heure: enRetard ? '' : r.heure, emoji: r.genre === 'tache' ? '📝' : '📌', titre: r.titre, theme: themeDe(r), retard: enRetard ? r.le : '',
      detail: [r.lieu ? '📍 ' + r.lieu : '', r.note || ''].filter(Boolean).join(' · '), rdv: r });
  });
  if (!agendaDatesSite) return liste;
  (agenda.rappels || []).forEach(function (r) {
    liste.push({ le: r.le < auj ? auj : r.le, emoji: '🔔', titre: 'Rappel : ' + r.titre, detail: r.detail || '', onglet: 'accueil', theme: themeDe(r) });
  });
  (typeof visites !== 'undefined' ? visites : []).forEach(function (v) {
    if (v.statut !== 'acceptee' || !v.creneau_date) return;
    const a = v.annonce || {}, b = v.acheteur || {};
    liste.push({ le: v.creneau_date, heure: v.creneau_heure, emoji: '🏡', titre: 'Visite « ' + (a.titre || 'bien') + ' »', theme: 'Particuliers',
      detail: [nomAgenda(b) !== 'un membre' ? 'Visiteur : ' + nomAgenda(b) : '', a.ville || ''].filter(Boolean).join(' · '), onglet: 'visites' });
  });
  (typeof membres !== 'undefined' ? membres : []).forEach(function (m) {
    const s = (typeof suiviMembres !== 'undefined' && suiviMembres[m.id]) || {};
    if (!s.relancer_le || s.etape === 'ok' || s.etape === 'pause' || (typeof estSuspendu === 'function' && estSuspendu(m))) return;
    const enRetard = s.relancer_le < auj;
    liste.push({ le: enRetard ? auj : s.relancer_le, emoji: '⏰', titre: 'Relancer ' + nomAgenda(m), theme: m.role && m.role !== 'particulier' ? 'Pros' : 'Particuliers', retard: enRetard ? s.relancer_le : '',
      detail: enRetard ? 'Prévu le ' + dateLisible(s.relancer_le + 'T12:00:00') + ' (en retard)' : (m.telephone || ''), onglet: 'membres' });
  });
  (typeof papiersPros !== 'undefined' ? papiersPros : []).forEach(function (x) {
    if (!x.expire || !x.expire_le || x.statut === 'refuse' || x.expire_le < auj) return;
    liste.push({ le: x.expire_le, emoji: '📄', theme: 'Pros', titre: 'Fin de validité : ' + String(x.libelle || 'papier').replace(/\s*\(.*\)\s*$/, ''), detail: x.pro || '', onglet: 'valides' });
  });
  (typeof rappelsMandat !== 'undefined' ? rappelsMandat : []).forEach(function (r) {
    if (!r.fin_mandat) return;
    const date = String(r.fin_mandat).slice(0, 10);
    liste.push({ le: date < auj ? auj : date, emoji: '🔔', theme: 'Particuliers', titre: 'Fin du mandat exclusif de ' + nomAgenda(r),
      detail: (date < auj ? 'Terminé le ' + dateLisible(date + 'T12:00:00') + ' : c\'est le moment d\'appeler. ' : '') + (r.telephone || ''), onglet: 'annonces' });
  });
  // Les contacts du carnet à relancer (ceux en retard apparaissent aujourd'hui)
  (typeof carnet !== 'undefined' ? carnet : []).forEach(function (c) {
    if (!c.relancer_le || c.etape === 'inscrit' || c.etape === 'pas_interesse') return;
    const enRetard = c.relancer_le < auj;
    liste.push({ le: enRetard ? auj : c.relancer_le, emoji: '📇', theme: 'Réseau et prospection', retard: enRetard ? c.relancer_le : '', titre: 'Relancer ' + nomContact(c) + (c.metier ? ' (' + (METIERS_CARNET[c.metier] || c.metier).replace(/^\S+\s/, '') + ')' : ''),
      detail: [enRetard ? 'Prévu le ' + dateLisible(c.relancer_le + 'T12:00:00') + ' (en retard)' : '', c.telephone || ''].filter(Boolean).join(' · '), onglet: 'carnet' });
  });
  return liste;
}

function rdvDuJour() {
  const auj = jourIso(0);
  return (agenda.rdv || []).filter(function (r) { return r.le <= auj && !r.fait_le; });
}

function titreJour(iso) {
  const auj = jourIso(0), demain = jourIso(1);
  const date = new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  if (iso === auj) return 'Aujourd\'hui · ' + date;
  if (iso === demain) return 'Demain · ' + date;
  return date.charAt(0).toUpperCase() + date.slice(1);
}

function ligneAgenda(e) {
  const r = e.rdv;
  const fait = r && r.fait_le;
  const t = THEMES_AGENDA[e.theme] || THEMES_AGENDA['Organisation et perso'];
  return '<div class="ligne-info" style="display:flex;gap:10px;align-items:flex-start;padding:8px 0 8px 8px;border-top:1px dashed #E8E6E1;border-left:4px solid ' + (e.retard && !fait ? '#C62828' : t.c) + ';' + (fait ? 'opacity:.6;' : '') + '">' +
    '<span style="min-width:48px;font-weight:700;color:#5A3A6A;">' + (heureCourte(e.heure) || '—') + '</span>' +
    '<span style="flex:1;min-width:0;">' + e.emoji + ' <strong' + (fait ? ' style="text-decoration:line-through;"' : '') + '>' + albEchapper(e.titre) + '</strong>' +
      ' <span class="etiquette" style="background:transparent;color:' + t.c + ';border:1px solid ' + t.c + ';">' + t.e + ' ' + albEchapper(e.theme || 'Organisation et perso') + '</span>' +
      (e.retard && !fait ? ' <span class="etiquette rouge">en retard depuis le ' + albEchapper(dateLisible(e.retard + 'T12:00:00')) + '</span>' : '') +
      (r && r.genre === 'tache' ? ' <span class="etiquette or">tâche</span>' : '') +
      (r ? '' : ' <span class="etiquette">site</span>') +
      (e.detail ? '<br><span style="color:#6a6a65;overflow-wrap:anywhere;">' + albEchapper(e.detail) + '</span>' : '') +
      (r ? '<span class="actions" style="margin-top:6px;">' +
          '<button type="button" class="bouton discret" onclick="agendaFait(\'' + r.id + '\', ' + (fait ? 'false' : 'true') + ', this)">' + (fait ? 'Annuler « fait »' : '✓ Fait') + '</button>' +
          '<button type="button" class="bouton discret" onclick="agendaModifier(\'' + r.id + '\')">✏️ Modifier</button>' +
          '<button type="button" class="bouton discret" onclick="agendaRetirer(\'' + r.id + '\', this)">🗑️ Retirer</button></span>'
        : '<br><button type="button" class="bouton discret" style="margin-top:4px;" onclick="afficherOnglet(\'' + e.onglet + '\'); window.scrollTo({ top: 0, behavior: \'smooth\' });">Voir →</button>') +
    '</span></div>';
}

function blocJours(liste) {
  const jours = {};
  liste.forEach(function (e) { (jours[e.le] = jours[e.le] || []).push(e); });
  return Object.keys(jours).sort().map(function (jour) {
    const elements = jours[jour].sort(function (a, b) { return String(a.heure || '').localeCompare(String(b.heure || '')); });
    return '<div class="carte" style="margin-top:10px;"><h3 style="font-family:Montserrat,sans-serif;font-size:1rem;color:#5A3A6A;margin-bottom:4px;">' +
      albEchapper(titreJour(jour)) + ' <span class="etiquette">' + elements.length + '</span></h3>' + elements.map(ligneAgenda).join('') + '</div>';
  }).join('');
}

function formulaireAgenda() {
  const r = agendaFormulaire && agendaFormulaire !== 'nouveau' ? (agenda.rdv || []).find(function (x) { return x.id === agendaFormulaire; }) || {} : {};
  const genre = r.genre || 'rdv';
  return '<div class="decision" id="agenda-formulaire"><div class="decision-titre">' + (r.id ? '✏️ Modifier' : '➕ Nouveau rendez-vous ou tâche') + '</div>' +
    '<div class="grille">' +
      '<label class="petit-champ">C\'est<select id="ag-genre"><option value="rdv"' + (genre === 'rdv' ? ' selected' : '') + '>📌 Un rendez-vous</option><option value="tache"' + (genre === 'tache' ? ' selected' : '') + '>📝 Une tâche à faire</option></select></label>' +
      '<label class="petit-champ">Thème<select id="ag-theme"><option value="">Automatique (d\'après le titre)</option>' + Object.keys(THEMES_AGENDA).map(function (k) { return '<option value="' + albEchapper(k) + '"' + (r.theme === k ? ' selected' : '') + '>' + THEMES_AGENDA[k].e + ' ' + albEchapper(k) + '</option>'; }).join('') + '</select></label>' +
      '<label class="petit-champ">Date<input type="date" id="ag-le" value="' + albEchapper(r.le || jourIso(0)) + '"></label>' +
      '<label class="petit-champ">Heure (facultatif)<input type="time" id="ag-heure" value="' + albEchapper(String(r.heure || '').slice(0, 5)) + '"></label>' +
      '<label class="petit-champ">Quoi ?<input type="text" id="ag-titre" maxlength="200" placeholder="Ex. : Café avec Pauline, appeler un courtier…" value="' + albEchapper(r.titre || '') + '"></label>' +
      '<label class="petit-champ">Où ? (facultatif)<input type="text" id="ag-lieu" maxlength="200" placeholder="Ex. : Saint-Maximin, en visio…" value="' + albEchapper(r.lieu || '') + '"></label>' +
    '</div>' +
    '<label class="petit-champ" style="margin-top:8px;">Note (facultatif)<textarea id="ag-note" maxlength="1000" style="min-height:60px;">' + albEchapper(r.note || '') + '</textarea></label>' +
    '<p class="aide" style="margin-top:6px;">Si tu ne coches pas « fait », il remonte tout seul à aujourd\'hui, en rouge « en retard », jusqu\'à ce que tu le coches.</p>' +
    '<div class="actions"><button type="button" class="bouton vert" onclick="agendaEnregistrer(this)">💾 Enregistrer</button>' +
    '<button type="button" class="bouton discret" onclick="agendaFermer()">Annuler</button></div></div>';
}

function afficherAgenda() {
  preparerOngletAgenda();
  const panneau = document.getElementById('panneau-agenda');
  if (!panneau) return;
  const auj = jourIso(0);
  const fin = agendaPeriode ? jourIso(agendaPeriode) : '9999-12-31';
  const toutSansFiltre = elementsAgenda();
  const tout = toutSansFiltre.filter(function (e) { return !agendaTheme || e.theme === agendaTheme; });
  const aVenir = tout.filter(function (e) { return e.le >= auj && e.le <= fin; });
  const passes = tout.filter(function (e) { return e.le < auj && e.rdv && e.rdv.fait_le; }).reverse();
  const nbRetard = toutSansFiltre.filter(function (e) { return e.retard && !(e.rdv && e.rdv.fait_le); }).length;
  const compteTheme = function (k) { return toutSansFiltre.filter(function (e) { return e.theme === k && e.le >= auj && e.le <= fin; }).length; };
  const filtreThemes = '<select onchange="agendaTheme=this.value; afficherAgenda();" style="width:auto;"><option value="">Tous les thèmes</option>' +
    Object.keys(THEMES_AGENDA).map(function (k) { const n = compteTheme(k); return (n || agendaTheme === k) ? '<option value="' + albEchapper(k) + '"' + (agendaTheme === k ? ' selected' : '') + '>' + THEMES_AGENDA[k].e + ' ' + albEchapper(k) + ' (' + n + ')</option>' : ''; }).join('') + '</select>';
  const nbAuj = rdvDuJour().length;
  const pastille = document.getElementById('pastille-agenda');
  if (pastille) { pastille.textContent = nbAuj; pastille.classList.toggle('cache', !nbAuj); }
  const choix = function (jours, texte) {
    return '<button type="button" class="bouton ' + (agendaPeriode === jours ? '' : 'discret') + '" onclick="agendaChoisirPeriode(' + jours + ')">' + texte + '</button>';
  };
  // On garde ce qui est en cours de saisie si la liste se redessine
  const enCours = document.getElementById('agenda-formulaire') ? ['ag-le', 'ag-heure', 'ag-titre', 'ag-lieu', 'ag-note', 'ag-genre', 'ag-theme'].map(function (id) { return document.getElementById(id).value; }) : null;
  panneau.innerHTML =
    '<p class="aide">Tes rendez-vous (📌) et tes tâches (📝), et les dates du site ajoutées toutes seules (visites confirmées, membres à relancer, fins de validité, fins de mandat, rappels). Rien n\'est envoyé à personne : c\'est ton agenda.</p>' +
    '<div class="actions" style="margin-top:0;">' +
      '<button type="button" class="bouton vert" onclick="agendaNouveau()">' + (agendaFormulaire ? '✖ Fermer' : '➕ Ajouter un rendez-vous ou une tâche') + '</button>' +
      (nbRetard ? '<span class="etiquette rouge" style="align-self:center;">⚠️ ' + nbRetard + ' en retard</span>' : '') +
    '</div>' +
    (agendaFormulaire ? formulaireAgenda() : '') +
    '<div class="actions">' + choix(7, '7 jours') + choix(30, '30 jours') + choix(90, '3 mois') + choix(0, 'Tout') +
      '<label style="display:flex;gap:6px;align-items:center;margin-left:6px;"><input type="checkbox" style="width:auto;flex:none;"' + (agendaDatesSite ? ' checked' : '') + ' onchange="agendaDatesSite=this.checked; afficherAgenda();"> Dates du site</label>' +
      filtreThemes +
    '</div>' +
    (aVenir.length ? blocJours(aVenir) : '<div class="vide" style="margin-top:10px;">Rien de prévu sur cette période. 🌿</div>') +
    (passes.length ? '<details class="historique" style="margin-top:12px;"><summary>📜 Rendez-vous passés (30 derniers jours)</summary>' + blocJours(passes) + '</details>' : '');
  if (enCours && document.getElementById('agenda-formulaire')) {
    ['ag-le', 'ag-heure', 'ag-titre', 'ag-lieu', 'ag-note', 'ag-genre', 'ag-theme'].forEach(function (id, i) { document.getElementById(id).value = enCours[i]; });
  }
}

function agendaChoisirPeriode(jours) { agendaPeriode = jours; afficherAgenda(); }
function agendaNouveau() { agendaFormulaire = agendaFormulaire ? null : 'nouveau'; afficherAgenda(); }
function agendaModifier(id) { agendaFormulaire = null; afficherAgenda(); agendaFormulaire = id; afficherAgenda(); document.getElementById('agenda-formulaire').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
function agendaFermer() { agendaFormulaire = null; afficherAgenda(); }

async function agendaEnregistrer(bouton) {
  const v = function (id) { return document.getElementById(id).value.trim(); };
  const rdv = { le: v('ag-le'), heure: v('ag-heure'), titre: v('ag-titre'), lieu: v('ag-lieu'), note: v('ag-note'), genre: v('ag-genre') || 'rdv', theme: v('ag-theme') };
  if (!rdv.titre) { afficherMessage('message-general', 'erreur', ERREURS.TITRE_MANQUANT); return; }
  if (!rdv.le) { afficherMessage('message-general', 'erreur', ERREURS.RDV_DATE_MANQUANTE); return; }
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_agenda_enregistrer', { p_id: agendaFormulaire === 'nouveau' ? null : agendaFormulaire, p_rdv: rdv });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  agendaFormulaire = null;
  await chargerAgenda();
  afficherAgenda();
  afficherAFaire();
  afficherMessage('message-general', 'succes', (rdv.genre === 'tache' ? 'Tâche' : 'Rendez-vous') + ' enregistré ✓');
}

async function agendaFait(id, fait, bouton) {
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_agenda_fait', { p_id: id, p_fait: fait });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerAgenda();
  afficherAgenda();
  afficherAFaire();
}

async function agendaRetirer(id, bouton) {
  if (!confirm('Retirer ce rendez-vous de ton agenda ?')) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_agenda_retirer', { p_id: id });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  if (agendaFormulaire === id) agendaFormulaire = null;
  await chargerAgenda();
  afficherAgenda();
  afficherAFaire();
  afficherMessage('message-general', 'succes', 'Rendez-vous retiré.');
}

// « À faire aujourd'hui » : tout en haut, les rendez-vous du jour
LIGNES_A_FAIRE.unshift({
  calcul: function () { return rdvDuJour().length; },
  un: 'chose à faire aujourd\'hui (ou en retard) dans ton agenda', plusieurs: 'choses à faire aujourd\'hui (ou en retard) dans ton agenda', emoji: '📅', onglet: 'agenda'
});

preparerOngletAgenda();
(function () {
  const toutRechargerAvantAgenda = toutRecharger;
  toutRecharger = async function () {
    await Promise.all([toutRechargerAvantAgenda(), chargerAgenda()]);
    afficherAgenda();
    afficherAFaire();
  };
})();

// ----- 📇 Carnet (onglet juste après « Agenda ») -----
// Les personnes pas encore inscrites sur ALB Immobilier : un pro rencontré en
// visio, un particulier au téléphone… avec des notes datées (la plus récente
// en haut), où on en est, et la date à laquelle le relancer (elle apparaît
// dans l'agenda et dans « À faire aujourd'hui »). Quand il est prêt :
// « ✅ L'inscrire sur ALB » ouvre « Ajouter un membre » déjà rempli.
let carnet = [];
let carnetFiltre = 'actifs';     // actifs | a_relancer | tous | <étape>
let carnetFormulaire = null;     // null, 'nouveau' ou l'id du contact en cours de modification
let carnetNoteOuverte = {};      // id du contact → zone « Ajouter une note » ouverte
let carnetDerniereOrigine = '';  // pour enchaîner plusieurs contacts d'une même visio
const METIERS_CARNET = { courtier: '🏦 Courtier', artisan: '🔨 Artisan', agent: '🏠 Agent immobilier', mandataire: '📋 Mandataire', autre_pro: '🤝 Autre pro', particulier: '🙋 Particulier' };
const ETAPES_CARNET = { a_relancer: '📞 À relancer', en_discussion: '💬 En discussion', interesse: '👍 Intéressé', inscrit: '✅ Inscrit sur ALB', pas_interesse: '🚫 Pas intéressé' };
ERREURS.NOM_CONTACT_MANQUANT = 'Indique au moins un prénom, un nom ou une entreprise.';
ERREURS.CONTACT_INTROUVABLE = 'Ce contact n\'existe plus.';
ERREURS.ETAPE_INVALIDE = 'Choisis où vous en êtes dans la liste.';

async function chargerCarnet() {
  const { data, error } = await albSupabase.rpc('alb_gestion_carnet');
  if (error) { console.error('[ALB DEBUG] carnet :', error); return; }
  carnet = data || [];
}

function nomContact(c) { return ((c.prenom || '') + ' ' + (c.nom || '')).trim() || c.entreprise || 'Contact'; }
function contactARelancer(c) { return !!c.relancer_le && c.relancer_le <= jourIso(0) && c.etape !== 'inscrit' && c.etape !== 'pas_interesse'; }

function contactsFiltres() {
  const q = ((document.getElementById('recherche-carnet') || {}).value || '').toLowerCase().trim();
  return carnet.filter(function (c) {
    if (carnetFiltre === 'actifs' && (c.etape === 'inscrit' || c.etape === 'pas_interesse')) return false;
    if (carnetFiltre === 'a_relancer' && !contactARelancer(c)) return false;
    if (ETAPES_CARNET[carnetFiltre] && c.etape !== carnetFiltre) return false;
    if (!q) return true;
    return [c.prenom, c.nom, c.entreprise, c.telephone, c.email, c.ville, c.origine, c.journal, METIERS_CARNET[c.metier]]
      .join(' ').toLowerCase().indexOf(q) !== -1 || String(c.telephone || '').replace(/\D/g, '').indexOf(q.replace(/\D/g, '') || '§') !== -1;
  }).sort(function (a, b) {
    // D'abord ceux à relancer (le plus ancien en premier), puis les plus récents
    const ra = contactARelancer(a), rb = contactARelancer(b);
    if (ra !== rb) return ra ? -1 : 1;
    if (ra && rb) return a.relancer_le.localeCompare(b.relancer_le);
    return String(b.maj_le).localeCompare(String(a.maj_le));
  });
}

function formulaireContact() {
  const c = carnetFormulaire && carnetFormulaire !== 'nouveau' ? carnet.find(function (x) { return x.id === carnetFormulaire; }) || {} : { origine: carnetDerniereOrigine };
  const options = function (liste, valeur, vide) {
    return (vide ? '<option value="">' + vide + '</option>' : '') + Object.keys(liste).map(function (k) { return '<option value="' + k + '"' + (valeur === k ? ' selected' : '') + '>' + liste[k] + '</option>'; }).join('');
  };
  return '<div class="decision" id="carnet-formulaire"><div class="decision-titre">' + (c.id ? '✏️ Modifier ' + albEchapper(nomContact(c)) : '➕ Nouveau contact') + '</div>' +
    '<div class="grille">' +
      '<label class="petit-champ">Prénom<input type="text" id="ca-prenom" maxlength="80" value="' + albEchapper(c.prenom || '') + '"></label>' +
      '<label class="petit-champ">Nom<input type="text" id="ca-nom" maxlength="80" value="' + albEchapper(c.nom || '') + '"></label>' +
      '<label class="petit-champ">Entreprise<input type="text" id="ca-entreprise" maxlength="150" value="' + albEchapper(c.entreprise || '') + '"></label>' +
      '<label class="petit-champ">C\'est…<select id="ca-metier">' + options(METIERS_CARNET, c.metier || '', '— Choisis —') + '</select></label>' +
      '<label class="petit-champ">Téléphone<input type="tel" id="ca-tel" maxlength="30" value="' + albEchapper(c.telephone || '') + '"></label>' +
      '<label class="petit-champ">E-mail<input type="email" id="ca-email" maxlength="200" autocomplete="off" value="' + albEchapper(c.email || '') + '"></label>' +
      '<label class="petit-champ">Ville<input type="text" id="ca-ville" maxlength="80" value="' + albEchapper(c.ville || '') + '"></label>' +
      '<label class="petit-champ">D\'où il vient<input type="text" id="ca-origine" maxlength="200" placeholder="Ex. : Visio courtiers du 20 octobre" value="' + albEchapper(c.origine || '') + '"></label>' +
      '<label class="petit-champ">Où vous en êtes<select id="ca-etape">' + options(ETAPES_CARNET, c.etape || 'a_relancer') + '</select></label>' +
      '<label class="petit-champ">Le relancer le (facultatif)<input type="date" id="ca-relance" value="' + albEchapper(c.relancer_le || '') + '"></label>' +
    '</div>' +
    '<label class="petit-champ" style="margin-top:8px;">' + (c.id ? 'Ajouter une note (facultatif, datée d\'aujourd\'hui)' : 'Note (facultatif)') + '<textarea id="ca-note" maxlength="2000" style="min-height:70px;" placeholder="Ce que vous vous êtes dit, ce qu\'il attend…"></textarea></label>' +
    '<div class="actions"><button type="button" class="bouton vert" onclick="carnetEnregistrer(this, false)">💾 Enregistrer</button>' +
      (c.id ? '' : '<button type="button" class="bouton" onclick="carnetEnregistrer(this, true)">💾 Enregistrer et en ajouter un autre</button>') +
      '<button type="button" class="bouton discret" onclick="carnetFermer()">Annuler</button></div></div>';
}

function carteContact(c) {
  const num = String(c.telephone || '').replace(/[^0-9+]/g, '');
  const relance = c.relancer_le ? '<span class="etiquette ' + (contactARelancer(c) ? 'rouge' : '') + '">⏰ Relancer le ' + albEchapper(dateLisible(c.relancer_le + 'T12:00:00')) + '</span>' : '';
  const ouverte = carnetNoteOuverte[c.id];
  return '<div class="carte">' +
    '<h3 style="font-family:Montserrat,sans-serif;font-size:1.05rem;">' + albEchapper(nomContact(c)) +
      (c.entreprise && nomContact(c) !== c.entreprise ? ' <span style="font-weight:400;color:#6a6a65;">· ' + albEchapper(c.entreprise) + '</span>' : '') + '</h3>' +
    '<p class="ligne-info">' + (c.metier ? '<span class="etiquette">' + albEchapper(METIERS_CARNET[c.metier] || c.metier) + '</span> ' : '') +
      '<span class="etiquette ' + (c.etape === 'inscrit' ? 'vert' : c.etape === 'interesse' ? 'or' : '') + '">' + albEchapper(ETAPES_CARNET[c.etape] || c.etape) + '</span> ' + relance + '</p>' +
    (num ? '<p class="ligne-info">📱 <a href="tel:' + albEchapper(num) + '"><strong>' + albEchapper(c.telephone) + '</strong></a></p>' : '') +
    (c.email ? '<p class="ligne-info">✉️ <a href="mailto:' + albEchapper(c.email) + '">' + albEchapper(c.email) + '</a></p>' : '') +
    (c.ville || c.origine ? '<p class="ligne-info">' + [c.ville ? '📍 ' + albEchapper(c.ville) : '', c.origine ? '🧭 ' + albEchapper(c.origine) : ''].filter(Boolean).join(' · ') + '</p>' : '') +
    (c.journal ? '<details class="historique"' + (ouverte ? '' : ' open') + '><summary>📝 Notes</summary><div class="ligne-info" style="white-space:pre-line;overflow-wrap:anywhere;">' + albEchapper(c.journal) + '</div></details>' : '') +
    (ouverte
      ? '<div class="decision"><div class="decision-titre">📝 Après votre échange</div>' +
          '<label class="petit-champ">Ce que vous vous êtes dit<textarea id="cn-note-' + c.id + '" maxlength="2000" style="min-height:70px;"></textarea></label>' +
          '<div class="grille">' +
            '<label class="petit-champ">Le relancer le<input type="date" id="cn-relance-' + c.id + '" value="' + albEchapper(c.relancer_le && c.relancer_le > jourIso(0) ? c.relancer_le : '') + '"></label>' +
            '<label class="petit-champ">Où vous en êtes<select id="cn-etape-' + c.id + '">' + Object.keys(ETAPES_CARNET).map(function (k) { return '<option value="' + k + '"' + (c.etape === k ? ' selected' : '') + '>' + ETAPES_CARNET[k] + '</option>'; }).join('') + '</select></label>' +
          '</div>' +
          '<div class="actions"><button type="button" class="bouton vert" onclick="carnetNoter(\'' + c.id + '\', this)">💾 Enregistrer</button>' +
          '<button type="button" class="bouton discret" onclick="carnetOuvrirNote(\'' + c.id + '\')">Annuler</button></div></div>'
      : '') +
    '<div class="actions">' +
      (num ? '<a class="bouton" href="tel:' + albEchapper(num) + '">📞 Appeler</a>' : '') +
      (ouverte ? '' : '<button type="button" class="bouton vert" onclick="carnetOuvrirNote(\'' + c.id + '\')">📝 Ajouter une note</button>') +
      '<button type="button" class="bouton discret" onclick="carnetModifier(\'' + c.id + '\')">✏️ Modifier</button>' +
      (c.etape !== 'inscrit' ? '<button type="button" class="bouton discret" onclick="carnetInscrire(\'' + c.id + '\')">✅ L\'inscrire sur ALB</button>' : '') +
      '<button type="button" class="bouton discret" onclick="carnetRetirer(\'' + c.id + '\', this)">🗑️ Retirer</button>' +
    '</div></div>';
}

function afficherCarnet() {
  preparerOngletAgenda();
  const panneau = document.getElementById('panneau-carnet');
  if (!panneau) return;
  const aRelancer = carnet.filter(contactARelancer).length;
  const pastille = document.getElementById('pastille-carnet');
  if (pastille) { pastille.textContent = aRelancer; pastille.classList.toggle('cache', !aRelancer); }
  // On garde la recherche et ce qui est en cours de saisie
  const recherche = (document.getElementById('recherche-carnet') || {}).value || '';
  const champs = ['ca-prenom', 'ca-nom', 'ca-entreprise', 'ca-metier', 'ca-tel', 'ca-email', 'ca-ville', 'ca-origine', 'ca-etape', 'ca-relance', 'ca-note'];
  const enCours = document.getElementById('carnet-formulaire') ? champs.map(function (id) { return document.getElementById(id).value; }) : null;
  const notesEnCours = {};
  Object.keys(carnetNoteOuverte).forEach(function (id) { const t = document.getElementById('cn-note-' + id); if (t) notesEnCours[id] = t.value; });
  const filtre = function (cle, texte, nb) {
    return '<button type="button" class="filtre' + (carnetFiltre === cle ? ' actif' : '') + '" onclick="carnetChoisirFiltre(\'' + cle + '\')">' + texte + ' <span class="nb">(' + nb + ')</span></button>';
  };
  const liste = contactsFiltres();
  panneau.innerHTML =
    '<p class="aide">Les personnes qui ne sont pas (encore) inscrites sur ALB Immobilier : un pro rencontré en visio, un particulier au téléphone… ' +
      'Note ce que vous vous êtes dit et quand le relancer : il apparaîtra ce jour-là dans ton agenda et dans « À faire aujourd\'hui ». Rien n\'est envoyé à personne.</p>' +
    '<div class="actions" style="margin-top:0;"><button type="button" class="bouton vert" onclick="carnetNouveau()">' + (carnetFormulaire ? '✖ Fermer' : '➕ Ajouter un contact') + '</button></div>' +
    (carnetFormulaire ? formulaireContact() : '') +
    '<input type="search" class="recherche" id="recherche-carnet" autocomplete="off" style="margin-top:12px;" placeholder="Rechercher un nom, une entreprise, un téléphone, une note…" oninput="afficherListeCarnet()" value="' + albEchapper(recherche) + '">' +
    '<div class="filtres">' +
      filtre('actifs', 'En cours', carnet.filter(function (c) { return c.etape !== 'inscrit' && c.etape !== 'pas_interesse'; }).length) +
      filtre('a_relancer', '⏰ À relancer aujourd\'hui', aRelancer) +
      Object.keys(ETAPES_CARNET).map(function (k) { return filtre(k, ETAPES_CARNET[k], carnet.filter(function (c) { return c.etape === k; }).length); }).join('') +
      filtre('tous', 'Tous', carnet.length) +
    '</div>' +
    '<div id="liste-carnet">' + htmlListeCarnet(liste) + '</div>';
  if (enCours && document.getElementById('carnet-formulaire')) champs.forEach(function (id, i) { document.getElementById(id).value = enCours[i]; });
  Object.keys(notesEnCours).forEach(function (id) { const t = document.getElementById('cn-note-' + id); if (t) t.value = notesEnCours[id]; });
}

function htmlListeCarnet(liste) {
  return liste.length ? '<div class="liste-fiches">' + liste.map(carteContact).join('') + '</div>'
    : '<div class="vide">' + (carnet.length ? 'Personne avec ces critères.' : 'Ton carnet est vide pour l\'instant. Ajoute ton premier contact avec « ➕ Ajouter un contact ». 🌿') + '</div>';
}
// Pendant la recherche, seule la liste est redessinée (le champ garde la main)
function afficherListeCarnet() {
  const zone = document.getElementById('liste-carnet');
  if (zone) zone.innerHTML = htmlListeCarnet(contactsFiltres());
}

function carnetChoisirFiltre(cle) { carnetFiltre = cle; afficherCarnet(); }
function carnetNouveau() { carnetFormulaire = carnetFormulaire ? null : 'nouveau'; afficherCarnet(); }
function carnetFermer() { carnetFormulaire = null; afficherCarnet(); }
function carnetModifier(id) {
  carnetFormulaire = null; afficherCarnet();
  carnetFormulaire = id; afficherCarnet();
  document.getElementById('carnet-formulaire').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function carnetOuvrirNote(id) { carnetNoteOuverte[id] = !carnetNoteOuverte[id]; afficherCarnet(); }

async function carnetEnregistrer(bouton, encoreUn) {
  const v = function (id) { return document.getElementById(id).value.trim(); };
  const fiche = {
    prenom: v('ca-prenom'), nom: v('ca-nom'), entreprise: v('ca-entreprise'), metier: v('ca-metier'),
    telephone: v('ca-tel'), email: v('ca-email'), ville: v('ca-ville'), origine: v('ca-origine'),
    etape: v('ca-etape'), relancer_le: v('ca-relance'), note: v('ca-note')
  };
  if (!fiche.prenom && !fiche.nom && !fiche.entreprise) { afficherMessage('message-general', 'erreur', ERREURS.NOM_CONTACT_MANQUANT); return; }
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_carnet_enregistrer', { p_id: carnetFormulaire === 'nouveau' ? null : carnetFormulaire, p_fiche: fiche });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  carnetDerniereOrigine = fiche.origine;
  const nouveau = carnetFormulaire === 'nouveau';
  // « Enregistrer et en ajouter un autre » : le formulaire se vide, l'origine reste (pratique après une visio à plusieurs)
  carnetFormulaire = null;
  await chargerCarnet();
  afficherCarnet();
  if (encoreUn) { carnetFormulaire = 'nouveau'; afficherCarnet(); document.getElementById('ca-prenom').focus(); }
  afficherAgenda();
  afficherAFaire();
  afficherMessage('message-general', 'succes', nouveau ? 'Contact ajouté au carnet ✓' : 'Contact enregistré ✓');
}

async function carnetNoter(id, bouton) {
  const note = document.getElementById('cn-note-' + id).value;
  const relance = document.getElementById('cn-relance-' + id).value || null;
  const etape = document.getElementById('cn-etape-' + id).value;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_carnet_noter', { p_id: id, p_note: note, p_relancer_le: relance, p_etape: etape });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  carnetNoteOuverte[id] = false;
  await chargerCarnet();
  afficherCarnet();
  afficherAgenda();
  afficherAFaire();
  afficherMessage('message-general', 'succes', 'C\'est noté ✓' + (relance ? ' Relance prévue le ' + dateLisible(relance + 'T12:00:00') + '.' : ''));
}

async function carnetRetirer(id, bouton) {
  const c = carnet.find(function (x) { return x.id === id; }) || {};
  if (!confirm('Retirer ' + nomContact(c) + ' de ton carnet ? Ses notes seront effacées.')) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_carnet_retirer', { p_id: id });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerCarnet();
  afficherCarnet();
  afficherAgenda();
  afficherAFaire();
  afficherMessage('message-general', 'succes', 'Contact retiré du carnet.');
}

// « ✅ L'inscrire sur ALB » : ouvre « Ajouter un membre » (Suivi des membres), déjà rempli.
// Une fois son espace créé, passe-le en « ✅ Inscrit sur ALB » dans le carnet.
function carnetInscrire(id) {
  const c = carnet.find(function (x) { return x.id === id; });
  if (!c || typeof afficherAjoutMembre !== 'function') return;
  afficherOnglet('membres');
  formulaireEspace[AJOUT] = true;
  afficherAjoutMembre();
  const remplir = function (champ, valeur) { const el = document.getElementById('es-' + champ + '-' + AJOUT); if (el && valeur) el.value = valeur; };
  remplir('prenom', c.prenom); remplir('nom', c.nom); remplir('email', c.email); remplir('tel', c.telephone);
  const estPro = c.metier && c.metier !== 'particulier';
  const radio = document.querySelector('input[name="es-qui-' + AJOUT + '"][value="' + (estPro ? 'pro' : 'particulier') + '"]');
  if (radio) { radio.checked = true; basculerQuiEspace(AJOUT); }
  if (estPro) {
    remplir('metier', c.metier === 'autre_pro' ? 'autre' : c.metier);
    remplir('entreprise', c.entreprise);
    basculerQuiEspace(AJOUT);
  }
  remplir('note', [c.origine ? 'Vient de : ' + c.origine : '', c.journal || ''].filter(Boolean).join('\n'));
  const formulaire = document.getElementById('form-espace-' + AJOUT);
  if (formulaire) formulaire.scrollIntoView({ behavior: 'smooth', block: 'start' });
  afficherMessage('message-general', 'succes', 'Vérifie les informations, puis clique « ✅ Créer son espace ». Pense ensuite à le passer en « ✅ Inscrit sur ALB » dans ton carnet.');
}

// « À faire aujourd'hui » : les contacts du carnet à relancer
LIGNES_A_FAIRE.splice(1, 0, {
  calcul: function () { return carnet.filter(contactARelancer).length; },
  un: 'contact de ton carnet à relancer', plusieurs: 'contacts de ton carnet à relancer', emoji: '📇', onglet: 'carnet',
  filtre: function () { carnetChoisirFiltre('a_relancer'); }
});

(function () {
  const toutRechargerAvantCarnet = toutRecharger;
  toutRecharger = async function () {
    await Promise.all([toutRechargerAvantCarnet(), chargerCarnet()]);
    afficherCarnet();
    afficherAgenda();
    afficherAFaire();
  };
})();

// ----- 🚪 Départs (onglet juste après « Suivi des membres ») -----
// Un membre clique « Quitter ALB Immobilier » dans son espace : sa demande arrive
// ici (et dans « À faire aujourd'hui »). Jocelyne l'appelle si elle veut, puis
// « 🚪 Fermer son compte » : plus de connexion possible, annonces en pause, fiche
// hors de « Nos pros ALB » (comme une suspension), et c'est noté.
// Elle peut aussi fermer le compte de quelqu'un d'elle-même, depuis « Suivi des membres ».
// Rien n'est effacé automatiquement : l'effacement des données se fait à part.
let departs = [];
ERREURS.DEPART_INTROUVABLE = 'Cette demande a déjà été traitée.';
ERREURS.SUSPENSION_ADMIN = 'Impossible de fermer un compte de l\'équipe ALB.';

async function chargerDeparts() {
  const { data, error } = await albSupabase.rpc('alb_gestion_departs');
  if (error) { console.error('[ALB DEBUG] départs :', error); return; }
  departs = data || [];
}

function departsEnAttente() { return departs.filter(function (d) { return d.statut === 'en_attente'; }); }
function compteFerme(id) { return departs.some(function (d) { return d.profile_id === id && d.statut === 'ferme'; }); }

function carteDepart(d) {
  const num = String(d.telephone || '').replace(/[^0-9+]/g, '');
  const nom = ((d.prenom || '') + ' ' + (d.nom || '')).trim() || 'Membre';
  const qui = d.role && d.role !== 'particulier' ? '🧑‍💼 Pro' + (d.nom_entreprise ? ' · ' + d.nom_entreprise : '') : '🙋 Particulier';
  const enAttente = d.statut === 'en_attente';
  return '<div class="carte"' + (enAttente ? '' : ' style="opacity:0.8;"') + '>' +
    '<h3 style="font-family:Montserrat,sans-serif;font-size:1.05rem;">' + albEchapper(nom) + ' ' +
      (enAttente ? '<span class="etiquette rouge">🚪 Veut quitter ALB</span>'
        : d.statut === 'ferme' ? '<span class="etiquette">🔒 Compte fermé le ' + albEchapper(dateLisible(d.traite_le)) + '</span>'
        : '<span class="etiquette vert">↩️ Reste sur ALB</span>') + '</h3>' +
    '<p class="ligne-info"><span class="etiquette">' + albEchapper(qui) + '</span></p>' +
    (num ? '<p class="ligne-info">📱 <a href="tel:' + albEchapper(num) + '"><strong>' + albEchapper(d.telephone) + '</strong></a></p>' : '') +
    (d.email ? '<p class="ligne-info">✉️ <a href="mailto:' + albEchapper(d.email) + '">' + albEchapper(d.email) + '</a></p>' : '') +
    '<p class="ligne-info">' + (d.par === 'membre' ? '📩 Demandé par le membre le ' : '✋ Décidé par toi le ') + albEchapper(dateLisible(d.cree_le)) + '</p>' +
    (d.raison && d.par === 'membre' ? '<p class="ligne-info mot">💬 « ' + albEchapper(d.raison) + ' »</p>' : '') +
    (d.note ? '<p class="ligne-info">📝 ' + albEchapper(d.note) + '</p>' : '') +
    (enAttente
      ? '<p class="ligne-info">' + (d.en_ligne ? '🌐 Sa fiche est en ligne sur « Nos pros ALB ». ' : '') + (d.nb_annonces ? '🏡 ' + d.nb_annonces + ' annonce' + (d.nb_annonces > 1 ? 's' : '') + '. ' : '') + '</p>' +
        '<label class="petit-champ" style="margin-top:8px;">Ta note (facultatif)<textarea id="depart-note-' + d.id + '" maxlength="500" style="min-height:60px;" placeholder="Ex. : appelé, confirme son départ"></textarea></label>' +
        '<div class="actions">' + (num ? '<a class="bouton" href="tel:' + albEchapper(num) + '">📞 Appeler</a>' : '') +
          '<button type="button" class="bouton rouge" onclick="fermerCompte(\'' + d.profile_id + '\', \'' + d.id + '\', this)">🚪 Fermer son compte</button>' +
          '<button type="button" class="bouton discret" onclick="annulerDepart(\'' + d.id + '\', this)">↩️ Il reste sur ALB</button></div>'
      : d.statut === 'ferme'
        ? '<p class="aide">Plus de connexion possible, annonces en pause, fiche hors ligne. Ses données sont toujours enregistrées : leur effacement se fait à part (délai légal : un mois après sa demande). Pour le remettre : « ▶️ Remettre ce membre » dans Suivi des membres.</p>'
        : '') +
  '</div>';
}

function afficherDeparts() {
  preparerOngletAgenda();
  const panneau = document.getElementById('panneau-departs');
  if (!panneau) return;
  const attente = departsEnAttente();
  const autres = departs.filter(function (d) { return d.statut !== 'en_attente'; });
  const pastille = document.getElementById('pastille-departs');
  if (pastille) { pastille.textContent = attente.length; pastille.classList.toggle('cache', !attente.length); }
  panneau.innerHTML =
    '<p class="aide">Les membres qui ont demandé à quitter ALB Immobilier depuis leur espace. Appelle-les si tu veux, puis ferme leur compte, ou note qu\'ils restent. ' +
      'Pour retirer quelqu\'un toi-même : « 🚪 Fermer son compte » sur sa carte, dans Suivi des membres. Aucun message n\'est envoyé automatiquement.</p>' +
    (attente.length ? '<div class="liste-fiches">' + attente.map(carteDepart).join('') + '</div>' : '<div class="vide">Aucune demande de départ. 🌿</div>') +
    (autres.length ? '<details class="historique" style="margin-top:12px;"><summary>📜 Déjà traités (' + autres.length + ')</summary><div class="liste-fiches" style="margin-top:8px;">' + autres.map(carteDepart).join('') + '</div></details>' : '');
}

async function fermerCompte(profileId, departId, bouton, motif) {
  const champ = departId ? document.getElementById('depart-note-' + departId) : document.getElementById('fermer-motif-' + profileId);
  const note = motif !== undefined ? motif : (champ ? champ.value : '');
  if (!confirm('Fermer ce compte ? La personne ne pourra plus se connecter, ses annonces passent en pause et sa fiche sort de « Nos pros ALB ». Tu pourras le remettre plus tard si besoin.')) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_fermer_compte', { p_profile: profileId, p_depart: departId || null, p_motif: note });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  if (typeof panneauOuvert !== 'undefined') panneauOuvert[profileId] = null;
  await toutRecharger();
  afficherMessage('message-general', 'succes', 'Compte fermé ✓ La personne ne peut plus se connecter. Aucun message ne lui a été envoyé.');
}

async function annulerDepart(departId, bouton) {
  const champ = document.getElementById('depart-note-' + departId);
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_depart_annuler', { p_id: departId, p_note: champ ? champ.value : null });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerDeparts();
  afficherDeparts();
  afficherAFaire();
  afficherMessage('message-general', 'succes', 'C\'est noté : il reste sur ALB ✓');
}

// Sur chaque carte de « Suivi des membres » : « 🚪 Fermer son compte », juste après « ⛔ Suspendre »
(function () {
  const carteMembreAvantDepart = carteMembre;
  carteMembre = function (m) {
    const html = carteMembreAvantDepart(m);
    if (m.est_admin || (compteFerme(m.id) && html.indexOf('▶️ Remettre ce membre</button>') !== -1)) return html;
    const bouton = '<button type="button" class="bouton rouge" onclick="ouvrirPanneauMembre(\'' + m.id + '\', \'fermer\')">🚪 Fermer son compte</button>';
    const apres = html.indexOf('⛔ Suspendre</button>') !== -1 ? '⛔ Suspendre</button>' : '▶️ Remettre ce membre</button>';
    return html.replace(apres, apres + bouton);
  };
  const panneauMembreAvantDepart = panneauMembre;
  panneauMembre = function (m, quoi) {
    if (quoi !== 'fermer') return panneauMembreAvantDepart(m, quoi);
    const id = m.id;
    return '<div class="decision" style="border-color:#F0CACA;background:#FFFBFB;"><div class="decision-titre">🚪 Fermer le compte de ' + albEchapper(((m.prenom || '') + ' ' + (m.nom || '')).trim() || 'ce membre') + '</div>' +
      '<p class="ligne-info">Pour retirer quelqu\'un de la plateforme. Ce qui va se passer :</p><ul style="margin:4px 0 8px 18px;color:#4A4A47;font-size:0.9rem;">' +
        '<li>plus aucune connexion possible ;</li>' +
        '<li>ses annonces en ligne passent « en pause » et sa fiche sort de « Nos pros ALB » ;</li>' +
        '<li>la fermeture est notée dans 🚪 Départs et dans son historique ;</li>' +
        '<li>rien n\'est effacé pour l\'instant, et aucun message ne lui est envoyé.</li>' +
      '</ul>' +
      '<label class="petit-champ">Pourquoi (pour toi, facultatif)<textarea id="fermer-motif-' + id + '" maxlength="500" style="min-height:60px;"></textarea></label>' +
      '<div class="actions"><button type="button" class="bouton rouge" onclick="fermerCompte(\'' + id + '\', null, this)">🚪 Oui, fermer son compte</button>' +
      '<button type="button" class="bouton discret" onclick="ouvrirPanneauMembre(\'' + id + '\', \'fermer\')">Annuler</button></div></div>';
  };
})();

// « À faire aujourd'hui » : les demandes de départ, juste après les rendez-vous du jour
LIGNES_A_FAIRE.splice(1, 0, {
  calcul: function () { return departsEnAttente().length; },
  un: 'membre qui demande à quitter ALB Immobilier', plusieurs: 'membres qui demandent à quitter ALB Immobilier', emoji: '🚪', onglet: 'departs'
});

(function () {
  const toutRechargerAvantDeparts = toutRecharger;
  toutRecharger = async function () {
    await Promise.all([toutRechargerAvantDeparts(), chargerDeparts()]);
    afficherDeparts();
    if (typeof afficherMembres === 'function') afficherMembres();
    afficherAFaire();
  };
})();

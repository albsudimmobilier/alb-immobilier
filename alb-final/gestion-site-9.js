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
let agendaLienPrevu = '';      // personne déjà choisie quand on ouvre l'agenda depuis une fiche (« membre:id » ou « carnet:id »)
let agendaFaitOuvert = null;   // id de l'élément dont on est en train de cocher « fait » (zone de note ouverte)
const REPETITIONS = { semaine: 'chaque semaine', mois: 'chaque mois', an: 'chaque année' };
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
  // Lié à quelqu'un : le thème vient de la personne
  if (r.lien_type === 'carnet') return 'Réseau et prospection';
  if (r.lien_type === 'membre') {
    const m = personneLiee(r);
    if (m) return m.role && m.role !== 'particulier' ? 'Pros' : 'Particuliers';
  }
  const m = MOTS_THEMES.find(function (x) { return x[1].test((r.titre || '') + ' ' + (r.note || '')); });
  return m ? m[0] : 'Organisation et perso';
}

// ---------- Lier un rendez-vous ou une tâche à une personne ----------
// La personne liée (un membre du site ou un contact du carnet), ou null
function personneLiee(r) {
  if (!r || !r.lien_id) return null;
  if (r.lien_type === 'membre') return (typeof membres !== 'undefined' ? membres : []).find(function (m) { return m.id === r.lien_id; }) || null;
  if (r.lien_type === 'carnet') return (typeof carnet !== 'undefined' ? carnet : []).find(function (c) { return c.id === r.lien_id; }) || null;
  return null;
}
// Le nom à afficher, avec son métier ou « particulier »
function nomLien(r) {
  const p = personneLiee(r);
  if (!p) return r.lien_nom || '';
  if (r.lien_type === 'carnet') return nomContact(p) + (p.metier ? ' (' + (METIERS_CARNET[p.metier] || p.metier).replace(/^\S+\s/, '') + ')' : '') + ' · carnet';
  const metier = typeof metierDe === 'function' ? metierDe(p) : null;
  return nomAgenda(p) + (metier && typeof METIERS !== 'undefined' ? ' (' + METIERS[metier].replace(/^\S+\s/, '') + ')' : p.role === 'particulier' ? ' (particulier)' : '');
}
// La liste « Avec qui ? » du formulaire, rangée par catégorie
function choixPersonnes(r) {
  const actuel = r.lien_type && r.lien_id ? r.lien_type + ':' + r.lien_id : (r.id ? '' : agendaLienPrevu);
  const opt = function (val, texte) { return '<option value="' + albEchapper(val) + '"' + (val === actuel ? ' selected' : '') + '>' + albEchapper(texte) + '</option>'; };
  const tri = function (a, b) { return a[1].localeCompare(b[1], 'fr'); };
  const liste = typeof membres !== 'undefined' ? membres : [];
  const pros = liste.filter(function (m) { return m.role && m.role !== 'particulier'; }).map(function (m) { return ['membre:' + m.id, nomLien({ lien_type: 'membre', lien_id: m.id })]; }).sort(tri);
  const parts = liste.filter(function (m) { return !m.role || m.role === 'particulier'; }).map(function (m) { return ['membre:' + m.id, nomAgenda(m)]; }).sort(tri);
  const contacts = (typeof carnet !== 'undefined' ? carnet : []).map(function (c) { return ['carnet:' + c.id, nomContact(c) + (c.entreprise && c.entreprise !== nomContact(c) ? ' · ' + c.entreprise : '')]; }).sort(tri);
  const groupe = function (titre, items) { return items.length ? '<optgroup label="' + titre + '">' + items.map(function (x) { return opt(x[0], x[1]); }).join('') + '</optgroup>' : ''; };
  // Si la personne n'existe plus dans les listes, on garde quand même son nom
  const disparu = actuel && !pros.concat(parts, contacts).some(function (x) { return x[0] === actuel; }) ? opt(actuel, (r.lien_nom || 'Personne liée') + ' (plus dans les listes)') : '';
  return '<option value="">Personne en particulier</option>' + disparu + groupe('🤝 Pros', pros) + groupe('🏡 Particuliers', parts) + groupe('📇 Carnet', contacts);
}
// Ouvre la fiche de la personne liée
function voirPersonneLiee(type, id) {
  const r = { lien_type: type, lien_id: id };
  const p = personneLiee(r);
  if (!p) { afficherMessage('message-general', 'erreur', 'Cette personne n\'est plus dans la liste.'); return; }
  if (type === 'membre') {
    afficherOnglet('membres');
    if (typeof toutAfficherMembres === 'function') toutAfficherMembres();
    const champ = document.getElementById('recherche-membres');
    if (champ) { champ.value = p.email || nomAgenda(p); afficherMembres(); }
  } else {
    afficherOnglet('carnet');
    const champ = document.getElementById('recherche-carnet');
    if (champ) { champ.value = p.telephone || nomContact(p); afficherListeCarnet(); }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
// Ce qui est dans l'agenda pour une personne (pour sa fiche) : type = 'membre' ou 'carnet'
function agendaDeContact(id) { return agendaDePersonne('carnet', id); }
function agendaDePersonne(type, id) {
  const liste = (agenda.rdv || []).filter(function (r) { return r.lien_type === type && r.lien_id === id; })
    .sort(function (a, b) { return String(b.le).localeCompare(String(a.le)); });
  if (!liste.length) return '';
  return '<details class="historique" open><summary>📅 Dans ton agenda (' + liste.length + ')</summary>' +
    liste.map(function (r) {
      return '<div class="ligne-info" style="overflow-wrap:anywhere;">' + (r.fait_le ? '✓ ' : r.le < jourIso(0) ? '⚠️ ' : '⏳ ') +
        albEchapper(dateLisible(r.le + 'T12:00:00')) + ' · ' + albEchapper(r.titre) +
        (r.fait_le ? (r.note_fait ? ' — 📝 ' + albEchapper(r.note_fait) : ' — fait') : r.le < jourIso(0) ? ' — en retard' : '') + '</div>';
    }).join('') + '</details>';
}
// Depuis une fiche : ouvre l'agenda avec le formulaire déjà rempli pour cette personne
function agendaPour(type, id) {
  agendaLienPrevu = type + ':' + id;
  agendaFormulaire = 'nouveau';
  afficherOnglet('agenda');
  afficherAgenda();
  const choix = document.getElementById('ag-lien');
  if (choix) choix.value = agendaLienPrevu;
  agendaLienPrevu = '';
  const form = document.getElementById('agenda-formulaire');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const titre = document.getElementById('ag-titre');
  if (titre) titre.focus();
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
    if (!x.expire_le || x.statut === 'refuse' || x.expire_le < auj) return;
    // Rappel automatique 30 jours avant la fin (ou aujourd'hui si on est déjà à moins de 30 jours)
    const rappel = new Date(x.expire_le + 'T12:00:00'); rappel.setDate(rappel.getDate() - 30);
    const leRappel = rappel.toISOString().slice(0, 10);
    liste.push({ le: leRappel < auj ? auj : leRappel, emoji: '⏰', theme: 'Pros', titre: 'Demander le nouveau document : ' + String(x.libelle || 'papier').replace(/\s*\(.*\)\s*$/, ''),
      detail: (x.pro || '') + ' · il expire le ' + dateLisible(x.expire_le + 'T12:00:00'), onglet: 'valides' });
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
      (r && REPETITIONS[r.repete] ? ' <span class="etiquette">🔁 ' + REPETITIONS[r.repete] + '</span>' : '') +
      (r ? '' : ' <span class="etiquette">site</span>') +
      (r && r.lien_id ? '<br><span style="overflow-wrap:anywhere;">👤 <strong>' + albEchapper(nomLien(r)) + '</strong> <button type="button" class="bouton discret" style="padding:2px 8px;" onclick="voirPersonneLiee(\'' + r.lien_type + '\', \'' + r.lien_id + '\')">Voir la fiche →</button></span>' : '') +
      (e.detail ? '<br><span style="color:#6a6a65;overflow-wrap:anywhere;">' + albEchapper(e.detail) + '</span>' : '') +
      (fait ? '<br><span style="color:#2E7D32;overflow-wrap:anywhere;">✓ Fait le ' + albEchapper(dateLisible(r.fait_le)) + (r.note_fait ? ' · 📝 ' + albEchapper(r.note_fait) : '') + '</span>' : '') +
      (r && agendaFaitOuvert === r.id && !fait ?
        '<span class="decision" style="display:block;margin-top:6px;"><label class="petit-champ">Une note ? (facultatif)<textarea id="ag-note-fait" maxlength="1000" style="min-height:50px;" placeholder="Ex. : rappelé, il me renvoie son devis lundi"></textarea></label>' +
          (REPETITIONS[r.repete] ? '<span class="aide" style="display:block;">🔁 Le prochain (' + REPETITIONS[r.repete] + ') se mettra tout seul dans ton agenda.</span>' : '') +
          '<span class="actions" style="margin-top:6px;"><button type="button" class="bouton vert" onclick="agendaFait(\'' + r.id + '\', true, this)">✓ Valider « fait »</button>' +
          '<button type="button" class="bouton discret" onclick="agendaFaitOuvert=null; afficherAgenda();">Annuler</button></span></span>' : '') +
      (r ? '<span class="actions" style="margin-top:6px;">' +
          (fait ? '<button type="button" class="bouton discret" onclick="agendaFait(\'' + r.id + '\', false, this)">Annuler « fait »</button>'
                : (agendaFaitOuvert === r.id ? '' : '<button type="button" class="bouton discret" onclick="agendaOuvrirFait(\'' + r.id + '\')">✓ Fait</button>')) +
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
      '<label class="petit-champ">Avec qui ? (facultatif)<select id="ag-lien">' + choixPersonnes(r) + '</select></label>' +
      '<label class="petit-champ">Répéter<select id="ag-repete"><option value="">Non, une seule fois</option>' + Object.keys(REPETITIONS).map(function (k) { return '<option value="' + k + '"' + (r.repete === k ? ' selected' : '') + '>🔁 ' + REPETITIONS[k].charAt(0).toUpperCase() + REPETITIONS[k].slice(1) + '</option>'; }).join('') + '</select></label>' +
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
  const noteFaitEnCours = (document.getElementById('ag-note-fait') || {}).value || '';
  const enCours = document.getElementById('agenda-formulaire') ? ['ag-le', 'ag-heure', 'ag-titre', 'ag-lieu', 'ag-note', 'ag-genre', 'ag-theme', 'ag-repete', 'ag-lien'].map(function (id) { return document.getElementById(id).value; }) : null;
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
    ['ag-le', 'ag-heure', 'ag-titre', 'ag-lieu', 'ag-note', 'ag-genre', 'ag-theme', 'ag-repete', 'ag-lien'].forEach(function (id, i) { document.getElementById(id).value = enCours[i]; });
  }
  if (noteFaitEnCours && document.getElementById('ag-note-fait')) document.getElementById('ag-note-fait').value = noteFaitEnCours;
}

function agendaChoisirPeriode(jours) { agendaPeriode = jours; afficherAgenda(); }
function agendaNouveau() { agendaFormulaire = agendaFormulaire ? null : 'nouveau'; afficherAgenda(); }
function agendaModifier(id) { agendaFormulaire = null; afficherAgenda(); agendaFormulaire = id; afficherAgenda(); document.getElementById('agenda-formulaire').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
function agendaFermer() { agendaFormulaire = null; afficherAgenda(); }

async function agendaEnregistrer(bouton) {
  const v = function (id) { return document.getElementById(id).value.trim(); };
  const rdv = { le: v('ag-le'), heure: v('ag-heure'), titre: v('ag-titre'), lieu: v('ag-lieu'), note: v('ag-note'), genre: v('ag-genre') || 'rdv', theme: v('ag-theme'), repete: v('ag-repete') };
  // La personne liée : « membre:id » ou « carnet:id »
  const lien = v('ag-lien').split(':');
  rdv.lien_type = lien.length === 2 ? lien[0] : '';
  rdv.lien_id = lien.length === 2 ? lien[1] : '';
  rdv.lien_nom = rdv.lien_id ? nomLien({ lien_type: rdv.lien_type, lien_id: rdv.lien_id }).replace(/ · carnet$/, '') : '';
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

// « ✓ Fait » ouvre une petite zone pour ajouter une note (facultative) avant de valider
function agendaOuvrirFait(id) {
  agendaFaitOuvert = id;
  afficherAgenda();
  const zone = document.getElementById('ag-note-fait');
  if (zone) zone.focus();
}

async function agendaFait(id, fait, bouton) {
  const note = fait ? ((document.getElementById('ag-note-fait') || {}).value || '').trim() : '';
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_agenda_cocher', { p_id: id, p_fait: fait, p_note: note || null });
  bouton.disabled = false;
  if (error) { console.error('[ALB DEBUG] agenda fait :', error); afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  agendaFaitOuvert = null;
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
    agendaDeContact(c.id) +
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
      '<button type="button" class="bouton discret" onclick="agendaPour(\'carnet\', \'' + c.id + '\')">📅 Prévoir dans l\'agenda</button>' +
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

// Sur chaque carte de « Suivi des membres » : ce qui est prévu ou fait avec lui dans l'agenda,
// et un bouton « 📅 Agenda » pour prévoir quelque chose avec lui
(function () {
  const carteMembreAvantAgenda = carteMembre;
  carteMembre = function (m) {
    let html = carteMembreAvantAgenda(m);
    const repere = '<div id="panneau-membre-' + m.id + '">';
    if (html.indexOf(repere) !== -1) html = html.replace(repere, agendaDePersonne('membre', m.id) + repere);
    const bouton = '📋 Où j\'en suis</button>';
    if (html.indexOf(bouton) !== -1) html = html.replace(bouton, bouton + '<button type="button" class="bouton discret" onclick="agendaPour(\'membre\', \'' + m.id + '\')">📅 Agenda</button>');
    return html;
  };
})();

// =====================================================================
// 📋 Point des pièces : pour chaque pro, ce qui est demandé à son métier,
// ce qui est arrivé, vérifié, expiré… et surtout ce qui MANQUE
// (la liste des pièces par métier vient de Supabase : alb_papiers_metier)
// =====================================================================
let papiersAttendus = {};   // « role|sous_role » → liste des pièces demandées

function clePapiers(m) { return (m.role || '') + '|' + (m.role === 'immo' ? (m.sous_role_immo || '') : ''); }

async function chargerPapiersAttendus() {
  const cles = {};
  (typeof membres !== 'undefined' ? membres : []).forEach(function (m) { if (estUnPro(m)) cles[clePapiers(m)] = m; });
  await Promise.all(Object.keys(cles).filter(function (k) { return !papiersAttendus[k]; }).map(async function (k) {
    const m = cles[k];
    const { data, error } = await albSupabase.rpc('alb_papiers_metier', { p_role: m.role, p_sous_role: m.sous_role_immo || null });
    if (error) { console.error('[ALB DEBUG] pièces par métier :', error); return; }
    papiersAttendus[k] = Array.isArray(data) ? data : [];
  }));
}

function estUnPro(m) { return !!(m && m.role && m.role !== 'particulier' && !m.est_admin); }

// L'état de chaque pièce demandée à ce pro
function pointPieces(m) {
  const auj = jourIso(0);
  const attendues = papiersAttendus[clePapiers(m)] || [];
  const recus = (typeof papiersPros !== 'undefined' ? papiersPros : []).filter(function (x) { return x.profile_id === m.id; });
  return attendues.filter(function (p) { return p.type !== 'avis_google'; }).map(function (p) {
    // S'il y a plusieurs envois du même papier, on garde le plus récent
    const x = recus.filter(function (y) { return y.type === p.type; })
      .sort(function (a, b) { return String(b.envoye_le || '').localeCompare(String(a.envoye_le || '')); })[0];
    let etat, manque;
    if (!x) { etat = p.facultatif ? '○ pas reçu (facultatif)' : '❌ pas reçu'; manque = !p.facultatif; }
    else if (x.statut === 'refuse') { etat = '✗ à renvoyer'; manque = !p.facultatif; }
    else if (x.statut === 'a_verifier') { etat = '⏳ reçu, à vérifier'; manque = false; }
    else if (x.expire_le && x.expire_le < auj) { etat = '⚠️ expiré le ' + dateLisible(x.expire_le + 'T12:00:00'); manque = !p.facultatif; }
    else { etat = '✅ vérifié' + (x.expire_le ? ' · valable jusqu\'au ' + dateLisible(x.expire_le + 'T12:00:00') : (p.expire || DOIT_AVOIR_DATE.indexOf(p.type) !== -1 ? ' · ⚠️ date de fin à noter (pas de rappel)' : '')); manque = false; }
    return { libelle: String(p.libelle || p.type).replace(/\s*\(.*\)\s*$/, ''), etat: etat, manque: manque, facultatif: !!p.facultatif, aVerifier: !!x && x.statut === 'a_verifier' };
  });
}
function piecesManquantes(m) { return pointPieces(m).filter(function (p) { return p.manque; }); }

// Sur la carte du pro, juste au-dessus de « Ses papiers »
function blocPointPieces(m) {
  const liste = pointPieces(m);
  if (!liste.length) return '';
  const manque = liste.filter(function (p) { return p.manque; });
  return '<div class="' + (manque.length ? 'point-a-faire' : 'ligne-info') + '" style="margin:6px 0;">' +
    '<strong>📋 Point des pièces</strong> ' + (manque.length
      ? '<span class="etiquette rouge">' + manque.length + ' manquante' + (manque.length > 1 ? 's' : '') + '</span>'
      : '<span class="etiquette vert">complet</span>') +
    liste.map(function (p) {
      return '<br><span style="' + (p.manque ? 'color:#8A2D2D;font-weight:600;' : '') + '">' + albEchapper(p.etat.split(' ')[0]) + ' ' + albEchapper(p.libelle) +
        ' <span style="font-weight:400;color:#7a7a75;">— ' + albEchapper(p.etat.split(' ').slice(1).join(' ')) + '</span></span>';
    }).join('') + '</div>';
}

// En haut de « Pros validés » : le tableau de tous les pros
function afficherPointPieces() {
  const panneau = document.getElementById('panneau-valides');
  const liste = document.getElementById('liste-valides');
  if (!panneau || !liste) return;
  let zone = document.getElementById('point-pieces');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'point-pieces';
    liste.parentNode.insertBefore(zone, liste);
  }
  const pros = (typeof membres !== 'undefined' ? membres : []).filter(estUnPro)
    .map(function (m) { return { m: m, manque: piecesManquantes(m), point: pointPieces(m) }; })
    .sort(function (a, b) { return (b.m.profil_mis_en_ligne && b.manque.length ? 2 : b.manque.length ? 1 : 0) - (a.m.profil_mis_en_ligne && a.manque.length ? 2 : a.manque.length ? 1 : 0); });
  if (!pros.length) { zone.innerHTML = ''; return; }
  const nbManque = pros.filter(function (p) { return p.manque.length; }).length;
  zone.innerHTML = '<details class="historique carte" style="margin-bottom:14px;"' + (nbManque ? ' open' : '') + '>' +
    '<summary style="font-weight:700;color:#5A3A6A;cursor:pointer;">📋 Point des pièces par pro ' +
      (nbManque ? '<span class="etiquette rouge">' + nbManque + ' pro' + (nbManque > 1 ? 's' : '') + ' incomplet' + (nbManque > 1 ? 's' : '') + '</span>' : '<span class="etiquette vert">tout est complet</span>') + '</summary>' +
    '<p class="aide">Ce que le site demande à chaque métier. Les pros envoient leurs pièces depuis leur espace ; c\'est toi qui les vérifies (dans leur carte, plus bas).</p>' +
    pros.map(function (p) {
      const m = p.m;
      const metier = typeof metierDe === 'function' && metierDe(m) && typeof METIERS !== 'undefined' ? METIERS[metierDe(m)] : '';
      return '<div class="ligne-info" style="padding:8px 0;border-top:1px dashed #E8E6E1;overflow-wrap:anywhere;">' +
        '<strong>' + albEchapper(nomAgenda(m)) + '</strong> ' + (metier ? '<span class="etiquette">' + albEchapper(metier) + '</span> ' : '') +
        (m.profil_mis_en_ligne ? '<span class="etiquette vert">en ligne</span> ' : m.statut_verifie ? '<span class="etiquette">validé, pas en ligne</span> ' : '<span class="etiquette or">pas encore validé</span> ') +
        (p.manque.length
          ? '<br><span style="color:#8A2D2D;font-weight:600;">' + (m.profil_mis_en_ligne ? '⚠️ En ligne sans : ' : '❌ Manque : ') + albEchapper(p.manque.map(function (x) { return x.libelle; }).join(' · ')) + '</span>'
          : '<br><span style="color:#2E7D32;">✅ Pièces obligatoires complètes</span>') +
        (p.point.some(function (x) { return x.aVerifier; }) ? ' <span class="etiquette or">⏳ à vérifier</span>' : '') +
        '<br><button type="button" class="bouton discret" style="margin-top:4px;" onclick="agendaPour(\'membre\', \'' + m.id + '\')">📅 Prévoir une relance</button>' +
      '</div>';
    }).join('') + '</details>';
}

// On branche le point des pièces sur le chargement des papiers
(function () {
  const chargerPapiersAvantPoint = chargerPapiers;
  chargerPapiers = async function () {
    await Promise.all([chargerPapiersAvantPoint(), chargerPapiersAttendus()]);
    document.querySelectorAll('.papiers-pro').forEach(function (zone) { zone.innerHTML = blocPapiersPro(zone.dataset.pro); });
    afficherPointPieces();
    if (typeof afficherAFaire === 'function') afficherAFaire();
  };
  const blocPapiersAvantPoint = blocPapiersPro;
  blocPapiersPro = function (proId) {
    const m = (typeof membres !== 'undefined' ? membres : []).find(function (x) { return x.id === proId; });
    return (m && estUnPro(m) ? blocPointPieces(m) : '') + blocPapiersAvantPoint(proId);
  };
})();

// « À faire aujourd'hui » : les pros EN LIGNE à qui il manque une pièce obligatoire
LIGNES_A_FAIRE.push({
  calcul: function () { return (typeof membres !== 'undefined' ? membres : []).filter(function (m) { return estUnPro(m) && m.profil_mis_en_ligne && piecesManquantes(m).length; }).length; },
  un: 'pro en ligne à qui il manque une pièce obligatoire (assurance, numéro…)', plusieurs: 'pros en ligne à qui il manque une pièce obligatoire (assurance, numéro…)', emoji: '📋', onglet: 'valides'
});

// ---------- Lecture automatique d'un document (PDF) : type, numéro, date de fin ----------
const MOIS_FR = { janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12 };
// Ce qui permet de reconnaître chaque document (le premier qui correspond gagne)
const RECONNAITRE_PAPIER = [
  ['orias', /orias|registre unique des interm[ée]diaires/i],
  ['decennale', /d[ée]cennale/i],
  ['garantie', /garantie financi[èe]re/i],
  ['rc_pro', /responsabilit[ée] civile (professionnelle|pro\b)|\brc pro\b/i],
  ['urssaf', /attestation de vigilance|urssaf/i],
  ['fluides', /fluides? frigorig[èe]ne/i],
  ['rge', /\brge\b|reconnu garant/i],
  ['carte_t', /carte professionnelle|\bcpi ?\d{4}/i],
  ['habilitation', /attestation d.habilitation/i],
  ['cni', /carte nationale d.identit[ée]|identity card/i],
  ['kbis', /registre sp[ée]cial des agents commerciaux|extrait d.immatriculation|\bk ?bis\b|registre du commerce/i],
  ['sirene', /r[ée]pertoire sirene/i],
  ['rib', /relev[ée] d.identit[ée] bancaire|\biban\b/i],
  ['contrat', /contrat d.apporteur/i]
];
// Les dates du texte, avec un score : « jusqu'au », « expire », « fin de validité »… comptent pour la date de fin
function datesDuTexte(texte) {
  const t = texte.replace(/\s+/g, ' ');
  const trouvees = [];
  const ajouter = function (j, m, a, index) {
    j = +j; m = +m; a = +a;
    if (a < 100) a += 2000;
    if (!(j >= 1 && j <= 31 && m >= 1 && m <= 12 && a >= 1990 && a <= 2100)) return;
    const avant = t.slice(Math.max(0, index - 60), index).toLowerCase();
    let score = 0;
    if (/(jusqu.?(au|à|a)|expir|fin de validit|[ée]ch[ée]ance|valable|valide|validit[ée]|au\s*$|terme)/.test(avant)) score += 2;
    if (/(jusqu.?(au|à|a)|expir|fin de validit)\W*$/.test(avant)) score += 3;
    if (/(n[ée]e? le|naissance|depuis|d[ée]livr|fait (à|a|le)|[ée]tabli|du\s*$|immatricul|cr[ée]ation|commencement|à la date|[àa] jour au|edition|édité)/.test(avant.slice(-30))) score -= 3;
    trouvees.push({ iso: a + '-' + String(m).padStart(2, '0') + '-' + String(j).padStart(2, '0'), score: score });
  };
  let r;
  const chiffres = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/g;
  while ((r = chiffres.exec(t))) ajouter(r[1], r[2], r[3], r.index);
  const lettres = /\b(\d{1,2})(?:er)? (janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre) (\d{4})\b/gi;
  while ((r = lettres.exec(t))) ajouter(r[1], MOIS_FR[r[2].toLowerCase().replace('û', 'u')] || MOIS_FR[r[2].toLowerCase()], r[3], r.index);
  return trouvees;
}
// Analyse le texte : quel document, quel numéro, quelle date de fin (null si pas trouvé)
function analyserTexte(texte, typesPossibles) {
  const t = String(texte || '').replace(/\s+/g, ' ');
  const reco = RECONNAITRE_PAPIER.find(function (x) { return x[1].test(t) && (!typesPossibles || typesPossibles.indexOf(x[0]) !== -1); });
  const type = reco ? reco[0] : null;
  let numero = null, r;
  if (type === 'orias' && (r = /(?:immatriculation|n° ?orias|num[ée]ro orias)\D{0,30}(\d{8})\b/i.exec(t))) numero = r[1];
  if (type === 'carte_t' && (r = /\b(CPI ?\d{4} ?\d{4} ?\d{3} ?\d{3})\b/i.exec(t))) numero = r[1].replace(/\s/g, ' ');
  if ((type === 'kbis' || type === 'rsac' || type === 'sirene') && (r = /\b(\d{3} ?\d{3} ?\d{3})\b/.exec(t))) numero = r[1];
  const auj = new Date().toISOString().slice(0, 10);
  const dates = datesDuTexte(t);
  // La date de fin : la mieux notée ; à égalité, la plus lointaine. On ne garde qu'une date qui a un indice de « fin »
  const fin = dates.filter(function (d) { return d.score > 0; })
    .sort(function (a, b) { return b.score - a.score || b.iso.localeCompare(a.iso); })[0];
  // Kbis, avis SIRENE, RIB, contrat : pas de date de fin
  let dateFin = fin && ['kbis', 'sirene', 'rib', 'contrat', 'corps_metier', 'reseau'].indexOf(type) === -1 ? fin.iso : null;
  // Attestation URSSAF sans date de fin écrite : valable 6 mois après sa date
  if (!dateFin && type === 'urssaf' && dates.length) {
    const d = new Date(dates.map(function (x) { return x.iso; }).sort().pop() + 'T12:00:00');
    d.setMonth(d.getMonth() + 6);
    dateFin = d.toISOString().slice(0, 10);
  }
  return { type: type, numero: numero, dateFin: dateFin, dejaPassee: !!dateFin && dateFin < auj };
}

// Lit le texte d'un PDF (outil pdf.js, chargé seulement quand on en a besoin)
let pdfjsPret = null;
function chargerPdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsPret) return pdfjsPret;
  pdfjsPret = new Promise(function (ok, ko) {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      ok(window.pdfjsLib);
    };
    s.onerror = function () { pdfjsPret = null; ko(new Error('pdf.js')); };
    document.head.appendChild(s);
  });
  return pdfjsPret;
}
async function texteDuPdf(fichier) {
  const pdfjs = await chargerPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await fichier.arrayBuffer()) }).promise;
  let texte = '';
  for (let i = 1; i <= Math.min(doc.numPages, 5); i++) {
    const contenu = await (await doc.getPage(i)).getTextContent();
    texte += contenu.items.map(function (x) { return x.str; }).join(' ') + '\n';
  }
  return texte;
}

// ---------- Ajouter un document pour un pro (reçu par mail, en main propre…) ----------
let papiersHorsSite = null;     // Kbis, SIRENE, URSSAF, CNI, contrat, RIB…
// Les documents qui ont toujours une date de fin (l'ORIAS se renouvelle chaque année) : sans date, pas de rappel possible
const DOIT_AVOIR_DATE = ['orias', 'rc_pro', 'decennale', 'garantie', 'carte_t', 'habilitation', 'rge', 'urssaf', 'cni', 'fluides'];
let ajoutDocOuvert = null;      // id du pro dont le formulaire est ouvert
async function chargerPapiersHorsSite() {
  if (papiersHorsSite) return;
  const { data, error } = await albSupabase.rpc('alb_papiers_hors_site');
  if (error) { console.error('[ALB DEBUG] pièces hors site :', error); return; }
  papiersHorsSite = Array.isArray(data) ? data : [];
}
function typesPourPro(m) {
  const metier = (papiersAttendus[clePapiers(m)] || []).filter(function (p) { return p.type !== 'avis_google'; });
  return metier.map(function (p) { return { type: p.type, libelle: String(p.libelle).replace(/\s*\(.*\)\s*$/, ''), groupe: 'metier' }; })
    .concat((papiersHorsSite || []).filter(function (p) { return !metier.some(function (x) { return x.type === p.type; }); })
      .map(function (p) { return { type: p.type, libelle: p.libelle, groupe: 'hors' }; }));
}
function formulaireAjoutDoc(m) {
  const types = typesPourPro(m);
  const opt = function (t) { return '<option value="' + albEchapper(t.type) + '">' + albEchapper(t.libelle) + '</option>'; };
  return '<div class="decision" id="ajout-doc-' + m.id + '" style="margin-top:8px;"><div class="decision-titre">➕ Ajouter un document pour ' + albEchapper(nomAgenda(m)) + '</div>' +
    '<label class="petit-champ">Le fichier (PDF ou photo)<input type="file" id="ad-fichier-' + m.id + '" accept="application/pdf,image/*" onchange="lireDocument(\'' + m.id + '\')"></label>' +
    '<p class="aide" id="ad-lecture-' + m.id + '" style="margin-top:4px;">Choisis le fichier : je lis le PDF et je remplis tout seul ce que je trouve. Tu vérifies avant d\'enregistrer.</p>' +
    '<div class="grille">' +
      '<label class="petit-champ">C\'est quoi ?<select id="ad-type-' + m.id + '">' +
        '<optgroup label="Demandé à son métier">' + types.filter(function (t) { return t.groupe === 'metier'; }).map(opt).join('') + '</optgroup>' +
        '<optgroup label="Autres pièces">' + types.filter(function (t) { return t.groupe === 'hors'; }).map(opt).join('') + '</optgroup></select></label>' +
      '<label class="petit-champ">Numéro (facultatif)<input type="text" id="ad-numero-' + m.id + '" maxlength="200" placeholder="Ex. : ORIAS, carte T, SIREN…"></label>' +
      '<label class="petit-champ">Valable jusqu\'au<input type="date" id="ad-date-' + m.id + '"></label>' +
    '</div>' +
    '<p class="aide" style="margin-top:4px;">Laisse la date vide si le document n\'a pas de fin (Kbis, RIB, contrat…). Avec une date, les rappels se font tout seuls : un mois avant dans ton agenda, puis mail et SMS à préparer.</p>' +
    '<div class="actions"><button type="button" class="bouton vert" onclick="enregistrerDocument(\'' + m.id + '\', this)">💾 Enregistrer (vérifié)</button>' +
    '<button type="button" class="bouton discret" onclick="ouvrirAjoutDoc(null)">Annuler</button></div></div>';
}
function ouvrirAjoutDoc(proId) {
  ajoutDocOuvert = proId;
  document.querySelectorAll('.papiers-pro').forEach(function (zone) { zone.innerHTML = blocPapiersPro(zone.dataset.pro); });
  const form = proId && document.getElementById('ajout-doc-' + proId);
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
async function lireDocument(proId) {
  const fichier = (document.getElementById('ad-fichier-' + proId).files || [])[0];
  const info = document.getElementById('ad-lecture-' + proId);
  if (!fichier) return;
  if (fichier.type !== 'application/pdf') { info.textContent = '📷 C\'est une photo : je ne peux pas la lire. Choisis le type et écris la date de fin toi-même.'; return; }
  info.textContent = '🔎 Je lis le document…';
  try {
    const m = membres.find(function (x) { return x.id === proId; });
    const texte = await texteDuPdf(fichier);
    if (texte.replace(/\s/g, '').length < 20) { info.textContent = '📷 Ce PDF est une image scannée : je ne peux pas le lire. Choisis le type et écris la date de fin toi-même.'; return; }
    const r = analyserTexte(texte, typesPourPro(m).map(function (t) { return t.type; }));
    const trouve = [];
    if (r.type) { document.getElementById('ad-type-' + proId).value = r.type; trouve.push('c\'est : ' + typesPourPro(m).find(function (t) { return t.type === r.type; }).libelle); }
    if (r.numero) { document.getElementById('ad-numero-' + proId).value = r.numero; trouve.push('numéro ' + r.numero); }
    if (r.dateFin) { document.getElementById('ad-date-' + proId).value = r.dateFin; trouve.push('valable jusqu\'au ' + dateLisible(r.dateFin + 'T12:00:00')); }
    console.log('[ALB DEBUG] lecture document :', r);
    info.innerHTML = (trouve.length ? '✅ J\'ai trouvé : <strong>' + albEchapper(trouve.join(' · ')) + '</strong>. Vérifie avant d\'enregistrer.' : '🤔 Je n\'ai rien reconnu : remplis les cases toi-même.') +
      (r.dejaPassee ? '<br><span style="color:#8A2D2D;font-weight:600;">⚠️ Cette date est déjà passée : le document n\'est plus valable.</span>' : '') +
      (!r.dateFin && r.type && ['kbis', 'sirene', 'rib', 'contrat'].indexOf(r.type) === -1 ? '<br>📅 Pas de date de fin trouvée : écris-la si le document en a une.' : '');
  } catch (e) {
    console.error('[ALB DEBUG] lecture PDF :', e);
    info.textContent = 'Je n\'ai pas pu lire ce PDF. Remplis les cases toi-même, l\'enregistrement marche quand même.';
  }
}
async function enregistrerDocument(proId, bouton) {
  const fichier = (document.getElementById('ad-fichier-' + proId).files || [])[0];
  const type = document.getElementById('ad-type-' + proId).value;
  const numero = document.getElementById('ad-numero-' + proId).value.trim();
  const date = document.getElementById('ad-date-' + proId).value || null;
  if (!fichier && !numero) { afficherMessage('message-general', 'erreur', 'Choisis un fichier ou écris un numéro.'); return; }
  if (!date && DOIT_AVOIR_DATE.indexOf(type) !== -1 &&
      !confirm('Il n\'y a pas de date de fin : aucun rappel ne sera prévu pour ce document.\n\nEnregistrer quand même ? (Tu pourras ajouter la date plus tard sur sa carte.)')) return;
  if (fichier && fichier.size > 10 * 1024 * 1024) { afficherMessage('message-general', 'erreur', 'Ce fichier est trop lourd : 10 Mo au plus.'); return; }
  bouton.disabled = true;
  let chemin = null;
  if (fichier) {
    const extension = fichier.type === 'application/pdf' ? 'pdf' : ((fichier.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg');
    chemin = proId + '/' + type + '-' + Date.now() + '.' + extension;
    const envoi = await albSupabase.storage.from('pro-documents').upload(chemin, fichier, { contentType: fichier.type || 'application/octet-stream', upsert: false });
    if (envoi.error) { bouton.disabled = false; console.error('[ALB DEBUG] envoi document :', envoi.error); afficherMessage('message-general', 'erreur', 'Le fichier n\'a pas pu être envoyé. Réessaie.'); return; }
  }
  const { error } = await albSupabase.rpc('alb_gestion_papier_ajouter', { p_pro: proId, p_type: type, p_valeur: numero || null, p_chemin: chemin, p_nom: fichier ? fichier.name : null, p_expire_le: date });
  bouton.disabled = false;
  if (error) { console.error('[ALB DEBUG] ajout document :', error); afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  ajoutDocOuvert = null;
  await chargerPapiers();
  afficherAgenda();
  afficherMessage('message-general', 'succes', 'Document enregistré et vérifié ✓' + (date ? ' Les rappels sont en place (un mois avant la fin).' : ''));
}

// On branche : la liste des pièces hors site se charge avec les papiers, et le bouton « ➕ Ajouter un document » est sur chaque pro
(function () {
  const chargerAvantHorsSite = chargerPapiersAttendus;
  chargerPapiersAttendus = async function () { await Promise.all([chargerAvantHorsSite(), chargerPapiersHorsSite()]); };
  // Après chaque chargement : un document qui doit avoir une date de fin affiche la case « Valable jusqu'au » sur sa carte
  const chargerPapiersAvantDate = chargerPapiers;
  chargerPapiers = async function () {
    await chargerPapiersAvantDate();
    let change = false;
    (typeof papiersPros !== 'undefined' ? papiersPros : []).forEach(function (x) { if (!x.expire && DOIT_AVOIR_DATE.indexOf(x.type) !== -1) { x.expire = true; change = true; } });
    if (change) {
      document.querySelectorAll('.papiers-pro').forEach(function (zone) { zone.innerHTML = blocPapiersPro(zone.dataset.pro); });
      afficherPointPieces();
      if (typeof afficherAFaire === 'function') afficherAFaire();
    }
  };
  const blocPointAvantAjout = blocPointPieces;
  blocPointPieces = function (m) {
    const recus = (typeof papiersPros !== 'undefined' ? papiersPros : []).filter(function (x) { return x.profile_id === m.id; });
    const horsSite = (papiersHorsSite || []).filter(function (p) { return recus.some(function (x) { return x.type === p.type; }); });
    return blocPointAvantAjout(m) +
      (horsSite.length ? '<p class="ligne-info" style="margin:4px 0;">📎 Autres pièces : ' + horsSite.map(function (p) {
        const x = recus.find(function (y) { return y.type === p.type; });
        return albEchapper(p.libelle) + (x.expire_le ? ' (jusqu\'au ' + albEchapper(dateLisible(x.expire_le + 'T12:00:00')) + ')' : '');
      }).join(' · ') + '</p>' : '') +
      (ajoutDocOuvert === m.id ? formulaireAjoutDoc(m)
        : '<div class="actions" style="margin-top:4px;"><button type="button" class="bouton discret" onclick="ouvrirAjoutDoc(\'' + m.id + '\')">➕ Ajouter un document</button></div>');
  };
})();

// =====================================================================
// 💶 Bilan de chaque pro sur sa carte (Suivi des membres) :
// ce qu'ALB lui a apporté (mises en relation, dossiers signés, montants)
// et ce qui lui est facturé, ou offert (« non facturé ») pendant la période gratuite
// =====================================================================
let bilanPros = { offert_jusqu_au: null, parPro: {} };
async function chargerBilanPros() {
  const { data, error } = await albSupabase.rpc('alb_gestion_bilan_pros');
  if (error) { console.error('[ALB DEBUG] bilan des pros :', error); return; }
  bilanPros = { offert_jusqu_au: data && data.offert_jusqu_au, parPro: {} };
  ((data && data.pros) || []).forEach(function (b) { bilanPros.parPro[b.pro_id] = b; });
}
function eurosBilan(n) { return Math.round(Number(n || 0)).toLocaleString('fr-FR') + ' €'; }
function blocBilanPro(m) {
  const b = bilanPros.parPro[m.id];
  if (!b) return '';
  const offertEnCours = bilanPros.offert_jusqu_au && jourIso(0) <= bilanPros.offert_jusqu_au;
  const morceaux = [];
  morceaux.push(b.mises_en_relation + ' mise' + (b.mises_en_relation > 1 ? 's' : '') + ' en relation');
  if (b.signes) morceaux.push(b.signes + ' dossier' + (b.signes > 1 ? 's' : '') + ' signé' + (b.signes > 1 ? 's' : '') + (Number(b.montant_signe) ? ' (' + eurosBilan(b.montant_signe) + ')' : ''));
  if (b.ventes) morceaux.push(b.ventes + ' vente' + (b.ventes > 1 ? 's' : '') + (Number(b.montant_ventes) ? ' (' + eurosBilan(b.montant_ventes) + ')' : ''));
  const facture = Number(b.facture_ht), offert = Number(b.offert_ht);
  let argent;
  if (facture) argent = '🧾 Facturé : <strong>' + eurosBilan(facture) + ' HT</strong>' + (offert ? ' · 🎁 offert : ' + eurosBilan(offert) + ' HT' : '');
  else if (offert) argent = '🎁 <strong>Non facturé</strong> : ' + eurosBilan(offert) + ' HT offerts' + (offertEnCours ? ' (gratuit jusqu\'au ' + dateLisible(bilanPros.offert_jusqu_au + 'T12:00:00') + ')' : '');
  else argent = offertEnCours ? '🎁 <strong>Non facturé</strong> : gratuit jusqu\'au ' + dateLisible(bilanPros.offert_jusqu_au + 'T12:00:00') : '🧾 Rien de facturé pour l\'instant';
  return '<p class="ligne-info" style="margin-top:6px;">💶 <strong>Avec ALB</strong> : ' + albEchapper(morceaux.join(' · ')) + '<br>' + argent + '</p>';
}
(function () {
  const carteMembreAvantBilan = carteMembre;
  carteMembre = function (m) {
    const html = carteMembreAvantBilan(m);
    if (!(m.role && m.role !== 'particulier')) return html;
    const repere = '<p class="ligne-info" style="margin-top:6px;">📒 ';
    return html.indexOf(repere) !== -1 ? html.replace(repere, blocBilanPro(m) + repere) : html;
  };
  const toutRechargerAvantBilan = toutRecharger;
  toutRecharger = async function () {
    await chargerBilanPros();
    await toutRechargerAvantBilan();
  };
})();

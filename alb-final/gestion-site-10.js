// ============================================================
// Gestion du site — partie 10 : 📄 Suivi des devis
// Un onglet « 📄 Devis » (juste après « Projets »), rangé par particulier
// (3 devis au plus chacun). Pour chaque devis : l'artisan, le type de projet,
// le montant, la date d'envoi, le statut (envoyé / en discussion / signé /
// perdu), la prochaine action et sa date, et tes notes.
// Les relances se proposent toutes seules :
//   J+2  : vérifier qu'il a bien reçu le devis
//   J+7  : lui demander s'il a des questions ou des points à éclaircir
//   J+14 : savoir s'il souhaite avancer, reporter ou abandonner son projet
// Le SMS est prêt, c'est toi qui l'envoies. Les actions du jour arrivent
// dans « À faire aujourd'hui » et dans ton agenda.
// Chargé par gestion-site.html, après gestion-site-9.js
// ============================================================
let devisSuivi = [];
let filtreDevis = null;          // a_faire | en_cours | signes | perdus | tous
let devisOuvert = {};            // id du devis → panneau « Mettre à jour » ouvert
const SUIVIS_DEVIS = { envoye: '📨 Envoyé', en_discussion: '💬 En discussion', signe: '✍️ Signé', perdu: '❌ Perdu' };
const ETAPES_DEVIS = [
  { j: 2, champ: 'j2_fait_le', titre: 'J+2 : vérifier qu\'il a bien reçu le devis' },
  { j: 7, champ: 'j7_fait_le', titre: 'J+7 : lui demander s\'il a des questions ou des points à éclaircir' },
  { j: 14, champ: 'j14_fait_le', titre: 'J+14 : savoir s\'il souhaite avancer, reporter ou abandonner son projet' }
];
ERREURS.DEVIS_INTROUVABLE = 'Ce devis n\'existe plus. Recharge la page.';
ERREURS.STATUT_INVALIDE = 'Choisis un statut dans la liste.';

async function chargerDevisSuivi() {
  const { data, error } = await albSupabase.rpc('alb_gestion_devis');
  if (error) { console.error('[ALB DEBUG] devis :', error); return; }
  devisSuivi = data || [];
}

// ----- Petits outils -----
function jourDevis(iso, plus) { const d = new Date(iso); d.setDate(d.getDate() + (plus || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dateCourteDevis(jour) { return jour ? new Date(jour + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : ''; }
function montantDevisTexte(m) {
  if (!m) return 'Montant non indiqué';
  const n = Number(m), c = Number.isInteger(n) ? 0 : 2;
  return n.toLocaleString('fr-FR', { minimumFractionDigits: c, maximumFractionDigits: c }) + ' € TTC';
}
function eurosCourts(n) { return Math.round(n).toLocaleString('fr-FR') + ' €'; }
function nomArtisan(d) { const p = d.pro || {}; return p.nom_entreprise || ((p.prenom || '') + ' ' + (p.nom || '')).trim() || 'l\'artisan'; }
function typeProjetDevis(d) {
  const det = (d.projet || {}).details || {};
  const codes = typeof categoriesProjet === 'function' ? categoriesProjet(det) : (det.categories || []);
  const libs = codes.map(function (c) { return typeof libProjet === 'function' ? libProjet('categorie', c) : c; }).filter(Boolean);
  return 'Travaux' + (libs.length ? ' · ' + libs.join(', ') : '');
}
function devisActuels() { return devisSuivi.filter(function (d) { return d.statut !== 'remplace'; }); }
function devisEnCours(d) { return d.suivi === 'envoye' || d.suivi === 'en_discussion'; }

// La prochaine action : celle que tu as notée, sinon la prochaine relance J+2 / J+7 / J+14
function prochaineActionDevis(d) {
  if (!devisEnCours(d)) return null;
  if (d.prochaine_action) return { texte: d.prochaine_action, le: d.prochaine_action_le || jourIso(0), manuelle: true };
  const etape = ETAPES_DEVIS.find(function (x) { return !d[x.champ]; });
  if (!etape) return null;
  return { texte: etape.titre, le: jourDevis(d.cree_le, etape.j), etape: etape.j };
}
function actionDue(d) { const a = prochaineActionDevis(d); return !!a && a.le <= jourIso(0); }

// Le SMS prêt à envoyer au particulier (c'est toi qui l'envoies)
function smsDevis(d, action) {
  const prenom = (d.particulier || {}).prenom || '';
  const debut = 'Bonjour ' + prenom + ', c\'est Jocelyne d\'ALB Immobilier. ';
  const art = nomArtisan(d);
  if (action && action.etape === 2) return debut + art + ' vous a envoyé son devis pour vos travaux : l\'avez-vous bien reçu ? Vous le retrouvez dans « Mes projets ALB », dans votre espace. Belle journée !';
  if (action && action.etape === 7) return debut + 'Avez-vous pu regarder le devis de ' + art + ' ? Si vous avez des questions ou des points à éclaircir, je suis là pour vous aider. Belle journée !';
  if (action && action.etape === 14) return debut + 'Je reviens vers vous au sujet du devis de ' + art + ' : souhaitez-vous avancer, reporter ou abandonner votre projet ? Dites-le-moi simplement, sans aucune pression. Belle journée !';
  return debut;
}

// ----- Une ligne de devis -----
function carteDevis(d, historique) {
  const pa = d.particulier || {}, pr = d.pro || {};
  const action = prochaineActionDevis(d);
  const due = action && action.le <= jourIso(0);
  const enRetard = action && action.le < jourIso(0);
  const numPart = String(pa.telephone || '').replace(/[^0-9+]/g, '');
  const numPro = String(pr.telephone || '').replace(/[^0-9+]/g, '');
  const reponse = d.statut === 'accepte' ? '<span class="etiquette vert">🙋 A accepté le devis' + (d.repondu_le ? ' le ' + albEchapper(dateLisible(d.repondu_le)) : '') + '</span>'
    : d.statut === 'refuse' ? '<span class="etiquette">🙋 Ne l\'a pas retenu</span>' : '';
  const etapes = ETAPES_DEVIS.map(function (x) {
    return '<span class="etiquette' + (d[x.champ] ? ' vert' : '') + '" title="' + albEchapper(x.titre) + '">' + (d[x.champ] ? '✓ ' : '') + 'J+' + x.j + '</span>';
  }).join(' ');
  return '<div class="carte" style="margin-top:10px;' + (historique ? 'opacity:.6;' : '') + (due && !historique ? 'border-color:#B28E3D;' : '') + '">' +
    '<div class="etiquettes"><span class="etiquette' + (d.suivi === 'signe' ? ' vert' : d.suivi === 'perdu' ? '' : ' or') + '">' + albEchapper(SUIVIS_DEVIS[d.suivi] || d.suivi) + '</span>' + reponse +
      (historique ? '<span class="etiquette">Ancienne version</span>' : '') + '</div>' +
    '<h3 style="font-family:Montserrat,sans-serif;font-size:1rem;margin-top:6px;">🔨 ' + albEchapper(nomArtisan(d)) + '</h3>' +
    '<p class="ligne-info">📝 ' + albEchapper(typeProjetDevis(d)) + ((d.projet || {}).zone ? ' · 📍 ' + albEchapper(d.projet.zone) : '') + '</p>' +
    '<p class="ligne-info">💶 <strong>' + albEchapper(montantDevisTexte(d.montant)) + '</strong> · envoyé le ' + albEchapper(dateLisible(d.cree_le)) + '</p>' +
    (d.note ? '<p class="ligne-info mot">💬 L\'artisan : « ' + albEchapper(d.note) + ' »</p>' : '') +
    (d.mot_particulier ? '<p class="ligne-info mot">🙋 Le particulier : « ' + albEchapper(d.mot_particulier) + ' »</p>' : '') +
    (historique ? '' :
      (devisEnCours(d) ? '<p class="ligne-info">Relances : ' + etapes + '</p>' : '') +
      (action
        ? '<div class="decision" style="margin-top:8px;' + (due ? 'border-color:#B28E3D;background:#FBF3E4;' : '') + '"><div class="decision-titre">' + (enRetard ? '⏰ En retard · ' : due ? '📌 Aujourd\'hui · ' : '📅 ') + 'Prochaine action le ' + albEchapper(dateCourteDevis(action.le)) + '</div>' +
            '<p class="ligne-info">' + albEchapper(action.texte) + '</p>' +
            '<div class="actions">' +
              (numPart ? '<a class="bouton" href="sms:' + albEchapper(numPart) + '?&body=' + encodeURIComponent(smsDevis(d, action)) + '">📱 SMS prêt</a>' : '') +
              (action.etape ? '<button type="button" class="bouton vert" onclick="devisEtapeFaite(\'' + d.id + '\', ' + action.etape + ', this)">✓ Relance J+' + action.etape + ' faite</button>'
                : '<button type="button" class="bouton vert" onclick="devisActionFaite(\'' + d.id + '\', this)">✓ C\'est fait</button>') +
            '</div></div>'
        : (devisEnCours(d) ? '<p class="ligne-info" style="color:#8A6A1F;">Plus de relance prévue : mets à jour son statut (signé, perdu…) ou note une prochaine action.</p>' : '')) +
      (d.notes ? '<details class="historique"><summary>📒 Tes notes</summary><div class="ligne-info" style="white-space:pre-line;overflow-wrap:anywhere;">' + albEchapper(d.notes) + '</div></details>' : '') +
      (devisOuvert[d.id] ? formulaireDevis(d) : '')) +
    '<div class="actions">' +
      '<button type="button" class="bouton discret" onclick="ouvrirFichierDevis(\'' + d.id + '\', this)">👀 Ouvrir le devis</button>' +
      (numPart ? '<a class="bouton discret" href="tel:' + albEchapper(numPart) + '">📞 ' + albEchapper(pa.prenom || 'Le particulier') + '</a>' : '') +
      (numPro ? '<a class="bouton discret" href="tel:' + albEchapper(numPro) + '">📞 L\'artisan</a>' : '') +
      (historique ? '' : '<button type="button" class="bouton discret" onclick="basculerDevis(\'' + d.id + '\')">' + (devisOuvert[d.id] ? '✖ Fermer' : '✏️ Mettre à jour') + '</button>') +
    '</div>' +
  '</div>';
}

function formulaireDevis(d) {
  const a = d.prochaine_action ? { texte: d.prochaine_action, le: d.prochaine_action_le } : {};
  return '<div class="decision" style="margin-top:8px;"><div class="decision-titre">✏️ Où en est ce devis ?</div>' +
    '<div class="grille">' +
      '<label class="petit-champ">Statut<select id="dv-suivi-' + d.id + '">' + Object.keys(SUIVIS_DEVIS).map(function (k) {
        return '<option value="' + k + '"' + (d.suivi === k ? ' selected' : '') + '>' + SUIVIS_DEVIS[k] + '</option>'; }).join('') + '</select></label>' +
      '<label class="petit-champ">Prochaine action le<input type="date" id="dv-le-' + d.id + '" value="' + albEchapper(a.le || '') + '"></label>' +
      '<label class="petit-champ large">Prochaine action (vide = les relances J+2, J+7, J+14 reprennent)<input type="text" id="dv-action-' + d.id + '" maxlength="300" placeholder="Ex. : le rappeler après son rendez-vous à la banque" value="' + albEchapper(a.texte || '') + '"></label>' +
    '</div>' +
    '<label class="petit-champ" style="margin-top:8px;">Ta note (datée d\'aujourd\'hui, facultatif)<textarea id="dv-note-' + d.id + '" maxlength="2000" style="min-height:60px;" placeholder="Ce que vous vous êtes dit…"></textarea></label>' +
    '<div class="actions"><button type="button" class="bouton vert" onclick="enregistrerSuiviDevis(\'' + d.id + '\', this)">💾 Enregistrer</button>' +
    '<button type="button" class="bouton discret" onclick="basculerDevis(\'' + d.id + '\')">Annuler</button></div></div>';
}

// ----- Les chiffres -----
function blocChiffresDevis() {
  const l = devisActuels();
  const signes = l.filter(function (d) { return d.suivi === 'signe'; });
  const perdus = l.filter(function (d) { return d.suivi === 'perdu'; });
  const somme = function (liste) { return liste.reduce(function (n, d) { return n + Number(d.montant || 0); }, 0); };
  const reponses = l.filter(function (d) { return d.repondu_le; });
  const delai = reponses.length ? Math.round(reponses.reduce(function (n, d) { return n + (new Date(d.repondu_le) - new Date(d.cree_le)); }, 0) / reponses.length / 86400000) : null;
  const taux = signes.length + perdus.length ? Math.round(100 * signes.length / (signes.length + perdus.length)) + ' %' : '–';
  const c = function (valeur, libelle, alerte, filtre) {
    return '<div class="compteur' + (alerte ? ' alerte' : '') + '"' + (filtre ? ' style="cursor:pointer;" onclick="choisirFiltreDevis(\'' + filtre + '\')"' : '') + '><div class="valeur">' + valeur + '</div><div class="libelle">' + libelle + '</div></div>';
  };
  return '<div class="compteurs" style="margin-bottom:12px;">' +
    c(l.filter(actionDue).length, '⏰ Actions à faire aujourd\'hui', l.some(actionDue), 'a_faire') +
    c(l.length, '📨 Devis envoyés', false, 'tous') +
    c(l.filter(devisEnCours).length, '💬 En cours (envoyés + en discussion)', false, 'en_cours') +
    c(signes.length, '✍️ Signés', false, 'signes') +
    c(perdus.length, '❌ Perdus', false, 'perdus') +
    c(eurosCourts(somme(l)), '💶 Montant total des devis') +
    c(eurosCourts(somme(signes)), '💶 Montant signé') +
    c(taux, '🎯 Taux de signature (signés / signés + perdus)') +
    c(delai === null ? '–' : delai + ' j', '⏱️ Délai moyen de réponse du particulier') +
  '</div>';
}

// ----- L'onglet -----
const FILTRES_DEVIS = [
  ['a_faire', '⏰ À faire aujourd\'hui', function (g) { return g.items.some(actionDue); }],
  ['en_cours', '💬 En cours', function (g) { return g.items.some(devisEnCours); }],
  ['signes', '✍️ Signés', function (g) { return g.items.some(function (d) { return d.suivi === 'signe'; }); }],
  ['perdus', '❌ Perdus', function (g) { return g.items.some(function (d) { return d.suivi === 'perdu'; }); }],
  ['tous', 'Tous', function () { return true; }]
];
function groupesDevis() {
  const groupes = [], index = {};
  devisActuels().forEach(function (d) {
    const p = d.particulier || {};
    const cle = p.id || 'inconnu';
    if (!index[cle]) { index[cle] = { p: p, items: [], anciens: [] }; groupes.push(index[cle]); }
    index[cle].items.push(d);
  });
  devisSuivi.filter(function (d) { return d.statut === 'remplace'; }).forEach(function (d) {
    const g = index[(d.particulier || {}).id || 'inconnu'];
    if (g) g.anciens.push(d);
  });
  // Ceux qui ont une action due en premier
  return groupes.sort(function (a, b) { return (b.items.some(actionDue) ? 1 : 0) - (a.items.some(actionDue) ? 1 : 0); });
}

function afficherDevisSuivi() {
  if (typeof ajouterOnglet === 'function') ajouterOnglet('devis', '📄 Devis', 'projets');
  const panneau = document.getElementById('panneau-devis');
  if (!panneau) return;
  const aFaire = devisActuels().filter(actionDue).length;
  const pastille = document.getElementById('pastille-devis');
  if (pastille) { pastille.textContent = aFaire; pastille.classList.toggle('cache', !aFaire); }
  const groupes = groupesDevis();
  if (!filtreDevis) filtreDevis = aFaire ? 'a_faire' : 'en_cours';
  const test = (FILTRES_DEVIS.find(function (f) { return f[0] === filtreDevis; }) || FILTRES_DEVIS[FILTRES_DEVIS.length - 1])[2];
  const recherche = ((document.getElementById('recherche-devis') || {}).value || '').trim().toLowerCase();
  const liste = groupes.filter(test).filter(function (g) {
    if (!recherche) return true;
    return [g.p.prenom, g.p.nom, g.p.telephone, g.p.email].concat(g.items.map(function (d) { return nomArtisan(d) + ' ' + typeProjetDevis(d) + ' ' + ((d.projet || {}).zone || ''); }))
      .some(function (x) { return String(x || '').toLowerCase().indexOf(recherche) !== -1; });
  });
  // On garde ce qui est en cours de saisie si la liste se redessine
  const saisies = {};
  Object.keys(devisOuvert).forEach(function (id) {
    if (!document.getElementById('dv-note-' + id)) return;
    saisies[id] = ['dv-suivi-', 'dv-le-', 'dv-action-', 'dv-note-'].map(function (p) { return document.getElementById(p + id).value; });
  });
  const focus = document.activeElement && document.activeElement.id === 'recherche-devis';
  panneau.innerHTML =
    '<p class="aide">Tous les devis envoyés par les artisans, rangés par particulier (3 devis au plus chacun). Les relances J+2, J+7 et J+14 se proposent toutes seules, avec le SMS prêt : c\'est toi qui l\'envoies, puis tu cliques « ✓ Relance faite ». Rien ne part automatiquement.</p>' +
    blocChiffresDevis() +
    '<input type="search" class="recherche" id="recherche-devis" autocomplete="off" placeholder="Rechercher un particulier, un artisan, un secteur…" oninput="afficherDevisSuivi()" value="' + albEchapper(recherche) + '">' +
    '<div class="filtres">' + FILTRES_DEVIS.map(function (f) {
      return '<button type="button" class="filtre' + (filtreDevis === f[0] ? ' actif' : '') + '" onclick="choisirFiltreDevis(\'' + f[0] + '\')">' + f[1] + ' <span class="nb">(' + groupes.filter(f[2]).length + ')</span></button>';
    }).join('') + '</div>' +
    (liste.length ? liste.map(function (g) {
      const p = g.p;
      const items = filtreDevis === 'tous' || filtreDevis === 'en_cours' || filtreDevis === 'a_faire' ? g.items
        : g.items.filter(function (d) { return d.suivi === (filtreDevis === 'signes' ? 'signe' : 'perdu'); });
      return '<div class="proprio">' +
        '<div class="proprio-tete"><span class="badge-qui particulier">🙋 Particulier</span>' +
          '<span class="proprio-nom">' + albEchapper(((p.prenom || '') + ' ' + (p.nom || '')).trim() || 'Particulier') + '</span>' +
          '<span class="compte">' + g.items.length + ' devis reçu' + (g.items.length > 1 ? 's' : '') + ' sur 3 au plus</span>' +
          '<div class="proprio-coord">' + (typeof lienTelephone === 'function' ? lienTelephone(p.telephone) : albEchapper(p.telephone || '')) +
            (p.email ? '<a href="mailto:' + albEchapper(p.email) + '">✉️ ' + albEchapper(p.email) + '</a>' : '') + '</div></div>' +
        items.map(function (d) { return carteDevis(d, false); }).join('') +
        (g.anciens.length ? '<details class="historique" style="margin-top:8px;"><summary>🕘 Anciennes versions (' + g.anciens.length + ')</summary>' + g.anciens.map(function (d) { return carteDevis(d, true); }).join('') + '</details>' : '') +
      '</div>';
    }).join('') : '<div class="vide">' + (devisSuivi.length ? 'Rien ici pour le moment. 🌿' : 'Aucun devis pour l\'instant. Ils arrivent ici dès qu\'un artisan en envoie un depuis son espace. 🌿') + '</div>');
  Object.keys(saisies).forEach(function (id) {
    ['dv-suivi-', 'dv-le-', 'dv-action-', 'dv-note-'].forEach(function (p, i) { const el = document.getElementById(p + id); if (el) el.value = saisies[id][i]; });
  });
  if (focus) { const r = document.getElementById('recherche-devis'); r.focus(); r.setSelectionRange(r.value.length, r.value.length); }
}

function choisirFiltreDevis(f) { filtreDevis = f; afficherDevisSuivi(); }
function basculerDevis(id) { devisOuvert[id] = !devisOuvert[id]; afficherDevisSuivi(); }

async function ouvrirFichierDevis(id, bouton) {
  const d = devisSuivi.find(function (x) { return x.id === id; });
  if (!d) return;
  const fenetre = window.open('', '_blank');
  bouton.disabled = true;
  const { data, error } = await albSupabase.storage.from('projets-medias').createSignedUrl(d.chemin, 3600);
  bouton.disabled = false;
  if (error || !data) { if (fenetre) fenetre.close(); afficherMessage('message-general', 'erreur', 'Le devis n\'a pas pu être ouvert. Réessaie dans un instant.'); return; }
  if (fenetre) fenetre.location = data.signedUrl; else window.open(data.signedUrl, '_blank');
}

async function apresSuiviDevis(texte) {
  await chargerDevisSuivi();
  afficherDevisSuivi();
  afficherAFaire();
  if (typeof afficherAgenda === 'function') afficherAgenda();
  afficherMessage('message-general', 'succes', texte);
}

async function devisEtapeFaite(id, etape, bouton) {
  const mot = window.prompt('Relance J+' + etape + ' faite. Ce qu\'il t\'a répondu ? (facultatif)', '');
  if (mot === null) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_devis_etape', { p_id: id, p_etape: etape, p_note: mot });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await apresSuiviDevis('C\'est noté ✓ Relance J+' + etape + ' faite.');
}

async function devisActionFaite(id, bouton) {
  const d = devisSuivi.find(function (x) { return x.id === id; });
  if (!d) return;
  const mot = window.prompt('« ' + d.prochaine_action + ' » : c\'est fait. Un mot pour tes notes ? (facultatif)', '');
  if (mot === null) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_devis_suivi', { p_id: id, p_suivi: null, p_note: 'Fait : ' + d.prochaine_action + (mot.trim() ? ' — ' + mot.trim() : ''), p_action: null, p_action_le: null });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await apresSuiviDevis('C\'est noté ✓');
}

async function enregistrerSuiviDevis(id, bouton) {
  const v = function (p) { return document.getElementById(p + id).value.trim(); };
  const action = v('dv-action-'), le = v('dv-le-');
  if (action && !le) { afficherMessage('message-general', 'erreur', 'Choisis la date de la prochaine action.'); return; }
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_devis_suivi', { p_id: id, p_suivi: v('dv-suivi-'), p_note: v('dv-note-'), p_action: action, p_action_le: le || null });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  devisOuvert[id] = false;
  await apresSuiviDevis('Suivi du devis enregistré ✓');
}

// « À faire aujourd'hui » : les actions de devis du jour (et celles en retard)
LIGNES_A_FAIRE.splice(2, 0, {
  calcul: function () { return devisActuels().filter(actionDue).length; },
  un: 'devis à relancer ou à suivre aujourd\'hui', plusieurs: 'devis à relancer ou à suivre aujourd\'hui', emoji: '📄', onglet: 'devis',
  filtre: function () { choisirFiltreDevis('a_faire'); }
});

// Dans l'agenda : la prochaine action de chaque devis (celles en retard apparaissent aujourd'hui)
if (typeof elementsAgenda === 'function') {
  (function () {
    const elementsAgendaAvantDevis = elementsAgenda;
    elementsAgenda = function () {
      const liste = elementsAgendaAvantDevis();
      if (typeof agendaDatesSite !== 'undefined' && !agendaDatesSite) return liste;
      const auj = jourIso(0);
      devisActuels().forEach(function (d) {
        const a = prochaineActionDevis(d);
        if (!a) return;
        const pa = d.particulier || {};
        liste.push({ le: a.le < auj ? auj : a.le, emoji: '📄', titre: 'Devis ' + nomArtisan(d) + ' · ' + (((pa.prenom || '') + ' ' + (pa.nom || '')).trim() || 'particulier'),
          detail: (a.le < auj ? 'Prévu le ' + dateCourteDevis(a.le) + ' (en retard) · ' : '') + a.texte, onglet: 'devis' });
      });
      return liste;
    };
  })();
}

if (typeof ajouterOnglet === 'function') ajouterOnglet('devis', '📄 Devis', 'projets');
(function () {
  const toutRechargerAvantDevis = toutRecharger;
  toutRecharger = async function () {
    await Promise.all([toutRechargerAvantDevis(), chargerDevisSuivi()]);
    afficherDevisSuivi();
    if (typeof afficherAgenda === 'function') afficherAgenda();
    afficherAFaire();
  };
})();

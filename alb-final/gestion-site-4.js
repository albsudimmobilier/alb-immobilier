// ============================================================
// Gestion du site — partie 4 : 📆 Points des pros
// Désaccords entre un pro et un particulier, ventes annoncées
// à confirmer, et réponses des pros au point du mois.
// Rien n'est facturé ni changé sans la décision de Jocelyne.
// ============================================================

let pointsPros = { desaccords: [], ventes: [], points: [] };
let filtrePoints = null;

ERREURS.INTROUVABLE = "Cet élément est introuvable : il a peut-être déjà été traité. Recharge la page.";

const REPONSES_PRO = { signe: '✅ Signé', en_cours: '🔄 En cours', a_relancer: '📞 À relancer', sans_suite: '✗ Sans suite', refuse: '✗ Refusé',
  en_vente: '🌐 Toujours en vente', pause: '⏸️ En pause', compromis: '✍️ Sous compromis', vendu: '🎉 Vendu (à confirmer)' };
const REPONSES_PARTICULIER = { fait: '✅ C\'est fait', en_cours: '🔄 En cours', pas_encore: '⏳ Pas encore décidé', non: '✗ Pas de suite' };
const MODULES_POINTS = { financement: '💶 Financement', travaux: '🔧 Travaux', accompagnement: '🤝 Vente / achat' };
const METIERS_POINTS = { courtier: '🏦 Courtier', artisan: '🔨 Artisan', immo: '🏠 Agent / mandataire', autre: '🤝 Autre métier' };

function desaccordsOuverts() { return pointsPros.desaccords.filter(function (d) { return !d.traite_le; }); }

const FILTRES_POINTS = [
  ['desaccords', '⚠️ Désaccords', function () { return desaccordsOuverts(); }],
  ['ventes', '🎉 Ventes à confirmer', function () { return pointsPros.ventes; }],
  ['reponses', '📆 Réponses des pros', function () { return pointsPros.points; }],
  ['regles', '✓ Désaccords réglés', function () { return pointsPros.desaccords.filter(function (d) { return d.traite_le; }); }]
];

async function chargerPoints() {
  const { data, error } = await albSupabase.rpc('alb_gestion_points');
  if (error) { console.error('[ALB DEBUG] points des pros :', error); return; }
  pointsPros = data || { desaccords: [], ventes: [], points: [] };
  afficherPoints();
}

function choisirFiltrePoints(nom) { filtrePoints = nom; afficherPoints(); }

function montantLisible(m) { return m != null ? ' · ' + prixLisible(m) : ''; }

function afficherPoints() {
  const ouverts = desaccordsOuverts().length;
  const ventes = pointsPros.ventes.length;
  document.getElementById('pastille-points').textContent = ouverts + ventes;
  if (!filtrePoints) filtrePoints = ouverts ? 'desaccords' : ventes ? 'ventes' : 'reponses';

  document.getElementById('filtres-points').innerHTML = FILTRES_POINTS.map(function (f) {
    return '<button type="button" class="filtre' + (filtrePoints === f[0] ? ' actif' : '') + '" onclick="choisirFiltrePoints(\'' + f[0] + '\')">' +
      f[1] + ' <span class="nb">(' + f[2]().length + ')</span></button>';
  }).join('');

  const zone = document.getElementById('liste-points');
  const liste = (FILTRES_POINTS.find(function (f) { return f[0] === filtrePoints; }) || FILTRES_POINTS[2])[2]();
  if (!liste.length) {
    const vides = {
      desaccords: 'Aucun désaccord en ce moment. Les pros et les particuliers disent la même chose. 🌿',
      ventes: 'Aucune vente à confirmer. 🌿',
      reponses: 'Pas encore de point du mois. Les premiers mails partent le 25 à 9 h, seulement aux pros à qui ALB a apporté quelque chose.',
      regles: 'Aucun désaccord réglé ces 60 derniers jours.'
    };
    zone.innerHTML = '<div class="carte vide">' + vides[filtrePoints] + '</div>';
    return;
  }
  if (filtrePoints === 'desaccords' || filtrePoints === 'regles') zone.innerHTML = liste.map(ficheDesaccord).join('');
  else if (filtrePoints === 'ventes') zone.innerHTML = liste.map(ficheVente).join('');
  else zone.innerHTML = liste.map(fichePoint).join('');
}

function ficheDesaccord(d) {
  const titre = d.genre === 'montant' ? '⚠️ Pas le même montant' : '⚠️ Pas la même réponse';
  const regle = d.traite_le
    ? '<div class="point-a-faire">' + (d.regle_seul
        ? '🌿 Réglé tout seul le ' + albEchapper(dateLisible(d.traite_le)) + ' : ils disent maintenant la même chose.'
        : '✓ Réglé par toi le ' + albEchapper(dateLisible(d.traite_le)) + (d.note ? ' : « ' + albEchapper(d.note) + ' »' : '')) + '</div>'
    : '<div class="decision"><div class="decision-titre">Après tes appels, qu\'as-tu décidé ?</div>' +
        '<textarea class="texte-pret" id="note-desaccord-' + albEchapper(d.id) + '" maxlength="1000" placeholder="Ex. : appelé les deux, le prêt est bien signé pour 150 000 €"></textarea>' +
        '<div class="actions"><button type="button" class="bouton vert" onclick="reglerDesaccord(\'' + albEchapper(d.id) + '\', this)">✓ C\'est réglé</button></div></div>';
  return '<div class="carte' + (d.traite_le ? '' : ' a-faire') + '">' +
    '<h3>' + titre + '</h3>' +
    '<p class="ligne-info">' + albEchapper(MODULES_POINTS[d.module] || 'Projet') + (d.zone ? ' · ' + albEchapper(d.zone) : '') +
      ' · signalé le ' + albEchapper(dateLisible(d.cree_le)) + '</p>' +
    '<div class="prive"><div class="prive-titre">🧰 Le pro : ' + albEchapper(d.pro || '') + '</div>' +
      '<p class="ligne-info"><strong>' + albEchapper((REPONSES_PRO[d.reponse_pro] || d.reponse_pro || '') + montantLisible(d.montant_pro)) + '</strong></p>' +
      (d.commentaire_pro ? '<p class="ligne-info mot">💬 ' + albEchapper(d.commentaire_pro) + '</p>' : '') +
      '<p class="ligne-info">' + lienTelephone(d.pro_tel) + '</p></div>' +
    '<div class="prive"><div class="prive-titre">🏠 Le particulier : ' + albEchapper(d.particulier || '') + '</div>' +
      '<p class="ligne-info"><strong>' + albEchapper((REPONSES_PARTICULIER[d.reponse_particulier] || d.reponse_particulier || '') + montantLisible(d.montant_particulier)) + '</strong></p>' +
      (d.commentaire_particulier ? '<p class="ligne-info mot">💬 ' + albEchapper(d.commentaire_particulier) + '</p>' : '') +
      '<p class="ligne-info">' + lienTelephone(d.particulier_tel) + '</p></div>' +
    regle +
  '</div>';
}

function ficheVente(v) {
  return '<div class="carte a-faire">' +
    '<h3>🎉 ' + albEchapper(v.titre || 'Annonce') + '</h3>' +
    '<p class="ligne-info">' + albEchapper(v.ville || '') + ' · ' + albEchapper(prixLisible(v.prix)) + '</p>' +
    '<p class="ligne-info">Annoncé vendu par <strong>' + albEchapper(v.pro || '') + '</strong> le ' + albEchapper(dateLisible(v.repondu_le)) + '</p>' +
    (v.commentaire ? '<p class="ligne-info mot">💬 ' + albEchapper(v.commentaire) + '</p>' : '') +
    '<p class="ligne-info">' + lienTelephone(v.pro_tel) + '</p>' +
    '<p class="aide">Vérifie avec le pro, puis confirme. Tant que tu n\'as rien cliqué, l\'annonce reste en ligne.</p>' +
    '<div class="actions">' +
      '<button type="button" class="bouton vert" onclick="decisionAnnonce(\'' + albEchapper(v.annonce_id) + '\', \'vendu\', this)">🎉 Confirmer : c\'est vendu</button>' +
      '<button type="button" class="bouton rouge" onclick="ecarterVente(\'' + albEchapper(v.ligne) + '\', this)">✗ Ce n\'est pas vendu</button>' +
    '</div>' +
  '</div>';
}

function fichePoint(p) {
  const mois = new Date(p.mois + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const etat = p.repondu_le ? '<span class="etiquette vert">✓ Répondu le ' + albEchapper(dateLisible(p.repondu_le)) + '</span>'
    : p.envoye_le ? '<span class="etiquette">📨 Envoyé le ' + albEchapper(dateLisible(p.envoye_le)) + ', pas encore de réponse</span>'
    : '<span class="etiquette">⏳ Part le 25 à 9 h</span>';
  const lignes = (p.lignes || []).map(function (l) {
    const quoi = l.type === 'annonce'
      ? '🏡 ' + albEchapper(l.titre || '') + ' · ' + albEchapper(l.ville || '')
      : albEchapper(MODULES_POINTS[l.module] || 'Projet') + ' · ' + albEchapper(l.particulier || '');
    const rep = l.reponse
      ? '<strong>' + albEchapper((REPONSES_PRO[l.reponse] || l.reponse) + montantLisible(l.montant) +
          (l.date_acte ? ' · acte le ' + dateLisible(l.date_acte) : '')) + '</strong>'
      : '<span style="color:#7a7a75;">pas encore répondu</span>';
    const part = l.type !== 'annonce' && l.reponse_particulier
      ? '<br><span class="aide">Le particulier dit : ' + albEchapper(REPONSES_PARTICULIER[l.reponse_particulier] || l.reponse_particulier) + '</span>' : '';
    return '<div class="visite"><div>' + quoi + '</div><div>' + rep + part + '</div>' +
      (l.commentaire ? '<div class="mot">💬 ' + albEchapper(l.commentaire) + '</div>' : '') + '</div>';
  }).join('');
  return '<div class="carte">' +
    '<h3>' + albEchapper(p.pro || 'Pro') + '</h3>' +
    '<p class="ligne-info">' + albEchapper(METIERS_POINTS[p.pro_role] || '') + ' · point de ' + albEchapper(mois) + '</p>' +
    '<div class="etiquettes">' + etat + '</div>' +
    '<p class="ligne-info">' + lienTelephone(p.pro_tel) + '</p>' +
    lignes +
  '</div>';
}

async function reglerDesaccord(id, bouton) {
  const note = (document.getElementById('note-desaccord-' + id).value || '').trim();
  if (!note && !confirm('Tu n\'as rien noté. Marquer quand même ce désaccord comme réglé ?')) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_desaccord_traiter', { p_id: id, p_note: note });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerPoints();
  afficherAFaire();
  afficherMessage('message-general', 'succes', 'C\'est noté ✓ Le désaccord est réglé. Tu le retrouves dans « ✓ Désaccords réglés ».');
}

async function ecarterVente(ligne, bouton) {
  if (!confirm('Le pro s\'est trompé et ce n\'est pas vendu ? L\'annonce reste comme elle est.')) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_vente_ecarter', { p_ligne: ligne });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerPoints();
  afficherAFaire();
  afficherMessage('message-general', 'info', 'C\'est noté : la vente n\'est pas confirmée. L\'annonce reste comme elle est.');
}

// Les deux lignes les plus importantes passent en tête de « À faire aujourd'hui »
LIGNES_A_FAIRE.unshift(
  { calcul: function () { return desaccordsOuverts().length; }, un: 'désaccord entre un pro et un particulier : appelle-les pour trancher', plusieurs: 'désaccords entre pros et particuliers : appelle-les pour trancher', emoji: '⚠️', onglet: 'points', filtre: function () { choisirFiltrePoints('desaccords'); } },
  { calcul: function () { return pointsPros.ventes.length; }, un: 'vente annoncée par un pro, à confirmer', plusieurs: 'ventes annoncées par des pros, à confirmer', emoji: '🎉', onglet: 'points', filtre: function () { choisirFiltrePoints('ventes'); } }
);

// À chaque rechargement de Gestion du site, on recharge aussi les points des pros
(function () {
  const toutRechargerDeBase = toutRecharger;
  toutRecharger = async function () {
    await Promise.all([toutRechargerDeBase(), chargerPoints()]);
    afficherAFaire();
  };
})();

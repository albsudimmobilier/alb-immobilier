// ============================================================
// gestion-site-3.js — Gestion du site, partie 3
//  • « 📋 À faire aujourd'hui » : la liste des choses à faire, en haut
//    du tableau de bord, rangées de la plus urgente à la moins urgente.
//    Un clic sur une ligne ouvre le bon onglet, déjà filtré.
//  • Visites : les SMS de rappel à copier, avec « ✓ Je l'ai envoyé »
//    pour savoir où tu en es. (ligneVisite et blocSms remplacent ici
//    celles de la partie 2.)
// Chargé par gestion-site.html, après gestion-site-1.js et gestion-site-2.js
// ============================================================

// ---------- Visites : SMS de rappel, avec le suivi « envoyé » ----------
function ligneVisite(v) {
  const b = v.acheteur || {}, vd = v.vendeur || {}, a = v.annonce || {};
  const pro = v.type_vente === 'accompagnee';
  const retard = sansReponseDepuis(v);
  let quand = '';
  if (v.statut === 'autre_moment') quand = 'Proposé par le vendeur : ' + momentVisite(v.nouveau_creneau_date, v.nouveau_creneau_heure) + (v.creneau_date ? ' (demandé : ' + momentVisite(v.creneau_date, v.creneau_heure) + ')' : '');
  else if (v.creneau_date) quand = momentVisite(v.creneau_date, v.creneau_heure);
  else quand = pro ? 'Date à fixer par le pro au téléphone' : 'Aucun créneau choisi : le vendeur doit proposer un moment';

  let sms = '';
  if (v.statut === 'acceptee' && v.creneau_date === jourIso(1)) {
    const heure = String(v.creneau_heure || '').replace(':', 'h');
    const lieu = [a.adresse, ((a.code_postal || '') + ' ' + (a.ville || '')).trim()].filter(Boolean).join(', ');
    const contactVendeur = ((vd.prenom || '') + (pro && vd.nom_entreprise ? ' (' + vd.nom_entreprise + ')' : '')).trim();
    const telVendeur = a.telephone_annonce || vd.telephone || '';
    const texteAcheteur = 'Bonjour ' + (b.prenom || '') + ', petit rappel : votre visite « ' + a.titre + ' » est demain à ' + heure + ', ' + lieu + '. ' +
      (contactVendeur ? 'Contact : ' + contactVendeur + (telVendeur ? ' au ' + telVendeur : '') + '. ' : '') + 'Bonne visite ! Jocelyne, ALB Sud Immobilier';
    const texteVendeur = 'Bonjour ' + (vd.prenom || '') + ', petit rappel : visite de votre bien « ' + a.titre + ' » demain à ' + heure + ' avec ' +
      ((b.prenom || '') + ' ' + (b.nom || '')).trim() + (b.telephone ? ' (' + b.telephone + ')' : '') + '. Bonne visite ! Jocelyne, ALB Sud Immobilier';
    sms = blocSms('au visiteur (' + (b.prenom || '') + ')', b.telephone, texteAcheteur, v, 'acheteur') +
          blocSms('au ' + (pro ? 'professionnel' : 'vendeur') + ' (' + (vd.prenom || '') + ')', telVendeur, texteVendeur, v, 'vendeur');
  }

  return '<div class="visite">' +
    '<div class="visite-tete"><span class="badge-qui acheteur">🔎 Acheteur</span>' +
      '<span class="visite-nom">' + albEchapper(((b.prenom || '') + ' ' + (b.nom || '')).trim()) + '</span>' +
      lienTelephone(b.telephone) + (b.email ? '<a href="mailto:' + albEchapper(b.email) + '">✉️ ' + albEchapper(b.email) + '</a>' : '') + '</div>' +
    '<p class="ligne-info"><strong>' + (STATUTS_VISITE[v.statut] || albEchapper(v.statut)) + '</strong>' +
      (retard >= 2 ? ' · <span class="retard">sans réponse depuis ' + retard + ' jours</span>' : '') + '</p>' +
    '<p class="ligne-info">📅 ' + albEchapper(quand) + '</p>' +
    '<p class="ligne-info">💰 Budget estimé ' + prixLisible(v.budget_estime) + ' pour un bien à ' + prixLisible(v.prix_bien) + (v.dans_budget ? ' ✅' : ' ⚠️') +
      (v.partage_budget ? ' · partagé avec le vendeur' : '') + (v.courtier_souhaite ? ' · <strong>🏦 rappel courtier demandé</strong>' : '') + '</p>' +
    '<details class="historique"><summary>Détail de la simulation</summary><p>Revenus ' + prixLisible(v.revenus_mensuels) + ' par mois · crédits ' + prixLisible(v.credits_mensuels) +
      ' par mois · apport ' + prixLisible(v.apport) + ' · ' + albEchapper(v.duree_annees) + ' ans à ' + albEchapper(v.taux) + ' %</p></details>' +
    (v.message ? '<p class="ligne-info mot">💬 Acheteur : « ' + albEchapper(v.message) + ' »</p>' : '') +
    (v.reponse_vendeur ? '<p class="ligne-info mot">💬 Vendeur : « ' + albEchapper(v.reponse_vendeur) + ' »</p>' : '') +
    '<p class="ligne-info" style="color:#7a7a75;">Demandée le ' + dateLisible(v.cree_le) + '</p>' +
    sms +
  '</div>';
}

function blocSms(pour, telephone, texte, v, qui) {
  const num = String(telephone || '').replace(/[^0-9+]/g, '');
  if (!num) return '<div class="sms">📱 SMS ' + albEchapper(pour) + ' : pas de numéro.</div>';
  const envoyeLe = v && qui ? v['sms_' + qui + '_le'] : null;
  const suivi = !v ? '' : envoyeLe
    ? '<p class="ligne-info" style="margin-top:6px;"><span class="etiquette vert">✅ Envoyé à ' + new Date(envoyeLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h') + '</span> ' +
      '<button type="button" class="bouton discret" style="padding:4px 10px;font-size:0.8rem;" onclick="smsEnvoye(\'' + v.id + '\', \'' + qui + '\', false, this)">Annuler</button></p>'
    : '';
  return '<div class="sms"' + (envoyeLe ? ' style="opacity:0.75;"' : '') + '><strong>📱 SMS ' + albEchapper(pour) + '</strong>' +
    '<textarea class="texte-pret" readonly>' + albEchapper(texte) + '</textarea>' +
    '<div class="actions"><a class="bouton" href="sms:' + albEchapper(num) + '?&body=' + encodeURIComponent(texte) + '">📱 Ouvrir le SMS</a>' +
    '<button type="button" class="bouton discret" onclick="copier(this)">📋 Copier le texte</button>' +
    (v && !envoyeLe ? '<button type="button" class="bouton vert" onclick="smsEnvoye(\'' + v.id + '\', \'' + qui + '\', true, this)">✓ Je l\'ai envoyé</button>' : '') +
    '</div>' + suivi + '</div>';
}

async function smsEnvoye(id, qui, envoye, bouton) {
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_visite_sms', { p_id: id, p_qui: qui, p_envoye: envoye });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  const v = visites.find(function (x) { return x.id === id; });
  if (v) v['sms_' + qui + '_le'] = envoye ? new Date().toISOString() : null;
  afficherVisites();
  afficherAFaire();
}

// SMS de rappel encore à envoyer pour les visites de demain
function smsRestants() {
  return (typeof visites !== 'undefined' ? visites : []).filter(function (v) {
    return v.statut === 'acceptee' && v.creneau_date === jourIso(1);
  }).reduce(function (n, v) {
    const telVendeur = (v.annonce || {}).telephone_annonce || (v.vendeur || {}).telephone;
    return n + ((v.acheteur || {}).telephone && !v.sms_acheteur_le ? 1 : 0) + (telVendeur && !v.sms_vendeur_le ? 1 : 0);
  }, 0);
}

// Chaque ligne : compteur à lire, texte (1 / plusieurs), onglet et filtre à ouvrir
const LIGNES_A_FAIRE = [
  { calcul: smsRestants, un: 'SMS de rappel à envoyer pour les visites de demain', plusieurs: 'SMS de rappel à envoyer pour les visites de demain', emoji: '📱', onglet: 'visites', filtre: function () { choisirFiltreVisites('demain'); } },
  { compteur: 'c-vis-retard', un: 'demande de visite sans réponse depuis 48 h : relance le vendeur', plusieurs: 'demandes de visite sans réponse depuis 48 h : relance les vendeurs', emoji: '⏳', onglet: 'visites', filtre: function () { choisirFiltreVisites('a_traiter'); } },
  { compteur: 'c-pj-traiter', un: 'projet à traiter : appel ou orientation vers un pro', plusieurs: 'projets à traiter : appel ou orientation vers un pro', emoji: '📞', onglet: 'projets', filtre: function () { choisirFiltreProjets('a_traiter'); } },
  { mandats: true, un: 'vendeur dont le mandat exclusif est terminé : c\'est le moment de l\'appeler', plusieurs: 'vendeurs dont le mandat exclusif est terminé : c\'est le moment de les appeler', emoji: '🔔', onglet: 'annonces', ancre: 'liste-mandats' },
  { compteur: 'c-a-valider', un: 'pro à rappeler pour valider son inscription', plusieurs: 'pros à rappeler pour valider leur inscription', emoji: '🤝', onglet: 'a-valider' },
  { compteur: 'c-ann-etudier', un: 'annonce à étudier avant sa mise en ligne', plusieurs: 'annonces à étudier avant leur mise en ligne', emoji: '🏡', onglet: 'annonces', filtre: function () { choisirFiltreStatut('a_etudier'); } },
  { compteur: 'c-ann-points', un: 'point mensuel à faire avec un vendeur', plusieurs: 'points mensuels à faire avec les vendeurs', emoji: '📆', onglet: 'annonces', filtre: function () { choisirFiltreStatut('points'); } },
  { compteur: 'c-papiers', un: 'papier de pro à vérifier', plusieurs: 'papiers de pros à vérifier', emoji: '📄', onglet: 'valides' },
  { compteur: 'c-pas-en-ligne', un: 'pro validé pas encore en ligne', plusieurs: 'pros validés pas encore en ligne', emoji: '⏸️', onglet: 'valides' },
  { compteur: 'c-pj-suivis', un: 'suivi à vérifier avec un pro (travaux ou prêt signé ?)', plusieurs: 'suivis à vérifier avec les pros (travaux ou prêts signés ?)', emoji: '🔎', onglet: 'projets', filtre: function () { choisirFiltreProjets('suivis'); } },
  { compteur: 'c-avis-a-relire', un: 'avis à relire avant publication', plusieurs: 'avis à relire avant publication', emoji: '⭐', onglet: 'avis', filtre: function () { choisirFiltreAvis('a_relire'); } },
  { compteur: 'pastille-acces', un: 'demande d\'accès à un compte à traiter', plusieurs: 'demandes d\'accès à des comptes à traiter', emoji: '🔑', onglet: 'acces' }
];

function nombreAFaire(ligne) {
  if (ligne.calcul) return ligne.calcul();
  if (ligne.mandats) {
    const aujourdhui = new Date();
    return (typeof rappelsMandat !== 'undefined' ? rappelsMandat : []).filter(function (r) {
      return r.fin_mandat && new Date(r.fin_mandat + 'T12:00:00') <= aujourdhui;
    }).length;
  }
  const el = document.getElementById(ligne.compteur);
  return el ? (parseInt(el.textContent, 10) || 0) : 0;
}

function afficherAFaire() {
  const zone = document.getElementById('a-faire-liste');
  if (!zone) return;
  const lignes = [];
  LIGNES_A_FAIRE.forEach(function (ligne, i) {
    const n = nombreAFaire(ligne);
    if (n > 0) lignes.push({ i: i, n: n, ligne: ligne });
  });
  const total = lignes.reduce(function (t, x) { return t + x.n; }, 0);
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('a-faire-date').textContent = date.charAt(0).toUpperCase() + date.slice(1);
  if (!lignes.length) {
    zone.innerHTML = '<p class="a-faire-vide">🌿 Rien d\'urgent aujourd\'hui. Tout est à jour, bravo !</p>';
    return;
  }
  zone.innerHTML = '<p class="a-faire-total">' + total + ' chose' + (total > 1 ? 's' : '') + ' à faire, de la plus urgente à la moins urgente :</p>' +
    lignes.map(function (x) {
      return '<button type="button" class="a-faire-ligne" onclick="ouvrirAFaire(' + x.i + ')">' +
        '<span class="a-faire-emoji">' + x.ligne.emoji + '</span>' +
        '<span class="a-faire-texte"><strong>' + x.n + '</strong> ' + albEchapper(x.n > 1 ? x.ligne.plusieurs : x.ligne.un) + '</span>' +
        '<span class="a-faire-fleche">→</span></button>';
    }).join('');
}

function ouvrirAFaire(i) {
  const ligne = LIGNES_A_FAIRE[i];
  if (!ligne) return;
  afficherOnglet(ligne.onglet);
  if (ligne.filtre) ligne.filtre();
  const cible = ligne.ancre ? document.getElementById(ligne.ancre) : null;
  if (cible) cible.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

// La liste se met à jour à chaque rechargement de Gestion du site :
// on la refait juste après le chargement des papiers des pros (le dernier compteur rempli)
(function () {
  const chargerPapiersDeBase = chargerPapiers;
  chargerPapiers = async function () {
    try { await chargerPapiersDeBase(); } finally { afficherAFaire(); }
  };
})();

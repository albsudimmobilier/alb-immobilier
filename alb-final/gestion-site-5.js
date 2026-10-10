// ============================================================
// Gestion du site — partie 5 : 💶 Factures
// Brouillons préparés le 1er du mois (pour le mois précédent).
// Rien n'est envoyé ni facturé sans la validation de Jocelyne.
// Jusqu'au 31/12/2026 : tout est offert (factures « à blanc »).
// Les vraies factures sont faites sur Pennylane : une facture validée
// passe « à saisir sur Pennylane », puis Jocelyne note le numéro Pennylane.
// ============================================================

let facturation = { tarifs: [], factures: [] };
let filtreFactures = 'brouillons';

ERREURS.FACTURE_NON_MODIFIABLE = 'Cette facture est déjà validée ou annulée : elle ne peut plus être modifiée.';
ERREURS.DESACCORD_OUVERT = 'Un désaccord est encore ouvert sur une ligne : règle-le dans « 📆 Points des pros », ou retire la ligne.';
ERREURS.MONTANT_INVALIDE = 'Ce montant ne semble pas juste.';

const METIERS_FACTURE = { courtier: '🏦 Courtier', artisan: '🔨 Artisan', immo: '🏠 Agent / mandataire', particulier: '🏡 Particulier vendeur', autre: '🤝 Autre métier' };
const UNITES_TARIF = { taux_artisan: '%', pret_courtier: '€ HT', abonnement_immo: '€ HT', immo_par_contact: '€ HT', abonnement_vendeur: '€ TTC', taux_tva: '%' };

function debutMois(decalage) {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth() + decalage, 1);
  return m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0') + '-01';
}
function moisLisible(iso) {
  const t = new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function euros(n) { return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

// Brouillons des mois terminés : ceux-là sont à valider
function brouillonsAValider() {
  const ceMois = debutMois(0);
  return facturation.factures.filter(function (f) { return f.statut === 'brouillon' && f.mois < ceMois; });
}
function aSaisirPennylane(f) { return f.statut === 'validee' && !f.a_blanc && !f.numero_pennylane; }

const FILTRES_FACTURES = [
  ['brouillons', '📝 Brouillons', function (f) { return f.statut === 'brouillon'; }],
  ['pennylane', '⏳ À saisir sur Pennylane', aSaisirPennylane],
  ['faites', '✅ Faites', function (f) { return f.statut === 'validee' && !aSaisirPennylane(f); }],
  ['annulees', '✗ Annulées', function (f) { return f.statut === 'annulee'; }]
];

async function chargerFactures() {
  const { data, error } = await albSupabase.rpc('alb_gestion_factures');
  if (error) { console.error('[ALB DEBUG] factures :', error); return; }
  facturation = data || { tarifs: [], factures: [] };
  afficherFactures();
}

function choisirFiltreFactures(nom) { filtreFactures = nom; afficherFactures(); }

function afficherTarifs() {
  const offert = facturation.tarifs.find(function (t) { return t.cle === 'offert_jusqu_au'; });
  document.getElementById('tarifs-offert').textContent = offert && offert.date_valeur
    ? '🎁 Tout est offert jusqu\'au ' + dateLisible(offert.date_valeur) + ' : les factures de cette période sont « à blanc » (0 € à payer).' : '';
  document.getElementById('liste-tarifs').innerHTML = facturation.tarifs.filter(function (t) { return t.cle !== 'offert_jusqu_au'; }).map(function (t) {
    return '<div class="petit-champ"><span>' + albEchapper(t.libelle) + '</span>' +
      '<div style="display:flex;gap:6px;align-items:center;"><input type="number" min="0" step="0.01" inputmode="decimal" id="tarif-' + albEchapper(t.cle) + '" value="' + albEchapper(t.valeur) + '" style="max-width:130px;"> ' +
      '<span>' + albEchapper(UNITES_TARIF[t.cle] || '') + '</span>' +
      '<button type="button" class="bouton discret" onclick="modifierTarif(\'' + albEchapper(t.cle) + '\', this)">Enregistrer</button></div></div>';
  }).join('');
}

function afficherFactures() {
  const aValider = brouillonsAValider().length + facturation.factures.filter(aSaisirPennylane).length;
  document.getElementById('pastille-factures').textContent = aValider;
  afficherTarifs();

  document.getElementById('filtres-factures').innerHTML = FILTRES_FACTURES.map(function (f) {
    return '<button type="button" class="filtre' + (filtreFactures === f[0] ? ' actif' : '') + '" onclick="choisirFiltreFactures(\'' + f[0] + '\')">' +
      f[1] + ' <span class="nb">(' + facturation.factures.filter(f[2]).length + ')</span></button>';
  }).join('');

  const filtre = (FILTRES_FACTURES.find(function (f) { return f[0] === filtreFactures; }) || FILTRES_FACTURES[0])[2];
  const liste = facturation.factures.filter(filtre);
  const zone = document.getElementById('liste-factures');
  if (!liste.length) {
    zone.innerHTML = '<div class="carte vide">' + (filtreFactures === 'brouillons'
      ? 'Aucun brouillon. Ils sont préparés automatiquement le 1er de chaque mois pour le mois précédent. Tu peux aussi les préparer maintenant avec les boutons ci-dessus.'
      : 'Rien ici pour le moment.') + '</div>';
    return;
  }
  zone.innerHTML = liste.map(ficheFacture).join('');
}

function ficheFacture(f) {
  const brouillon = f.statut === 'brouillon';
  const qui = (f.entreprise ? f.entreprise + ' · ' : '') + (f.nom || '');
  const lignes = (f.lignes || []).map(function (l) {
    return '<div class="visite">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;' + (l.retiree ? 'opacity:0.55;text-decoration:line-through;' : '') + '"><span>' + albEchapper(l.libelle) + (l.modifiee ? ' <span class="etiquette or">corrigé par toi</span>' : '') + '</span>' +
      '<strong>' + albEchapper(euros(l.montant_ht)) + ' HT</strong></div>' +
      (brouillon ? '<div class="actions" style="margin-top:6px;">' +
        (l.retiree
          ? '<button type="button" class="bouton discret" onclick="ligneFacture(\'' + albEchapper(l.id) + '\', \'remettre\', this)">↩️ Remettre</button>'
          : '<button type="button" class="bouton discret" onclick="corrigerLigneFacture(\'' + albEchapper(l.id) + '\', ' + Number(l.montant_ht) + ', this)">✏️ Corriger le montant</button>' +
            '<button type="button" class="bouton rouge" onclick="ligneFacture(\'' + albEchapper(l.id) + '\', \'retirer\', this)">✗ Retirer</button>') +
      '</div>' : '') +
    '</div>';
  }).join('');
  const etat = f.statut === 'annulee' ? '<span class="etiquette rouge">✗ Annulée</span>'
    : f.statut === 'brouillon' ? '<span class="etiquette or">📝 Brouillon</span>'
    : f.a_blanc ? '<span class="etiquette vert">✅ Relevé offert validé le ' + albEchapper(dateLisible(f.valide_le)) + '</span>'
    : f.numero_pennylane ? '<span class="etiquette vert">✅ Saisie sur Pennylane · n° ' + albEchapper(f.numero_pennylane) + '</span>'
    : '<span class="etiquette or">⏳ Validée le ' + albEchapper(dateLisible(f.valide_le)) + ' · à saisir sur Pennylane</span>';
  const blocPennylane = f.statut === 'validee' && !f.a_blanc
    ? '<div class="decision"><div class="decision-titre">' + (f.numero_pennylane ? 'Numéro de la facture sur Pennylane' : 'Une fois la facture faite sur Pennylane, colle son numéro ici') + '</div>' +
        '<input type="text" id="pennylane-' + albEchapper(f.id) + '" maxlength="60" placeholder="Ex. : F-2027-0001" value="' + albEchapper(f.numero_pennylane || '') + '">' +
        '<div class="actions"><button type="button" class="bouton vert" onclick="noterPennylane(\'' + albEchapper(f.id) + '\', this)">✓ Enregistrer le numéro</button></div></div>'
    : '';
  const totaux = '<div class="prive"><p class="ligne-info">Total HT : <strong>' + albEchapper(euros(f.total_ht)) + '</strong> · TVA : ' + albEchapper(euros(f.tva)) +
      ' · TTC : <strong>' + albEchapper(euros(f.total_ttc)) + '</strong></p>' +
      (f.a_blanc ? '<p class="ligne-info" style="color:#2E6B34;"><strong>🎁 Offert : 0 € à payer.</strong> Ce relevé montre ce que ' + albEchapper(f.nom || 'ce membre') + ' aurait payé.</p>' : '') + '</div>';
  return '<div class="carte' + (brouillon ? ' a-faire' : '') + '">' +
    '<h3>' + albEchapper(qui) + '</h3>' +
    '<p class="ligne-info">' + albEchapper(METIERS_FACTURE[f.role] || '') + ' · ' + albEchapper(moisLisible(f.mois)) + (f.siret ? ' · SIRET ' + albEchapper(f.siret) : '') + '</p>' +
    '<div class="etiquettes">' + etat + (f.a_blanc ? '<span class="etiquette vert">🎁 À blanc</span>' : '') + '</div>' +
    (f.desaccord ? '<div class="point-a-faire">⚠️ Un désaccord est ouvert sur une ligne : règle-le dans « 📆 Points des pros » avant de valider.</div>' : '') +
    lignes + totaux +
    (f.note ? '<p class="ligne-info mot">📝 ' + albEchapper(f.note) + '</p>' : '') +
    blocPennylane +
    (brouillon ? '<div class="decision"><div class="decision-titre">Ta décision</div>' +
      '<input type="text" id="note-facture-' + albEchapper(f.id) + '" maxlength="1000" placeholder="Une note pour toi (facultatif)">' +
      '<div class="actions"><button type="button" class="bouton vert" onclick="decisionFacture(\'' + albEchapper(f.id) + '\', \'valider\', this)">' + (f.a_blanc ? '✓ Valider le relevé offert' : '✓ Valider : à saisir sur Pennylane') + '</button>' +
      '<button type="button" class="bouton rouge" onclick="decisionFacture(\'' + albEchapper(f.id) + '\', \'annuler\', this)">✗ Annuler</button></div></div>' : '') +
  '</div>';
}

async function preparerFactures(decalage, bouton) {
  const mois = debutMois(decalage);
  bouton.disabled = true;
  const { data, error } = await albSupabase.rpc('alb_gestion_factures_preparer', { p_mois: mois });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  filtreFactures = 'brouillons';
  await chargerFactures();
  afficherAFaire();
  afficherMessage('message-general', 'succes', 'Brouillons de ' + moisLisible(mois).toLowerCase() + ' à jour ✓ ' + (data || 0) + ' ligne' + (data > 1 ? 's' : '') + ' ajoutée' + (data > 1 ? 's' : '') + '. Rien n\'est envoyé.');
}

async function ligneFacture(id, action, bouton, montant) {
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_facture_ligne', { p_ligne: id, p_action: action, p_montant: montant == null ? null : montant });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerFactures();
  afficherAFaire();
}

function corrigerLigneFacture(id, actuel, bouton) {
  const saisie = prompt('Nouveau montant HT de cette ligne (en €) :', String(actuel).replace('.', ','));
  if (saisie === null) return;
  const montant = Number(String(saisie).replace(/\s/g, '').replace(',', '.'));
  if (!(montant >= 0)) { afficherMessage('message-general', 'erreur', ERREURS.MONTANT_INVALIDE); return; }
  ligneFacture(id, 'montant', bouton, montant);
}

async function decisionFacture(id, decision, bouton) {
  const question = decision === 'valider'
    ? 'Valider ? Une fois validée, elle ne pourra plus être modifiée. Rien n\'est envoyé au membre : la facture se fait ensuite sur Pennylane.'
    : 'Annuler ce brouillon ? Ses lignes pourront revenir dans un prochain brouillon.';
  if (!confirm(question)) return;
  const note = (document.getElementById('note-facture-' + id).value || '').trim();
  bouton.disabled = true;
  const { data, error } = await albSupabase.rpc('alb_gestion_facture_decision', { p_id: id, p_decision: decision, p_note: note || null });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerFactures();
  afficherAFaire();
  afficherMessage('message-general', decision === 'valider' ? 'succes' : 'info', decision === 'valider'
    ? 'Validé ✓ S\'il y a un montant à payer, la facture passe dans « ⏳ À saisir sur Pennylane ».'
    : 'Brouillon annulé.');
}

async function noterPennylane(id, bouton) {
  const numero = (document.getElementById('pennylane-' + id).value || '').trim();
  if (!numero && !confirm('Le champ est vide : effacer le numéro Pennylane de cette facture ?')) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_facture_pennylane', { p_id: id, p_numero: numero });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerFactures();
  afficherAFaire();
  afficherMessage('message-general', 'succes', numero ? 'Numéro Pennylane enregistré ✓ La facture passe dans « ✅ Faites ».' : 'Numéro Pennylane effacé.');
}

async function modifierTarif(cle, bouton) {
  const valeur = Number(String(document.getElementById('tarif-' + cle).value || '').replace(',', '.'));
  if (!(valeur >= 0)) { afficherMessage('message-general', 'erreur', ERREURS.MONTANT_INVALIDE); return; }
  if (!confirm('Changer ce tarif ? Il s\'appliquera aux prochains brouillons (les factures validées ne changent pas).')) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_tarif_modifier', { p_cle: cle, p_valeur: valeur });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerFactures();
  afficherMessage('message-general', 'succes', 'Tarif enregistré ✓');
}

// « À faire aujourd'hui » : les brouillons des mois terminés, juste après les ventes à confirmer
LIGNES_A_FAIRE.splice(2, 0,
  { calcul: function () { return brouillonsAValider().length; }, un: 'brouillon de facture à vérifier et valider', plusieurs: 'brouillons de facture à vérifier et valider', emoji: '💶', onglet: 'factures', filtre: function () { choisirFiltreFactures('brouillons'); } },
  { calcul: function () { return facturation.factures.filter(aSaisirPennylane).length; }, un: 'facture validée à faire sur Pennylane', plusieurs: 'factures validées à faire sur Pennylane', emoji: '🧾', onglet: 'factures', filtre: function () { choisirFiltreFactures('pennylane'); } }
);

(function () {
  const toutRechargerAvantFactures = toutRecharger;
  toutRecharger = async function () {
    await Promise.all([toutRechargerAvantFactures(), chargerFactures()]);
    afficherAFaire();
  };
})();

// ---------- 🔔 Rappels datés (ex. : tarifs des pros) ----------
// Ils s'affichent en tête de « À faire aujourd'hui » à partir de leur date,
// jusqu'à ce que Jocelyne clique « C'est fait ».
let rappels = [];

async function chargerRappels() {
  const { data, error } = await albSupabase.rpc('alb_gestion_rappels');
  if (error) { console.error('[ALB DEBUG] rappels :', error); return; }
  rappels = data || [];
}

async function rappelFait(id, bouton) {
  if (!confirm('C\'est fait ? Le rappel disparaîtra de « À faire aujourd\'hui ».')) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_rappel_fait', { p_id: id });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerRappels();
  afficherAFaire();
  afficherMessage('message-general', 'succes', 'Rappel terminé ✓');
}

(function () {
  const afficherAFaireDeBase = afficherAFaire;
  afficherAFaire = function () {
    afficherAFaireDeBase();
    const zone = document.getElementById('a-faire-liste');
    if (!zone || !rappels.length) return;
    const vide = zone.querySelector('.a-faire-vide');
    if (vide) vide.remove();
    zone.insertAdjacentHTML('afterbegin', rappels.map(function (r) {
      return '<div class="a-faire-ligne" style="cursor:default;flex-wrap:wrap;border-color:#B28E3D;background:#FBF3E4;">' +
        '<span class="a-faire-emoji">🔔</span>' +
        '<span class="a-faire-texte"><strong>Rappel :</strong> ' + albEchapper(r.titre) +
          (r.detail ? '<br><span class="aide">' + albEchapper(r.detail) + '</span>' : '') + '</span>' +
        '<button type="button" class="bouton discret" onclick="rappelFait(\'' + albEchapper(r.id) + '\', this)">✓ C\'est fait</button>' +
      '</div>';
    }).join(''));
  };
  const toutRechargerAvantRappels = toutRecharger;
  toutRecharger = async function () {
    await Promise.all([toutRechargerAvantRappels(), chargerRappels()]);
    afficherAFaire();
  };
})();

// ---------- 📅 Papiers des pros : dates de fin de validité et relances ----------
// Les pros indiquent jusqu'à quand leurs assurances et certificats sont valables.
//  • J-30 : « expire bientôt » (pour info)
//  • J-15 : mail de relance prêt (objet + texte), Jocelyne l'envoie elle-même puis clique « C'est fait »
//  • J-5  : si rien n'est arrivé, SMS prêt, même principe
//  • Jour J : si rien n'est arrivé, Jocelyne retire le pro de « Nos pros ALB »
// Dès que le pro envoie sa nouvelle attestation, tout repart à zéro.
ERREURS.DATE_INVALIDE = 'Cette date ne semble pas juste.';
ERREURS.DATE_MANQUANTE = 'Indique d\'abord la date de fin de validité.';

function joursAvant(iso) {
  const fin = new Date(iso + 'T12:00:00');
  const auj = new Date(); auj.setHours(12, 0, 0, 0);
  return Math.round((fin - auj) / 86400000);
}
function papierSuivi(x) { return x.expire && x.expire_le && x.statut !== 'refuse'; }
function papierExpireBientot(x) { return papierSuivi(x) && joursAvant(x.expire_le) <= 30; }
function papierInfo30(x) { return papierSuivi(x) && joursAvant(x.expire_le) <= 30 && joursAvant(x.expire_le) > 15; }
function papierMailAFaire(x) { return papierSuivi(x) && joursAvant(x.expire_le) <= 15 && joursAvant(x.expire_le) > 5 && !x.relance_mail_le; }
function papierSmsAFaire(x) { return papierSuivi(x) && joursAvant(x.expire_le) <= 5 && joursAvant(x.expire_le) > 0 && !x.relance_sms_le; }
function papierRetraitAFaire(x) { return papierSuivi(x) && joursAvant(x.expire_le) <= 0 && x.pro_en_ligne; }
function dateLongue(iso) { return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
function libelleCourt(x) { const t = String(x.libelle || 'attestation').replace(/\s*\(.*\)\s*$/, ''); return t.charAt(0).toLowerCase() + t.slice(1); }

function etatValidite(x) {
  if (!x.expire) return '';
  if (!x.expire_le) return '<br><span class="etiquette or">📅 Date de validité pas encore indiquée par le pro</span>';
  const j = joursAvant(x.expire_le);
  const date = dateLisible(x.expire_le);
  if (j < 0) return '<br><span class="etiquette rouge">❗ Expiré depuis le ' + albEchapper(date) + '</span>';
  if (j === 0) return '<br><span class="etiquette rouge">❗ Expire aujourd\'hui</span>';
  if (j <= 30) return '<br><span class="etiquette or">⏰ Expire le ' + albEchapper(date) + ' (dans ' + j + ' jour' + (j > 1 ? 's' : '') + ')</span>';
  return '<br><span class="etiquette vert">📅 Valable jusqu\'au ' + albEchapper(date) + '</span>';
}

function texteSmsRelance(x) {
  const date = dateLongue(x.expire_le);
  return 'Bonjour ' + (x.pro_prenom || '') + ', votre ' + libelleCourt(x) + ' expire le ' + date + '. ' +
    'Sans la nouvelle attestation d\'ici là, votre fiche sera retirée de « Nos pros ALB » le ' + date + '. ' +
    'Vous pouvez l\'envoyer en 2 minutes depuis votre espace : albimmobilier.fr/espace-alb.html#mes-papiers. Jocelyne, ALB Sud Immobilier';
}

function objetMailRelance(x) { return 'Votre ' + libelleCourt(x) + ' expire le ' + dateLongue(x.expire_le); }
function texteMailRelance(x) {
  const date = dateLongue(x.expire_le);
  return 'Bonjour ' + (x.pro_prenom || '') + ',\n\n' +
    'Petit rappel : votre ' + libelleCourt(x) + ' enregistrée sur ALB Immobilier est valable jusqu\'au ' + date + '.\n\n' +
    'Pour rester visible sur « Nos pros ALB » et continuer à recevoir des demandes, merci de m\'envoyer la nouvelle attestation avant cette date. ' +
    'Ça prend deux minutes depuis votre espace, rubrique « Mes papiers », avec sa nouvelle date de validité :\n' +
    'https://albimmobilier.fr/espace-alb.html#mes-papiers\n\n' +
    'Sans nouvelle attestation le ' + date + ', votre fiche sera retirée de « Nos pros ALB » jusqu\'à réception. Elle reviendra dès que je l\'aurai vérifiée.\n\n' +
    'Une question ? Répondez simplement à ce mail, ou appelez-moi au 07 45 60 28 05.\n\n' +
    'À la bien, toujours ✨\nJocelyne Rimlinger\nFondatrice · ALB Sud Immobilier';
}
// Modèle prêt à copier, avec « C'est fait » qui garde la date d'envoi
function blocModele(x, quoi, titre, objet, texte, lienOuvrir, envoyeLe) {
  return '<div class="sms"' + (envoyeLe ? ' style="opacity:0.75;"' : '') + '><strong>' + titre + '</strong>' +
    (objet ? '<p class="ligne-info" style="margin-top:6px;"><strong>Objet :</strong> ' + albEchapper(objet) + '</p>' : '') +
    '<textarea class="texte-pret" readonly' + (quoi === 'mail' ? ' style="min-height:220px;"' : '') + '>' + albEchapper(texte) + '</textarea>' +
    '<div class="actions">' + lienOuvrir +
      '<button type="button" class="bouton discret" onclick="copier(this)">📋 Copier le texte</button>' +
      (envoyeLe
        ? '<span class="etiquette vert">✅ Envoyé le ' + albEchapper(dateLisible(envoyeLe)) + '</span><button type="button" class="bouton discret" onclick="relancerPapier(\'' + x.id + '\', \'' + quoi + '\', false, this)">Annuler</button>'
        : '<button type="button" class="bouton vert" onclick="relancerPapier(\'' + x.id + '\', \'' + quoi + '\', true, this)">✓ C\'est fait</button>') +
    '</div></div>';
}

// Ce qu'il y a à faire pour ce papier, selon la date
function blocRelances(x) {
  if (!papierExpireBientot(x)) return '';
  const j = joursAvant(x.expire_le);
  let html = '<div class="decision" style="margin-top:8px;"><div class="decision-titre">🔔 Relance du pro</div>';
  // Mail (à partir de J-15) : modèle prêt, Jocelyne l'envoie de sa messagerie
  if (j <= 15) {
    const objet = objetMailRelance(x), texte = texteMailRelance(x);
    const ouvrir = x.pro_email
      ? '<a class="bouton" href="mailto:' + albEchapper(x.pro_email) + '?subject=' + encodeURIComponent(objet) + '&body=' + encodeURIComponent(texte) + '">📧 Ouvrir le mail</a>'
      : '';
    html += blocModele(x, 'mail', '📧 Mail à ' + (x.pro_prenom || 'ce pro') + (x.pro_email ? ' · ' + x.pro_email : ' (pas d\'e-mail)'), objet, texte, ouvrir, x.relance_mail_le);
  } else html += '<p class="ligne-info" style="color:#7a7a75;">📧 Le mail de relance sera à envoyer à partir du ' + albEchapper(dateLisible(new Date(new Date(x.expire_le + 'T12:00:00').getTime() - 15 * 86400000).toISOString())) + '.</p>';
  // SMS (à partir de J-5)
  if (j <= 5 && j > 0) {
    const num = String(x.pro_tel || '').replace(/[^0-9+]/g, '');
    const texte = texteSmsRelance(x);
    const ouvrir = num ? '<a class="bouton" href="sms:' + albEchapper(num) + '?&body=' + encodeURIComponent(texte) + '">📱 Ouvrir le SMS</a>' : '';
    html += blocModele(x, 'sms', '📱 SMS à ' + (x.pro_prenom || 'ce pro') + (num ? ' · ' + (x.pro_tel || '') : ' (pas de numéro)'), '', texte, ouvrir, x.relance_sms_le);
  }
  // Jour J
  if (j <= 0) {
    html += x.pro_en_ligne
      ? '<div class="point-a-faire">🚫 Rien reçu : retire ' + albEchapper(x.pro || 'ce pro') + ' de « Nos pros ALB » en attendant la nouvelle attestation.' +
          '<div class="actions" style="margin-top:6px;"><button type="button" class="bouton rouge" onclick="mettreEnLigne(\'' + x.profile_id + '\', false, this)">Retirer de Nos pros ALB</button></div></div>'
      : '<p class="ligne-info">🚫 Retiré de « Nos pros ALB ». Quand sa nouvelle attestation arrive et que tu l\'as vérifiée, remets-le en ligne.</p>';
  }
  return html + '</div>';
}

async function relancerPapier(id, quoi, fait, bouton) {
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_papier_relance', { p_id: id, p_quoi: quoi, p_fait: fait });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerPapiers();
  afficherMessage('message-general', 'succes', fait ? 'C\'est noté : ' + (quoi === 'mail' ? 'mail' : 'SMS') + ' envoyé aujourd\'hui ✓' : 'C\'est noté.');
}

blocPapiersPro = function (proId) {
  const liste = papiersPros.filter(function (x) { return x.profile_id === proId; });
  if (!liste.length) return '<p class="ligne-info" style="color:#7a7a75;">📄 Aucun papier envoyé depuis son espace pour le moment.</p>';
  const aVerifier = liste.filter(function (x) { return x.statut === 'a_verifier'; }).length;
  const bientot = liste.filter(papierExpireBientot).length;
  return '<details class="historique" style="color:#4A4A47;font-size:0.88rem;"' + (aVerifier || bientot ? ' open' : '') + '><summary style="font-weight:600;color:#5A3A6A;cursor:pointer;">📄 Ses papiers (' + liste.length +
      (aVerifier ? ', dont ' + aVerifier + ' à vérifier' : '') + (bientot ? ' · ⏰ ' + bientot + ' qui expire' + (bientot > 1 ? 'nt' : '') : '') + ')</summary>' +
    liste.map(function (x) {
      return '<div class="' + (x.statut === 'a_verifier' || papierExpireBientot(x) ? 'point-a-faire' : 'ligne-info') + '" style="margin:6px 0;">' +
        '<strong>' + albEchapper(x.libelle) + '</strong> ' + (STATUTS_PAPIER_GESTION[x.statut] || '') + etatValidite(x) + '<br>' +
        (x.chemin
          ? '<button type="button" class="bouton discret" style="margin-top:6px;" onclick="ouvrirPapier(\'' + x.id + '\')">📎 Ouvrir ' + albEchapper(x.nom_fichier || 'le fichier') + '</button>'
          : '<span style="font-size:1rem;">' + albEchapper(x.valeur || '') + '</span>') +
        '<br><span style="color:#7a7a75;">Envoyé le ' + dateLisible(x.envoye_le) + (x.verifie_le ? ' · traité le ' + dateLisible(x.verifie_le) : '') + '</span>' +
        (x.statut === 'refuse' && x.note ? '<br><span class="mot">💬 « ' + albEchapper(x.note) + ' »</span>' : '') +
        blocRelances(x) +
        (x.expire
          ? '<div class="actions" style="margin-top:6px;"><label class="petit-champ">Valable jusqu\'au<input type="date" id="date-papier-' + x.id + '" value="' + albEchapper(x.expire_le || '') + '"></label>' +
            '<button type="button" class="bouton discret" onclick="corrigerDatePapier(\'' + x.id + '\', this)">📅 Enregistrer la date</button></div>'
          : '') +
        (x.statut === 'a_verifier'
          ? '<div class="actions" style="margin-top:6px;"><button type="button" class="bouton vert" onclick="verifierPapier(\'' + x.id + '\', \'verifie\', this)">✓ Vérifié</button>' +
            '<button type="button" class="bouton rouge" onclick="verifierPapier(\'' + x.id + '\', \'refuse\', this)">✗ À renvoyer</button></div>'
          : '') +
      '</div>';
    }).join('') + '</details>';
};

async function corrigerDatePapier(id, bouton) {
  const date = document.getElementById('date-papier-' + id).value || null;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_papier_date', { p_id: id, p_date: date });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerPapiers();
  afficherMessage('message-general', 'succes', date ? 'Date de validité enregistrée ✓' : 'Date de validité effacée.');
}

// « À faire aujourd'hui » : juste après « papiers de pros à vérifier », du plus urgent au moins urgent
(function () {
  const i = LIGNES_A_FAIRE.findIndex(function (l) { return l.compteur === 'c-papiers'; });
  function nb(test) { return function () { return papiersPros.filter(test).length; }; }
  LIGNES_A_FAIRE.splice(i >= 0 ? i + 1 : LIGNES_A_FAIRE.length, 0,
    { calcul: nb(papierRetraitAFaire), emoji: '🚫', onglet: 'valides',
      un: 'pro dont le papier a expiré sans nouvelle attestation : retire-le de « Nos pros ALB »',
      plusieurs: 'pros dont un papier a expiré sans nouvelle attestation : retire-les de « Nos pros ALB »' },
    { calcul: nb(papierSmsAFaire), emoji: '📱', onglet: 'valides',
      un: 'SMS à envoyer : un papier expire dans 5 jours ou moins et rien n\'est arrivé',
      plusieurs: 'SMS à envoyer : des papiers expirent dans 5 jours ou moins et rien n\'est arrivé' },
    { calcul: nb(papierMailAFaire), emoji: '📧', onglet: 'valides',
      un: 'mail de relance à envoyer : un papier expire dans 15 jours ou moins',
      plusieurs: 'mails de relance à envoyer : des papiers expirent dans 15 jours ou moins' },
    { calcul: nb(papierInfo30), emoji: '⏰', onglet: 'valides',
      un: 'papier de pro qui expire dans moins de 30 jours (pour info)',
      plusieurs: 'papiers de pros qui expirent dans moins de 30 jours (pour info)' });
})();

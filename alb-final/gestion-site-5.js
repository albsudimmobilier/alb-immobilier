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

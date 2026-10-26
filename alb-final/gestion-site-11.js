// ============================================================
// Gestion du site — partie 11 : 🎯 suivi commercial d'ALB Sud Immobilier
//  • 📇 Carnet : deux étapes de plus, « 📨 Proposition envoyée » et
//    « ✍️ Contrat signé », avec leur date et un bouton en un clic.
//    Après une proposition, la relance est prévue toute seule à J+7
//    (elle apparaît ce jour-là dans l'agenda et dans « À faire »).
//    Les contacts du salon (page /rent) arrivent tout seuls dans le Carnet.
//  • 💶 Factures : « Payée le… » sur chaque facture validée, un filtre
//    « À encaisser », et une ligne dans « À faire » quand une facture
//    validée n'est toujours pas payée 30 jours après.
//  • 👥 Suivi des membres : WhatsApp en plus de SMS, mail, appel, note
//    (les boutons WhatsApp eux-mêmes viennent de alb-whatsapp.js).
// ============================================================

// ----- 👥 Suivi des membres : le canal WhatsApp -----
CANAUX.whatsapp = '💬 WhatsApp';

// ----- 📇 Carnet : les étapes, dans l'ordre du parcours -----
(function () {
  const anciennes = Object.assign({}, ETAPES_CARNET);
  Object.keys(ETAPES_CARNET).forEach(function (k) { delete ETAPES_CARNET[k]; });
  ETAPES_CARNET.a_relancer = anciennes.a_relancer;
  ETAPES_CARNET.en_discussion = anciennes.en_discussion;
  ETAPES_CARNET.interesse = anciennes.interesse;
  ETAPES_CARNET.proposition = '📨 Proposition envoyée';
  ETAPES_CARNET.contrat_signe = '✍️ Contrat signé';
  ETAPES_CARNET.inscrit = anciennes.inscrit;
  ETAPES_CARNET.pas_interesse = anciennes.pas_interesse;
})();

function dateCourteCarnet(iso) { return iso ? dateLisible(iso) : ''; }

// Les dates du parcours et les boutons en un clic, ajoutés sur chaque fiche du carnet
(function () {
  const carteContactDeBase = carteContact;
  carteContact = function (c) {
    let html = carteContactDeBase(c);
    const dates = [
      c.salon_id ? '🧭 Contact du salon' : '',
      c.proposition_le ? '📨 Proposition envoyée le ' + albEchapper(dateCourteCarnet(c.proposition_le)) : '',
      c.contrat_le ? '✍️ Contrat signé le ' + albEchapper(dateCourteCarnet(c.contrat_le)) : ''
    ].filter(Boolean);
    if (dates.length) {
      const i = html.indexOf('</p>');
      if (i !== -1) html = html.slice(0, i + 4) + '<p class="ligne-info"><strong>' + dates.join(' · ') + '</strong></p>' + html.slice(i + 4);
    }
    let boutons = '';
    if (['a_relancer', 'en_discussion', 'interesse'].indexOf(c.etape) !== -1) {
      boutons += '<button type="button" class="bouton" onclick="carnetEtapeRapide(\'' + c.id + '\', \'proposition\', this)">📨 Proposition envoyée</button>';
    }
    if (c.etape === 'proposition') {
      boutons += '<button type="button" class="bouton vert" onclick="carnetEtapeRapide(\'' + c.id + '\', \'contrat_signe\', this)">✍️ Contrat signé</button>';
    }
    const repere = '<button type="button" class="bouton discret" onclick="agendaPour(';
    const j = html.indexOf(repere);
    if (boutons && j !== -1) html = html.slice(0, j) + boutons + html.slice(j);
    return html;
  };
})();

// Un clic : on note l'étape (avec un petit mot facultatif)
async function carnetEtapeRapide(id, etape, bouton) {
  const c = carnet.find(function (x) { return x.id === id; }) || {};
  const question = etape === 'proposition'
    ? 'Proposition envoyée à ' + nomContact(c) + '. Un mot pour toi ? (facultatif : ce que tu as proposé, par quel moyen…)\nLa relance sera prévue dans 7 jours.'
    : 'Contrat signé avec ' + nomContact(c) + ' 🎉 Un mot pour toi ? (facultatif : formule choisie, date de début…)';
  const mot = prompt(question, '');
  if (mot === null) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_carnet_noter', { p_id: id, p_note: mot, p_relancer_le: null, p_etape: etape });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerCarnet();
  afficherCarnet();
  afficherAgenda();
  afficherAFaire();
  if (etape === 'proposition') {
    const d = new Date(); d.setDate(d.getDate() + 7);
    afficherMessage('message-general', 'succes', 'C\'est noté ✓ Relance prévue le ' + d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + '.');
  } else {
    afficherMessage('message-general', 'succes', 'Contrat signé, bravo ! 🎉 C\'est noté.');
  }
}

// ----- 💶 Factures : le paiement -----
ERREURS.FACTURE_PAS_A_ENCAISSER = 'Seules les factures validées (pas les relevés offerts) peuvent être marquées payées.';
ERREURS.FACTURE_INTROUVABLE = 'Cette facture n\'existe plus. Recharge la page.';
if (!ERREURS.DATE_INVALIDE) ERREURS.DATE_INVALIDE = 'Cette date n\'est pas valide.';

function aEncaisser(f) { return f.statut === 'validee' && !f.a_blanc && !f.payee_le; }
function joursDepuisValidation(f) { return f.valide_le ? Math.floor((Date.now() - new Date(f.valide_le).getTime()) / 86400000) : 0; }
function payeeEnRetard(f) { return aEncaisser(f) && joursDepuisValidation(f) > 30; }

(function () {
  const i = FILTRES_FACTURES.findIndex(function (f) { return f[0] === 'pennylane'; });
  FILTRES_FACTURES.splice(i + 1, 0, ['encaisser', '💶 À encaisser', aEncaisser]);
})();

(function () {
  const ficheFactureDeBase = ficheFacture;
  ficheFacture = function (f) {
    const html = ficheFactureDeBase(f);
    if (f.statut !== 'validee' || f.a_blanc) return html;
    const id = albEchapper(f.id);
    const bloc = f.payee_le
      ? '<div class="decision"><div class="decision-titre">💶 Payée le ' + albEchapper(dateLisible(f.payee_le + 'T12:00:00')) + ' ✓</div>' +
          '<div class="actions"><button type="button" class="bouton discret" onclick="facturePayee(\'' + id + '\', false, this)">↩️ Finalement, pas encore payée</button></div></div>'
      : '<div class="decision"><div class="decision-titre">💶 Pas encore payée</div>' +
          (payeeEnRetard(f) ? '<div class="point-a-faire">⏰ Validée il y a ' + joursDepuisValidation(f) + ' jours : pense à relancer.</div>' : '') +
          '<label class="petit-champ">Payée le<input type="date" id="payee-' + id + '" value="' + jourIso(0) + '" max="' + jourIso(0) + '"></label>' +
          '<div class="actions"><button type="button" class="bouton vert" onclick="facturePayee(\'' + id + '\', true, this)">✓ Elle est payée</button></div></div>';
    const fin = html.lastIndexOf('</div>');
    return html.slice(0, fin) + bloc + html.slice(fin);
  };
})();

async function facturePayee(id, payee, bouton) {
  const champ = document.getElementById('payee-' + id);
  const le = payee ? (champ && champ.value) || jourIso(0) : null;
  if (!payee && !confirm('Retirer la date de paiement de cette facture ?')) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_facture_payee', { p_id: id, p_le: le });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerFactures();
  afficherAFaire();
  afficherMessage('message-general', 'succes', payee ? 'Paiement noté ✓ Il compte dans « Montant encaissé » des Statistiques.' : 'Date de paiement retirée.');
}

// « À faire aujourd'hui » : les factures validées toujours pas payées 30 jours après
LIGNES_A_FAIRE.push({
  calcul: function () { return (facturation.factures || []).filter(payeeEnRetard).length; },
  un: 'facture validée toujours pas payée après 30 jours : relance', plusieurs: 'factures validées toujours pas payées après 30 jours : relance',
  emoji: '💶', onglet: 'factures', filtre: function () { choisirFiltreFactures('encaisser'); }
});

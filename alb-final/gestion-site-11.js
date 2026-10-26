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
//    (les boutons WhatsApp eux-mêmes viennent de alb-whatsapp.js), et pour
//    les pros déjà inscrits : « Proposition envoyée » et « Contrat signé ».
//  • Un contact du Carnet qui s'inscrit passe dans « Suivi des membres »
//    avec tout son historique (tout seul si son e-mail ou son téléphone
//    correspond, sinon « 🔗 Déjà inscrit ? Relier »).
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
      c.contrat_le ? '✍️ Contrat signé le ' + albEchapper(dateCourteCarnet(c.contrat_le)) : '',
      c.profile_id ? '👥 Inscrit sur ALB : son suivi continue dans « Suivi des membres », avec tout cet historique' : ''
    ].filter(Boolean);
    if (dates.length) {
      const i = html.indexOf('</p>');
      if (i !== -1) html = html.slice(0, i + 4) + '<p class="ligne-info"><strong>' + dates.join(' · ') + '</strong></p>' + html.slice(i + 4);
    }
    let boutons = '';
    if (c.profile_id) {
      boutons += '<button type="button" class="bouton vert" onclick="carnetVoirMembre(\'' + c.profile_id + '\')">👥 Voir sa fiche de membre</button>';
    } else {
      if (['a_relancer', 'en_discussion', 'interesse'].indexOf(c.etape) !== -1) {
        boutons += '<button type="button" class="bouton" onclick="carnetEtapeRapide(\'' + c.id + '\', \'proposition\', this)">📨 Proposition envoyée</button>';
      }
      if (c.etape === 'proposition') {
        boutons += '<button type="button" class="bouton vert" onclick="carnetEtapeRapide(\'' + c.id + '\', \'contrat_signe\', this)">✍️ Contrat signé</button>';
      }
      if (c.etape !== 'pas_interesse') {
        boutons += '<button type="button" class="bouton discret" onclick="carnetRelier(\'' + c.id + '\', this)">🔗 Déjà inscrit ? Relier</button>';
      }
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

// ----- 👥 Suivi des membres : WhatsApp à côté de SMS et Mail -----
// ----- et, pour les pros déjà inscrits : proposition et contrat, comme dans le Carnet -----
(function () {
  const carteMembreAvantCommercial = carteMembre;
  carteMembre = function (m) {
    let html = carteMembreAvantCommercial(m);
    const boutonSms = '\'' + m.id + '\', \'sms\')">📱 SMS</button>';
    const i = html.indexOf(boutonSms);
    if (i !== -1 && m.telephone) {
      const fin = i + boutonSms.length;
      html = html.slice(0, fin) + '<button type="button" class="bouton" onclick="ouvrirPanneauMembre(\'' + m.id + '\', \'whatsapp\')">💬 WhatsApp</button>' + html.slice(fin);
    }
    const s = suiviDe(m);
    const dates = [
      s.carnet_origine || s.carnet_id ? '📇 Venu du Carnet' + (s.carnet_origine ? ' (' + albEchapper(s.carnet_origine) + ')' : '') : '',
      estPro(m) && s.proposition_le ? '📨 Proposition envoyée le ' + albEchapper(dateLisible(s.proposition_le)) : '',
      estPro(m) && s.contrat_le ? '✍️ Contrat signé le ' + albEchapper(dateLisible(s.contrat_le)) : ''
    ].filter(Boolean);
    {
      let boutons = '';
      if (estPro(m) && !s.contrat_le) {
        boutons += '<button type="button" class="bouton discret" onclick="membreCommercial(\'' + m.id + '\', \'proposition\', this)">📨 Proposition envoyée</button>';
        if (s.proposition_le) boutons += '<button type="button" class="bouton vert" onclick="membreCommercial(\'' + m.id + '\', \'contrat\', this)">✍️ Contrat signé</button>';
      }
      const actions = '<div class="actions">';
      const j = html.indexOf(actions);
      if (j !== -1) {
        html = html.slice(0, j) +
          (dates.length ? '<p class="ligne-info"><strong>' + dates.join(' · ') + '</strong></p>' : '') +
          html.slice(j, j + actions.length) + boutons + html.slice(j + actions.length);
      }
    }
    return html;
  };

  const panneauMembreAvantWhatsApp = panneauMembre;
  panneauMembre = function (m, quoi) {
    if (quoi !== 'whatsapp') return panneauMembreAvantWhatsApp(m, quoi);
    const id = m.id;
    const num = String(m.telephone || '').replace(/[^0-9+]/g, '');
    if (!num) return '<div class="decision"><p class="ligne-info">💬 Pas de numéro de téléphone pour ce membre.</p></div>';
    const modeles = modelesPour(m);
    return '<div class="decision"><div class="decision-titre">💬 WhatsApp à ' + albEchapper(m.prenom || '') + ' · ' + albEchapper(m.telephone) + '</div>' +
      '<label class="petit-champ" style="margin-bottom:8px;">Modèle<select onchange="appliquerModele(\'' + id + '\', \'whatsapp\', this.value)">' +
        Object.keys(modeles).map(function (k) { return '<option value="' + k + '">' + modeles[k].nom + '</option>'; }).join('') + '</select></label>' +
      '<textarea class="texte-pret" id="texte-' + id + '">' + albEchapper(modeles.libre.sms) + '</textarea>' +
      '<div class="actions">' +
        '<button type="button" class="bouton" onclick="ouvrirWhatsApp(\'' + id + '\', \'' + albEchapper(num) + '\')">💬 Ouvrir WhatsApp</button>' +
        '<button type="button" class="bouton discret" onclick="copierTexte(\'' + id + '\', this)">📋 Copier</button>' +
        '<button type="button" class="bouton vert" onclick="noterContact(\'' + id + '\', \'whatsapp\', this)">✓ C\'est fait, je l\'ai envoyé</button>' +
      '</div><p class="aide">WhatsApp s\'ouvre avec le texte prêt. Envoie-le, puis clique « C\'est fait » pour le garder en mémoire.</p></div>';
  };

  const appliquerModeleAvantWhatsApp = appliquerModele;
  appliquerModele = function (id, quoi, cle) {
    if (quoi !== 'whatsapp') return appliquerModeleAvantWhatsApp(id, quoi, cle);
    const m = membres.find(function (x) { return x.id === id; });
    document.getElementById('texte-' + id).value = modelesPour(m)[cle].sms;
  };
})();

// « 👥 Voir sa fiche de membre » depuis le Carnet
function carnetVoirMembre(profileId) {
  const m = membres.find(function (x) { return x.id === profileId; });
  afficherOnglet('membres');
  toutAfficherMembres();
  if (m) {
    document.getElementById('recherche-membres').value = m.email || m.telephone || ((m.prenom || '') + ' ' + (m.nom || '')).trim();
    afficherMembres();
  }
  const fiche = document.getElementById('membre-' + profileId);
  if (fiche) fiche.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// « 🔗 Déjà inscrit ? Relier » : pour un contact qui s'est inscrit avec un autre e-mail ou téléphone
ERREURS.CONTACT_DEJA_RELIE = 'Ce contact est déjà relié à un espace ALB.';
async function carnetRelier(id, bouton) {
  const c = carnet.find(function (x) { return x.id === id; }) || {};
  const recherche = prompt('Quel e-mail ou quel téléphone ' + nomContact(c) + ' a-t-il utilisé pour créer son espace ALB ?\nSes notes, sa relance et ses rendez-vous passeront dans « Suivi des membres ».', c.email || c.telephone || '');
  if (recherche === null || !recherche.trim()) return;
  bouton.disabled = true;
  const { data, error } = await albSupabase.rpc('alb_gestion_carnet_lier', { p_carnet: id, p_recherche: recherche.trim() });
  bouton.disabled = false;
  if (error) {
    const code = String(error.message || '');
    afficherMessage('message-general', 'erreur', code.indexOf('MEMBRE_INTROUVABLE') !== -1
      ? 'Aucun espace ALB trouvé avec « ' + recherche.trim() + ' ». Vérifie l\'e-mail ou le téléphone dans « Suivi des membres ».'
      : messageErreur(error));
    return;
  }
  await toutRecharger();
  await chargerCarnet();
  afficherCarnet();
  afficherAFaire();
  afficherMessage('message-general', 'succes', 'Relié à ' + (data || 'son espace') + ' ✓ Son historique continue dans « Suivi des membres ».');
}

async function membreCommercial(id, etape, bouton) {
  const m = membres.find(function (x) { return x.id === id; }) || {};
  const nom = ((m.prenom || '') + ' ' + (m.nom || '')).trim() || 'ce pro';
  const question = etape === 'proposition'
    ? 'Proposition envoyée à ' + nom + '. Un mot pour toi ? (facultatif : ce que tu as proposé, par quel moyen…)\nLa relance sera prévue dans 7 jours.'
    : 'Contrat signé avec ' + nom + ' 🎉 Un mot pour toi ? (facultatif : formule choisie, date de début…)';
  const mot = prompt(question, '');
  if (mot === null) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_membre_commercial', { p_profile: id, p_etape: etape, p_note: mot });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerSuiviMembres();
  if (typeof afficherAgenda === 'function') afficherAgenda();
  afficherAFaire();
  afficherMessage('message-general', 'succes', etape === 'proposition' ? 'C\'est noté ✓ Relance prévue dans 7 jours.' : 'Contrat signé, bravo ! 🎉 C\'est noté.');
}

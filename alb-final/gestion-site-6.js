// ============================================================
// Gestion du site — partie 6 : 📈 Prévisionnel financier
// 12 mois à partir du mois choisi : chiffre d'affaires prévu (selon tes
// hypothèses et les tarifs de « ⚙️ Tarifs »), charges, résultat, trésorerie,
// et le réel (factures validées) à côté dès qu'il existe.
// Les chiffres se recalculent pendant que tu tapes ; « Enregistrer » les garde.
// ============================================================

let previsionnel = null;
let prevModifie = false; // des changements pas encore enregistrés : on ne les écrase pas en rechargeant

const SOURCES_PREV = [
  ['agents', '🏠 Agents et mandataires abonnés', 'abonnés', 'Nombre d\'agents ou mandataires qui paient l\'abonnement'],
  ['annonces', '🏡 Annonces de particuliers', 'annonces', 'Nombre d\'annonces de particuliers diffusées'],
  ['prets', '🏦 Prêts signés', 'prêts', 'Nombre de prêts signés par les courtiers, par mois'],
  ['chantiers', '🔨 Chantiers signés', 'chantiers', 'Nombre de chantiers signés par les artisans, par mois'],
  ['contacts', '🤝 Mises en relation agents', 'mises en relation', 'Vendeurs ou acheteurs envoyés aux agents et acceptés, par mois']
];

async function chargerPrevisionnel(forcer) {
  const { data, error } = await albSupabase.rpc('alb_gestion_previsionnel');
  if (error) { console.error('[ALB DEBUG] prévisionnel :', error); return; }
  previsionnel = data;
  if (forcer || !prevModifie || !document.getElementById('prev-debut')) { dessinerFormulairePrevisionnel(); prevModifie = false; }
  calculerPrevisionnel();
}
function prevChange() { prevModifie = true; calculerPrevisionnel(); }

function nombre(v) { const n = Number(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; }
function eurosRonds(n) { return Math.round(n).toLocaleString('fr-FR') + ' €'; }
function tarifPrev(cle, defaut) { const t = previsionnel && previsionnel.tarifs || {}; return t[cle] != null ? Number(t[cle]) : defaut; }

// ----- Formulaire : hypothèses et charges -----
function champPrev(id, libelle, valeur, aide, type) {
  return '<div class="petit-champ"><span>' + libelle + '</span>' +
    '<input type="' + (type || 'number') + '" ' + (type ? '' : 'step="any" inputmode="decimal" ') + 'id="' + id + '" value="' + albEchapper(valeur) + '" oninput="prevChange()">' +
    (aide ? '<span class="aide" style="font-weight:500;">' + aide + '</span>' : '') + '</div>';
}

function dessinerFormulairePrevisionnel() {
  const f = previsionnel.fiche || {};
  const h = f.hypotheses || {};
  document.getElementById('prev-general').innerHTML =
    champPrev('prev-debut', '📅 Premier mois', String(f.debut || '2027-01-01').slice(0, 7), '', 'month') +
    champPrev('prev-tresorerie', '🏦 Argent sur le compte au départ (€)', f.tresorerie_depart || 0, 'Ce qu\'il y a sur Qonto au début du premier mois.') +
    champPrev('prev-objectif-bas', '🎯 Objectif par mois, minimum (€)', f.objectif_bas != null ? f.objectif_bas : 1000, 'Ce qu\'il doit rester après les charges.') +
    champPrev('prev-objectif-haut', '🎯 Objectif par mois, idéal (€)', f.objectif_haut != null ? f.objectif_haut : 2000, '');
  document.getElementById('prev-hypotheses').innerHTML = SOURCES_PREV.map(function (s) {
    const v = h[s[0]] || {};
    return '<div class="bloc-acces" style="margin-top:0;"><strong>' + s[1] + '</strong><p class="aide">' + s[3] + '</p>' +
      '<div class="grille" style="grid-template-columns:1fr 1fr;margin-top:8px;">' +
      champPrev('prev-' + s[0] + '-depart', 'Le premier mois', v.depart || 0, '') +
      champPrev('prev-' + s[0] + '-hausse', 'En plus chaque mois', v.hausse || 0, '') +
      '</div>' + (s[0] === 'chantiers' ? '<div style="margin-top:8px;">' + champPrev('prev-montant-chantier', 'Montant moyen d\'un chantier (€ HT)', h.montant_chantier || 0, '') + '</div>' : '') +
      '</div>';
  }).join('');
  document.getElementById('prev-tarifs').innerHTML = 'Tarifs utilisés (réglage « ⚙️ Tarifs » de l\'onglet Factures) : agents ' + tarifPrev('abonnement_immo', 60) + ' € HT/mois · annonce de particulier ' +
    String(tarifPrev('abonnement_vendeur', 9.9)).replace('.', ',') + ' € TTC/mois · prêt ' + tarifPrev('pret_courtier', 150) + ' € HT · chantier ' + tarifPrev('taux_artisan', 10) + ' % HT · mise en relation agent ' + tarifPrev('immo_par_contact', 0) + ' € HT.';
  dessinerCharges(f.charges || []);
}

function dessinerCharges(charges) {
  document.getElementById('prev-charges').innerHTML = charges.map(function (c, i) {
    return '<div class="ligne-charge" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">' +
      '<input type="text" maxlength="80" class="charge-libelle" value="' + albEchapper(c.libelle || '') + '" placeholder="Nom de la charge" oninput="prevChange()" style="flex:2;">' +
      '<input type="number" step="any" min="0" inputmode="decimal" class="charge-montant" value="' + albEchapper(c.montant != null ? c.montant : '') + '" placeholder="€ / mois" oninput="prevChange()" style="flex:1;max-width:120px;">' +
      '<button type="button" class="bouton rouge" title="Retirer" onclick="retirerCharge(' + i + ')" style="padding:8px 11px;">✕</button></div>';
  }).join('') || '<p class="aide">Aucune charge pour l\'instant.</p>';
}

function lireCharges() {
  return Array.prototype.map.call(document.querySelectorAll('#prev-charges .ligne-charge'), function (l) {
    return { libelle: l.querySelector('.charge-libelle').value.trim(), montant: nombre(l.querySelector('.charge-montant').value) };
  });
}
function ajouterCharge() { const c = lireCharges(); c.push({ libelle: '', montant: '' }); dessinerCharges(c); const l = document.querySelectorAll('#prev-charges .charge-libelle'); if (l.length) l[l.length - 1].focus(); prevChange(); }
function retirerCharge(i) { const c = lireCharges(); c.splice(i, 1); dessinerCharges(c); prevChange(); }

function lireHypotheses() {
  const h = {};
  SOURCES_PREV.forEach(function (s) {
    h[s[0]] = { depart: nombre(document.getElementById('prev-' + s[0] + '-depart').value), hausse: nombre(document.getElementById('prev-' + s[0] + '-hausse').value) };
  });
  h.montant_chantier = nombre(document.getElementById('prev-montant-chantier').value);
  return h;
}

// ----- Calcul des 12 mois -----
function calculerPrevisionnel() {
  if (!previsionnel) return;
  const h = lireHypotheses();
  const charges = lireCharges();
  const totalCharges = charges.reduce(function (t, c) { return t + c.montant; }, 0);
  const debutTexte = document.getElementById('prev-debut').value || '2027-01';
  const debut = new Date(Number(debutTexte.slice(0, 4)), Number(debutTexte.slice(5, 7)) - 1, 1);
  let tresorerie = nombre(document.getElementById('prev-tresorerie').value);
  const objBas = nombre(document.getElementById('prev-objectif-bas').value);
  const objHaut = nombre(document.getElementById('prev-objectif-haut').value);
  const tva = tarifPrev('taux_tva', 20);
  const prix = {
    agents: tarifPrev('abonnement_immo', 60),
    annonces: tarifPrev('abonnement_vendeur', 9.9) / (1 + tva / 100),
    prets: tarifPrev('pret_courtier', 150),
    chantiers: h.montant_chantier * tarifPrev('taux_artisan', 10) / 100,
    contacts: tarifPrev('immo_par_contact', 0)
  };
  const offertJusquAu = previsionnel.offert_jusqu_au ? new Date(previsionnel.offert_jusqu_au + 'T12:00:00') : null;
  const reel = {};
  (previsionnel.reel || []).forEach(function (r) { const k = String(r.mois).slice(0, 7); reel[k] = reel[k] || {}; reel[k][r.source] = (reel[k][r.source] || 0) + Number(r.montant || 0); });

  const mois = [];
  for (let i = 0; i < 12; i++) {
    const m = new Date(debut.getFullYear(), debut.getMonth() + i, 1);
    const cle = m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0');
    const offert = offertJusquAu && m <= offertJusquAu;
    const parSource = {};
    let ca = 0;
    SOURCES_PREV.forEach(function (s) {
      const n = Math.max(0, h[s[0]].depart + h[s[0]].hausse * i);
      const montant = offert ? 0 : n * prix[s[0]];
      parSource[s[0]] = { n: n, montant: montant };
      ca += montant;
    });
    const resultat = ca - totalCharges;
    tresorerie += resultat;
    const r = reel[cle];
    const caReel = r ? Object.keys(r).reduce(function (t, k) { return t + r[k]; }, 0) : null;
    mois.push({ cle: cle, date: m, offert: offert, parSource: parSource, ca: ca, charges: totalCharges, resultat: resultat, tresorerie: tresorerie, reel: r, caReel: caReel });
  }
  dessinerResultatsPrevisionnel(mois, objBas, objHaut, totalCharges, prix);
}

function nomMois(d, court) {
  const t = d.toLocaleDateString('fr-FR', { month: court ? 'short' : 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function dessinerResultatsPrevisionnel(mois, objBas, objHaut, totalCharges, prix) {
  const caAn = mois.reduce(function (t, m) { return t + m.ca; }, 0);
  const resAn = mois.reduce(function (t, m) { return t + m.resultat; }, 0);
  const premierOk = mois.find(function (m) { return m.resultat >= objBas && objBas > 0; });
  const premierIdeal = mois.find(function (m) { return m.resultat >= objHaut && objHaut > 0; });
  const premierPositif = mois.find(function (m) { return m.resultat >= 0; });
  const dernier = mois[mois.length - 1];
  const plusBas = Math.min.apply(null, mois.map(function (m) { return m.tresorerie; }));
  function couleur(n) { return n < 0 ? 'color:#8A2D2D;' : ''; }

  document.getElementById('prev-compteurs').innerHTML =
    '<div class="compteur"><div class="valeur">' + eurosRonds(caAn) + '</div><div class="libelle">💶 Chiffre d\'affaires prévu sur 12 mois (HT)</div></div>' +
    '<div class="compteur"><div class="valeur">' + eurosRonds(totalCharges) + '</div><div class="libelle">🧾 Charges par mois</div></div>' +
    '<div class="compteur' + (resAn < 0 ? ' alerte' : '') + '"><div class="valeur" style="' + couleur(resAn) + '">' + eurosRonds(resAn) + '</div><div class="libelle">📊 Résultat sur 12 mois</div></div>' +
    '<div class="compteur' + (plusBas < 0 ? ' alerte' : '') + '"><div class="valeur" style="' + couleur(dernier.tresorerie) + '">' + eurosRonds(dernier.tresorerie) + '</div><div class="libelle">🏦 Sur le compte fin ' + nomMois(dernier.date, true) + '</div></div>';

  const phrases = [];
  phrases.push(premierPositif ? (premierPositif === mois[0] ? '✅ Les charges sont couvertes dès ' : '✅ Les charges sont couvertes à partir de ') + nomMois(premierPositif.date) + '.' : '⚠️ Avec ces hypothèses, les charges ne sont jamais couvertes sur les 12 mois.');
  if (objBas > 0) phrases.push(premierOk ? '🎯 Objectif minimum (' + eurosRonds(objBas) + ' par mois) atteint en ' + nomMois(premierOk.date) + '.' : '🎯 Objectif minimum (' + eurosRonds(objBas) + ' par mois) pas encore atteint sur ces 12 mois.');
  if (objHaut > 0) phrases.push(premierIdeal ? '🌟 Objectif idéal (' + eurosRonds(objHaut) + ' par mois) atteint en ' + nomMois(premierIdeal.date) + '.' : '🌟 Objectif idéal (' + eurosRonds(objHaut) + ' par mois) pas encore atteint sur ces 12 mois.');
  if (plusBas < 0) phrases.push('🚨 Le compte passe dans le rouge : jusqu\'à ' + eurosRonds(plusBas) + '. Prévois de quoi tenir.');
  // Ce qu'il faudrait en plus pour l'objectif minimum, exprimé en prêts signés
  if (objBas > 0 && !premierOk && prix.prets > 0) {
    const manque = objBas - mois[0].resultat;
    if (manque > 0) phrases.push('💡 Pour atteindre l\'objectif minimum dès ' + nomMois(mois[0].date) + ', il manque ' + eurosRonds(manque) + ' par mois, soit environ ' + Math.ceil(manque / prix.prets) + ' prêt(s) signé(s) en plus.');
  }
  if (mois.some(function (m) { return m.offert; })) phrases.push('🎁 Les mois offerts (jusqu\'au ' + new Date(previsionnel.offert_jusqu_au + 'T12:00:00').toLocaleDateString('fr-FR') + ') ne rapportent rien.');
  document.getElementById('prev-bilan').innerHTML = phrases.map(function (p) { return '<p class="ligne-info">' + p + '</p>'; }).join('');

  const aDuReel = mois.some(function (m) { return m.caReel != null; });
  document.getElementById('prev-tableau').innerHTML = '<table class="tableau-prev"><thead><tr><th>Mois</th><th>Chiffre d\'affaires prévu (HT)</th><th>Charges</th><th>Résultat</th><th>Sur le compte</th>' +
    (aDuReel ? '<th>Réel facturé (HT)</th>' : '') + '</tr></thead><tbody>' +
    mois.map(function (m) {
      const ok = m.resultat >= objBas && objBas > 0;
      return '<tr><td>' + nomMois(m.date, true) + (m.offert ? ' <span class="etiquette vert">offert</span>' : '') + '</td>' +
        '<td>' + eurosRonds(m.ca) + '</td><td>' + eurosRonds(m.charges) + '</td>' +
        '<td style="font-weight:700;' + couleur(m.resultat) + (ok ? 'color:#2E6B34;' : '') + '">' + eurosRonds(m.resultat) + (ok ? ' 🎯' : '') + '</td>' +
        '<td style="' + couleur(m.tresorerie) + '">' + eurosRonds(m.tresorerie) + '</td>' +
        (aDuReel ? '<td>' + (m.caReel == null ? '—' : eurosRonds(m.caReel) + '<span class="aide" style="display:block;">' + (m.caReel >= m.ca ? '+' : '') + eurosRonds(m.caReel - m.ca) + ' / prévu</span>') + '</td>' : '') + '</tr>';
    }).join('') + '</tbody></table>';

  document.getElementById('prev-detail').innerHTML = '<table class="tableau-prev"><thead><tr><th>Mois</th>' +
    SOURCES_PREV.map(function (s) { return '<th>' + s[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
    mois.map(function (m) {
      return '<tr><td>' + nomMois(m.date, true) + '</td>' + SOURCES_PREV.map(function (s) {
        const x = m.parSource[s[0]];
        const r = m.reel && m.reel[s[0]];
        return '<td>' + eurosRonds(x.montant) + '<span class="aide" style="display:block;">' + (Math.round(x.n * 10) / 10).toLocaleString('fr-FR') + ' ' + s[2] +
          (r != null ? ' · réel ' + eurosRonds(r) : '') + '</span></td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table>';
}

// ----- Enregistrer -----
async function enregistrerPrevisionnel(bouton) {
  const debut = (document.getElementById('prev-debut').value || '2027-01') + '-01';
  const charges = lireCharges().filter(function (c) { return c.libelle || c.montant; });
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_previsionnel_enregistrer', {
    p_debut: debut,
    p_tresorerie: nombre(document.getElementById('prev-tresorerie').value),
    p_objectif_bas: nombre(document.getElementById('prev-objectif-bas').value),
    p_objectif_haut: nombre(document.getElementById('prev-objectif-haut').value),
    p_hypotheses: lireHypotheses(),
    p_charges: charges
  });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerPrevisionnel(true);
  afficherMessage('message-general', 'succes', 'Prévisionnel enregistré ✓');
}

(function () {
  const toutRechargerAvantPrevisionnel = toutRecharger;
  toutRecharger = async function () {
    await Promise.all([toutRechargerAvantPrevisionnel(), chargerPrevisionnel()]);
  };
})();

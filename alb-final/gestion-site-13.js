// =====================================================================
// 🪪 Infos administratives d'un pro : SIRET, RSAC, adresse, date de naissance
// (la date sert uniquement à lui souhaiter son anniversaire)
// =====================================================================
let infosPros = {};   // id du pro → { siret, numero_rsac, adresse_complete, date_naissance }

async function chargerInfosPros() {
  const { data, error } = await albSupabase.rpc('alb_gestion_infos_pros');
  if (error) { console.error('[ALB] Infos administratives des pros :', error); return; }
  infosPros = {};
  (Array.isArray(data) ? data : []).forEach(function (x) { infosPros[x.id] = x; });
}

// Nombre de jours avant le prochain anniversaire (0 = aujourd'hui), ou null
function joursAvantAnniversaire(dateIso) {
  if (!dateIso) return null;
  const p = String(dateIso).split('-');
  const mois = +p[1], jour = +p[2];
  if (!(mois >= 1 && mois <= 12 && jour >= 1 && jour <= 31)) return null;
  const auj = new Date(); auj.setHours(12, 0, 0, 0);
  let prochain = new Date(auj.getFullYear(), mois - 1, jour, 12, 0, 0, 0);
  if (prochain < auj && prochain.toDateString() !== auj.toDateString()) prochain = new Date(auj.getFullYear() + 1, mois - 1, jour, 12, 0, 0, 0);
  return Math.round((prochain - auj) / 86400000);
}
function anniversaireLisible(dateIso) {
  const p = String(dateIso).split('-');
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return (+p[2] === 1 ? '1er' : +p[2]) + ' ' + MOIS[(+p[1]) - 1];
}

function blocInfosAdmin(m) {
  const i = infosPros[m.id] || {};
  const jours = joursAvantAnniversaire(i.date_naissance);
  let anniv = '';
  if (jours === 0) anniv = ' <span class="etiquette or">🎂 C\'est son anniversaire aujourd\'hui !</span>';
  else if (jours !== null && jours <= 7) anniv = ' <span class="etiquette">🎂 anniversaire dans ' + jours + ' jour' + (jours > 1 ? 's' : '') + '</span>';
  const manque = !i.siret || !i.adresse_complete || !i.date_naissance;
  return '<details class="historique" style="margin:6px 0;"' + (jours === 0 ? ' open' : '') + '>' +
    '<summary style="font-weight:600;color:#5A3A6A;cursor:pointer;">🪪 Infos administratives' +
      (manque ? ' <span class="etiquette or">à compléter</span>' : ' <span class="etiquette vert">complètes</span>') + anniv + '</summary>' +
    '<div class="actions" style="margin-top:6px;flex-direction:column;align-items:flex-start;">' +
      '<label class="petit-champ">SIRET (14 chiffres)<input id="adm-siret-' + m.id + '" inputmode="numeric" maxlength="17" value="' + albEchapper(i.siret || '') + '"></label>' +
      '<label class="petit-champ">N° RSAC <span style="font-weight:400;color:#7a7a75;">(si agent commercial : numéro et greffe)</span><input id="adm-rsac-' + m.id + '" maxlength="80" value="' + albEchapper(i.numero_rsac || '') + '" placeholder="ex. : 123 456 789 — greffe de Draguignan" style="width:100%;max-width:420px;"></label>' +
      '<label class="petit-champ">Adresse<input id="adm-adresse-' + m.id + '" maxlength="250" value="' + albEchapper(i.adresse_complete || '') + '" placeholder="Numéro, rue, code postal, ville" style="width:100%;max-width:420px;"></label>' +
      '<label class="petit-champ">Date de naissance <span style="font-weight:400;color:#7a7a75;">(uniquement pour lui souhaiter son anniversaire)</span><input type="date" id="adm-naissance-' + m.id + '" value="' + albEchapper(i.date_naissance || '') + '"></label>' +
      (i.date_naissance ? '<p class="ligne-info" style="margin:0;">🎂 Son anniversaire : le ' + albEchapper(anniversaireLisible(i.date_naissance)) + '</p>' : '') +
      '<button type="button" class="bouton vert" onclick="enregistrerInfosAdmin(\'' + m.id + '\', this)">💾 Enregistrer</button>' +
    '</div></details>';
}

async function enregistrerInfosAdmin(id, bouton) {
  const siret = document.getElementById('adm-siret-' + id).value.replace(/\s+/g, '');
  const rsac = document.getElementById('adm-rsac-' + id).value.trim();
  const adresse = document.getElementById('adm-adresse-' + id).value.trim();
  const naissance = document.getElementById('adm-naissance-' + id).value || null;
  if (siret && !/^\d{14}$/.test(siret)) { afficherMessage('message-general', 'erreur', 'Le SIRET doit contenir exactement 14 chiffres.'); return; }
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_infos_pro_enregistrer', {
    p_id: id, p_siret: siret || null, p_rsac: rsac || null, p_adresse: adresse || null, p_naissance: naissance
  });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerInfosPros();
  document.querySelectorAll('.papiers-pro').forEach(function (zone) { zone.innerHTML = blocPapiersPro(zone.dataset.pro); });
  if (typeof afficherAFaire === 'function') afficherAFaire();
  afficherMessage('message-general', 'succes', 'Infos enregistrées ✓');
}

// On branche : chargement avec les papiers, et bloc sur la carte de chaque pro
(function () {
  const chargerAvantInfos = chargerPapiers;
  chargerPapiers = async function () {
    await chargerAvantInfos();
    await chargerInfosPros();
    document.querySelectorAll('.papiers-pro').forEach(function (zone) { zone.innerHTML = blocPapiersPro(zone.dataset.pro); });
    if (typeof afficherAFaire === 'function') afficherAFaire();
  };
  const blocAvantInfos = blocPapiersPro;
  blocPapiersPro = function (proId) {
    const m = (typeof membres !== 'undefined' ? membres : []).find(function (x) { return x.id === proId; });
    return (m && estUnPro(m) ? blocInfosAdmin(m) : '') + blocAvantInfos(proId);
  };
})();

// « À faire aujourd'hui » : les anniversaires du jour
LIGNES_A_FAIRE.push({
  calcul: function () { return Object.keys(infosPros).filter(function (id) { return joursAvantAnniversaire(infosPros[id].date_naissance) === 0; }).length; },
  un: 'pro dont c\'est l\'anniversaire aujourd\'hui : pense à lui écrire 🎂',
  plusieurs: 'pros dont c\'est l\'anniversaire aujourd\'hui : pense à leur écrire 🎂',
  emoji: '🎂', onglet: 'valides'
});

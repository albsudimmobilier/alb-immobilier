// =====================================================================
// ☑ Pièces « couvertes autrement » : tu coches une pièce et tu écris pourquoi
// (ex. : RC pro comprise dans la décennale). La pièce ne compte plus comme manquante.
// =====================================================================
const MARQUE_COUVERT = 'Couvert par ailleurs';

function estCouvert(x) { return !!x && x.statut === 'verifie' && !x.chemin && x.valeur === MARQUE_COUVERT; }
function couvertDe(proId, type) {
  return (typeof papiersPros !== 'undefined' ? papiersPros : []).find(function (x) { return x.profile_id === proId && x.type === type && estCouvert(x); });
}

// Une pièce couverte compte comme présente (elle n'est plus « manquante »)
(function () {
  const pointAvant = pointPieces;
  pointPieces = function (m) {
    const liste = pointAvant(m);
    const attendues = (papiersAttendus[clePapiers(m)] || []).filter(function (p) { return p.type !== 'avis_google'; });
    return liste.map(function (p, i) {
      const att = attendues[i];
      if (!att) return p;
      p.type = att.type;
      const c = couvertDe(m.id, att.type);
      if (c) { p.manque = false; p.etat = '✅ couverte : ' + (c.note || ''); p.couverte = true; }
      return p;
    });
  };
})();

// Le bloc avec les cases à cocher, sur la carte du pro
function blocCouvrir(m) {
  const liste = pointPieces(m).filter(function (p) { return p.type && (p.couverte || /^(❌|○)/.test(p.etat)); });
  if (!liste.length) return '';
  const nbCouvertes = liste.filter(function (p) { return p.couverte; }).length;
  const nbAFaire = liste.length - nbCouvertes;
  return '<details class="historique" style="margin:6px 0;"' + (nbAFaire ? ' open' : '') + '>' +
    '<summary style="font-weight:600;color:#5A3A6A;cursor:pointer;">☑ Pièces couvertes autrement' + (nbCouvertes ? ' (' + nbCouvertes + ' cochée' + (nbCouvertes > 1 ? 's' : '') + ')' : '') + '</summary>' +
    '<p class="aide">Écris pourquoi la pièce n\'est pas nécessaire, puis coche la case. Elle ne sera plus comptée comme manquante.</p>' +
    liste.map(function (p) {
      const c = couvertDe(m.id, p.type);
      const idChamp = 'couv-' + m.id + '-' + p.type;
      return '<div style="padding:6px 0;border-top:1px dashed #E8E6E1;">' +
        '<label style="font-weight:600;"><input type="checkbox" ' + (c ? 'checked ' : '') + 'onchange="basculerCouvert(\'' + m.id + '\', \'' + p.type + '\', this)"> ' + albEchapper(p.libelle) + '</label>' +
        '<br><input type="text" id="' + idChamp + '" maxlength="500" value="' + albEchapper(c ? (c.note || '') : '') + '" placeholder="Pourquoi ? (ex. : comprise dans sa décennale)" style="width:100%;max-width:420px;margin-top:4px;">' +
        (c ? ' <button type="button" class="bouton discret" onclick="enregistrerNoteCouvert(\'' + m.id + '\', \'' + p.type + '\')">Enregistrer la note</button>' : '') +
      '</div>';
    }).join('') + '</details>';
}

(function () {
  const blocAvant = blocPointPieces;
  blocPointPieces = function (m) { return blocAvant(m) + blocCouvrir(m); };
})();

async function enregistrerCouvert(proId, type, note) {
  const { error } = await albSupabase.rpc('alb_gestion_papier_couvrir', { p_pro: proId, p_type: type, p_note: note });
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return false; }
  await chargerPapiers();
  afficherMessage('message-general', 'succes', 'C\'est noté : pièce couverte ✓');
  return true;
}

async function basculerCouvert(proId, type, caseACocher) {
  const champ = document.getElementById('couv-' + proId + '-' + type);
  const note = champ ? champ.value.trim() : '';
  if (caseACocher.checked) {
    if (!note) {
      caseACocher.checked = false;
      afficherMessage('message-general', 'erreur', 'Écris d\'abord pourquoi cette pièce n\'est pas nécessaire (ex. : comprise dans sa décennale), puis coche la case.');
      if (champ) champ.focus();
      return;
    }
    caseACocher.disabled = true;
    const ok = await enregistrerCouvert(proId, type, note);
    if (!ok) { caseACocher.disabled = false; caseACocher.checked = false; }
  } else {
    if (!window.confirm('Décocher cette pièce ? Elle redeviendra « pas reçue ». Aucun document envoyé par le pro n\'est touché.')) { caseACocher.checked = true; return; }
    caseACocher.disabled = true;
    const { error } = await albSupabase.rpc('alb_gestion_papier_decouvrir', { p_pro: proId, p_type: type });
    caseACocher.disabled = false;
    if (error) { caseACocher.checked = true; afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
    await chargerPapiers();
    afficherMessage('message-general', 'succes', 'C\'est décoché : la pièce redevient « pas reçue ».');
  }
}

async function enregistrerNoteCouvert(proId, type) {
  const champ = document.getElementById('couv-' + proId + '-' + type);
  const note = champ ? champ.value.trim() : '';
  if (!note) { afficherMessage('message-general', 'erreur', 'Écris la raison dans la case avant d\'enregistrer.'); return; }
  await enregistrerCouvert(proId, type, note);
}

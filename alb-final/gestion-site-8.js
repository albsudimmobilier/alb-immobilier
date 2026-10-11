// ============================================================
// Gestion du site — partie 8 : 📞 Demandes de rappel (Projets ALB)
// Un particulier qui ne sait pas par où commencer laisse son prénom
// et son numéro sur Projets ALB : Jocelyne le rappelle, puis note
// ce qu'ils se sont dit et clique « C'est fait ».
// ============================================================

let demandesRappel = [];
ERREURS.DEMANDE_INTROUVABLE = 'Cette demande n\'existe plus.';
const MOMENTS_RAPPEL = { matin: '🌅 Le matin', midi: '🍽️ Entre midi et deux', apres_midi: '☀️ L\'après-midi', soir: '🌆 En fin de journée', peu_importe: '🕐 Peu importe' };

async function chargerDemandesRappel() {
  const { data, error } = await albSupabase.rpc('alb_gestion_demandes_rappel');
  if (error) { console.error('[ALB DEBUG] demandes de rappel :', error); return; }
  demandesRappel = data || [];
  afficherDemandesRappel();
}

function demandesRappelEnAttente() { return demandesRappel.filter(function (d) { return !d.traitee_le; }); }

function afficherDemandesRappel() {
  const zone = document.getElementById('liste-demandes-rappel');
  if (!zone) return;
  const attente = demandesRappelEnAttente();
  const faites = demandesRappel.filter(function (d) { return d.traitee_le; });
  document.getElementById('titre-demandes-rappel').textContent = '📞 Demandes de rappel' + (attente.length ? ' (' + attente.length + ' à rappeler)' : '');
  if (!demandesRappel.length) { zone.innerHTML = '<div class="vide">Aucune demande de rappel pour l\'instant. 🌿</div>'; return; }
  zone.innerHTML = '<div class="liste-fiches">' + attente.map(carteDemandeRappel).join('') + '</div>' +
    (faites.length ? '<details class="historique"><summary>✅ Déjà rappelés (' + faites.length + ')</summary><div class="liste-fiches" style="margin-top:8px;">' + faites.map(carteDemandeRappel).join('') + '</div></details>' : '');
}

function carteDemandeRappel(d) {
  const num = String(d.telephone || '').replace(/[^0-9+]/g, '');
  const ancien = Math.floor((Date.now() - new Date(d.cree_le).getTime()) / 3600000);
  const retard = !d.traitee_le && ancien >= 24;
  return '<div class="carte"' + (d.traitee_le ? ' style="opacity:0.8;"' : '') + '>' +
    '<h3 style="font-family:Montserrat,sans-serif;font-size:1.05rem;">' + albEchapper(d.prenom) +
      (d.traitee_le ? ' <span class="etiquette vert">✅ Rappelé le ' + albEchapper(dateLisible(d.traitee_le)) + '</span>' : (retard ? ' <span class="etiquette rouge">⏳ Depuis ' + Math.floor(ancien / 24) + ' j</span>' : ' <span class="etiquette or">🆕 À rappeler</span>')) + '</h3>' +
    '<p class="ligne-info">📱 <a href="tel:' + albEchapper(num) + '"><strong>' + albEchapper(d.telephone) + '</strong></a>' + (d.code_postal ? ' · 📍 ' + albEchapper(d.code_postal) : '') + '</p>' +
    '<p class="ligne-info">' + (MOMENTS_RAPPEL[d.moment] || '') + ' · demandé le ' + albEchapper(new Date(d.cree_le).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) + '</p>' +
    (d.message ? '<p class="ligne-info mot">💬 « ' + albEchapper(d.message) + ' »</p>' : '') +
    (d.traitee_le
      ? (d.note ? '<p class="ligne-info">📝 ' + albEchapper(d.note) + '</p>' : '') +
        '<div class="actions"><button type="button" class="bouton discret" onclick="demandeRappelTraitee(\'' + d.id + '\', false, this)">Annuler « c\'est fait »</button></div>'
      : '<label class="petit-champ" style="margin-top:8px;">Ce que vous vous êtes dit (facultatif)<textarea id="note-rappel-' + d.id + '" maxlength="1000" style="min-height:70px;"></textarea></label>' +
        '<div class="actions">' + (num ? '<a class="bouton" href="tel:' + albEchapper(num) + '">📞 Appeler</a>' : '') +
        '<button type="button" class="bouton vert" onclick="demandeRappelTraitee(\'' + d.id + '\', true, this)">✓ C\'est fait, je l\'ai rappelé</button></div>') +
  '</div>';
}

async function demandeRappelTraitee(id, fait, bouton) {
  const champ = document.getElementById('note-rappel-' + id);
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_demande_rappel_traitee', { p_id: id, p_note: champ ? champ.value : null, p_fait: fait });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerDemandesRappel();
  afficherAFaire();
  afficherMessage('message-general', 'succes', fait ? 'Rappel noté ✓' : 'C\'est de nouveau à rappeler.');
}

// « À faire aujourd'hui » : en tête, car la personne attend un appel
LIGNES_A_FAIRE.unshift({
  calcul: function () { return demandesRappelEnAttente().length; },
  un: 'personne à rappeler (demande faite sur Projets ALB)', plusieurs: 'personnes à rappeler (demandes faites sur Projets ALB)', emoji: '📞', onglet: 'projets', ancre: 'zone-demandes-rappel'
});

(function () {
  const toutRechargerAvantRappelsDemandes = toutRecharger;
  toutRecharger = async function () {
    await Promise.all([toutRechargerAvantRappelsDemandes(), chargerDemandesRappel()]);
    afficherAFaire();
  };
})();

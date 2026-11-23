// gestion-site-18.js — « 📂 Documents pour les courtiers » (onglet 🤝 Projets + À faire aujourd'hui)
// 48 h après qu'un courtier a accepté une demande, Jocelyne appelle le particulier :
// a-t-il déposé ses documents chez le courtier ? Sinon, SMS et mail prêts (elle les envoie elle-même).
// ALB ne voit pas les documents : c'est l'appel qui le dit.
let depotsCourtiers = [];

async function chargerDepotsCourtiers() {
  const { data, error } = await albSupabase.rpc('alb_gestion_depots');
  if (error) { console.error('[ALB DEBUG] dépôts courtiers :', error); return; }
  depotsCourtiers = data || [];
}

function depotAAppeler(d) { return !d.deposes_le && !d.appel_fait_le && new Date(d.a_appeler_le) <= new Date(); }
function depotNomPro(d) { return (d.pro && (d.pro.entreprise || ((d.pro.prenom || '') + ' ' + (d.pro.nom || '')).trim())) || 'votre courtier'; }
function depotListe(d) { return String(d.documents || '').split(/\n|;/).map(function (x) { return x.replace(/^[\s\-•*]+/, '').trim(); }).filter(Boolean); }

function depotTextes(d) {
  const prenom = (d.particulier && d.particulier.prenom) || '';
  const pro = depotNomPro(d);
  const docs = depotListe(d);
  const lien = d.lien || 'https://albimmobilier.fr/espace-alb.html';
  const sms = 'Bonjour ' + prenom + ', c\'est Jocelyne d\'ALB Immobilier. Pour avancer avec ' + pro + ', voici le lien pour déposer vos documents : ' + lien +
    (docs.length ? ' (' + docs.join(', ') + ').' : '.') + (d.explication ? ' ' + d.explication : '') + ' Je reste disponible au 07 45 60 28 05. À la bien, toujours ✨';
  const sujet = 'PARTICULIER ACQUÉREUR – Vos documents pour votre courtier';
  const corps = 'Bonjour ' + prenom + ',\n\nMerci pour notre échange. Pour que ' + pro + ' puisse étudier votre financement, il vous reste à déposer vos documents dans son espace sécurisé :\n👉 ' + lien + '\n\n' +
    (docs.length ? 'Les documents demandés :\n' + docs.map(function (x) { return '- ' + x; }).join('\n') + '\n\n' : '') +
    (d.explication ? 'Comment faire, expliqué par ' + pro + ' :\n' + d.explication + '\n\n' : '') +
    'Si vous avez la moindre question, je suis disponible au 07 45 60 28 05, du lundi au samedi de 9h à 18h.\n\nÀ la bien, toujours ✨\nJocelyne – ALB Sud Immobilier';
  return { sms: sms, sujet: sujet, corps: corps };
}

function carteDepotCourtier(d) {
  const p = d.particulier || {};
  const nom = ((p.prenom || '') + ' ' + (p.nom || '')).trim() || 'Particulier';
  const num = String(p.telephone || '').replace(/[^0-9+]/g, '');
  const t = depotTextes(d);
  const fini = d.deposes_le || d.appel_fait_le;
  const pasEncore = new Date(d.a_appeler_le) > new Date();
  const etat = d.deposes_le ? '<span class="etiquette vert">✅ Documents déposés</span>'
    : d.appel_fait_le ? '<span class="etiquette vert">📞 Appelé le ' + albEchapper(dateLisible(d.appel_fait_le)) + '</span>'
    : pasEncore ? '<span class="etiquette">⏳ À appeler le ' + albEchapper(new Date(d.a_appeler_le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })) + '</span>'
    : '<span class="etiquette rouge">📞 À appeler</span>';
  const ligne = function (txt) { return '<p class="ligne-info">' + txt + '</p>'; };
  return '<div class="carte"' + (fini ? ' style="opacity:0.8;"' : '') + '>' +
    '<h3 style="font-family:Montserrat,sans-serif;font-size:1.05rem;">' + albEchapper(nom) + ' ' + etat + '</h3>' +
    ligne('🏦 Courtier : <strong>' + albEchapper(depotNomPro(d)) + '</strong> · a accepté le ' + albEchapper(dateLisible(d.accepte_le))) +
    ligne('📱 ' + (num ? '<a href="tel:' + albEchapper(num) + '"><strong>' + albEchapper(p.telephone) + '</strong></a>' : '—') + ' · 📧 ' + albEchapper(p.email || '')) +
    (d.lien ? '' : ligne('<span class="etiquette or">⚠️ Ce courtier n\'a pas encore indiqué son lien de dépôt dans son espace</span>')) +
    (d.sms_le ? ligne('<span class="etiquette vert">📱 SMS envoyé le ' + albEchapper(dateLisible(d.sms_le)) + '</span>') : '') +
    (d.mail_le ? ligne('<span class="etiquette vert">📧 Mail envoyé le ' + albEchapper(dateLisible(d.mail_le)) + '</span>') : '') +
    (d.note ? ligne('📝 ' + albEchapper(d.note)) : '') +
    (fini
      ? '<div class="actions"><button type="button" class="bouton discret" onclick="depotMarquer(\'' + d.ligne_id + '\', \'' + (d.deposes_le ? 'deposes' : 'appel') + '\', false, this)">Annuler</button></div>'
      : '<label class="petit-champ" style="margin-top:8px;">Ce que vous vous êtes dit (facultatif)<textarea id="note-depot-' + d.ligne_id + '" maxlength="1000" style="min-height:60px;"></textarea></label>' +
        '<div class="actions">' +
          (num ? '<a class="bouton" href="tel:' + albEchapper(num) + '">📞 Appeler</a>' : '') +
          '<button type="button" class="bouton vert" onclick="depotMarquer(\'' + d.ligne_id + '\', \'deposes\', true, this)">✓ Documents déposés</button>' +
          (num ? '<a class="bouton" href="sms:' + albEchapper(num) + '?&body=' + encodeURIComponent(t.sms) + '" onclick="depotMarquer(\'' + d.ligne_id + '\', \'sms\', true)">📱 SMS prêt</a>' : '') +
          (p.email ? '<a class="bouton" href="mailto:' + albEchapper(p.email) + '?subject=' + encodeURIComponent(t.sujet) + '&body=' + encodeURIComponent(t.corps) + '" onclick="depotMarquer(\'' + d.ligne_id + '\', \'mail\', true)">📧 Mail prêt</a>' : '') +
          '<button type="button" class="bouton" onclick="depotMarquer(\'' + d.ligne_id + '\', \'appel\', true, this)">✓ Appel fait</button>' +
        '</div>') +
  '</div>';
}

async function depotMarquer(id, quoi, oui, bouton) {
  if (bouton) bouton.disabled = true;
  const champ = document.getElementById('note-depot-' + id);
  const { error } = await albSupabase.rpc('alb_gestion_depot_marquer', { p_ligne: id, p_quoi: quoi, p_oui: oui, p_note: champ ? champ.value : null });
  if (bouton) bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerDepotsCourtiers();
  afficherDepotsCourtiers();
  afficherAFaire();
}

function afficherDepotsCourtiers() {
  const panneau = document.getElementById('panneau-projets');
  if (!panneau) return;
  let zone = document.getElementById('zone-depots-courtiers');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'zone-depots-courtiers';
    panneau.insertBefore(zone, panneau.firstChild);
  }
  const aAppeler = depotsCourtiers.filter(depotAAppeler);
  const bientot = depotsCourtiers.filter(function (d) { return !d.deposes_le && !d.appel_fait_le && new Date(d.a_appeler_le) > new Date(); });
  const faits = depotsCourtiers.filter(function (d) { return d.deposes_le || d.appel_fait_le; });
  if (!depotsCourtiers.length) { zone.innerHTML = ''; return; }
  zone.innerHTML = '<h2 class="titre-section">📂 Documents pour les courtiers' + (aAppeler.length ? ' (' + aAppeler.length + ' à appeler)' : '') + '</h2>' +
    '<p class="aide">48 h après qu\'un courtier a accepté une demande, appelle le particulier : a-t-il déposé ses documents ? Sinon, envoie-lui le SMS ou le mail prêt (c\'est toi qui l\'envoies). ALB ne voit pas les documents, c\'est ton appel qui le dit.</p>' +
    '<div class="liste-fiches">' + aAppeler.concat(bientot).map(carteDepotCourtier).join('') + '</div>' +
    (faits.length ? '<details class="historique"><summary>✅ Déjà faits (' + faits.length + ')</summary><div class="liste-fiches" style="margin-top:8px;">' + faits.map(carteDepotCourtier).join('') + '</div></details>' : '');
}

// « À faire aujourd'hui »
LIGNES_A_FAIRE.splice(1, 0, {
  calcul: function () { return depotsCourtiers.filter(depotAAppeler).length; },
  un: 'particulier à appeler pour ses documents de courtier', plusieurs: 'particuliers à appeler pour leurs documents de courtier', emoji: '📂', onglet: 'projets',
  filtre: function () { const z = document.getElementById('zone-depots-courtiers'); if (z) z.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
});

(function () {
  const avant = toutRecharger;
  toutRecharger = async function () {
    await Promise.all([avant(), chargerDepotsCourtiers()]);
    afficherDepotsCourtiers();
    afficherAFaire();
  };
})();

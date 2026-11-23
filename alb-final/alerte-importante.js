// alerte-importante.js — Bandeaux d'alerte en haut des pages de gestion
// (Gestion du site, Calendrier, Questionnaires de biens). Visible uniquement par Jocelyne :
// les fonctions refusent les autres comptes, et dans ce cas rien ne s'affiche.
//  • Bandeau ROUGE « IMPORTANT » : relances de questionnaires du bien restés en brouillon
//    (SMS ou mail pas encore marqué « fait »), questionnaires modifiés après l'envoi,
//    et demandes de modification d'annonces en ligne (bouton « Fait »).
//  • Le doré montre aussi les changements faits par les vendeurs (prix, description, photos — bouton « Vu »).
//  • Bandeau DORÉ : ce qui attend ta validation (demandes de projet, annonces, avis,
//    pros à valider, photos, demandes de rappel, questionnaires de biens reçus, accès).
//  • Bandeau VERT « Tout est ok » : quand il n'y a rien du tout.
(function () {
  'use strict';

  const GS = 'gestion-site.html';

  // Le style des bandeaux, ajouté une seule fois (ces pages n'utilisent pas styles.css)
  function ajouterStyle() {
    if (document.getElementById('alerte-importante-style')) return;
    const st = document.createElement('style');
    st.id = 'alerte-importante-style';
    st.textContent =
      '.alerte-importante { background:#B3261E; color:#fff; padding:12px 16px; margin:0; font-size:0.95rem; line-height:1.45; }' +
      '.alerte-importante strong { display:block; font-size:1rem; margin-bottom:4px; }' +
      '.alerte-importante ul { margin:4px 0 8px 18px; padding:0; }' +
      '.alerte-importante a { display:inline-block; background:#fff; color:#B3261E; font-weight:700; padding:6px 14px; border-radius:6px; text-decoration:none; }' +
      '.alerte-importante.alerte-doree { background:#C9A227; color:#2B2100; }' +
      '.alerte-importante.alerte-doree ul { list-style:none; margin-left:0; }' +
      '.alerte-importante.alerte-doree li { margin:4px 0; }' +
      '.alerte-importante.alerte-doree a { background:#2B2100; color:#F5E3A3; padding:3px 10px; margin-left:6px; font-size:0.85rem; }' +
      '.alerte-importante .alerte-bouton { border:0; border-radius:6px; padding:3px 10px; margin-left:6px; font-weight:700; cursor:pointer; background:#fff; color:#2B2100; font-size:0.85rem; }' +
      '.alerte-importante.alerte-ok { background:#2E6B34; }' +
      '.alerte-importante.alerte-ok strong { margin-bottom:0; }';
    document.head.appendChild(st);
  }

  function echapper(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Nombre de jours depuis une date
  function joursDepuis(dateIso) {
    if (!dateIso) return 0;
    return Math.floor((Date.now() - new Date(dateIso).getTime()) / 86400000);
  }

  function liste(r) { return r && !r.error && Array.isArray(r.data) ? r.data : []; }
  function pluriel(n, mot, mots) { return n + ' ' + (n > 1 ? mots : mot); }

  // Ce qui attend la validation de Jocelyne (mêmes règles que les pastilles de Gestion du site)
  async function chargerAValider() {
    const r = await Promise.all([
      albSupabase.rpc('alb_gestion_projets'),
      albSupabase.rpc('alb_gestion_annonces'),
      albSupabase.rpc('alb_gestion_avis'),
      albSupabase.rpc('alb_gestion_compteurs'),
      albSupabase.rpc('alb_gestion_photos_a_valider'),
      albSupabase.rpc('alb_gestion_demandes_rappel'),
      albSupabase.rpc('alb_gestion_questionnaires_biens'),
      albSupabase.rpc('alb_gestion_demandes_acces')
    ]);
    r.forEach(function (x, i) { if (x.error) console.log('[ALB DEBUG] bandeau doré, source ' + i + ' :', x.error); });
    const nProjets = liste(r[0]).filter(function (p) { return p.statut === 'a_verifier' || p.statut === 'a_orienter' || p.statut === 'sans_suite'; }).length;
    const nAnnonces = liste(r[1]).filter(function (a) { return a.statut === 'en_attente'; }).length;
    const nAvis = liste(r[2]).filter(function (a) { return a.statut === 'en_attente'; }).length;
    const nPros = (r[3] && !r[3].error && r[3].data && Number(r[3].data.pros_a_valider)) || 0;
    const nPhotos = liste(r[4]).length;
    const nRappels = liste(r[5]).filter(function (d) { return !d.traitee_le; }).length;
    // Questionnaires modifiés après l'envoi : ils vont dans le bandeau rouge, pas dans le doré
    // Questionnaires « sans mandat » et « mandat remporté » : bandeau rouge aussi
    const aTraiterQ = liste(r[6]).filter(function (q) { return q.statut !== 'brouillon' && !q.traite_le; });
    const enRouge = function (q) { return q.modifie_apres_envoi_le || q.sans_mandat || q.mandat_remporte_le; };
    const modifies = aTraiterQ.filter(enRouge);
    const nQuest = aTraiterQ.filter(function (q) { return !enRouge(q); }).length;
    const nAcces = liste(r[7]).length;

    const items = [];
    if (nProjets) items.push(['🤝 ' + pluriel(nProjets, 'demande de projet', 'demandes de projet') + ' à traiter', GS + '#projets']);
    if (nAnnonces) items.push(['🏡 ' + pluriel(nAnnonces, 'annonce', 'annonces') + ' à étudier', GS + '#annonces']);
    if (nAvis) items.push(['⭐ ' + pluriel(nAvis, 'avis', 'avis') + ' à relire', GS + '#avis']);
    if (nPros) items.push(['📞 ' + pluriel(nPros, 'pro', 'pros') + ' à valider', GS + '#a-valider']);
    if (nPhotos) items.push(['🖼️ ' + pluriel(nPhotos, 'photo', 'photos') + ' à valider', GS]);
    if (nRappels) items.push(['☎️ ' + pluriel(nRappels, 'demande de rappel', 'demandes de rappel') + ' en attente', 'calendrier.html']);
    if (nQuest) items.push(['📝 ' + pluriel(nQuest, 'questionnaire de bien reçu', 'questionnaires de biens reçus') + ' à traiter', 'questionnaires-biens.html']);
    if (nAcces) items.push(['🔑 ' + pluriel(nAcces, 'demande d’accès', 'demandes d’accès') + ' en attente', GS + '#acces']);
    return { items: items, modifies: modifies };
  }

  function creer(classe, html) {
    const z = document.createElement('div');
    z.className = 'alerte-importante ' + classe;
    z.innerHTML = html;
    return z;
  }

  async function afficherAlertes() {
    if (typeof albSupabase === 'undefined') return;
    const [rel, charge, ann] = await Promise.all([
      albSupabase.rpc('alb_gestion_alertes_questionnaires'),
      chargerAValider(),
      albSupabase.rpc('alb_gestion_alertes_annonces')
    ]);
    if (ann.error) console.log('[ALB DEBUG] alertes annonces :', ann.error);
    const demandes = (ann.data && Array.isArray(ann.data.demandes)) ? ann.data.demandes : [];
    const modifsAnn = (ann.data && Array.isArray(ann.data.modifs)) ? ann.data.modifs : [];
    if (rel.error) { console.log('[ALB DEBUG] alertes questionnaires :', rel.error); return; }  // pas Jocelyne : rien
    const relances = Array.isArray(rel.data) ? rel.data : [];
    const aValider = charge.items, modifies = charge.modifies;

    const ancien = document.getElementById('alerte-importante');
    if (ancien) ancien.remove();
    ajouterStyle();
    const zone = document.createElement('div');
    zone.id = 'alerte-importante';

    // Rouge : relances de questionnaires
    if (relances.length || modifies.length || demandes.length) {
      const lignesDemandes = demandes.map(function (d) {
        return '<li>' + echapper(d.nom || 'Membre') + ' demande une modification' + (d.ville ? ' (' + echapper(d.ville) + ')' : '') + ' : « ' + echapper(d.message) + ' » ' +
          '<a href="' + GS + '#annonces">Voir</a> <button type="button" class="alerte-bouton" data-alerte-faite="demande" data-id="' + echapper(d.id) + '">✓ Fait</button></li>';
      }).join('');
      const lignesModif = modifies.map(function (q) {
        const nom = echapper([q.pro_prenom, q.pro_nom].filter(Boolean).join(' ') || q.pro || 'Membre');
        const ou = q.adresse ? ' (' + echapper(q.adresse) + ')' : '';
        let quoi;
        if (q.mandat_remporte_le && !q.sans_mandat) quoi = '🏆 ' + nom + ' a remporté le mandat' + ou + ' : annonce à valider';
        else if (q.sans_mandat) quoi = '📄 ' + nom + ' : questionnaire sans mandat' + ou + ', aperçu de l\u2019annonce à préparer';
        else quoi = nom + ' a modifié son questionnaire après l\u2019envoi' + ou;
        return '<li>' + quoi + ' <a href="questionnaires-biens.html?q=' + echapper(q.id) + '">Voir l\u2019annonce proposée</a></li>';
      }).join('');
      const lignes = lignesDemandes + lignesModif + relances.map(function (a) {
        const quoi = a.quoi === 'mail' ? 'mail à envoyer' : 'SMS à envoyer';
        const j = joursDepuis(a.depuis);
        return '<li>' + echapper(a.nom || 'Membre') + ' – questionnaire en brouillon – <em>' + quoi + '</em>' +
          (j >= 2 ? ' (en attente depuis ' + j + ' jours)' : '') + '</li>';
      }).join('');
      const n = relances.length + modifies.length + demandes.length;
      zone.appendChild(creer('', '<strong>🔴 IMPORTANT – ' + pluriel(n, 'point', 'points') + ' à voir</strong>' +
        '<ul>' + lignes + '</ul>' + (relances.length ? '<a href="calendrier.html">Voir dans le Calendrier</a>' : '')));
    }

    // Doré : ce qui attend ta validation, et les changements faits par les vendeurs
    const NOMS_MODIF = { prix: 'son prix', honoraires: 'ses honoraires', description: 'sa description', photos: 'ses photos' };
    if (aValider.length || modifsAnn.length) {
      const lignes = modifsAnn.map(function (m) {
        const quoi = (m.quoi || []).map(function (q) { return NOMS_MODIF[q] || q; });
        const texte = quoi.length > 1 ? quoi.slice(0, -1).join(', ') + ' et ' + quoi[quoi.length - 1] : (quoi[0] || 'son annonce');
        return '<li>✏️ ' + echapper(m.nom || 'Membre') + ' a modifié ' + echapper(texte) + (m.ville ? ' (' + echapper(m.ville) + ')' : '') +
          ' <a href="' + GS + '#annonces">Voir</a> <button type="button" class="alerte-bouton" data-alerte-faite="modif" data-id="' + echapper(m.id) + '">👁 Vu</button></li>';
      }).join('') + aValider.map(function (it) {
        return '<li>' + echapper(it[0]) + ' <a href="' + echapper(it[1]) + '">Voir</a></li>';
      }).join('');
      zone.appendChild(creer('alerte-doree', '<strong>✨ À valider</strong><ul>' + lignes + '</ul>'));
    }

    // Vert : rien du tout
    if (!relances.length && !modifies.length && !demandes.length && !aValider.length && !modifsAnn.length) {
      zone.appendChild(creer('alerte-ok', '<strong>✅ Tout est ok – rien à valider ni à relancer</strong>'));
    }
    placer(zone);
  }

  // Boutons « Fait » (demande de modification traitée) et « Vu » (changement du vendeur)
  document.addEventListener('click', async function (ev) {
    const b = ev.target.closest && ev.target.closest('[data-alerte-faite]');
    if (!b) return;
    b.disabled = true;
    const { error } = await albSupabase.rpc('alb_gestion_alerte_annonce_faite', { p_quoi: b.dataset.alerteFaite, p_id: b.dataset.id });
    if (error) { console.log('[ALB DEBUG] alerte faite :', error); b.disabled = false; return; }
    afficherAlertes();
  });

  // Place les bandeaux juste sous l'en-tête de la page
  function placer(z) {
    const bandeau = document.querySelector('header');
    if (bandeau && bandeau.parentNode) bandeau.parentNode.insertBefore(z, bandeau.nextSibling);
    else document.body.insertBefore(z, document.body.firstChild);
  }

  // On attend que la connexion soit prête (session de Jocelyne chargée)
  async function demarrer() {
    if (typeof albSupabase === 'undefined') return;
    const { data } = await albSupabase.auth.getSession();
    if (data && data.session) afficherAlertes();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();

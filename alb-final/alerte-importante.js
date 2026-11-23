// alerte-importante.js — Bandeaux d'alerte en haut des pages de gestion
// (Gestion du site, Calendrier, Questionnaires de biens). Visible uniquement par Jocelyne :
// les fonctions refusent les autres comptes, et dans ce cas rien ne s'affiche.
//  • Bandeau ROUGE « IMPORTANT » : relances de questionnaires du bien restés en brouillon
//    (SMS ou mail pas encore marqué « fait ») et questionnaires modifiés après l'envoi.
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
    const modifies = liste(r[6]).filter(function (q) { return q.statut !== 'brouillon' && !q.traite_le && q.modifie_apres_envoi_le; });
    const nQuest = liste(r[6]).filter(function (q) { return q.statut !== 'brouillon' && !q.traite_le && !q.modifie_apres_envoi_le; }).length;
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
    const [rel, charge] = await Promise.all([
      albSupabase.rpc('alb_gestion_alertes_questionnaires'),
      chargerAValider()
    ]);
    if (rel.error) { console.log('[ALB DEBUG] alertes questionnaires :', rel.error); return; }  // pas Jocelyne : rien
    const relances = Array.isArray(rel.data) ? rel.data : [];
    const aValider = charge.items, modifies = charge.modifies;

    const ancien = document.getElementById('alerte-importante');
    if (ancien) ancien.remove();
    ajouterStyle();
    const zone = document.createElement('div');
    zone.id = 'alerte-importante';

    // Rouge : relances de questionnaires
    if (relances.length || modifies.length) {
      const lignesModif = modifies.map(function (q) {
        return '<li>' + echapper(q.pro || [q.pro_prenom, q.pro_nom].filter(Boolean).join(' ') || 'Membre') + ' a modifié son questionnaire après l\u2019envoi' + (q.adresse ? ' (' + echapper(q.adresse) + ')' : '') + '</li>';
      }).join('');
      const lignes = lignesModif + relances.map(function (a) {
        const quoi = a.quoi === 'mail' ? 'mail à envoyer' : 'SMS à envoyer';
        const j = joursDepuis(a.depuis);
        return '<li>' + echapper(a.nom || 'Membre') + ' – questionnaire en brouillon – <em>' + quoi + '</em>' +
          (j >= 2 ? ' (en attente depuis ' + j + ' jours)' : '') + '</li>';
      }).join('');
      const n = relances.length + modifies.length;
      zone.appendChild(creer('', '<strong>🔴 IMPORTANT – ' + pluriel(n, 'point', 'points') + ' à voir</strong>' +
        '<ul>' + lignes + '</ul>' + (modifies.length ? '<a href="questionnaires-biens.html">Voir les questionnaires</a> ' : '') + (relances.length ? '<a href="calendrier.html">Voir dans le Calendrier</a>' : '')));
    }

    // Doré : ce qui attend ta validation
    if (aValider.length) {
      const lignes = aValider.map(function (it) {
        return '<li>' + echapper(it[0]) + ' <a href="' + echapper(it[1]) + '">Voir</a></li>';
      }).join('');
      zone.appendChild(creer('alerte-doree', '<strong>✨ À valider</strong><ul>' + lignes + '</ul>'));
    }

    // Vert : rien du tout
    if (!relances.length && !modifies.length && !aValider.length) {
      zone.appendChild(creer('alerte-ok', '<strong>✅ Tout est ok – rien à valider ni à relancer</strong>'));
    }
    placer(zone);
  }

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

// alerte-importante.js — Bandeau rouge « IMPORTANT » en haut des pages de gestion
// Affiche les relances (ou un bandeau vert « Tout est ok » s'il n'y a rien à faire)
// Détail : affiche les relances à faire pour les questionnaires du bien restés en brouillon
// (SMS ou mail pas encore marqué « fait »). Il reste affiché tant que ce n'est pas traité.
// Visible uniquement par Jocelyne (la fonction refuse les autres comptes : rien ne s'affiche).
(function () {
  'use strict';

  // Le style du bandeau, ajouté une seule fois (ces pages n'utilisent pas styles.css)
  function ajouterStyle() {
    if (document.getElementById('alerte-importante-style')) return;
    const st = document.createElement('style');
    st.id = 'alerte-importante-style';
    st.textContent =
      '.alerte-importante { background:#B3261E; color:#fff; padding:12px 16px; margin:0; font-size:0.95rem; line-height:1.45; }' +
      '.alerte-importante strong { display:block; font-size:1rem; margin-bottom:4px; }' +
      '.alerte-importante ul { margin:4px 0 8px 18px; padding:0; }' +
      '.alerte-importante.alerte-ok { background:#2E6B34; }' +
      '.alerte-importante.alerte-ok strong { margin-bottom:0; }' +
      '.alerte-importante a { display:inline-block; background:#fff; color:#B3261E; font-weight:700; padding:6px 14px; border-radius:6px; text-decoration:none; }';
    document.head.appendChild(st);
  }

  function echapper(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Nombre de jours depuis la création de la tâche de relance
  function joursDepuis(dateIso) {
    if (!dateIso) return 0;
    return Math.floor((Date.now() - new Date(dateIso).getTime()) / 86400000);
  }

  async function afficherAlertes() {
    if (typeof albSupabase === 'undefined') return;
    const { data, error } = await albSupabase.rpc('alb_gestion_alertes_questionnaires');
    if (error) { console.log('[ALB DEBUG] alertes questionnaires :', error); return; }
    const liste = Array.isArray(data) ? data : [];
    const ancien = document.getElementById('alerte-importante');
    if (ancien) ancien.remove();
    ajouterStyle();
    // Rien à relancer : bandeau vert « Tout est ok »
    if (!liste.length) {
      const ok = document.createElement('div');
      ok.id = 'alerte-importante';
      ok.className = 'alerte-importante alerte-ok';
      ok.innerHTML = '<strong>✅ Tout est ok – aucune relance de questionnaire à faire</strong>';
      placer(ok);
      return;
    }

    const lignes = liste.map(function (a) {
      const quoi = a.quoi === 'mail' ? 'mail à envoyer' : 'SMS à envoyer';
      const j = joursDepuis(a.depuis);
      return '<li>' + echapper(a.nom || 'Membre') + ' – questionnaire en brouillon – <em>' + quoi + '</em>' +
        (j >= 2 ? ' (en attente depuis ' + j + ' jours)' : '') + '</li>';
    }).join('');
    const z = document.createElement('div');
    z.id = 'alerte-importante';
    z.className = 'alerte-importante';
    z.innerHTML = '<strong>🔴 IMPORTANT – ' + liste.length + ' relance' + (liste.length > 1 ? 's' : '') + ' de questionnaire à faire</strong>' +
      '<ul>' + lignes + '</ul><a href="calendrier.html">Voir dans le Calendrier</a>';
    placer(z);
  }

  // Place le bandeau juste sous l'en-tête de la page
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

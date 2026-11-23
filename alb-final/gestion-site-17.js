// gestion-site-17.js — Bouton « 📘 Guide ALB » dans le bandeau de Gestion du site
(function () {
  function demarrer() {
    var barre = document.querySelector('.bandeau-droite');
    if (!barre || document.getElementById('bouton-guide')) return;
    var lien = document.createElement('a');
    lien.id = 'bouton-guide';
    lien.href = 'guide-alb.html';
    lien.textContent = '📘 Guide ALB';
    barre.insertBefore(lien, barre.firstChild);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();

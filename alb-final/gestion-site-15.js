// gestion-site-15.js — Bouton « Mes rendez-vous » dans le bandeau de Gestion du site
(function () {
  var LIEN_RESERVATION = 'https://calendar.app.google/Gto8gCNmLCEhD8hk6';
  var LIEN_AGENDA = 'https://calendar.google.com/calendar/u/0/r';

  function demarrer() {
    var barre = document.querySelector('.bandeau-droite');
    if (!barre || document.getElementById('bouton-rdv')) return;

    // Le bouton, placé juste avant « Statistiques »
    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.id = 'bouton-rdv';
    bouton.textContent = '📅 Mes rendez-vous';
    var statistiques = barre.querySelector('a[href="statistiques.html"]');
    barre.insertBefore(bouton, statistiques || barre.firstChild);

    // La fenêtre
    var fond = document.createElement('div');
    fond.id = 'fenetre-rdv';
    fond.className = 'cache';
    fond.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:200;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;padding:16px;';
    fond.innerHTML =
      '<div class="carte" style="max-width:460px;width:100%;margin:0;">' +
        '<h2 style="margin-bottom:8px;">📅 Mes rendez-vous</h2>' +
        '<p class="ligne-info" style="margin-bottom:14px;">Les personnes qui réservent un échange avec toi apparaissent dans ton Google Agenda, avec leurs coordonnées.</p>' +
        '<div class="actions">' +
          '<a class="bouton" href="' + LIEN_AGENDA + '" target="_blank" rel="noopener">Ouvrir mon agenda</a>' +
          '<a class="bouton discret" href="' + LIEN_RESERVATION + '" target="_blank" rel="noopener">Voir ma page de réservation</a>' +
          '<button type="button" class="bouton discret" id="fermer-rdv">Fermer</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(fond);

    function ouvrir() { fond.classList.remove('cache'); }
    function fermer() { fond.classList.add('cache'); }

    bouton.addEventListener('click', ouvrir);
    document.getElementById('fermer-rdv').addEventListener('click', fermer);
    fond.addEventListener('click', function (e) { if (e.target === fond) fermer(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();

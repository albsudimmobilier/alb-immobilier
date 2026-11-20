// gestion-site-16.js — Questionnaires de biens : bouton en premier dans le bandeau + chiffre « à traiter » sur l'accueil
(function () {
  var PAGE = 'questionnaires-biens.html';
  var pastille = null;   // le petit chiffre sur le bouton
  var valeurTuile = null; // le chiffre de la tuile « En un coup d'œil »
  var essais = 0;

  // Le bouton, placé tout au début du bandeau
  function creerBouton() {
    var barre = document.querySelector('.bandeau-droite');
    if (!barre) return;
    var bouton = barre.querySelector('a[href="' + PAGE + '"]');
    if (!bouton) {
      bouton = document.createElement('a');
      bouton.href = PAGE;
      bouton.textContent = '🏠 Questionnaires de biens';
      barre.insertBefore(bouton, barre.firstChild);
    }
    pastille = document.createElement('span');
    pastille.id = 'pastille-questionnaires-biens';
    pastille.style.cssText = 'display:none;margin-left:6px;background:#B28E3D;color:#fff;border-radius:10px;padding:1px 7px;font-size:0.72rem;font-weight:700;';
    bouton.appendChild(pastille);
  }

  // La tuile, placée en premier dans « En un coup d'œil »
  function creerTuile() {
    var zone = document.querySelector('#panneau-accueil .compteurs');
    if (!zone) return;
    var tuile = document.createElement('div');
    tuile.className = 'compteur alerte';
    tuile.style.cursor = 'pointer';
    tuile.innerHTML = '<div class="valeur" id="c-questionnaires-biens">–</div><div class="libelle">🏠 Questionnaires de biens à traiter</div>';
    tuile.addEventListener('click', function () { window.location.href = PAGE; });
    zone.insertBefore(tuile, zone.firstChild);
    valeurTuile = document.getElementById('c-questionnaires-biens');
  }

  function afficher(nombre) {
    if (pastille) {
      pastille.textContent = nombre;
      pastille.style.display = nombre > 0 ? 'inline-block' : 'none';
    }
    if (valeurTuile) valeurTuile.textContent = nombre;
  }

  // Compte les questionnaires envoyés qui ne sont pas encore traités
  async function compter() {
    var base = window.albSupabase || (typeof albSupabase !== 'undefined' ? albSupabase : null);
    if (!base) return false;
    try {
      var reponse = await base.rpc('alb_gestion_questionnaires_biens');
      if (reponse.error) return false;
      var liste = reponse.data || [];
      afficher(liste.filter(function (q) { return !q.traite_le; }).length);
      return true;
    } catch (erreur) {
      console.log('[ALB DEBUG] questionnaires de biens : comptage impossible', erreur);
      return false;
    }
  }

  // Au démarrage, tu n'es peut-être pas encore connectée : on réessaie quelques secondes
  function essayer() {
    compter().then(function (ok) {
      essais++;
      if (!ok && essais < 20) setTimeout(essayer, 3000);
    });
  }

  function demarrer() {
    if (document.getElementById('pastille-questionnaires-biens')) return;
    creerBouton();
    creerTuile();
    essayer();
    // Quand tu reviens sur l'onglet du navigateur, le chiffre se met à jour
    window.addEventListener('focus', compter);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();

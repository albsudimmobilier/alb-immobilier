// common.js
document.addEventListener('DOMContentLoaded', function() {
  
  // HEADER HTML
  const headerHTML = `
    <header class="alb-header">
      <div class="header-wrapper">
        <a href="index.html" class="logo-left">
          <img src="LOGO.png" alt="ALB Sud Immobilier" />
        </a>
        <nav class="nav">
          <a href="index.html">Accueil</a>
          <a href="annonces.html">Annonces</a>
          <a href="vitrine-pros.html">Nos pros ALB</a>
          <a href="projets-alb.html">Projets ALB</a>
          <a href="espace-alb.html" class="btn-cta">Mon espace ALB</a>
        </nav>
      </div>
    </header>
  `;

  // FOOTER HTML
  const footerHTML = `
    <footer class="footer">
      <div class="footer-container">
        <div class="footer-col">
          <h5>À propos</h5>
          <p>
            <a onclick="openModal('apropos-modal'); return false;">À propos d'ALB Immobilier</a><br>
            <br>
            <a onclick="openModal('jocelyne-modal'); return false;">Le mot de la fondatrice</a>
          </p>
        </div>
        <div class="footer-col legal">
          <h5>Légal</h5>
          <p>
            <a href="https://albimmobilier.fr/confidentialite">Politique de confidentialité</a><br>
            <a href="https://albimmobilier.fr/cgu">Conditions générales</a>
          </p>
        </div>
        <div class="footer-col">
          <h5>Contact</h5>
          <p><a href="mailto:contact@albimmobilier.fr"><strong>📧 contact@albimmobilier.fr</strong></a></p>
          <p><a href="tel:+33745602805">📱 07 45 60 28 05</a></p>
          <p class="footer-founder">La fondatrice<br><strong>Jocelyne</strong> répond à toutes vos questions</p>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2026 ALB Sud Immobilier • <span class="footer-slogan">à la bien, toujours</span> ✨</p>
      </div>
    </footer>

    <!-- MODALES -->
    <div id="apropos-modal" class="modal">
      <div class="modal-content">
        <span class="modal-close" onclick="closeModal('apropos-modal')">&times;</span>
        <h2>À propos d'ALB Immobilier</h2>
        <p>ALB Immobilier est né d'une conviction simple : un projet immobilier ancien mérite bien plus qu'une simple annonce.</p>
        <p>Derrière chaque maison, chaque appartement ou chaque rénovation, il y a des personnes, des histoires et parfois toute une vie qui s'apprête à changer.</p>
        <p>Acheter, vendre, financer, rénover ou trouver le bon professionnel ne devrait jamais être un parcours semé d'incertitudes.</p>
        <p>ALB Immobilier a été imaginé pour accompagner ces étapes avec une approche plus simple, plus humaine et plus transparente.</p>
        <p>Ce n'est pas seulement un service en ligne. C'est un parcours d'accompagnement où particuliers et professionnels avancent ensemble, dans un climat de confiance, tout en gardant chacun leur liberté de choisir, d'échanger et de décider.</p>
        <p>Parce que la technologie ne doit jamais remplacer la relation humaine. Elle doit simplement la rendre plus fluide.</p>
        <p>Notre ambition est de construire, pas à pas, une nouvelle façon d'aborder l'immobilier ancien. Une façon où chaque projet compte. Où chaque utilisateur est écouté. Et où la confiance retrouve naturellement sa place.</p>
        <p><strong>À la bien, toujours.</strong></p>
        <div class="modal-buttons">
          <a class="modal-btn" onclick="closeModal('apropos-modal'); return false;">Fermer</a>
        </div>
      </div>
    </div>

    <div id="jocelyne-modal" class="modal">
      <div class="modal-content">
        <span class="modal-close" onclick="closeModal('jocelyne-modal')">&times;</span>
        <h2>Le mot de la fondatrice</h2>
        <p>Je m'appelle Jocelyne Rimlinger et je suis la fondatrice d'ALB Sud Immobilier, l'entreprise à l'origine d'ALB Immobilier.</p>
        <p>Si vous prenez le temps de lire ces quelques lignes, c'est probablement que vous partagez, vous aussi, un projet immobilier. Alors, avant toute chose… bienvenue.</p>
        <p>ALB Immobilier est né d'une idée très simple. Je me suis souvent demandé pourquoi un projet aussi important qu'un achat, une vente ou une rénovation pouvait parfois devenir si compliqué.</p>
        <p>Trop d'interlocuteurs. Trop d'informations dispersées. Pas assez de repères. Et surtout, pas assez d'accompagnement.</p>
        <p>J'ai alors décidé de créer ce que j'aurais aimé trouver moi-même : un espace où l'on avance avec plus de clarté, plus de confiance et plus d'humanité.</p>
        <p>Je ne prétends pas réinventer l'immobilier. En revanche, je suis convaincue que l'on peut le vivre autrement. Avec davantage d'écoute. Davantage de simplicité. Et beaucoup de respect pour les personnes qui nous confient leur projet.</p>
        <p>ALB Immobilier grandit chaque jour. Chaque nouvelle fonctionnalité, chaque amélioration et chaque détail sont pensés avec une seule ambition : rendre votre parcours un peu plus simple que la veille.</p>
        <p>Je crois profondément qu'une belle entreprise ne se construit pas uniquement avec des outils. Elle se construit avec des valeurs. La confiance. La transparence. L'engagement. Et le plaisir de faire les choses bien.</p>
        <p>Si aujourd'hui vous choisissez de faire un bout de chemin avec ALB Immobilier, j'espère que vous ressentirez cette philosophie à chaque étape de votre parcours.</p>
        <p>Merci pour votre confiance. Et bienvenue dans cette belle aventure.</p>
        <p style="margin-top: 30px; font-weight: 600;">Jocelyne Rimlinger<br>Fondatrice d'ALB Sud Immobilier</p>
        <div class="modal-buttons">
          <a class="modal-btn" onclick="closeModal('jocelyne-modal'); return false;">Fermer</a>
        </div>
      </div>
    </div>
  `;

  // Injecter le header au début du body
  document.body.insertAdjacentHTML('afterbegin', headerHTML);
  
  // Injecter le footer à la fin du body
  document.body.insertAdjacentHTML('beforeend', footerHTML);
});

// Fonctions des modales
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.classList.remove('active');
  }
}

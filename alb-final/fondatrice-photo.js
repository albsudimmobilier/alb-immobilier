// fondatrice-photo.js — photo de Jocelyne en tête de « Le mot de la fondatrice » (23 nov 2026)
(function () {
  function ajouter() {
    var m = document.getElementById('jocelyne-modal');
    if (!m || m.querySelector('.fondatrice-photo')) return;
    var contenu = m.querySelector('.modal-content');
    var titre = contenu && contenu.querySelector('h2');
    if (!titre) return;
    if (!document.getElementById('fondatrice-photo-style')) {
      var s = document.createElement('style');
      s.id = 'fondatrice-photo-style';
      s.textContent = '.fondatrice-photo{display:block;width:120px;height:120px;border-radius:50%;object-fit:cover;object-position:center 30%;margin:0 auto 14px;border:3px solid #B28E3D;}' +
        '#jocelyne-modal .modal-content h2{text-align:center;}';
      document.head.appendChild(s);
    }
    var img = document.createElement('img');
    img.className = 'fondatrice-photo';
    img.src = 'jocelyne-fondatrice.jpg';
    img.alt = 'Jocelyne Rimlinger, fondatrice d’ALB Sud Immobilier';
    img.width = 120; img.height = 120; img.loading = 'lazy';
    contenu.insertBefore(img, titre);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ajouter); else ajouter();
})();

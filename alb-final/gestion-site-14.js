// ============================================================
// gestion-site-14.js — Photos et logos des pros à valider
//  • Quand un pro envoie une nouvelle photo ou un nouveau logo depuis son espace,
//    elle n'est pas en ligne : l'ancienne reste affichée.
//  • Sur sa fiche (Pros à valider / Pros validés) : l'ancienne et la nouvelle côte à côte,
//    avec « ✓ Mettre en ligne » ou « ✗ Refuser (l'ancienne reste) ».
//  • Jocelyne reçoit aussi un e-mail dès qu'une photo arrive.
// ============================================================
(function () {
  let photosAValider = [];

  function rond(url) {
    return url
      ? '<img src="' + albEchapper(url) + '" alt="" style="width:110px;height:110px;object-fit:cover;border-radius:50%;border:1px solid #E4DCCB;">'
      : '<span style="font-size:2rem;">👤</span>';
  }

  function blocPhoto(proId) {
    const x = photosAValider.find(function (p) { return p.id === proId; });
    if (!x) return '';
    return '<div class="point-a-faire">📷 <strong>Nouvelle photo à valider</strong> (envoyée le ' + dateLisible(x.le) + ') : vérifie qu\'il n\'y a ni téléphone, ni e-mail, ni site dessus.' +
      '<div style="display:flex;gap:18px;align-items:center;margin:10px 0;flex-wrap:wrap;">' +
        '<div style="text-align:center;">' + rond(x.ancienne) + '<div class="aide">En ligne aujourd\'hui</div></div>' +
        '<div style="font-size:1.5rem;">→</div>' +
        '<div style="text-align:center;"><a href="' + albEchapper(x.photo) + '" target="_blank" rel="noopener">' + rond(x.photo) + '</a><div class="aide">Nouvelle (clique pour l\'agrandir)</div></div>' +
      '</div>' +
      '<div class="actions"><button type="button" class="bouton vert" onclick="deciderPhotoPro(\'' + x.id + '\', true, this)">✓ Mettre en ligne</button>' +
      '<button type="button" class="bouton rouge" onclick="deciderPhotoPro(\'' + x.id + '\', false, this)">✗ Refuser (l\'ancienne reste)</button></div></div>';
  }

  // Une zone « photo à valider » juste au-dessus des papiers de chaque pro
  function placerBlocs() {
    document.querySelectorAll('.papiers-pro[data-pro]').forEach(function (papiers) {
      let zone = papiers.previousElementSibling;
      if (!zone || !zone.classList.contains('photo-a-valider')) {
        zone = document.createElement('div');
        zone.className = 'photo-a-valider';
        papiers.parentNode.insertBefore(zone, papiers);
      }
      const html = blocPhoto(papiers.dataset.pro);
      if (zone.dataset.html !== html) { zone.innerHTML = html; zone.dataset.html = html; }
    });
  }

  async function charger() {
    const { data, error } = await albSupabase.rpc('alb_gestion_photos_a_valider');
    if (error) { console.error('[ALB] Photos à valider :', error); return; }
    photosAValider = Array.isArray(data) ? data : [];
    placerBlocs();
  }

  window.deciderPhotoPro = async function (id, valider, bouton) {
    if (!valider && !window.confirm('Refuser cette photo ? L\'ancienne reste en ligne. Pense à prévenir le pro.')) return;
    bouton.disabled = true;
    const { error } = await albSupabase.rpc('alb_gestion_photo_decision', { p_id: id, p_valider: valider });
    bouton.disabled = false;
    if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
    afficherMessage('message-general', 'succes', valider ? 'La nouvelle photo est en ligne sur « Nos pros ALB » ✓' : 'Photo refusée : l\'ancienne reste en ligne.');
    await toutRecharger();
  };

  // À chaque rechargement de Gestion du site, on relit les photos en attente
  const toutRechargerAvantPhotos = toutRecharger;
  toutRecharger = async function () {
    await Promise.all([toutRechargerAvantPhotos(), charger()]);
    placerBlocs();
  };

  // Les listes de pros se redessinent souvent : on remet les blocs à chaque fois
  let prevu = false;
  new MutationObserver(function () {
    if (prevu) return;
    prevu = true;
    requestAnimationFrame(function () { prevu = false; placerBlocs(); });
  }).observe(document.body, { childList: true, subtree: true });

  charger();
})();

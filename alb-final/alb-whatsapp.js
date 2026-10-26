// ============================================================
// WhatsApp partout dans Gestion du site
//  • À côté de chaque bouton « SMS » : un bouton « 💬 WhatsApp »
//    avec le même message déjà écrit.
//  • À côté de chaque numéro de téléphone : un lien « 💬 WhatsApp »
//    (et un bouton « 📱 SMS » là où il n'y en avait pas, comme dans le Carnet).
//  • Dans « Suivi des membres » : « ✓ Envoyé par WhatsApp » pour le garder
//    en mémoire, comme pour un SMS.
// Rien ne part tout seul : WhatsApp s'ouvre avec le message, c'est toi
// qui appuies sur « Envoyer ».
// ============================================================
(function () {
  // 06 12 34 56 78 → 33612345678 (le format que WhatsApp attend)
  function numeroWhatsApp(brut) {
    let n = String(brut || '').replace(/[^0-9+]/g, '');
    if (n.indexOf('+') === 0) n = n.slice(1);
    else if (n.indexOf('00') === 0) n = n.slice(2);
    else if (n.length === 10 && n.charAt(0) === '0') n = '33' + n.slice(1);
    n = n.replace(/\D/g, '');
    return n.length >= 8 ? n : '';
  }
  function lienWhatsApp(num, texte) {
    return 'https://wa.me/' + num + (texte ? '?text=' + encodeURIComponent(texte) : '');
  }
  window.albNumeroWhatsApp = numeroWhatsApp;
  window.albLienWhatsApp = lienWhatsApp;

  // Ouvre WhatsApp avec le texte d'une zone de message (Suivi des membres)
  window.ouvrirWhatsApp = function (id, num) {
    const zone = document.getElementById('texte-' + id);
    const n = numeroWhatsApp(num);
    if (!n) return;
    window.open(lienWhatsApp(n, zone ? zone.value : ''), '_blank', 'noopener');
  };

  // Le texte déjà prêt dans un lien « sms:…?body=… »
  function texteDuSms(href) {
    const i = href.indexOf('body=');
    if (i === -1) return '';
    try { return decodeURIComponent(href.slice(i + 5).split('&')[0]); } catch (e) { return ''; }
  }
  function numeroDuLien(href) { return href.replace(/^(sms|tel):/, '').split('?')[0]; }

  function creerLien(num, texte, classe, libelle) {
    const a = document.createElement('a');
    a.href = lienWhatsApp(num, texte);
    a.target = '_blank';
    a.rel = 'noopener';
    if (classe) a.className = classe;
    a.textContent = libelle;
    a.dataset.albWa = num;
    return a;
  }
  // Déjà un bouton WhatsApp pour ce numéro dans le même bloc ?
  function dejaFait(bloc, num) { return !!bloc.querySelector('[data-alb-wa="' + num + '"]'); }

  function ajouterPartout() {
    // 1. À côté de chaque SMS prêt : WhatsApp avec le même message
    document.querySelectorAll('a[href^="sms:"]:not([data-alb-vu])').forEach(function (a) {
      a.dataset.albVu = '1';
      const num = numeroWhatsApp(numeroDuLien(a.getAttribute('href')));
      if (!num || dejaFait(a.parentNode, num)) return;
      a.insertAdjacentElement('afterend', creerLien(num, texteDuSms(a.getAttribute('href')), a.className, '💬 WhatsApp'));
    });
    // 2. Les boutons « 📱 Ouvrir le SMS » de Suivi des membres
    document.querySelectorAll('button[onclick^="ouvrirSms("]:not([data-alb-vu])').forEach(function (b) {
      b.dataset.albVu = '1';
      const m = b.getAttribute('onclick').match(/ouvrirSms\('([^']+)',\s*'([^']*)'\)/);
      if (!m) return;
      const num = numeroWhatsApp(m[2]);
      if (!num || dejaFait(b.parentNode, num)) return;
      const w = document.createElement('button');
      w.type = 'button';
      w.className = b.className;
      w.textContent = '💬 Ouvrir WhatsApp';
      w.dataset.albWa = num;
      w.onclick = function () { window.ouvrirWhatsApp(m[1], m[2]); };
      b.insertAdjacentElement('afterend', w);
    });
    // 3. « ✓ C'est fait, je l'ai envoyé » (SMS) → aussi « ✓ Envoyé par WhatsApp »
    document.querySelectorAll('button[onclick^="noterContact("][onclick*="\'sms\'"]:not([data-alb-vu])').forEach(function (b) {
      b.dataset.albVu = '1';
      if (typeof window.noterContact !== 'function') return;
      const m = b.getAttribute('onclick').match(/noterContact\('([^']+)'/);
      if (!m) return;
      const w = document.createElement('button');
      w.type = 'button';
      w.className = b.className;
      w.textContent = '✓ Envoyé par WhatsApp';
      w.onclick = function () { window.noterContact(m[1], 'whatsapp', w); };
      b.insertAdjacentElement('afterend', w);
    });
    // 4. Chaque numéro de téléphone : WhatsApp (et SMS sur les boutons « Appeler » qui n'en ont pas)
    document.querySelectorAll('a[href^="tel:"]:not([data-alb-vu])').forEach(function (a) {
      a.dataset.albVu = '1';
      const brut = numeroDuLien(a.getAttribute('href'));
      const num = numeroWhatsApp(brut);
      if (!num || dejaFait(a.parentNode, num)) return;
      const estBouton = /\bbouton/.test(a.className);
      // Un numéro écrit dans une fiche qui a déjà ses boutons « Appeler » : les boutons suffisent
      const fiche = a.closest('.carte, .contact, .visite');
      if (!estBouton && fiche && fiche.querySelector('a[href^="tel:"][class*="bouton"]')) return;
      let apres = a;
      if (estBouton && !a.parentNode.querySelector('a[href^="sms:"]')) {
        const s = document.createElement('a');
        s.href = 'sms:' + brut;
        s.className = a.className;
        s.textContent = '📱 SMS';
        s.dataset.albVu = '1';
        a.insertAdjacentElement('afterend', s);
        apres = s;
      }
      const w = creerLien(num, '', estBouton ? a.className : '', '💬 WhatsApp');
      if (!estBouton) w.style.marginLeft = '8px';
      apres.insertAdjacentElement('afterend', w);
    });
  }

  // Les listes se redessinent souvent : on repasse après chaque changement
  let prevu = false;
  function plusTard() {
    if (prevu) return;
    prevu = true;
    requestAnimationFrame(function () { prevu = false; ajouterPartout(); });
  }
  function demarrer() {
    ajouterPartout();
    new MutationObserver(plusTard).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();

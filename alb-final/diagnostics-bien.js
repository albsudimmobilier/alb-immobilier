/* Diagnostics d'un bien : envoi de fichiers par le vendeur (PDF ou photo).
   Les fichiers restent privés : seuls le vendeur du bien et Jocelyne les voient.
   Utilisé par les deux questionnaires (particulier et pro).
   Usage : albDiagnostics.html()  → bloc à insérer dans le questionnaire
           albDiagnostics.brancher(racine, annonceId) → à appeler quand la fenêtre est ouverte */
(function () {
  'use strict';

  const BUCKET = 'diagnostics-biens';
  const TAILLE_MAX = 52428800; // 50 Mo
  const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  const EXT = /\.(pdf|jpe?g|png|webp|heic|heif)$/i;

  const TEXTE_TITRE = 'Vos diagnostics, si vous les avez';
  const TEXTE_AIDE = 'Si vos diagnostics sont déjà faits (surtout le DPE), vous pouvez nous les envoyer ici. ' +
    'Cela nous fait gagner du temps pour préparer votre annonce, et vous évite de recopier les chiffres. ' +
    'Ils restent privés : seuls vous et Jocelyne les voyez, et nous ne les montrons à personne sans votre accord. ' +
    'Pas encore prêts ? Aucun souci, vous pourrez les ajouter plus tard.';
  const MSG_LOURD = 'Ce fichier est trop lourd. Envoyez-le-nous par e-mail ou prenez-le en photo.';
  const MSG_TYPE = 'Ce type de fichier n’est pas pris en compte. Envoyez un PDF ou une photo.';
  const MSG_ECHEC = 'Oups, cela n’a pas marché. Réessayez dans un instant ou appelez Jocelyne au 07 45 60 28 05.';
  const MSG_TROP = 'Vous avez déjà envoyé beaucoup de fichiers. Appelez Jocelyne au 07 45 60 28 05 pour en ajouter d’autres.';

  function e(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function poids(n) {
    n = Number(n) || 0;
    if (n >= 1048576) return (n / 1048576).toFixed(1).replace('.', ',') + ' Mo';
    return Math.max(1, Math.round(n / 1024)) + ' Ko';
  }

  function nomSur(nom) {
    const base = String(nom || 'fichier').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+/, '');
    return (base || 'fichier').slice(-80);
  }

  function styles() {
    if (document.getElementById('alb-diag-styles')) return;
    const s = document.createElement('style');
    s.id = 'alb-diag-styles';
    s.textContent =
      '.alb-diag{border:1px solid #e3d9f0;border-radius:12px;padding:14px 16px;margin:12px 0;background:#faf7fd}' +
      '.alb-diag-titre{font-weight:700;margin:0 0 6px}' +
      '.alb-diag-aide{margin:0 0 10px;font-size:.92em;line-height:1.5}' +
      '.alb-diag-liste{list-style:none;margin:8px 0;padding:0}' +
      '.alb-diag-liste li{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:.92em}' +
      '.alb-diag-nom{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.alb-diag-retirer{background:none;border:0;color:#7a3d9a;cursor:pointer;text-decoration:underline;font:inherit}' +
      '.alb-diag-msg{margin:8px 0 0;font-size:.9em;min-height:1.2em}' +
      '.alb-diag-msg.erreur{color:#b3261e}' +
      '.alb-diag-ajout{display:inline-block;cursor:pointer}' +
      '.alb-diag-ajout input{position:absolute;opacity:0;width:1px;height:1px}' +
      '.alb-diag-petit{font-size:.82em;opacity:.75;margin-left:8px}';
    document.head.appendChild(s);
  }

  function html() {
    return '<div class="alb-diag" data-alb-diag>' +
      '<p class="alb-diag-titre">' + e(TEXTE_TITRE) + '</p>' +
      '<p class="alb-diag-aide">' + e(TEXTE_AIDE) + '</p>' +
      '<ul class="alb-diag-liste" data-diag-liste></ul>' +
      '<label class="bouton alb-diag-ajout">Ajouter un fichier' +
      '<input type="file" data-diag-fichier multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/*"></label>' +
      '<span class="alb-diag-petit">PDF ou photo</span>' +
      '<p class="alb-diag-msg" data-diag-msg role="status"></p>' +
      '</div>';
  }

  function messageErreur(err) {
    const t = String((err && (err.message || err)) || '');
    if (/FICHIER_TROP_LOURD|Payload too large|exceeded the maximum/i.test(t)) return MSG_LOURD;
    if (/TROP_DE_FICHIERS/.test(t)) return MSG_TROP;
    return MSG_ECHEC;
  }

  function brancher(racine, annonceId) {
    styles();
    const zone = racine && racine.querySelector('[data-alb-diag]');
    if (!zone || !annonceId || zone.dataset.branche) return;
    zone.dataset.branche = '1';
    const liste = zone.querySelector('[data-diag-liste]');
    const msg = zone.querySelector('[data-diag-msg]');
    const champ = zone.querySelector('[data-diag-fichier]');
    let monId = null;

    function dire(texte, erreur) {
      msg.textContent = texte || '';
      msg.className = 'alb-diag-msg' + (erreur ? ' erreur' : '');
    }

    function dessiner(fichiers) {
      liste.innerHTML = fichiers.map(function (f) {
        return '<li><span class="alb-diag-nom">📎 ' + e(f.nom_fichier) + ' <small>(' + e(poids(f.taille)) + ')</small></span>' +
          '<button type="button" class="alb-diag-retirer" data-diag-retirer="' + e(f.id) + '">Retirer</button></li>';
      }).join('');
    }

    async function actualiser() {
      const r = await albSupabase.rpc('alb_diagnostics_lister', { p_annonce_id: annonceId });
      if (r.error) throw r.error;
      dessiner(r.data || []);
    }

    async function identifiant() {
      if (monId) return monId;
      const s = await albSupabase.auth.getSession();
      monId = s && s.data && s.data.session && s.data.session.user ? s.data.session.user.id : null;
      if (!monId) throw new Error('PAS_CONNECTE');
      return monId;
    }

    async function envoyer(fichier) {
      if (fichier.size > TAILLE_MAX) { dire(MSG_LOURD, true); return false; }
      const typeOk = TYPES.indexOf(fichier.type) !== -1 || (!fichier.type && EXT.test(fichier.name));
      if (!typeOk && !EXT.test(fichier.name)) { dire(MSG_TYPE, true); return false; }
      const uid = await identifiant();
      const chemin = uid + '/' + annonceId + '/' + Date.now() + '-' + nomSur(fichier.name);
      const type = fichier.type || (/\.pdf$/i.test(fichier.name) ? 'application/pdf' : 'image/jpeg');
      const up = await albSupabase.storage.from(BUCKET).upload(chemin, fichier, { contentType: type, upsert: false });
      if (up.error) throw up.error;
      const r = await albSupabase.rpc('alb_diagnostics_enregistrer', {
        p_annonce_id: annonceId, p_nom: fichier.name, p_chemin: chemin, p_type: type, p_taille: fichier.size
      });
      if (r.error) {
        // le fichier n'a pas été enregistré : on le retire pour ne rien laisser traîner
        await albSupabase.storage.from(BUCKET).remove([chemin]);
        throw r.error;
      }
      return true;
    }

    // Le choix d'un fichier ne doit pas déclencher l'enregistrement automatique du questionnaire
    zone.addEventListener('change', function (ev) { ev.stopPropagation(); });
    zone.addEventListener('input', function (ev) { ev.stopPropagation(); });

    champ.addEventListener('change', async function () {
      const fichiers = Array.prototype.slice.call(champ.files || []);
      champ.value = '';
      if (!fichiers.length) return;
      dire('Envoi en cours…', false);
      let envoyes = 0;
      try {
        for (let i = 0; i < fichiers.length; i++) {
          if (await envoyer(fichiers[i])) envoyes++; else return;
        }
        await actualiser();
        dire(envoyes > 1 ? 'Vos fichiers sont bien arrivés. Merci !' : 'Votre fichier est bien arrivé. Merci !', false);
      } catch (err) {
        console.warn('[ALB DEBUG] envoi diagnostic', err);
        try { await actualiser(); } catch (x) { /* rien */ }
        dire(messageErreur(err), true);
      }
    });

    liste.addEventListener('click', async function (ev) {
      const b = ev.target.closest('[data-diag-retirer]');
      if (!b) return;
      b.disabled = true;
      try {
        const r = await albSupabase.rpc('alb_diagnostics_retirer', { p_id: b.getAttribute('data-diag-retirer') });
        if (r.error) throw r.error;
        await albSupabase.storage.from(BUCKET).remove([r.data]);
        await actualiser();
        dire('Fichier retiré.', false);
      } catch (err) {
        console.warn('[ALB DEBUG] retrait diagnostic', err);
        b.disabled = false;
        dire(MSG_ECHEC, true);
      }
    });

    actualiser().catch(function (err) { console.warn('[ALB DEBUG] liste diagnostics', err); });
  }

  globalThis.albDiagnostics = { html: html, brancher: brancher, nomSur: nomSur, poids: poids };
})();

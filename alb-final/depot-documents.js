// ============================================================
// depot-documents.js — Dépôt des documents chez les courtiers (23 nov 2026)
// • Courtier (Mon espace ALB → Mon profil) : la liste des documents qu'il demande
//   et un mot pour ses clients (pas de lien : il crée lui-même l'accès à son logiciel). Jamais affichés sur « Nos pros ALB ».
// • Particulier (Mes projets) : dès qu'un courtier a accepté sa demande, il voit
//   « Préparez votre dossier » avec la liste, les explications et le lien.
// ALB Sud Immobilier ne voit jamais les documents : ils vont chez le courtier.
// ============================================================
(function () {
  const e = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    const lignes = function (t) { return String(t || '').split(/\n|;/).map(function (x) { return x.replace(/^[\s\-•*]+/, '').trim(); }).filter(Boolean); };

  function styles() {
    if (document.getElementById('depot-styles')) return;
    const s = document.createElement('style');
    s.id = 'depot-styles';
    s.textContent = '.depot-bloc{border:1px solid #E8E6E1;border-radius:10px;padding:14px;margin-top:14px;font-size:.92rem;background:#fff;}' +
      '.depot-titre{font-weight:700;color:#4B1A3E;margin-bottom:6px;}' +
      '.depot-bloc label{display:block;font-weight:600;margin:10px 0 4px;color:#4A4A47;}' +
      '.depot-bloc input,.depot-bloc textarea{width:100%;font:inherit;padding:9px 10px;border:1px solid #D9D5CE;border-radius:8px;}' +
      '.depot-aide{font-size:.82rem;color:#7a7a75;margin-top:4px;}' +
      '.depot-particulier{border:1px solid #E2D6E8;background:#FAF6FB;border-radius:10px;padding:12px 14px;margin:10px 0 4px;font-size:.9rem;}' +
      '.depot-particulier ul{margin:6px 0 8px 20px;}' +
      '.depot-btn{display:inline-block;background:#B28E3D;color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:8px;margin-top:6px;border:none;cursor:pointer;font:inherit;}' +
      '.depot-btn:hover{background:#5A3A6A;}' +
      '.depot-msg{margin-top:8px;font-size:.85rem;}';
    document.head.appendChild(s);
  }

  // ---------- Côté courtier ----------
  let courtierEnCours = false, courtierNon = false;
  async function blocCourtier() {
    const profil = document.getElementById('profil-pro');
    if (!profil || !profil.firstChild || courtierNon || courtierEnCours || document.getElementById('depot-courtier')) return;
    courtierEnCours = true;
    const { data, error } = await albSupabase.rpc('alb_pro_mon_depot');
    courtierEnCours = false;
    if (!error && data && !data.est_courtier) courtierNon = true;
    if (error || !data || !data.est_courtier) return;
    styles();
    const div = document.createElement('div');
    div.id = 'depot-courtier';
    div.className = 'depot-bloc';
    div.innerHTML =
      '<p class="depot-titre">📂 Les documents à préparer par vos clients</p>' +
      '<p class="depot-aide">Quand vous acceptez une demande, le particulier voit cette liste dans son espace ALB pour préparer ses documents avant votre appel. C\'est vous qui lui créez ensuite son accès à votre logiciel. Cette liste n\'est jamais affichée sur « Nos pros ALB ».</p>' +
      '<label for="depot-documents">Les documents que vous demandez <span style="font-weight:400;">(un par ligne)</span></label>' +
      '<textarea id="depot-documents" rows="5" maxlength="1500" placeholder="3 derniers bulletins de salaire&#10;Dernier avis d\'imposition&#10;3 derniers relevés de compte&#10;Pièce d\'identité">' + e(data.documents) + '</textarea>' +
      '<label for="depot-explication">Un mot pour vos clients <span style="font-weight:400;">(facultatif)</span></label>' +
      '<textarea id="depot-explication" rows="3" maxlength="1500" placeholder="Ex. : des documents récents et lisibles (PDF ou photos nettes) me permettront d\'étudier votre dossier plus vite.">' + e(data.explication) + '</textarea>' +
      '<button type="button" class="depot-btn" id="depot-enregistrer">💾 Enregistrer</button>' +
      '<div class="depot-msg" id="depot-msg"></div>';
    profil.parentNode.insertBefore(div, profil.nextSibling);
    document.getElementById('depot-enregistrer').addEventListener('click', async function () {
      const msg = document.getElementById('depot-msg');
      this.disabled = true;
      const r = await albSupabase.rpc('alb_pro_depot_enregistrer', { p_lien: null, p_explication: document.getElementById('depot-explication').value, p_documents: document.getElementById('depot-documents').value });
      this.disabled = false;
      if (r.error) { console.log('[ALB DEBUG] dépôt :', r.error); msg.style.color = '#8A2D2D'; msg.textContent = 'L\'enregistrement n\'a pas marché. Réessayez dans un instant.'; return; }
      msg.style.color = '#2E6B34'; msg.textContent = 'C\'est enregistré ✅';
    });
  }

  // ---------- Côté particulier ----------
  let depots = null, depotsEnCours = false;
  async function blocsParticulier() {
    const zone = document.getElementById('mes-projets');
    if (!zone || !zone.querySelector('.pj-carte')) return;
    if (depots === null) {
      if (depotsEnCours) return;
      depotsEnCours = true;
      const { data, error } = await albSupabase.rpc('alb_mes_depots');
      depots = error ? [] : (data || []);
      depotsEnCours = false;
    }
    if (!depots.length) return;
    styles();
    depots.forEach(function (d) {
      const carte = document.getElementById('projet-' + d.projet_id);
      if (!carte || carte.querySelector('[data-depot="' + d.pro_id + '"]')) return;
      const docs = lignes(d.documents);
      const div = document.createElement('div');
      div.className = 'depot-particulier';
      div.setAttribute('data-depot', d.pro_id);
      div.innerHTML = '<strong>📂 Préparez vos documents pour votre courtier</strong>' +
        '<p style="margin-top:6px;">Votre courtier va vous contacter et vous créer un accès à son espace sécurisé pour y déposer vos documents. Pour gagner du temps, vous pouvez déjà les rassembler :</p>' +
        '<ul>' + docs.map(function (x) { return '<li>' + e(x) + '</li>'; }).join('') + '</ul>' +
        (d.explication ? '<p><em>Le mot de votre courtier :</em> ' + e(d.explication) + '</p>' : '') +
        '<p class="depot-aide">ALB Sud Immobilier n\'a pas accès à vos documents : vous les transmettez directement à votre courtier.</p>';
      carte.appendChild(div);
    });
  }

  function surveiller() {
    const observer = new MutationObserver(function () { blocCourtier(); blocsParticulier(); });
    observer.observe(document.body, { childList: true, subtree: true });
    blocCourtier(); blocsParticulier();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', surveiller); else surveiller();
})();

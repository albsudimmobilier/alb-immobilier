// ============================================================
// depot-documents.js — Dépôt des documents chez les courtiers (23 nov 2026)
// • Courtier (Mon espace ALB → Mon profil) : son lien de dépôt, ses explications
//   et la liste des documents qu'il demande. Jamais affichés sur « Nos pros ALB ».
// • Particulier (Mes projets) : dès qu'un courtier a accepté sa demande, il voit
//   « Préparez votre dossier » avec la liste, les explications et le lien.
// ALB Sud Immobilier ne voit jamais les documents : ils vont chez le courtier.
// ============================================================
(function () {
  const e = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const lienSur = function (u) { return /^https:\/\//i.test(String(u || '')) ? String(u) : ''; };
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
      '<p class="depot-titre">📂 Dépôt des documents de vos clients</p>' +
      '<p class="depot-aide">Quand vous acceptez une demande, le particulier voit ces informations dans son espace ALB pour préparer son dossier. Elles ne sont jamais affichées sur « Nos pros ALB ». ALB Sud Immobilier n\'a pas accès aux documents : ils arrivent directement chez vous.</p>' +
      '<label for="depot-lien">Lien de votre espace de dépôt</label>' +
      '<input id="depot-lien" type="url" inputmode="url" maxlength="500" placeholder="https://…" value="' + e(data.lien) + '">' +
      '<label for="depot-documents">Les documents que vous demandez <span style="font-weight:400;">(un par ligne)</span></label>' +
      '<textarea id="depot-documents" rows="5" maxlength="1500" placeholder="3 derniers bulletins de salaire&#10;Dernier avis d\'imposition&#10;3 derniers relevés de compte&#10;Pièce d\'identité">' + e(data.documents) + '</textarea>' +
      '<label for="depot-explication">Vos explications pour vos clients</label>' +
      '<textarea id="depot-explication" rows="3" maxlength="1500" placeholder="Ex. : cliquez sur le lien, créez votre accès avec votre e-mail, puis déposez vos documents.">' + e(data.explication) + '</textarea>' +
      '<button type="button" class="depot-btn" id="depot-enregistrer">💾 Enregistrer</button>' +
      '<div class="depot-msg" id="depot-msg"></div>';
    profil.parentNode.insertBefore(div, profil.nextSibling);
    document.getElementById('depot-enregistrer').addEventListener('click', async function () {
      const msg = document.getElementById('depot-msg');
      const lien = document.getElementById('depot-lien').value.trim();
      if (lien && !lienSur(lien)) { msg.style.color = '#8A2D2D'; msg.textContent = 'Le lien doit commencer par https://'; return; }
      this.disabled = true;
      const r = await albSupabase.rpc('alb_pro_depot_enregistrer', { p_lien: lien, p_explication: document.getElementById('depot-explication').value, p_documents: document.getElementById('depot-documents').value });
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
      const lien = lienSur(d.lien);
      const div = document.createElement('div');
      div.className = 'depot-particulier';
      div.setAttribute('data-depot', d.pro_id);
      div.innerHTML = '<strong>📂 Préparez votre dossier pour votre courtier</strong>' +
        (docs.length ? '<p style="margin-top:6px;">Les documents demandés :</p><ul>' + docs.map(function (x) { return '<li>' + e(x) + '</li>'; }).join('') + '</ul>' : '') +
        (d.explication ? '<p><em>Comment faire :</em> ' + e(d.explication) + '</p>' : '') +
        (lien ? '<a class="depot-btn" href="' + e(lien) + '" target="_blank" rel="noopener">Déposer mes documents →</a>' : '') +
        '<p class="depot-aide">Ce lien vous mène vers l\'espace sécurisé de votre courtier. ALB Sud Immobilier n\'a pas accès à vos documents.</p>';
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

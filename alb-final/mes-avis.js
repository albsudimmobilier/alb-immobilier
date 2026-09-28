// ============================================================
// mes-avis.js — la rubrique « ⭐ Mes avis » de Mon espace ALB
//  • les avis que j'ai donnés sur des pros (et où ils en sont)
//  • les pros avec qui j'ai échangé : je peux donner mon avis
//  • si je suis pro : les avis publiés sur moi
// Chaque avis est relu par ALB Sud Immobilier avant d'être publié.
// Besoin de : alb-connexion.js (albSupabase, albEchapper)
// ============================================================
(function () {
  'use strict';

  const e = function (t) { return albEchapper(t); };
  function el(id) { return document.getElementById(id); }
  function dateLisible(d) { return d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; }
  function etoiles(note) {
    const n = Math.max(0, Math.min(5, Math.round(Number(note) || 0)));
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }
  function lienAvis(proId) { return 'vitrine-pros.html?avis=' + encodeURIComponent(proId); }

  const STATUTS = {
    en_attente: ['⏳ En cours de relecture', 'av-attente'],
    publie: ['✅ Publié sur sa fiche', 'av-publie'],
    refuse: ['Non publié', 'av-refuse']
  };

  function styles() {
    if (el('av-styles')) return;
    const s = document.createElement('style');
    s.id = 'av-styles';
    s.textContent = [
      '.av-bloc{margin-top:14px;}',
      '.av-bloc h3{font-size:1.02rem;margin-bottom:8px;}',
      '.av-carte{border:1px solid #E8E6E1;border-radius:10px;padding:12px 14px;margin-top:10px;background:#FBF8F3;}',
      '.av-tete{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;}',
      '.av-nom{font-weight:700;color:#2a2a28;}',
      '.av-etoiles{color:#B28E3D;letter-spacing:1px;}',
      '.av-texte{margin-top:6px;font-size:.92rem;white-space:pre-line;overflow-wrap:anywhere;}',
      '.av-bas{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin-top:8px;font-size:.8rem;color:#7a7a75;}',
      '.av-statut{display:inline-block;font-size:.75rem;font-weight:700;padding:3px 10px;border-radius:12px;}',
      '.av-attente{background:#FBF3E4;color:#8A6A1F;}',
      '.av-publie{background:#EEF6EE;color:#2E6B34;}',
      '.av-refuse{background:#F0EEE9;color:#6a6a65;}',
      '.av-lien{color:#5A3A6A;font-weight:600;font-size:.85rem;}',
      '.av-a-donner{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;border:1px dashed #B28E3D;border-radius:10px;padding:10px 14px;margin-top:8px;background:#FFFBF3;}',
      '.av-a-donner a{background:#B28E3D;color:#fff;text-decoration:none;font-weight:600;font-size:.85rem;padding:8px 14px;border-radius:6px;}',
      '.av-a-donner a:hover{background:#5A3A6A;}',
      '.av-petit{font-size:.85rem;color:#7a7a75;margin-top:6px;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function dessiner(d) {
    const zone = el('mes-avis');
    if (!zone) return;
    const donnes = d.donnes || [], aDonner = d.a_donner || [], recus = d.recus || [];
    let html = '';

    // Les pros sur qui je peux donner mon avis
    if (aDonner.length) {
      html += '<div class="av-bloc"><h3>✍️ Vous avez échangé avec eux : votre avis compte</h3>' +
        aDonner.map(function (p) {
          return '<div class="av-a-donner"><span class="av-nom">' + e(p.pro) + '</span>' +
            '<a href="' + lienAvis(p.pro_id) + '">⭐ Donner mon avis</a></div>';
        }).join('') + '</div>';
    }

    // Les avis que j'ai donnés
    if (donnes.length) {
      html += '<div class="av-bloc"><h3>📝 Les avis que j\'ai donnés</h3>' +
        donnes.map(function (a) {
          const statut = STATUTS[a.statut] || ['', ''];
          return '<div class="av-carte"><div class="av-tete"><span class="av-nom">' + e(a.pro) + '</span>' +
            '<span class="av-etoiles" aria-label="' + e(a.note) + ' sur 5">' + etoiles(a.note) + '</span></div>' +
            '<p class="av-texte">« ' + e(a.texte) + ' »</p>' +
            '<div class="av-bas"><span class="av-statut ' + statut[1] + '">' + statut[0] + '</span>' +
              '<span>' + e(dateLisible(a.le)) + '</span>' +
              '<a class="av-lien" href="' + lienAvis(a.pro_id) + '">✏️ Modifier</a></div></div>';
        }).join('') + '</div>';
    }

    // Pro : les avis publiés sur moi
    if (d.recus !== null && d.recus !== undefined) {
      const enRelecture = Number(d.recus_en_relecture) || 0;
      html += '<div class="av-bloc"><h3>🌟 Les avis sur moi</h3>' +
        (recus.length
          ? recus.map(function (a) {
              return '<div class="av-carte"><div class="av-tete"><span class="av-etoiles" aria-label="' + e(a.note) + ' sur 5">' + etoiles(a.note) + '</span></div>' +
                '<p class="av-texte">« ' + e(a.texte) + ' »</p>' +
                '<div class="av-bas"><span>' + e(a.auteur) + ' · ' + e(dateLisible(a.le)) + '</span></div></div>';
            }).join('')
          : '<p class="av-petit">Pas encore d\'avis publié sur votre fiche.</p>') +
        (enRelecture ? '<p class="av-petit">' + enRelecture + ' nouvel' + (enRelecture > 1 ? 's avis sont' : ' avis est') + ' en cours de relecture par ALB Sud Immobilier.</p>' : '') +
        '<p class="av-petit">Seules les personnes qui ont échangé avec vous via ALB peuvent donner leur avis. Chaque avis est relu avant d\'être publié.</p>' +
        '</div>';
    }

    zone.innerHTML = html;
    return html !== '';
  }

  // Renvoie true s'il y a quelque chose à montrer (sinon la rubrique reste cachée)
  window.albMesAvis = async function (profil) {
    if (!profil || !profil.id) return false;
    styles();
    const { data, error } = await albSupabase.rpc('alb_mes_avis');
    if (error) { console.error('[ALB DEBUG] Mes avis :', error); return false; }
    return dessiner(data || {});
  };
})();

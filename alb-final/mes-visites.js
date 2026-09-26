// ============================================================
// mes-visites.js — la rubrique « 🔎 Mes recherches et mes visites »
// de Mon espace ALB, côté acheteur : ses demandes de visite, leur
// suite (acceptée, autre moment proposé…) et les coordonnées une
// fois la visite confirmée.
// Besoin de : alb-connexion.js (albSupabase, albEchapper, albAppelerGuichet)
// ============================================================
(function () {
  'use strict';

  const e = function (t) { return albEchapper(t); };
  let demandes = [];

  const STATUTS = {
    en_attente: { texte: '⏳ En attente de réponse', classe: 'mv-attente' },
    autre_moment: { texte: '📅 Un autre moment vous est proposé', classe: 'mv-proposition' },
    acceptee: { texte: '✅ Visite confirmée', classe: 'mv-ok' },
    refusee: { texte: 'Pas de suite pour le moment', classe: 'mv-fin' },
    annulee: { texte: 'Annulée', classe: 'mv-fin' },
    effectuee: { texte: 'Visite faite', classe: 'mv-fin' },
  };

  function el(id) { return document.getElementById(id); }
  function euros(n) { const v = Number(n); return isFinite(v) ? Math.round(v).toLocaleString('fr-FR') + ' €' : ''; }
  function aujourdhui() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function moment(jour, heure) {
    if (!jour || !heure) return '';
    const d = new Date(jour + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' à ' + String(heure).replace(':', 'h');
  }
  function photoSure(url) { return /^https:\/\//.test(String(url || '')) ? String(url) : ''; }
  function message(id, type, texte) { const m = el(id); if (!m) return; m.className = 'message visible ' + type; m.textContent = texte; }

  async function charger() {
    const { data, error } = await albSupabase.rpc('alb_mes_demandes_envoyees');
    if (error) { console.error('[ALB DEBUG] mes visites :', error); throw error; }
    demandes = data || [];
  }

  function carte(d) {
    const passee = d.statut === 'acceptee' && d.creneau_date && d.creneau_date < aujourdhui();
    const st = passee ? { texte: 'Visite passée', classe: 'mv-fin' } : (STATUTS[d.statut] || { texte: d.statut, classe: '' });
    const photo = photoSure(d.photo);
    let corps = '';

    if (d.type_vente === 'accompagnee' && ['en_attente', 'acceptee'].indexOf(d.statut) !== -1) {
      corps += '<p>Le professionnel' + (d.agence_nom ? ' (' + e(d.agence_nom) + ')' : '') + ' a reçu votre demande et vous appelle pour fixer la date de la visite.</p>';
    } else if (d.statut === 'en_attente') {
      corps += d.creneau_date
        ? '<p>Vous avez demandé le <strong>' + e(moment(d.creneau_date, d.creneau_heure)) + '</strong>. Le propriétaire va vous répondre.</p>'
        : '<p>Le propriétaire va vous proposer un moment.</p>';
    } else if (d.statut === 'autre_moment') {
      corps += '<p>Le propriétaire vous propose le <strong>' + e(moment(d.nouveau_creneau_date, d.nouveau_creneau_heure)) + '</strong>.</p>';
      if (d.reponse_vendeur) corps += '<p class="mv-mot">💬 ' + e(d.reponse_vendeur) + '</p>';
    } else if (d.statut === 'acceptee') {
      corps += '<div class="mv-infos">' +
        '<div>📅 <strong>' + e(moment(d.creneau_date, d.creneau_heure)) + '</strong></div>' +
        (d.adresse ? '<div>📍 ' + e(d.adresse) + '</div>' : '') +
        (d.vendeur_prenom ? '<div>👤 ' + e(d.vendeur_prenom) + (d.vendeur_telephone ? ' · 📱 <a href="tel:' + e(String(d.vendeur_telephone).replace(/[^0-9+]/g, '')) + '">' + e(d.vendeur_telephone) + '</a>' : '') + '</div>' : '') +
      '</div>';
    } else if (d.statut === 'refusee') {
      corps += '<p>Le propriétaire ne peut pas donner suite pour le moment. D’autres biens vous attendent !</p>';
    }
    corps += '<p class="mv-budget">Budget estimé : <strong>' + e(euros(d.budget_estime)) + '</strong>' + (d.dans_budget ? ' ✅' : '') +
      (d.courtier_souhaite ? ' · Rappel courtier demandé' : '') + '</p>';

    let boutons = '';
    if (!passee) {
      if (d.statut === 'autre_moment') {
        boutons += '<button type="button" class="mv-btn mv-btn-oui" data-action="accepter" data-demande="' + e(d.id) + '">✅ Ça me va</button>';
        boutons += '<button type="button" class="mv-btn" data-action="annuler" data-demande="' + e(d.id) + '">Ça ne me convient pas</button>';
      } else if (d.statut === 'en_attente' || d.statut === 'acceptee') {
        boutons += '<button type="button" class="mv-btn" data-action="annuler" data-demande="' + e(d.id) + '">' + (d.statut === 'acceptee' ? 'Annuler la visite' : 'Annuler ma demande') + '</button>';
      }
    }

    return '<div class="mv-carte">' +
      '<a class="mv-tete" href="annonce-detail.html?id=' + encodeURIComponent(d.annonce_id) + '">' +
        (photo ? '<img src="' + e(photo) + '" alt="" loading="lazy">' : '<span class="mv-sans-photo">🏡</span>') +
        '<span><span class="mv-statut ' + st.classe + '">' + e(st.texte) + '</span>' +
        '<span class="mv-titre">' + e(d.titre) + '</span>' +
        '<span class="mv-prix">' + e(euros(d.prix)) + ' · ' + e(d.ville) + '</span></span>' +
      '</a>' + corps +
      '<div class="message" id="mv-msg-' + e(d.id) + '"></div>' +
      (boutons ? '<div class="mv-boutons">' + boutons + '</div>' : '') +
    '</div>';
  }

  function dessiner() {
    const zone = el('mes-visites');
    if (!zone) return;
    let html = '<a class="bouton mv-chercher" href="annonces.html">🔎 Voir les annonces</a>';
    if (!demandes.length) {
      html += '<p class="mv-vide">Pas encore de demande de visite. Trouvez un bien qui vous plaît, puis cliquez sur « Demander une visite » : le simulateur budget vous guide.</p>';
    } else {
      html += demandes.map(carte).join('');
    }
    zone.innerHTML = html;
  }

  async function agir(bouton) {
    const id = bouton.dataset.demande, action = bouton.dataset.action;
    if (action === 'annuler' && !window.confirm('Vous confirmez ? Le vendeur sera prévenu.')) return;
    bouton.disabled = true;
    const r = await albAppelerGuichet({ action: 'reponse_visite', demande_id: id, decision: action });
    if (!r.ok) {
      bouton.disabled = false;
      const textes = { CRENEAU_PASSE: 'Ce moment est déjà passé.', DECISION_IMPOSSIBLE: 'Cette demande a déjà changé : rechargez la page.' };
      message('mv-msg-' + id, 'erreur', textes[r.code] || albMessageErreur(r.code));
      return;
    }
    try { await charger(); } catch (ex) { /* on garde l'affichage */ }
    dessiner();
    message('mv-msg-' + id, 'succes', action === 'accepter'
      ? 'Visite confirmée ✅ Vous recevez l’adresse et les coordonnées par e-mail.'
      : 'C’est noté, le vendeur est prévenu.');
  }

  function styles() {
    if (el('mv-styles')) return;
    const s = document.createElement('style');
    s.id = 'mv-styles';
    s.textContent = [
      '.mv-chercher{margin:14px 0 6px;}',
      '.mv-vide{margin-top:12px;font-size:.93rem;}',
      '.mv-carte{border:1px solid #E8E6E1;border-radius:10px;padding:14px;margin-top:14px;font-size:.92rem;}',
      '.mv-carte p{margin-top:8px;}',
      '.mv-carte a{color:#5A3A6A;}',
      '.mv-tete{display:flex;gap:12px;align-items:center;text-decoration:none;color:inherit;}',
      '.mv-tete img,.mv-sans-photo{width:84px;height:64px;border-radius:6px;object-fit:cover;flex-shrink:0;background:#EFEAE3;display:flex;align-items:center;justify-content:center;font-size:1.6rem;}',
      '.mv-tete > span:last-child{display:flex;flex-direction:column;min-width:0;}',
      '.mv-statut{display:inline-block;align-self:flex-start;font-size:.78rem;font-weight:700;padding:3px 10px;border-radius:20px;margin-bottom:4px;}',
      '.mv-attente{background:#FBF3E4;color:#8A6420;}',
      '.mv-proposition{background:#F4EEF6;color:#5A3A6A;}',
      '.mv-ok{background:#EEF6EE;color:#2E6B34;}',
      '.mv-fin{background:#F0EFEC;color:#5f5f5a;}',
      '.mv-titre{font-weight:700;color:#2a2a28;line-height:1.3;overflow-wrap:anywhere;}',
      '.mv-prix{color:#5A3A6A;font-weight:600;font-size:.88rem;}',
      '.mv-infos{background:#EEF6EE;border-radius:8px;padding:10px 12px;margin-top:10px;line-height:1.8;}',
      '.mv-infos div::first-letter{text-transform:uppercase;}',
      '.mv-mot{font-style:italic;overflow-wrap:anywhere;}',
      '.mv-budget{font-size:.83rem;color:#6a6a65;}',
      '.mv-carte .message{margin:10px 0 0;}',
      '.mv-boutons{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}',
      '.mv-btn{border:1px solid #D8D5CE;background:#FBF8F3;color:#4A4A47;border-radius:6px;padding:9px 12px;font-family:inherit;font-size:.9rem;font-weight:600;cursor:pointer;}',
      '.mv-btn:hover{border-color:#5A3A6A;color:#5A3A6A;}',
      '.mv-btn-oui{background:#EEF6EE;border-color:#CBE3CD;color:#2E6B34;}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------- Point d'entrée, appelé par espace-alb.html ----------
  // Renvoie vrai si la personne a au moins une demande de visite
  window.albMesVisites = async function (profil) {
    if (!profil || !profil.id) return false;
    styles();
    const zone = el('mes-visites');
    if (zone && !zone.dataset.branche) {
      zone.dataset.branche = '1';
      zone.addEventListener('click', function (ev) {
        const b = ev.target.closest('.mv-btn');
        if (b && !b.disabled) agir(b);
      });
    }
    try {
      await charger();
    } catch (ex) {
      if (zone) zone.innerHTML = '<div class="message visible erreur">Vos visites n’ont pas pu être chargées. Rechargez la page dans un instant.</div>';
      return false;
    }
    dessiner();
    return demandes.length > 0;
  };
})();

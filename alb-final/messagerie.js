// ============================================================
// messagerie.js — la rubrique « 💬 Mes messages » de Mon espace ALB
// Tout le monde peut s'écrire depuis son espace, rangé par personne.
// Règle d'or (loi n° 2025-594) : un professionnel ne contacte jamais
// un particulier en premier. Le serveur le vérifie à chaque message.
// Besoin de : alb-connexion.js (albSupabase, albEchapper)
// ============================================================
(function () {
  'use strict';

  const e = function (t) { return albEchapper(t); };
  const ERREURS = {
    PRO_PAS_EN_PREMIER: 'Pour protéger les particuliers, un professionnel ne peut pas les contacter en premier (loi du 30 juin 2025). Ils peuvent vous écrire : vous pourrez alors leur répondre ici.',
    DESTINATAIRE_NON_AUTORISE: 'Ce membre ne peut pas recevoir de message pour le moment.',
    INTROUVABLE: 'Cette conversation ou cette annonce n’est plus disponible.',
    MESSAGE_VIDE: 'Écrivez votre message avant de l’envoyer.',
    MESSAGE_TROP_LONG: 'Votre message est trop long (2 000 caractères au maximum).',
    TROP_DE_MESSAGES: 'Vous avez envoyé beaucoup de messages en peu de temps. Réessayez dans un moment.',
    NON_CONNECTE: 'Votre session s’est terminée. Reconnectez-vous, puis réessayez.',
  };
  const METIERS = { courtier: '🏦 Courtier', artisan: '🔨 Artisan' };

  let conversations = [];
  let vue = 'liste';        // liste | fil | nouveau
  let filActuel = null;     // conversation ouverte
  let contexte = null;      // { destinataire | annonce | demande } pour une nouvelle conversation
  let preparation = null;   // interlocuteur + sujet d'une nouvelle conversation
  let minuterie = null;

  function el(id) { return document.getElementById(id); }
  function zone() { return el('messagerie'); }
  function messageErreur(err) {
    const brut = String((err && (err.message || err)) || '');
    for (const code in ERREURS) if (brut.indexOf(code) !== -1) return ERREURS[code];
    return 'Oups, ça n’a pas marché. Réessayez dans un instant.';
  }
  function quand(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const auj = new Date();
    if (d.toDateString() === auj.toDateString()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  // Badge bien visible : qui est cette personne ?
  function badge(p) {
    if (!p) return '';
    if (p.role === 'particulier') return '<span class="msg-badge msg-part">🏡 Particulier</span>';
    if (p.role === 'immo') return p.sous_role_immo === 'mandataire' ? '<span class="msg-badge msg-pro">📋 Mandataire</span>' : '<span class="msg-badge msg-pro">🏠 Agent immobilier</span>';
    if (METIERS[p.role]) return '<span class="msg-badge msg-pro">' + METIERS[p.role] + '</span>';
    return '<span class="msg-badge msg-pro">🤝 ' + e(p.metier_autre || 'Professionnel') + '</span>';
  }
  function nomDe(p) {
    if (!p) return 'Un membre';
    return ((p.prenom || '') + ' ' + (p.nom || '')).trim() + (p.nom_entreprise ? ' · ' + p.nom_entreprise : '');
  }

  // ---------- Données ----------
  async function chargerListe() {
    const { data, error } = await albSupabase.rpc('alb_mes_conversations');
    if (error) { console.error('[ALB DEBUG] messagerie :', error); throw error; }
    conversations = data || [];
    const nonLus = conversations.reduce(function (t, c) { return t + (Number(c.non_lus) || 0); }, 0);
    const pastille = el('messages-non-lus');
    if (pastille) { pastille.textContent = nonLus ? nonLus + ' non lu' + (nonLus > 1 ? 's' : '') : ''; pastille.classList.toggle('cache', !nonLus); }
  }

  // ---------- Vues ----------
  function dessiner() {
    const z = zone();
    if (!z) return;
    if (vue === 'fil' && filActuel) z.innerHTML = vueFil();
    else if (vue === 'nouveau' && preparation) z.innerHTML = vueNouveau();
    else z.innerHTML = vueListe();
    const fil = el('msg-fil');
    if (fil) fil.scrollTop = fil.scrollHeight;
  }

  // Liste rangée par personne : une carte par interlocuteur, ses conversations dessous
  function vueListe() {
    if (!conversations.length) {
      return '<p class="msg-vide">Pas encore de message. Écrivez à un professionnel depuis <a href="vitrine-pros.html">« Nos pros ALB »</a>, ou posez une question depuis une <a href="annonces.html">annonce</a>.</p>';
    }
    const groupes = [], index = {};
    conversations.forEach(function (c) {
      const p = c.interlocuteur || {};
      const cle = p.id || c.id;
      if (!index[cle]) { index[cle] = { p: p, convs: [], nonLus: 0 }; groupes.push(index[cle]); }
      index[cle].convs.push(c);
      index[cle].nonLus += Number(c.non_lus) || 0;
    });
    return groupes.map(function (g) {
      return '<div class="msg-personne' + (g.nonLus ? ' msg-a-lire' : '') + '">' +
        '<div class="msg-personne-tete">' + badge(g.p) + '<strong>' + e(nomDe(g.p)) + '</strong>' +
          (g.nonLus ? '<span class="msg-pastille">' + g.nonLus + '</span>' : '') + '</div>' +
        g.convs.map(function (c) {
          const dernier = c.dernier || {};
          return '<button type="button" class="msg-conv" data-action="ouvrir" data-id="' + e(c.id) + '">' +
            '<span class="msg-conv-sujet">' + e(c.sujet) + (Number(c.non_lus) ? ' <span class="msg-nouveau">● nouveau</span>' : '') + '</span>' +
            '<span class="msg-conv-apercu">' + (dernier.de_moi ? 'Vous : ' : '') + e(dernier.texte || '') + '</span>' +
            '<span class="msg-conv-date">' + e(quand(c.dernier_message_le)) + '</span>' +
          '</button>';
        }).join('') +
      '</div>';
    }).join('');
  }

  function enTete(p, sujet) {
    return '<div class="msg-entete"><button type="button" class="msg-retour" data-action="liste">← Mes messages</button>' +
      '<div class="msg-qui">' + badge(p) + '<strong>' + e(nomDe(p)) + '</strong></div>' +
      '<div class="msg-sujet">' + e(sujet || '') + '</div></div>';
  }
  function formulaire(bouton) {
    return '<div class="message" id="msg-erreur"></div>' +
      '<form class="msg-form" id="msg-form">' +
        '<textarea id="msg-texte" maxlength="2000" rows="3" placeholder="Votre message…"></textarea>' +
        '<button type="submit" class="bouton msg-envoyer">' + bouton + '</button>' +
      '</form>' +
      '<p class="msg-note">🔒 Échangez ici en toute tranquillité : vos coordonnées restent protégées. L’équipe ALB Sud Immobilier peut consulter les échanges en cas de souci.</p>';
  }

  function vueFil() {
    const c = filActuel;
    const bulles = (c.messages || []).map(function (m) {
      return '<div class="msg-bulle ' + (m.de_moi ? 'msg-moi' : 'msg-lui') + '"><div class="msg-texte">' + e(m.texte) + '</div><div class="msg-heure">' + e(quand(m.le)) + '</div></div>';
    }).join('');
    return enTete(c.interlocuteur, c.sujet) +
      (c.annonce_id ? '<a class="msg-lien-annonce" href="annonce-detail.html?id=' + encodeURIComponent(c.annonce_id) + '" target="_blank">🏡 Voir l’annonce</a>' : '') +
      '<div class="msg-fil" id="msg-fil">' + (bulles || '<p class="msg-vide">Aucun message pour le moment.</p>') + '</div>' +
      formulaire('Envoyer');
  }

  function vueNouveau() {
    return enTete(preparation.interlocuteur, preparation.sujet) +
      '<p class="msg-petit">Nouveau message. Présentez-vous en quelques mots et expliquez votre projet.</p>' +
      formulaire('Envoyer mon message');
  }

  // ---------- Actions ----------
  async function ouvrirConversation(id) {
    const { data, error } = await albSupabase.rpc('alb_conversation_lire', { p_conversation: id });
    if (error) { montrerErreurListe(messageErreur(error)); return; }
    filActuel = data;
    vue = 'fil';
    dessiner();
    lancerMinuterie();
    try { await chargerListe(); } catch (ex) { /* la pastille se mettra à jour plus tard */ }
  }

  function montrerErreurListe(texte) {
    const z = zone();
    if (!z) return;
    z.innerHTML = '<div class="message visible erreur">' + e(texte) + '</div>' + vueListe();
  }

  async function envoyer(ev) {
    ev.preventDefault();
    const texte = String(el('msg-texte').value || '').trim();
    const erreur = el('msg-erreur');
    if (!texte) { erreur.className = 'message visible erreur'; erreur.textContent = ERREURS.MESSAGE_VIDE; return; }
    const bouton = ev.target.querySelector('button');
    bouton.disabled = true;
    const args = { p_texte: texte };
    if (vue === 'fil' && filActuel) args.p_conversation = filActuel.id;
    else if (contexte) {
      if (contexte.destinataire) args.p_destinataire = contexte.destinataire;
      if (contexte.annonce) args.p_annonce = contexte.annonce;
      if (contexte.demande) args.p_demande = contexte.demande;
    }
    const { data, error } = await albSupabase.rpc('alb_message_ecrire', args);
    bouton.disabled = false;
    if (error) { erreur.className = 'message visible erreur'; erreur.textContent = messageErreur(error); return; }
    contexte = null; preparation = null;
    await ouvrirConversation(data);
  }

  // Ouvre (ou prépare) une conversation : depuis « Nos pros ALB », une annonce ou une demande de visite
  async function ouvrirAvec(ctx) {
    const rubrique = el('rubrique-messages');
    if (rubrique) rubrique.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const { data, error } = await albSupabase.rpc('alb_message_preparer', {
      p_destinataire: ctx.destinataire || null, p_annonce: ctx.annonce || null, p_demande: ctx.demande || null,
    });
    if (error) { vue = 'liste'; montrerErreurListe(messageErreur(error)); return; }
    if (data && data.conversation_id) { await ouvrirConversation(data.conversation_id); return; }
    contexte = ctx; preparation = data; vue = 'nouveau';
    dessiner();
    const t = el('msg-texte'); if (t) t.focus();
  }

  function lancerMinuterie() {
    arreterMinuterie();
    // Tant qu'une conversation est ouverte, on regarde toutes les 20 secondes s'il y a du nouveau
    minuterie = setInterval(async function () {
      if (vue !== 'fil' || !filActuel || document.hidden) return;
      const enCours = el('msg-texte') ? el('msg-texte').value : '';
      const { data, error } = await albSupabase.rpc('alb_conversation_lire', { p_conversation: filActuel.id });
      if (error || !data) return;
      if ((data.messages || []).length !== (filActuel.messages || []).length) {
        filActuel = data;
        dessiner();
        if (el('msg-texte')) el('msg-texte').value = enCours;
      }
    }, 20000);
  }
  function arreterMinuterie() { if (minuterie) { clearInterval(minuterie); minuterie = null; } }

  function brancher() {
    const z = zone();
    if (!z || z.dataset.branche) return;
    z.dataset.branche = '1';
    z.addEventListener('click', async function (ev) {
      const cible = ev.target.closest('[data-action]');
      if (!cible) return;
      if (cible.dataset.action === 'ouvrir') ouvrirConversation(cible.dataset.id);
      if (cible.dataset.action === 'liste') {
        arreterMinuterie(); vue = 'liste'; filActuel = null; contexte = null; preparation = null;
        try { await chargerListe(); } catch (ex) { /* on garde la liste */ }
        dessiner();
      }
    });
    z.addEventListener('submit', function (ev) { if (ev.target.id === 'msg-form') envoyer(ev); });
    z.addEventListener('keydown', function (ev) {
      // Ctrl + Entrée (ou Cmd + Entrée) pour envoyer vite
      if (ev.target.id === 'msg-texte' && ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); el('msg-form').requestSubmit(); }
    });
  }

  function styles() {
    if (el('msg-styles')) return;
    const s = document.createElement('style');
    s.id = 'msg-styles';
    s.textContent = [
      '.msg-titre-pastille{display:inline-block;margin-left:8px;background:#B28E3D;color:#fff;font-family:Montserrat,sans-serif;font-size:.75rem;font-weight:700;padding:2px 10px;border-radius:12px;vertical-align:middle;}',
      '.msg-vide{font-size:.92rem;margin-top:10px;}',
      '.msg-vide a{color:#5A3A6A;font-weight:600;}',
      '.msg-personne{border:1px solid #E8E6E1;border-radius:10px;padding:12px;margin-top:12px;}',
      '.msg-personne.msg-a-lire{border-color:#B28E3D;background:#FFFBF3;}',
      '.msg-personne-tete{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-bottom:8px;color:#2a2a28;}',
      '.msg-badge{display:inline-block;font-size:.75rem;font-weight:700;padding:3px 10px;border-radius:12px;}',
      '.msg-part{background:#F4EEF6;color:#5A3A6A;}',
      '.msg-pro{background:#FBF3E4;color:#8A6420;}',
      '.msg-pastille{margin-left:auto;background:#B28E3D;color:#fff;font-size:.75rem;font-weight:700;min-width:22px;text-align:center;padding:2px 7px;border-radius:12px;}',
      '.msg-conv{display:grid;grid-template-columns:1fr auto;gap:2px 10px;width:100%;text-align:left;background:#FBF8F3;border:1px solid #EFEAE3;border-radius:8px;padding:10px 12px;margin-top:6px;font-family:inherit;cursor:pointer;color:#4A4A47;}',
      '.msg-conv:hover{border-color:#5A3A6A;}',
      '.msg-conv-sujet{font-weight:700;font-size:.9rem;color:#2a2a28;}',
      '.msg-nouveau{color:#B28E3D;font-size:.78rem;}',
      '.msg-conv-apercu{grid-column:1 / 2;font-size:.85rem;color:#6a6a65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.msg-conv-date{grid-column:2;grid-row:1 / span 2;font-size:.75rem;color:#7a7a75;align-self:center;}',
      '.msg-entete{border-bottom:1px dashed #D8D5CE;padding-bottom:10px;margin:10px 0;}',
      '.msg-retour{background:none;border:none;color:#5A3A6A;font-family:inherit;font-weight:600;cursor:pointer;padding:0;margin-bottom:8px;}',
      '.msg-qui{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;color:#2a2a28;}',
      '.msg-sujet{font-size:.85rem;color:#6a6a65;margin-top:4px;}',
      '.msg-lien-annonce{display:inline-block;font-size:.85rem;color:#5A3A6A;font-weight:600;margin-bottom:8px;}',
      '.msg-fil{max-height:420px;overflow-y:auto;padding:6px 2px;display:flex;flex-direction:column;gap:8px;}',
      '.msg-bulle{max-width:82%;padding:9px 12px;border-radius:12px;font-size:.92rem;}',
      '.msg-moi{align-self:flex-end;background:#5A3A6A;color:#fff;border-bottom-right-radius:4px;}',
      '.msg-lui{align-self:flex-start;background:#F0EEE9;color:#2a2a28;border-bottom-left-radius:4px;}',
      '.msg-texte{white-space:pre-line;overflow-wrap:anywhere;}',
      '.msg-heure{font-size:.7rem;opacity:.75;margin-top:3px;text-align:right;}',
      '.msg-form{display:flex;flex-direction:column;gap:8px;margin-top:10px;}',
      '.msg-form textarea{width:100%;padding:12px;border:1px solid #D8D5CE;border-radius:8px;font-family:inherit;font-size:1rem;resize:vertical;min-height:80px;}',
      '.msg-form textarea:focus{outline:2px solid #B28E3D;border-color:#B28E3D;}',
      '.msg-note{font-size:.78rem;color:#7a7a75;margin-top:8px;}',
      '.msg-petit{font-size:.85rem;color:#6a6a65;}',
      '#messagerie .message{margin:10px 0 0;}',
      '@media (min-width:700px){.msg-form{flex-direction:row;align-items:flex-end;}.msg-form textarea{flex:1;}.msg-envoyer{min-width:0 !important;width:auto !important;}}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------- Points d'entrée ----------
  // Ouvrir une conversation depuis ailleurs dans l'espace (Mes annonces, Mes visites)
  window.albMessagerieOuvrir = function (ctx) { ouvrirAvec(ctx || {}); };

  window.albMessagerie = async function (profil) {
    if (!profil || !profil.id) return;
    styles();
    brancher();
    try { await chargerListe(); } catch (ex) {
      if (zone()) zone().innerHTML = '<div class="message visible erreur">Vos messages n’ont pas pu être chargés. Rechargez la page dans un instant.</div>';
      return;
    }
    vue = 'liste';
    dessiner();

    // Arrivée depuis « Nos pros ALB », une annonce ou un e-mail de notification
    const p = new URLSearchParams(location.search);
    const id = /^[0-9a-f-]{36}$/i;
    if (id.test(p.get('conversation') || '')) await ouvrirConversation(p.get('conversation'));
    else if (id.test(p.get('contacter') || '')) await ouvrirAvec({ destinataire: p.get('contacter') });
    else if (id.test(p.get('annonce') || '')) await ouvrirAvec({ annonce: p.get('annonce') });
    else if (location.hash === '#messages' && el('rubrique-messages')) el('rubrique-messages').scrollIntoView({ block: 'start' });
    if (p.get('conversation') || p.get('contacter') || p.get('annonce')) history.replaceState(null, '', location.pathname + '#messages');
  };
})();

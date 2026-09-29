// ============================================================
// mes-projets.js — Projets ALB dans Mon espace ALB
//  • « 📂 Mes projets ALB » : les demandes du particulier
//    (financement, travaux, vente/achat) et les pros qui ont accepté
//  • « 🤝 Mon activité pro » : les demandes reçues par un pro,
//    sans les coordonnées du particulier, à accepter ou décliner
// Besoin de : alb-connexion.js (albSupabase, albEchapper, albAppelerGuichet)
// ============================================================
(function () {
  'use strict';

  const e = function (t) { return albEchapper(t); };
  function el(id) { return document.getElementById(id); }
  function euros(n) { const v = Number(n); return isFinite(v) && n !== null && n !== '' ? Math.round(v).toLocaleString('fr-FR') + ' €' : ''; }
  function dateCourte(d) { return d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : ''; }
  function photoSure(url) { return /^https:\/\//.test(String(url || '')) ? String(url) : ''; }
  function message(id, type, texte) { const m = el(id); if (!m) return; m.className = 'message visible ' + type; m.textContent = texte; }

  const MODULES = {
    financement: { icone: '💶', titre: 'Financement', pros: 'courtiers', unPro: 'courtier' },
    travaux: { icone: '🔧', titre: 'Travaux', pros: 'artisans', unPro: 'artisan' },
    accompagnement: { icone: '🤝', titre: 'Vente / achat accompagné', pros: 'agents et mandataires', unPro: 'agent ou mandataire' },
  };
  const LIBELLES = {
    objet: { achat_rp: 'Achat de la résidence principale', achat_rs: 'Achat d’une résidence secondaire', investissement: 'Investissement locatif', travaux: 'Financer des travaux', rachat: 'Renégocier ou regrouper des crédits', autre: 'Autre projet' },
    type_bien: { maison: 'Maison', appartement: 'Appartement', terrain: 'Terrain', immeuble: 'Immeuble', local: 'Local professionnel', autre: 'Autre' },
    situation: { cdi: 'Salarié(e) en CDI', fonctionnaire: 'Fonctionnaire', cdd: 'CDD / intérim', independant: 'Indépendant(e) / chef d’entreprise', retraite: 'Retraité(e)', autre: 'Autre' },
    delai_fin: { moins_3_mois: 'Dans les 3 mois', '3_6_mois': 'Dans 3 à 6 mois', plus_6_mois: 'Dans plus de 6 mois', ne_sait_pas: 'Pas encore défini' },
    categorie: {
      macon: 'Maçonnerie', renovation: 'Rénovation générale', plombier: 'Plomberie', electricien: 'Électricité', peintre: 'Peinture',
      menuisier: 'Menuiserie', couvreur: 'Toiture – couverture', carreleur: 'Carrelage', chauffagiste: 'Chauffage', climaticien: 'Climatisation',
      pisciniste: 'Piscine', paysagiste: 'Jardin – paysage', terrassier: 'Terrassement – assainissement', facadier: 'Façade – isolation',
      autre: 'Autre', ne_sait_pas: 'Pas encore défini',
      electricite: 'Électricité', plomberie: 'Plomberie', carrelage: 'Carrelage', peinture: 'Peinture', menuiserie: 'Menuiserie', renovation_globale: 'Rénovation globale'
    },
    logement: { maison: 'Maison', appartement: 'Appartement', autre: 'Autre' },
    budget_travaux: { moins_5000: 'Moins de 5 000 €', '5000_15000': '5 000 à 15 000 €', '15000_50000': '15 000 à 50 000 €', plus_50000: 'Plus de 50 000 €', ne_sait_pas: 'Pas encore défini' },
    delai_travaux: { urgent: 'Urgent (moins de 2 semaines)', court: '1 à 2 mois', moyen: '2 à 3 mois', long: 'Plus de 3 mois' },
    projet: { vendre: 'Vendre', acheter: 'Acheter', les_deux: 'Vendre et acheter' },
    avancement_vente: { prochainement: 'Veut vendre prochainement', reflechit: 'Réfléchit à vendre', valeur: 'Veut connaître la valeur de son bien', ne_sait_pas: 'Ne sait pas par où commencer' },
    mandat: { non: 'Aucun mandat en cours', simple: 'Mandat simple en cours', ne_sait_pas: 'À vérifier' },
    avancement_achat: { activement: 'Recherche activement', commence: 'Commence ses recherches', savoir: 'Veut savoir ce qu’il peut acheter', ne_sait_pas: 'Ne sait pas par où commencer' },
    priorite: { vendre_dabord: 'Vendre d’abord', acheter_dabord: 'Acheter d’abord', parallele: 'Les deux en parallèle', ne_sait_pas: 'Pas encore défini' },
  };
  function lib(liste, v) { return (LIBELLES[liste] || {})[v] || ''; }
  // Travaux : un ou plusieurs corps de métier
  function libCategories(d) {
    const liste = Array.isArray(d.categories) ? d.categories : (d.categorie ? [d.categorie] : []);
    return liste.map(function (c) { return lib('categorie', c); }).filter(Boolean).join(', ');
  }

  // Le récapitulatif du projet (le même que celui envoyé aux pros)
  function recap(p) {
    const d = p.details || {};
    const l = [['Secteur', [p.zone, p.code_postal].filter(Boolean).join(' · ')]];
    if (p.module === 'financement') {
      l.push(['Projet', lib('objet', d.objet)], ['Type de bien', lib('type_bien', d.type_bien)], ['Prix visé', d.prix_vise ? euros(d.prix_vise) : ''],
        ['Budget estimé', d.budget_max != null ? euros(d.budget_max) : ''], ['À emprunter', d.montant_emprunt != null ? euros(d.montant_emprunt) : ''],
        ['Mensualité possible', d.mensualite_max != null ? euros(d.mensualite_max) + ' par mois' : ''], ['Apport', d.apport != null ? euros(d.apport) : ''],
        ['Durée', d.duree ? d.duree + ' ans (taux ' + String(d.taux).replace('.', ',') + ' %)' : ''],
        ['Endettement actuel', d.endettement_actuel != null ? d.endettement_actuel + ' %' : ''], ['Situation', lib('situation', d.situation)],
        ['Premier achat', d.primo === 'oui' ? 'Oui' : d.primo === 'non' ? 'Non' : ''], ['Échéance', lib('delai_fin', d.delai)]);
    } else if (p.module === 'travaux') {
      l.push(['Corps de métier', libCategories(d)], ['Logement', lib('logement', d.logement)], ['Budget', lib('budget_travaux', d.budget)],
        ['Délai', lib('delai_travaux', d.delai)], ['Besoin de financement', d.besoin_financement ? 'Oui' : '']);
    } else {
      l.push(['Projet', lib('projet', d.projet)]);
      if (d.avancement_vente) l.push(['Vente', lib('avancement_vente', d.avancement_vente)], ['Bien à vendre', lib('type_bien', d.type_bien_vente)], ['Mandat', lib('mandat', d.mandat)]);
      if (d.avancement_achat) l.push(['Achat', lib('avancement_achat', d.avancement_achat)], ['Bien recherché', lib('type_bien', d.type_bien_achat)], ['Budget envisagé', d.budget_achat ? euros(d.budget_achat) : '']);
      if (d.priorite) l.push(['Priorité', lib('priorite', d.priorite)]);
    }
    if (d.mot_alb) l.push(['Le mot de Jocelyne', d.mot_alb]);
    return '<dl class="pj-recap">' + l.filter(function (x) { return x[1]; }).map(function (x) {
      return '<dt>' + e(x[0]) + '</dt><dd>' + e(x[1]) + '</dd>';
    }).join('') + '</dl>' + (p.description ? '<p class="pj-description">' + e(p.description) + '</p>' : '') + blocMedias(d);
  }

  // Photos, plans, vidéo joints à la demande (fichiers privés : liens temporaires)
  function blocMedias(d) {
    const m = Array.isArray(d.medias) ? d.medias : [];
    if (!m.length) return '';
    return '<p class="pj-medias-titre">📷 Photos, plans, vidéo</p><div class="pj-medias">' + m.map(function (x) {
      return '<a class="pj-media" target="_blank" rel="noopener" data-chemin="' + e(x.chemin) + '" title="' + e(x.nom || '') + '">' +
        (x.type === 'photo' ? '<img alt="">' : '<span>' + (x.type === 'plan' ? '📄 Plan' : '🎬 Vidéo') + '</span>') + '</a>';
    }).join('') + '</div>';
  }
  async function chargerMedias(zone) {
    if (!zone) return;
    const liens = Array.from(zone.querySelectorAll('.pj-media:not([href])'));
    if (!liens.length) return;
    const { data, error } = await albSupabase.storage.from('projets-medias').createSignedUrls(liens.map(function (a) { return a.dataset.chemin; }), 3600);
    if (error || !data) { console.error('[ALB DEBUG] fichiers :', error); return; }
    data.forEach(function (x, i) {
      if (!x || !x.signedUrl) return;
      liens[i].href = x.signedUrl;
      const img = liens[i].querySelector('img');
      if (img) img.src = x.signedUrl;
    });
  }

  function lienTel(t) {
    const net = String(t || '').replace(/[^0-9+]/g, '');
    return net ? '<a href="tel:' + e(net) + '">📱 ' + e(t) + '</a>' : '';
  }

  // Les types de rendez-vous proposés par le pro (téléphone, visio, en personne)
  function rendezVous(c) {
    const m = (c && c.modes) || {};
    return [m.telephone ? '📞 téléphone' : '', m.visio ? '💻 visio' : '', m.physique ? '🤝 en personne' : ''].filter(Boolean).join(' · ');
  }

  function nomPro(c) {
    if (!c) return '';
    const nom = ((c.prenom || '') + ' ' + (c.nom || '')).trim();
    return c.nom_entreprise ? nom + ' (' + c.nom_entreprise + ')' : nom;
  }

  // ============================================================
  // Côté particulier : « Mes projets ALB »
  // ============================================================
  let projets = [];
  const STATUTS_PART = {
    nouvelle: ['⏳ En cours d’envoi', 'pj-attente'],
    a_verifier: ['📞 Jocelyne vous appelle avant l’envoi', 'pj-attente'],
    a_orienter: ['🔎 Jocelyne cherche le bon professionnel', 'pj-attente'],
    envoyee: ['📨 Envoyée aux professionnels', 'pj-attente'],
    complete: ['✅ Mise en relation faite', 'pj-ok'],
    sans_suite: ['📞 Jocelyne reprend la main', 'pj-attente'],
    annulee: ['Retirée', 'pj-fin'],
  };

  function carteProjet(p) {
    const m = MODULES[p.module] || { icone: '📂', titre: p.module, pros: 'pros', unPro: 'pro' };
    const st = STATUTS_PART[p.statut] || [p.statut, ''];
    let suivi = '';
    if (p.statut === 'envoyee' || p.statut === 'complete') {
      const acceptes = (p.pros || []).filter(function (x) { return x.statut === 'acceptee'; }).length;
      suivi = '<p class="pj-suivi">Envoyée à ' + e(p.nb_envoyes) + ' ' + e(p.nb_envoyes > 1 ? m.pros : m.unPro) +
        ' · ' + e(acceptes) + ' sur ' + e(p.quota) + ' ' + (acceptes > 1 ? 'ont accepté' : 'a accepté') +
        (p.nb_refus ? ' · ' + e(p.nb_refus) + ' indisponible' + (p.nb_refus > 1 ? 's' : '') : '') + '</p>';
    }
    const lignes = (p.pros || []).map(function (x) {
      const photo = photoSure(x.pro && x.pro.photo_url);
      const etat = x.statut === 'acceptee' ? '✅ A accepté' + (x.repondu_le ? ' le ' + e(dateCourte(x.repondu_le)) : '')
        : x.statut === 'en_attente' ? '⏳ N’a pas encore répondu'
        : x.statut === 'refusee' ? 'Pas disponible' : x.statut === 'complete' ? 'Plus nécessaire' : 'Retiré';
      return '<div class="pj-pro">' + (photo ? '<img src="' + e(photo) + '" alt="">' : '<span class="pj-sans-photo">👤</span>') +
        '<span class="pj-pro-texte"><strong>' + e(nomPro(x.pro)) + '</strong><span>' + etat + '</span>' +
          (rendezVous(x.pro) ? '<span class="pj-rdv">Rendez-vous : ' + e(rendezVous(x.pro)) + '</span>' : '') +
          (x.statut === 'acceptee' && x.pro && (x.pro.telephone || x.pro.email)
            ? '<span class="pj-coord">' + lienTel(x.pro.telephone) + (x.pro.email ? ' <a href="mailto:' + e(x.pro.email) + '">✉️ ' + e(x.pro.email) + '</a>' : '') + '</span>' : '') +
        '</span>' +
        (x.statut === 'acceptee' && x.conversation_id ? '<button type="button" class="pj-btn pj-btn-oui" data-action="discuter" data-conversation="' + e(x.conversation_id) + '">💬 Échanger</button>' : '') +
      '</div>';
    }).join('');
    const retirable = ['nouvelle', 'a_verifier', 'a_orienter', 'envoyee'].indexOf(p.statut) !== -1;
    return '<div class="pj-carte" id="projet-' + e(p.id) + '">' +
      '<div class="pj-tete"><span class="pj-icone">' + m.icone + '</span><span><span class="pj-titre">' + e(m.titre) + '</span>' +
      '<span class="pj-date">Demande du ' + e(dateCourte(p.cree_le)) + (p.source === 'visite' ? ' · depuis une demande de visite' : '') + '</span></span></div>' +
      '<span class="pj-statut ' + st[1] + '">' + e(st[0]) + '</span>' + suivi +
      ((p.statut === 'envoyee' || p.statut === 'complete') ? '<p class="pj-suivi">' + (p.appel_autorise ? '📞 Vous avez accepté d’être appelé(e) : les pros qui acceptent ont votre nom et votre téléphone.' : '💬 Les pros vous écrivent dans votre messagerie ALB.') + '</p>' : '') +
      (lignes ? '<div class="pj-pros">' + lignes + '</div>' : '') +
      '<details class="pj-details"><summary>Voir ma demande</summary>' + recap(p) + '</details>' +
      '<div class="message" id="pj-msg-' + e(p.id) + '"></div>' +
      (retirable ? '<div class="pj-boutons"><button type="button" class="pj-btn" data-action="retirer" data-projet="' + e(p.id) + '">Retirer ma demande</button></div>' : '') +
    '</div>';
  }

  function dessinerProjets() {
    const zone = el('mes-projets');
    if (!zone) return;
    zone.innerHTML = '<a class="bouton pj-nouveau" href="projets-alb.html">➕ Nouveau projet</a>' +
      (projets.length ? projets.map(carteProjet).join('') :
        '<p class="pj-vide">Pas encore de projet. Financement, travaux, vente ou achat accompagné : décrivez votre besoin, et les bons professionnels vous écrivent ici.</p>');
  }

  async function chargerProjets() {
    const { data, error } = await albSupabase.rpc('alb_mes_projets');
    if (error) { console.error('[ALB DEBUG] mes projets :', error); throw error; }
    projets = data || [];
  }

  async function retirer(bouton) {
    if (!window.confirm('Vous retirez cette demande ? Les professionnels qui n’ont pas encore répondu ne la verront plus.')) return;
    bouton.disabled = true;
    const id = bouton.dataset.projet;
    const { error } = await albSupabase.rpc('alb_projet_annuler', { p_projet: id });
    if (error) { bouton.disabled = false; message('pj-msg-' + id, 'erreur', 'Cette demande a déjà changé : rechargez la page.'); return; }
    try { await chargerProjets(); } catch (ex) { /* on garde l'affichage */ }
    dessinerProjets();
    chargerMedias(el('mes-projets'));
    message('pj-msg-' + id, 'succes', 'C’est noté, votre demande est retirée.');
  }

  // ============================================================
  // Côté pro : les demandes reçues
  // ============================================================
  let recues = [];
  const STATUTS_PRO = {
    en_attente: ['🆕 À vous de répondre', 'pj-proposition'],
    acceptee: ['✅ Vous avez accepté', 'pj-ok'],
    refusee: ['Vous avez décliné', 'pj-fin'],
    complete: ['Déjà prise par d’autres pros', 'pj-fin'],
    annulee: ['Retirée par le particulier', 'pj-fin'],
  };
  const MOT_ACCUEIL = 'Bonjour, j’ai bien reçu votre demande et je serais ravi(e) de vous accompagner. Quand pouvons-nous en parler ?';

  function carteRecue(l) {
    const p = l.projet || {};
    const m = MODULES[p.module] || { icone: '📂', titre: p.module };
    const st = STATUTS_PRO[l.statut] || [l.statut, ''];
    let corps = recap(p);
    let actions = '';
    if (l.statut === 'en_attente') {
      corps += '<p class="pj-suivi">' + (p.appel_autorise ? '📞 Il accepte d’être appelé : son nom et son téléphone vous sont donnés dès que vous acceptez. ' : '💬 Il souhaite échanger par la messagerie ALB. ') + '</p>' +
        '<p class="pj-suivi">' + (p.mode === 'direct' ? 'Le particulier vous a choisi(e). ' : '') +
        (p.quota > 1 ? 'Il souhaite échanger avec ' + e(p.quota) + ' professionnels au plus' : 'Il souhaite échanger avec un seul professionnel') +
        ' : les premiers qui acceptent remportent la mise en relation' + (p.nb_acceptes ? ' (' + e(p.nb_acceptes) + ' déjà)' : '') + '.</p>' +
        '<div class="champ pj-champ"><label for="pj-mot-' + e(l.id) + '">Votre premier message (il le reçoit dans sa messagerie ALB)</label>' +
        '<textarea id="pj-mot-' + e(l.id) + '" maxlength="2000" rows="3">' + e(MOT_ACCUEIL) + '</textarea></div>';
      actions = '<button type="button" class="pj-btn pj-btn-oui" data-action="accepter" data-ligne="' + e(l.id) + '">✅ Accepter et lui écrire</button>' +
        '<button type="button" class="pj-btn" data-action="decliner" data-ligne="' + e(l.id) + '">Décliner</button>';
    } else if (l.statut === 'acceptee') {
      const qui = l.particulier ? ((l.particulier.prenom || '') + ' ' + (l.particulier.nom || '')).trim() : 'le particulier';
      corps += p.appel_autorise && l.particulier && l.particulier.telephone
        ? '<div class="pj-appel">📞 <strong>' + e(qui) + '</strong> a accepté d’être appelé(e) : ' + lienTel(l.particulier.telephone) + '<br><span>Vous pouvez aussi lui écrire dans la messagerie ALB.</span></div>'
        : '<p class="pj-suivi">Vous échangez avec <strong>' + e(qui) + '</strong> dans votre messagerie ALB (il n’a pas souhaité être appelé : c’est lui qui choisit de vous donner son numéro).</p>';
      if (l.conversation_id) actions = '<button type="button" class="pj-btn pj-btn-oui" data-action="discuter" data-conversation="' + e(l.conversation_id) + '">💬 Voir la conversation</button>';
    }
    return '<div class="pj-carte" id="recue-' + e(l.id) + '">' +
      '<div class="pj-tete"><span class="pj-icone">' + m.icone + '</span><span><span class="pj-titre">' + e(m.titre) + (p.zone || p.code_postal ? ' · ' + e(p.zone || p.code_postal) : '') + '</span>' +
      '<span class="pj-date">Reçue le ' + e(dateCourte(l.envoye_le)) + '</span></span></div>' +
      '<span class="pj-statut ' + st[1] + '">' + e(st[0]) + '</span>' +
      (l.statut === 'en_attente' ? corps : '<details class="pj-details"><summary>Voir la demande</summary>' + corps + '</details>') +
      '<div class="message" id="pj-msg-' + e(l.id) + '"></div>' +
      (actions ? '<div class="pj-boutons">' + actions + '</div>' : '') +
    '</div>';
  }

  function dessinerRecues() {
    const zone = el('projets-recus');
    if (!zone) return;
    const aTraiter = recues.filter(function (l) { return l.statut === 'en_attente'; }).length;
    zone.innerHTML = '<p class="pj-sous-titre">📥 Demandes de projets reçues' + (aTraiter ? ' <span class="pj-pastille">' + e(aTraiter) + ' à traiter</span>' : '') + '</p>' +
      (recues.length ? recues.map(carteRecue).join('') :
        '<p class="pj-vide">Pas encore de demande. Dès qu’un particulier de votre secteur a besoin d’un professionnel comme vous, elle arrive ici (et par e-mail).</p>');
  }

  async function chargerRecues() {
    const { data, error } = await albSupabase.rpc('alb_projets_recus');
    if (error) { console.error('[ALB DEBUG] projets reçus :', error); throw error; }
    recues = data || [];
  }

  const ERREURS = {
    DEMANDE_COMPLETE: 'Trop tard : d’autres professionnels ont accepté cette demande avant vous.',
    DEMANDE_ANNULEE: 'Le particulier a retiré sa demande.',
    DEJA_REPONDU: 'Vous avez déjà répondu à cette demande.',
    MESSAGE_VIDE: 'Écrivez un premier message au particulier.',
    MESSAGE_TROP_LONG: 'Votre message est un peu long : 2 000 caractères au plus.',
  };

  async function repondre(bouton) {
    const id = bouton.dataset.ligne;
    const accepter = bouton.dataset.action === 'accepter';
    let texte = '';
    if (accepter) {
      texte = String((el('pj-mot-' + id) || {}).value || '').trim();
      if (!texte) { message('pj-msg-' + id, 'erreur', ERREURS.MESSAGE_VIDE); return; }
    } else {
      const mot = window.prompt('Vous déclinez cette demande. Un petit mot pour Jocelyne ? (facultatif)', '');
      if (mot === null) return;
      texte = mot.trim().slice(0, 600);
    }
    bouton.disabled = true;
    const r = await albAppelerGuichet({ action: 'reponse_projet', ligne_id: id, decision: accepter ? 'accepter' : 'refuser', message: texte });
    if (!r.ok) {
      bouton.disabled = false;
      message('pj-msg-' + id, 'erreur', ERREURS[r.code] || albMessageErreur(r.code));
      if (r.code === 'DEMANDE_COMPLETE' || r.code === 'DEMANDE_ANNULEE' || r.code === 'DEJA_REPONDU') {
        try { await chargerRecues(); dessinerRecues(); message('pj-msg-' + id, 'erreur', ERREURS[r.code]); } catch (ex) { /* rien */ }
      }
      return;
    }
    try { await chargerRecues(); } catch (ex) { /* on garde l'affichage */ }
    dessinerRecues();
    chargerMedias(el('projets-recus'));
    message('pj-msg-' + id, 'succes', accepter ? 'C’est parti ✅ Votre message est arrivé dans sa messagerie ALB.' : 'C’est noté, merci pour votre réponse.');
    if (accepter && r.conversation_id && window.albMessagerieOuvrir) window.albMessagerieOuvrir({ conversation: r.conversation_id });
  }

  // ============================================================
  function styles() {
    if (el('pj-styles')) return;
    const s = document.createElement('style');
    s.id = 'pj-styles';
    s.textContent = [
      '.pj-nouveau{margin:14px 0 6px;}',
      '.pj-vide{margin-top:12px;font-size:.93rem;}',
      '.pj-sous-titre{margin-top:14px;font-weight:700;color:#5A3A6A;}',
      '.pj-pastille{display:inline-block;background:#B28E3D;color:#fff;border-radius:20px;padding:1px 9px;font-size:.78rem;margin-left:6px;}',
      '.pj-carte{border:1px solid #E8E6E1;border-radius:10px;padding:14px;margin-top:14px;font-size:.92rem;}',
      '.pj-carte p{margin-top:8px;}',
      '.pj-tete{display:flex;gap:10px;align-items:center;}',
      '.pj-icone{font-size:1.6rem;}',
      '.pj-tete > span:last-child{display:flex;flex-direction:column;min-width:0;}',
      '.pj-titre{font-weight:700;color:#2a2a28;line-height:1.3;overflow-wrap:anywhere;}',
      '.pj-date{font-size:.8rem;color:#7a7a75;}',
      '.pj-statut{display:inline-block;font-size:.78rem;font-weight:700;padding:3px 10px;border-radius:20px;margin-top:8px;}',
      '.pj-attente{background:#FBF3E4;color:#8A6420;}',
      '.pj-proposition{background:#F4EEF6;color:#5A3A6A;}',
      '.pj-ok{background:#EEF6EE;color:#2E6B34;}',
      '.pj-fin{background:#F0EFEC;color:#5f5f5a;}',
      '.pj-suivi{font-size:.86rem;color:#5f5f5a;}',
      '.pj-pros{margin-top:10px;display:flex;flex-direction:column;gap:8px;}',
      '.pj-pro{display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#FBF8F3;border-radius:8px;padding:8px 10px;}',
      '.pj-pro img,.pj-sans-photo{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#EFEAE3;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
      '.pj-pro-texte{display:flex;flex-direction:column;flex:1;min-width:140px;font-size:.88rem;}',
      '.pj-details{margin-top:10px;}',
      '.pj-details summary{cursor:pointer;color:#5A3A6A;font-weight:600;font-size:.88rem;}',
      '.pj-recap{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin-top:10px;font-size:.88rem;}',
      '.pj-recap dt{color:#7a7a75;}',
      '.pj-recap dd{font-weight:600;overflow-wrap:anywhere;}',
      '.pj-description{background:#F4EEF6;border-left:4px solid #5A3A6A;border-radius:4px;padding:10px 12px;white-space:pre-line;overflow-wrap:anywhere;}',
      '.pj-champ{margin-top:12px;}',
      '.pj-medias-titre{font-weight:600;font-size:.88rem;color:#5A3A6A;}',
      '.pj-medias{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;}',
      '.pj-media{width:86px;height:86px;border-radius:8px;overflow:hidden;background:#EFEAE3;display:flex;align-items:center;justify-content:center;text-decoration:none;color:#5A3A6A;font-weight:600;font-size:.8rem;text-align:center;}',
      '.pj-media img{width:100%;height:100%;object-fit:cover;}',
      '.pj-champ label{display:block;font-weight:600;font-size:.88rem;margin-bottom:6px;}',
      '.pj-champ textarea{width:100%;padding:10px;border:1px solid #D8D5CE;border-radius:6px;font-family:inherit;font-size:.95rem;resize:vertical;}',
      '.pj-carte .message{margin:10px 0 0;}',
      '.pj-boutons{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}',
      '.pj-btn{border:1px solid #D8D5CE;background:#FBF8F3;color:#4A4A47;border-radius:6px;padding:9px 12px;font-family:inherit;font-size:.9rem;font-weight:600;cursor:pointer;}',
      '.pj-btn:hover{border-color:#5A3A6A;color:#5A3A6A;}',
      '.pj-btn-oui{background:#EEF6EE;border-color:#CBE3CD;color:#2E6B34;}',
      '.pj-surligne{outline:3px solid #B28E3D;}',
      '.pj-coord{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:.85rem;margin-top:2px;}',
      '.pj-rdv{font-size:.82rem;color:#5f5f5a;}',
      '.pj-coord a,.pj-appel a{color:#5A3A6A;font-weight:600;}',
      '.pj-appel{background:#EEF6EE;border:1px solid #CBE3CD;border-radius:8px;padding:10px 12px;margin-top:10px;}',
      '.pj-appel span{font-size:.85rem;color:#5f5f5a;}',
      '@media (max-width:480px){.pj-recap{grid-template-columns:1fr;}.pj-recap dd{margin-bottom:4px;}}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function brancher(zone) {
    if (!zone || zone.dataset.branche) return;
    zone.dataset.branche = '1';
    zone.addEventListener('click', function (ev) {
      const b = ev.target.closest('.pj-btn');
      if (!b || b.disabled) return;
      const action = b.dataset.action;
      if (action === 'discuter') { if (window.albMessagerieOuvrir) window.albMessagerieOuvrir({ conversation: b.dataset.conversation }); return; }
      if (action === 'retirer') { retirer(b); return; }
      if (action === 'accepter' || action === 'decliner') repondre(b);
    });
  }

  // Arrivée depuis l'e-mail « Voir la demande » : on montre la bonne carte
  function montrerDepuisLien(prefixe, liste, cle, ancre, rubrique) {
    const id = new URLSearchParams(location.search).get('projet');
    if (!id) {
      if (location.hash === ancre && el(rubrique)) setTimeout(function () { el(rubrique).scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300);
      return;
    }
    const trouve = liste.find(function (x) { return (cle ? x[cle] && x[cle].id : x.id) === id; });
    if (!trouve) return;
    const carte = el(prefixe + trouve.id);
    if (!carte) return;
    carte.classList.add('pj-surligne');
    setTimeout(function () { carte.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300);
  }

  // ---------- Points d'entrée, appelés par espace-alb.html ----------
  // Renvoie vrai si la personne a au moins un projet
  window.albMesProjets = async function (profil) {
    if (!profil || !profil.id) return false;
    styles();
    const zone = el('mes-projets');
    brancher(zone);
    try { await chargerProjets(); } catch (ex) {
      if (zone) zone.innerHTML = '<div class="message visible erreur">Vos projets n’ont pas pu être chargés. Rechargez la page dans un instant.</div>';
      return false;
    }
    dessinerProjets();
    chargerMedias(zone);
    montrerDepuisLien('projet-', projets, null, '#mes-projets', 'rubrique-projets');
    return projets.length > 0;
  };

  // Renvoie le nombre de demandes reçues
  window.albProjetsRecus = async function (profil) {
    if (!profil || !profil.id) return 0;
    styles();
    const zone = el('projets-recus');
    brancher(zone);
    try { await chargerRecues(); } catch (ex) {
      if (zone) zone.innerHTML = '<div class="message visible erreur">Vos demandes reçues n’ont pas pu être chargées. Rechargez la page dans un instant.</div>';
      return 0;
    }
    dessinerRecues();
    chargerMedias(zone);
    montrerDepuisLien('recue-', recues, 'projet', '#activite-pro', 'rubrique-pro');
    return recues.length;
  };
})();

// alerte-importante.js — Bandeaux d'alerte en haut des pages de gestion
// (Gestion du site, Calendrier, Questionnaires de biens). Visible uniquement par Jocelyne :
// les fonctions refusent les autres comptes, et dans ce cas rien ne s'affiche.
//  • Bandeau ROUGE « IMPORTANT » : relances de questionnaires du bien restés en brouillon
//    (SMS ou mail pas encore marqué « fait »), questionnaires modifiés après l'envoi,
//    et demandes de modification d'annonces en ligne (bouton « Fait »).
//  • Le doré montre aussi les changements faits par les vendeurs (prix, description, photos — bouton « Vu »).
//  • Bandeau DORÉ : ce qui attend ta validation (demandes de projet, annonces, avis,
//    pros à valider, photos, demandes de rappel, questionnaires de biens reçus, accès,
//    relances de devis des artisans, papiers de pros à vérifier ou qui expirent).
//  • Bandeau VERT « Tout est ok » : quand il n'y a rien du tout.
(function () {
  'use strict';

  const GS = 'gestion-site.html';

  // Le style des bandeaux, ajouté une seule fois (ces pages n'utilisent pas styles.css)
  function ajouterStyle() {
    if (document.getElementById('alerte-importante-style')) return;
    const st = document.createElement('style');
    st.id = 'alerte-importante-style';
    st.textContent =
      '.alerte-importante { background:#B3261E; color:#fff; padding:12px 16px; margin:0; font-size:0.95rem; line-height:1.45; }' +
      '.alerte-importante strong { display:block; font-size:1rem; margin-bottom:4px; }' +
      '.alerte-importante ul { margin:4px 0 8px 18px; padding:0; }' +
      '.alerte-importante a { display:inline-block; background:#fff; color:#B3261E; font-weight:700; padding:6px 14px; border-radius:6px; text-decoration:none; }' +
      '.alerte-importante.alerte-doree { background:#C9A227; color:#2B2100; }' +
      '.alerte-importante.alerte-doree ul { list-style:none; margin-left:0; }' +
      '.alerte-importante.alerte-doree li { margin:4px 0; }' +
      '.alerte-importante.alerte-doree a { background:#2B2100; color:#F5E3A3; padding:3px 10px; margin-left:6px; font-size:0.85rem; }' +
      '.alerte-importante .alerte-bouton { border:0; border-radius:6px; padding:3px 10px; margin-left:6px; font-weight:700; cursor:pointer; background:#fff; color:#2B2100; font-size:0.85rem; }' +
      '.alerte-importante.alerte-doree ul { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:2px 16px; }' +
      '.alerte-importante .alerte-nb { display:inline-block; min-width:1.6em; text-align:center; background:#2B2100; color:#F5E3A3; border-radius:10px; padding:0 6px; }' +
      '.alerte-importante .alerte-zero { opacity:0.55; }' +
      '.alerte-importante .alerte-zero .alerte-nb { background:transparent; color:#2B2100; border:1px solid #2B2100; }' +
      '.alerte-importante .alerte-plein { font-weight:700; }' +
      '.alerte-importante.alerte-ok { background:#2E6B34; }' +
      '.alerte-importante.alerte-ok strong { margin-bottom:0; }';
    document.head.appendChild(st);
  }

  function echapper(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Nombre de jours depuis une date
  function joursDepuis(dateIso) {
    if (!dateIso) return 0;
    return Math.floor((Date.now() - new Date(dateIso).getTime()) / 86400000);
  }

  // Relances de devis (artisans) : mêmes règles que l'onglet Devis — J+2, J+7, J+14 ou l'action notée
  function jourIsoDecale(iso, plus) { const d = iso ? new Date(iso) : new Date(); d.setDate(d.getDate() + (plus || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function devisARelancer(d) {
    if (d.statut === 'remplace' || !(d.suivi === 'envoye' || d.suivi === 'en_discussion')) return false;
    const auj = jourIsoDecale(null, 0);
    if (d.prochaine_action) return (d.prochaine_action_le || auj) <= auj;
    const etape = [[2, 'j2_fait_le'], [7, 'j7_fait_le'], [14, 'j14_fait_le']].find(function (x) { return !d[x[1]]; });
    return !!etape && jourIsoDecale(d.cree_le, etape[0]) <= auj;
  }
  // Papiers des pros qui expirent : mêmes règles que Gestion du site (mail à 15 j, SMS à 5 j, retrait à expiration)
  function joursAvantPapier(iso) { const fin = new Date(iso + 'T12:00:00'); const auj = new Date(); auj.setHours(12, 0, 0, 0); return Math.round((fin - auj) / 86400000); }
  function papierSuivi(x) { return x.expire && x.expire_le && x.statut !== 'refuse'; }
  function papierMailAFaire(x) { return papierSuivi(x) && joursAvantPapier(x.expire_le) <= 15 && joursAvantPapier(x.expire_le) > 5 && !x.relance_mail_le; }
  function papierSmsAFaire(x) { return papierSuivi(x) && joursAvantPapier(x.expire_le) <= 5 && joursAvantPapier(x.expire_le) > 0 && !x.relance_sms_le; }
  function papierRetraitAFaire(x) { return papierSuivi(x) && joursAvantPapier(x.expire_le) <= 0 && x.pro_en_ligne; }

  function liste(r) { return r && !r.error && Array.isArray(r.data) ? r.data : []; }
  function pluriel(n, mot, mots) { return n + ' ' + (n > 1 ? mots : mot); }

  // Ce qui attend la validation de Jocelyne (mêmes règles que les pastilles de Gestion du site)
  async function chargerAValider() {
    const r = await Promise.all([
      albSupabase.rpc('alb_gestion_projets'),
      albSupabase.rpc('alb_gestion_annonces'),
      albSupabase.rpc('alb_gestion_avis'),
      albSupabase.rpc('alb_gestion_compteurs'),
      albSupabase.rpc('alb_gestion_photos_a_valider'),
      albSupabase.rpc('alb_gestion_demandes_rappel'),
      albSupabase.rpc('alb_gestion_questionnaires_biens'),
      albSupabase.rpc('alb_gestion_demandes_acces'),
      albSupabase.rpc('alb_gestion_devis'),
      albSupabase.rpc('alb_gestion_papiers'),
      albSupabase.rpc('alb_gestion_depots')
    ]);
    r.forEach(function (x, i) { if (x.error) console.log('[ALB DEBUG] bandeau doré, source ' + i + ' :', x.error); });
    const nProjets = liste(r[0]).filter(function (p) { return p.statut === 'a_verifier' || p.statut === 'a_orienter' || p.statut === 'sans_suite'; }).length;
    const nAnnonces = liste(r[1]).filter(function (a) { return a.statut === 'en_attente'; }).length;
    const nAvis = liste(r[2]).filter(function (a) { return a.statut === 'en_attente'; }).length;
    const nPros = (r[3] && !r[3].error && r[3].data && Number(r[3].data.pros_a_valider)) || 0;
    const nPhotos = liste(r[4]).length;
    const nRappels = liste(r[5]).filter(function (d) { return !d.traitee_le; }).length;
    // Questionnaires modifiés après l'envoi : ils vont dans le bandeau rouge, pas dans le doré
    // Questionnaires « sans mandat » et « mandat remporté » : bandeau rouge aussi
    const aTraiterQ = liste(r[6]).filter(function (q) { return q.statut !== 'brouillon' && !q.traite_le; });
    const enRouge = function (q) { return q.modifie_apres_envoi_le || q.sans_mandat || q.mandat_remporte_le; };
    const modifies = aTraiterQ.filter(enRouge);
    const nQuest = aTraiterQ.filter(function (q) { return !enRouge(q); }).length;
    const nAcces = liste(r[7]).length;
    // Courtiers : 48 h après l'acceptation, appeler le particulier pour ses documents (même règle que l'onglet Projets)
    const nDepots = liste(r[10]).filter(function (d) { return !d.deposes_le && !d.appel_fait_le && d.a_appeler_le && new Date(d.a_appeler_le) <= new Date(); }).length;
    const nDevis = liste(r[8]).filter(devisARelancer).length;
    const papiers = liste(r[9]);
    const papiersAVerifier = papiers.filter(function (x) { return x.statut === 'a_verifier'; });
    const nPapiersAVerifier = papiersAVerifier.length;
    const nPapiersRelance = papiers.filter(function (x) { return papierMailAFaire(x) || papierSmsAFaire(x) || papierRetraitAFaire(x); }).length;

    // Toutes les lignes sont affichées, même à 0 : le chiffre monte dès qu'il y a quelque chose
    const items = [
      ['🤝', nProjets, 'demande de projet', 'demandes de projet', 'à traiter', GS + '#projets'],
      ['🏡', nAnnonces, 'annonce', 'annonces', 'à étudier', GS + '#annonces'],
      ['⭐', nAvis, 'avis', 'avis', 'à relire', GS + '#avis'],
      ['📞', nPros, 'pro', 'pros', 'à valider', GS + '#a-valider'],
      ['🖼️', nPhotos, 'photo', 'photos', 'à valider', GS],
      ['☎️', nRappels, 'demande de rappel', 'demandes de rappel', 'en attente', 'calendrier.html'],
      ['📝', nQuest, 'questionnaire de bien reçu', 'questionnaires de biens reçus', 'à traiter', 'questionnaires-biens.html'],
      ['📂', nDepots, 'relance de documents pour un courtier', 'relances de documents pour les courtiers', 'à faire (appeler le particulier)', GS + '#projets'],
      ['📄', nDevis, 'relance de devis', 'relances de devis', 'à faire (artisans)', GS + '#projets'],
      ['⏰', nPapiersRelance, 'relance de papier', 'relances de papiers', 'à faire (papier qui expire bientôt)', GS + '#valides'],
      ['🔑', nAcces, 'demande d\u2019accès', 'demandes d\u2019accès', 'en attente', GS + '#acces']
    ].map(function (x) { return { emoji: x[0], n: x[1], texte: (x[1] > 1 ? x[3] : x[2]) + ' ' + x[4], lien: x[5], rouge: x[0] === '☎️' }; });
    return { items: items, modifies: modifies, papiers: papiersAVerifier };
  }

  function creer(classe, html) {
    const z = document.createElement('div');
    z.className = 'alerte-importante ' + classe;
    z.innerHTML = html;
    return z;
  }

  // Dernières données, pour redessiner le doré sans tout recharger
  const dernier = { pret: false, modifsAnn: [], aValider: [], relances: [], demandes: [], modifies: [], papiers: [] };
  const NOMS_MODIF = { prix: 'son prix', honoraires: 'ses honoraires', description: 'sa description', photos: 'ses photos' };

  // Dans Gestion du site : la liste complète « À faire aujourd'hui » (même calcul, même ordre)
  function surGestionDuSite() { return typeof LIGNES_A_FAIRE !== 'undefined' && typeof nombreAFaire === 'function'; }
  function lignesDorees() {
    if (!surGestionDuSite()) return dernier.aValider;
    return LIGNES_A_FAIRE.map(function (l, i) {
      let n = 0;
      try { n = nombreAFaire(l) || 0; } catch (ex) { n = 0; }
      return { emoji: l.emoji, n: n, texte: n > 1 ? l.plusieurs : l.un, aFaire: i, rouge: estRouge(l.un) };
    });
  }
  function blocDore(items) {
    const nb = items.reduce(function (t, it) { return t + it.n; }, 0) + dernier.modifsAnn.length;
    const lignes = dernier.modifsAnn.map(function (m) {
      const quoi = (m.quoi || []).map(function (q) { return NOMS_MODIF[q] || q; });
      const texte = quoi.length > 1 ? quoi.slice(0, -1).join(', ') + ' et ' + quoi[quoi.length - 1] : (quoi[0] || 'son annonce');
      return '<li>✏️ ' + echapper(m.nom || 'Membre') + ' a modifié ' + echapper(texte) + (m.ville ? ' (' + echapper(m.ville) + ')' : '') +
        ' <a href="' + GS + '#annonces">Voir</a> <button type="button" class="alerte-bouton" data-alerte-faite="modif" data-id="' + echapper(m.id) + '">👁 Vu</button></li>';
    }).join('') + items.map(function (it) {
      const voir = !it.n ? '' : (it.aFaire !== undefined
        ? ' <button type="button" class="alerte-bouton" data-alerte-ouvrir="' + it.aFaire + '">Voir</button>'
        : ' <a href="' + echapper(it.lien) + '">Voir</a>');
      return '<li class="' + (it.n ? 'alerte-plein' : 'alerte-zero') + '">' + it.emoji + ' <b class="alerte-nb">' + it.n + '</b> ' + echapper(it.texte) + voir + '</li>';
    }).join('');
    return creer('alerte-doree', '<strong>✨ À faire dans la journée' + (nb ? ' – ' + nb : '') + '</strong><ul>' + lignes + '</ul>');
  }
  if (typeof window.afficherAFaire === 'function') {
    const origine = window.afficherAFaire;
    window.afficherAFaire = function () { const r = origine.apply(this, arguments); try { dessiner(); } catch (ex) { console.log('[ALB DEBUG] bandeau doré :', ex); } return r; };
  }
  // « Voir » d'une ligne de « À faire aujourd'hui » : ouvre le bon onglet, comme sur l'accueil
  document.addEventListener('click', function (ev) {
    const b = ev.target.closest && ev.target.closest('[data-alerte-ouvrir]');
    if (!b || typeof ouvrirAFaire !== 'function') return;
    ouvrirAFaire(Number(b.dataset.alerteOuvrir));
  });

  // Lignes de « À faire aujourd'hui » qui passent en ROUGE (hyper important). Repérées par leur texte.
  const LIGNES_ROUGES = [/^personne à rappeler/, /^SMS de rappel à envoyer pour les visites/, /^demande de visite sans réponse/,
    /^visite contestée/, /^désaccord entre/, /^pro dont le papier a expiré/, /^membre qui demande à quitter/];
  function estRouge(texteUn) { return LIGNES_ROUGES.some(function (r) { return r.test(texteUn || ''); }); }

  async function afficherAlertes() {
    if (typeof albSupabase === 'undefined') return;
    const [rel, charge, ann] = await Promise.all([
      albSupabase.rpc('alb_gestion_alertes_questionnaires'),
      chargerAValider(),
      albSupabase.rpc('alb_gestion_alertes_annonces')
    ]);
    if (rel.error) { console.log('[ALB DEBUG] alertes questionnaires :', rel.error); return; }  // pas Jocelyne : rien
    if (ann.error) console.log('[ALB DEBUG] alertes annonces :', ann.error);
    dernier.pret = true;
    dernier.relances = Array.isArray(rel.data) ? rel.data : [];
    dernier.demandes = (ann.data && Array.isArray(ann.data.demandes)) ? ann.data.demandes : [];
    dernier.modifsAnn = (ann.data && Array.isArray(ann.data.modifs)) ? ann.data.modifs : [];
    dernier.modifies = charge.modifies;
    dernier.aValider = charge.items;
    dernier.papiers = charge.papiers || [];
    dessiner();
  }

  // Dessine les bandeaux à partir des dernières données. Les chiffres de « À faire aujourd'hui »
  // sont relus à chaque fois : ce que tu as fait ailleurs disparaît tout seul.
  function dessiner() {
    if (!dernier.pret) return;
    const relances = dernier.relances, demandes = dernier.demandes, modifies = dernier.modifies;
    const toutes = lignesDorees();
    const rouges = toutes.filter(function (it) { return it.rouge && it.n > 0; });
    const dorees = toutes.filter(function (it) { return !it.rouge && !/^papiers? de pros? à vérifier/.test(it.texte || ''); });

    const ancien = document.getElementById('alerte-importante');
    ajouterStyle();
    const zone = document.createElement('div');
    zone.id = 'alerte-importante';

    // Rouge : hyper important
    // Documents déposés par les pros (à voir, enregistrer sur ton PC, puis vérifier)
    const papiersR = dernier.papiers || [];
    // Dans Gestion du site, la ligne « papiers à vérifier » de « À faire aujourd'hui » est remplacée par le détail rouge
    if (relances.length || modifies.length || demandes.length || rouges.length || papiersR.length) {
      const lignesPapiers = papiersR.map(function (x) {
        return '<li>📎 ' + echapper(x.pro || 'Un pro') + ' a déposé : <b>' + echapper(x.libelle || 'un document') + '</b>' +
          (x.envoye_le ? ' (le ' + echapper(new Date(x.envoye_le).toLocaleDateString('fr-FR')) + ')' : '') +
          (x.chemin ? ' <button type="button" class="alerte-bouton" data-papier-telecharger="' + echapper(x.chemin) + '" data-nom="' + echapper(x.nom_fichier || 'document') + '">⬇️ Enregistrer sur mon PC</button>' : (x.valeur ? ' : ' + echapper(x.valeur) : '')) +
          ' <a href="' + GS + '#valides">Vérifier</a></li>';
      }).join('');
      const lignesRouges = rouges.map(function (it) {
        const voir = it.aFaire !== undefined
          ? ' <button type="button" class="alerte-bouton" data-alerte-ouvrir="' + it.aFaire + '">Voir</button>'
          : ' <a href="' + echapper(it.lien) + '">Voir</a>';
        return '<li>' + it.emoji + ' <b>' + it.n + '</b> ' + echapper(it.texte) + voir + '</li>';
      }).join('');
      const lignesDemandes = demandes.map(function (d) {
        return '<li>' + echapper(d.nom || 'Membre') + ' demande une modification' + (d.ville ? ' (' + echapper(d.ville) + ')' : '') + ' : « ' + echapper(d.message) + ' » ' +
          '<a href="' + GS + '#annonces">Voir</a> <button type="button" class="alerte-bouton" data-alerte-faite="demande" data-id="' + echapper(d.id) + '">✓ Fait</button></li>';
      }).join('');
      const lignesModif = modifies.map(function (q) {
        const nom = echapper([q.pro_prenom, q.pro_nom].filter(Boolean).join(' ') || q.pro || 'Membre');
        const ou = q.adresse ? ' (' + echapper(q.adresse) + ')' : '';
        let quoi;
        if (q.mandat_remporte_le && !q.sans_mandat) quoi = '🏆 ' + nom + ' a remporté le mandat' + ou + ' : annonce à valider';
        else if (q.sans_mandat) quoi = '📄 ' + nom + ' : questionnaire sans mandat' + ou + ', aperçu de l\u2019annonce à préparer';
        else quoi = nom + ' a modifié son questionnaire après l\u2019envoi' + ou;
        return '<li>' + quoi + ' <a href="questionnaires-biens.html?q=' + echapper(q.id) + '">Voir l\u2019annonce proposée</a></li>';
      }).join('');
      const lignesRelances = relances.map(function (a) {
        const quoi = a.quoi === 'mail' ? 'mail à envoyer' : 'SMS à envoyer';
        const j = joursDepuis(a.depuis);
        return '<li>' + echapper(a.nom || 'Membre') + ' – questionnaire en brouillon – <em>' + quoi + '</em>' +
          (j >= 2 ? ' (en attente depuis ' + j + ' jours)' : '') + ' <a href="calendrier.html">Voir</a></li>';
      }).join('');
      const n = papiersR.length + relances.length + modifies.length + demandes.length + rouges.reduce(function (t, it) { return t + it.n; }, 0);
      zone.appendChild(creer('', '<strong>🔴 IMPORTANT – ' + n + ' à faire tout de suite</strong>' +
        '<ul>' + lignesPapiers + lignesRouges + lignesDemandes + lignesModif + lignesRelances + '</ul>'));
    }

    // Doré : à faire dans la journée (toutes les lignes, même à 0)
    const nbDore = dorees.reduce(function (t, it) { return t + it.n; }, 0);
    zone.appendChild(blocDore(dorees));

    // Vert : rien du tout
    if (!zone.querySelector('.alerte-importante:not(.alerte-doree)') && !nbDore && !dernier.modifsAnn.length) {
      zone.insertBefore(creer('alerte-ok', '<strong>✅ Tout est ok – rien à valider ni à relancer</strong>'), zone.firstChild);
    }
    if (ancien) ancien.replaceWith(zone); else placer(zone);
  }

  // « Enregistrer sur mon PC » : télécharge le document déposé par le pro (lien valable 10 minutes)
  document.addEventListener('click', async function (ev) {
    const b = ev.target.closest && ev.target.closest('[data-papier-telecharger]');
    if (!b) return;
    b.disabled = true;
    const { data, error } = await albSupabase.storage.from('pro-documents').createSignedUrl(b.dataset.papierTelecharger, 600, { download: b.dataset.nom || true });
    b.disabled = false;
    if (error || !data) { console.log('[ALB DEBUG] téléchargement papier :', error); alert('Le document n\u2019a pas pu être téléchargé. Réessaie dans un instant.'); return; }
    window.location.href = data.signedUrl;
  });

  // Boutons « Fait » (demande de modification traitée) et « Vu » (changement du vendeur)
  document.addEventListener('click', async function (ev) {
    const b = ev.target.closest && ev.target.closest('[data-alerte-faite]');
    if (!b) return;
    b.disabled = true;
    const { error } = await albSupabase.rpc('alb_gestion_alerte_annonce_faite', { p_quoi: b.dataset.alerteFaite, p_id: b.dataset.id });
    if (error) { console.log('[ALB DEBUG] alerte faite :', error); b.disabled = false; return; }
    afficherAlertes();
  });

  // Place les bandeaux juste sous l'en-tête de la page
  function placer(z) {
    const bandeau = document.querySelector('header');
    if (bandeau && bandeau.parentNode) bandeau.parentNode.insertBefore(z, bandeau.nextSibling);
    else document.body.insertBefore(z, document.body.firstChild);
  }

  // On attend que la connexion soit prête (session de Jocelyne chargée)
  async function demarrer() {
    if (typeof albSupabase === 'undefined') return;
    const { data } = await albSupabase.auth.getSession();
    if (data && data.session) afficherAlertes();
  }
  // Se met à jour tout seul : toutes les 2 minutes et quand tu reviens sur l'onglet
  setInterval(function () { if (!document.hidden) afficherAlertes(); }, 120000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && dernier.pret) afficherAlertes(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();

// ============================================================
// gestion-site-2.js — Gestion du site, partie 2 sur 2
// (projets, suivis, messages, pros, avis, membres, accès)
// Chargé par gestion-site.html, après gestion-site-1.js
// ============================================================

function ligneVisite(v) {
  const b = v.acheteur || {}, vd = v.vendeur || {}, a = v.annonce || {};
  const pro = v.type_vente === 'accompagnee';
  const retard = sansReponseDepuis(v);
  let quand = '';
  if (v.statut === 'autre_moment') quand = 'Proposé par le vendeur : ' + momentVisite(v.nouveau_creneau_date, v.nouveau_creneau_heure) + (v.creneau_date ? ' (demandé : ' + momentVisite(v.creneau_date, v.creneau_heure) + ')' : '');
  else if (v.creneau_date) quand = momentVisite(v.creneau_date, v.creneau_heure);
  else quand = pro ? 'Date à fixer par le pro au téléphone' : 'Aucun créneau choisi : le vendeur doit proposer un moment';

  let sms = '';
  if (v.statut === 'acceptee' && v.creneau_date === jourIso(1)) {
    const heure = String(v.creneau_heure || '').replace(':', 'h');
    const lieu = [a.adresse, ((a.code_postal || '') + ' ' + (a.ville || '')).trim()].filter(Boolean).join(', ');
    const contactVendeur = ((vd.prenom || '') + (pro && vd.nom_entreprise ? ' (' + vd.nom_entreprise + ')' : '')).trim();
    const telVendeur = a.telephone_annonce || vd.telephone || '';
    const texteAcheteur = 'Bonjour ' + (b.prenom || '') + ', petit rappel : votre visite « ' + a.titre + ' » est demain à ' + heure + ', ' + lieu + '. ' +
      (contactVendeur ? 'Contact : ' + contactVendeur + (telVendeur ? ' au ' + telVendeur : '') + '. ' : '') + 'Bonne visite ! Jocelyne, ALB Sud Immobilier';
    const texteVendeur = 'Bonjour ' + (vd.prenom || '') + ', petit rappel : visite de votre bien « ' + a.titre + ' » demain à ' + heure + ' avec ' +
      ((b.prenom || '') + ' ' + (b.nom || '')).trim() + (b.telephone ? ' (' + b.telephone + ')' : '') + '. Bonne visite ! Jocelyne, ALB Sud Immobilier';
    sms = blocSms('au visiteur (' + (b.prenom || '') + ')', b.telephone, texteAcheteur) +
          blocSms('au ' + (pro ? 'professionnel' : 'vendeur') + ' (' + (vd.prenom || '') + ')', telVendeur, texteVendeur);
  }

  return '<div class="visite">' +
    '<div class="visite-tete"><span class="badge-qui acheteur">🔎 Acheteur</span>' +
      '<span class="visite-nom">' + albEchapper(((b.prenom || '') + ' ' + (b.nom || '')).trim()) + '</span>' +
      lienTelephone(b.telephone) + (b.email ? '<a href="mailto:' + albEchapper(b.email) + '">✉️ ' + albEchapper(b.email) + '</a>' : '') + '</div>' +
    '<p class="ligne-info"><strong>' + (STATUTS_VISITE[v.statut] || albEchapper(v.statut)) + '</strong>' +
      (retard >= 2 ? ' · <span class="retard">sans réponse depuis ' + retard + ' jours</span>' : '') + '</p>' +
    '<p class="ligne-info">📅 ' + albEchapper(quand) + '</p>' +
    '<p class="ligne-info">💰 Budget estimé ' + prixLisible(v.budget_estime) + ' pour un bien à ' + prixLisible(v.prix_bien) + (v.dans_budget ? ' ✅' : ' ⚠️') +
      (v.partage_budget ? ' · partagé avec le vendeur' : '') + (v.courtier_souhaite ? ' · <strong>🏦 rappel courtier demandé</strong>' : '') + '</p>' +
    '<details class="historique"><summary>Détail de la simulation</summary><p>Revenus ' + prixLisible(v.revenus_mensuels) + ' par mois · crédits ' + prixLisible(v.credits_mensuels) +
      ' par mois · apport ' + prixLisible(v.apport) + ' · ' + albEchapper(v.duree_annees) + ' ans à ' + albEchapper(v.taux) + ' %</p></details>' +
    (v.message ? '<p class="ligne-info mot">💬 Acheteur : « ' + albEchapper(v.message) + ' »</p>' : '') +
    (v.reponse_vendeur ? '<p class="ligne-info mot">💬 Vendeur : « ' + albEchapper(v.reponse_vendeur) + ' »</p>' : '') +
    '<p class="ligne-info" style="color:#7a7a75;">Demandée le ' + dateLisible(v.cree_le) + '</p>' +
    sms +
  '</div>';
}

function blocSms(pour, telephone, texte) {
  const num = String(telephone || '').replace(/[^0-9+]/g, '');
  if (!num) return '<div class="sms">📱 SMS ' + albEchapper(pour) + ' : pas de numéro.</div>';
  return '<div class="sms"><strong>📱 SMS ' + albEchapper(pour) + '</strong>' +
    '<textarea class="texte-pret" readonly>' + albEchapper(texte) + '</textarea>' +
    '<div class="actions"><a class="bouton" href="sms:' + albEchapper(num) + '?&body=' + encodeURIComponent(texte) + '">📱 Ouvrir le SMS</a>' +
    '<button type="button" class="bouton discret" onclick="copier(this)">📋 Copier le texte</button></div></div>';
}

// ---------- Projets ALB (mises en relation) ----------
const MODULES_PROJET = { financement: '💶 Financement (courtiers)', travaux: '🔧 Travaux (artisans)', accompagnement: '🤝 Vente / achat (agents et mandataires)' };
const STATUTS_PROJET = {
  nouvelle: '⏳ En cours d\'envoi', a_verifier: '📞 À vérifier avec lui (mandat)', a_orienter: '🔎 Aucun pro disponible : à orienter',
  envoyee: '📨 Chez les pros', complete: '✅ Mise en relation faite', sans_suite: '📞 Tous les pros ont décliné', annulee: '✗ Retirée par le particulier'
};
const STATUTS_LIGNE = { en_attente: '⏳ pas encore répondu', acceptee: '✅ a accepté', refusee: '✗ a décliné', complete: 'plus nécessaire', annulee: 'demande retirée' };
const LIBELLES_PROJET = {
  objet: { achat_rp: 'Résidence principale', achat_rs: 'Résidence secondaire', investissement: 'Investissement locatif', travaux: 'Financer des travaux', rachat: 'Renégocier / regrouper', autre: 'Autre' },
  categorie: {
    macon: 'Maçonnerie', renovation: 'Rénovation générale', plombier: 'Plomberie', electricien: 'Électricité', peintre: 'Peinture',
    menuisier: 'Menuiserie', couvreur: 'Toiture', carreleur: 'Carrelage', chauffagiste: 'Chauffage', climaticien: 'Climatisation',
    pisciniste: 'Piscine', paysagiste: 'Jardin', terrassier: 'Terrassement', facadier: 'Façade – isolation', autre: 'Autre', ne_sait_pas: 'Pas défini',
    electricite: 'Électricité', plomberie: 'Plomberie', carrelage: 'Carrelage', peinture: 'Peinture', menuiserie: 'Menuiserie', renovation_globale: 'Rénovation globale'
  },
  delai_travaux: { urgent: 'Urgent', court: '1 à 2 mois', moyen: '2 à 3 mois', long: 'Plus de 3 mois' },
  budget_travaux: { moins_5000: '< 5 000 €', '5000_15000': '5 000 à 15 000 €', '15000_50000': '15 000 à 50 000 €', plus_50000: '> 50 000 €', ne_sait_pas: 'Pas défini' },
  projet: { vendre: 'Vendre', acheter: 'Acheter', les_deux: 'Vendre et acheter' },
  mandat: { non: 'aucun mandat', simple: 'mandat simple', ne_sait_pas: 'mandat à vérifier' }
};
function libProjet(liste, v) { return (LIBELLES_PROJET[liste] || {})[v] || v || ''; }
// Travaux : un ou plusieurs corps de métier
// « Je ne sais pas » (ou seulement « Autre ») : c'est à toi de préciser les travaux avec lui
function aPreciser(p) { const c = categoriesProjet(p.details || {}); return c.length > 0 && (c.indexOf('ne_sait_pas') !== -1 || c.every(function (x) { return x === 'autre'; })); }
function categoriesProjet(d) { return Array.isArray(d.categories) ? d.categories : (d.categorie ? [d.categorie] : []); }
// Les codes de travaux (les mêmes que ceux des artisans)
const TRAVAUX_CODES = ['macon', 'plombier', 'electricien', 'peintre', 'menuisier', 'couvreur', 'carreleur', 'chauffagiste', 'climaticien', 'pisciniste', 'paysagiste', 'terrassier', 'facadier', 'renovation', 'autre'];
const ANCIENS_CODES = { electricite: 'electricien', plomberie: 'plombier', carrelage: 'carreleur', peinture: 'peintre', menuiserie: 'menuisier', renovation_globale: 'renovation' };
// Suivi après mise en relation : le particulier dit que c'est fait ou en cours, et tu n'as pas encore vérifié
function suivisAVerifier(p) {
  return [].concat.apply([], (p.pros || []).map(function (l) { return l.suivis || []; }))
    .filter(function (su) { return (su.reponse === 'fait' || su.reponse === 'en_cours') && !su.traite_le; });
}
const FILTRES_PROJETS = [
  ['a_traiter', '📞 À traiter', function (p) { return p.statut === 'a_verifier' || p.statut === 'a_orienter' || p.statut === 'sans_suite'; }],
  ['en_cours', '📨 Chez les pros', function (p) { return p.statut === 'envoyee' || p.statut === 'nouvelle'; }],
  ['faites', '✅ Faites', function (p) { return p.statut === 'complete'; }],
  ['suivis', '🔎 Suivis à vérifier', function (p) { return suivisAVerifier(p).length > 0; }],
  ['retirees', '✗ Retirées', function (p) { return p.statut === 'annulee'; }],
  ['toutes', 'Toutes', function () { return true; }]
];
function choisirFiltreProjets(f) { filtreProjets = f; afficherProjets(); }

function resumeProjet(p) {
  const d = p.details || {}, pv = p.prive || {};
  if (p.module === 'financement') {
    return libProjet('objet', d.objet) + (d.prix_vise ? ' · bien à ' + prixLisible(d.prix_vise) : '') + ' · budget ' + prixLisible(d.budget_max) +
      ' · à emprunter ' + prixLisible(d.montant_emprunt) + ' · apport ' + prixLisible(d.apport) + ' · ' + (d.duree || '?') + ' ans' +
      (pv.revenus_mensuels != null ? ' · revenus ' + prixLisible(pv.revenus_mensuels) + '/mois, crédits ' + prixLisible(pv.credits_mensuels) + '/mois' : '');
  }
  if (p.module === 'travaux') {
    return categoriesProjet(d).map(function (c) { return libProjet('categorie', c); }).join(', ') + ' · ' + libProjet('delai_travaux', d.delai) + (d.budget ? ' · ' + libProjet('budget_travaux', d.budget) : '') +
      (d.besoin_financement ? ' · 💶 besoin de financement' : '');
  }
  return libProjet('projet', d.projet) + (d.mandat ? ' · ' + libProjet('mandat', d.mandat) : '') + (d.budget_achat ? ' · budget achat ' + prixLisible(d.budget_achat) : '');
}

function ficheProjet(p) {
  const lignes = (p.pros || []).map(function (l) {
    const pr = l.pro || {};
    return '<p class="ligne-info">' + badgeQuiLarge(pr) + ' <strong>' + albEchapper(((pr.prenom || '') + ' ' + (pr.nom || '')).trim()) + '</strong>' +
      (pr.nom_entreprise ? ' <span class="etiquette or">' + albEchapper(pr.nom_entreprise) + '</span>' : '') +
      ' · ' + (STATUTS_LIGNE[l.statut] || albEchapper(l.statut)) + (l.rang ? ' (n° ' + l.rang + ')' : '') +
      (l.repondu_le ? ' le ' + dateLisible(l.repondu_le) : '') + ' ' + lienTelephone(pr.telephone) +
      (l.mot_refus ? '<br><span class="mot">💬 « ' + albEchapper(l.mot_refus) + ' »</span>' : '') + '</p>' +
      (l.suivis || []).map(function (su) { return ligneSuivi(su, pr); }).join('');
  }).join('');
  const acceptes = (p.pros || []).filter(function (l) { return l.statut === 'acceptee'; }).length;
  const peutEnvoyer = p.statut === 'a_verifier' || p.statut === 'a_orienter';
  return '<div class="carte fiche" id="projet-' + p.id + '">' +
    '<div class="etiquettes"><span class="etiquette' + (FILTRES_PROJETS[0][2](p) ? ' or' : p.statut === 'complete' ? ' vert' : '') + '">' + (p.statut === 'a_orienter' && p.module === 'travaux' && aPreciser(p) ? '📞 Travaux à préciser avec lui' : (STATUTS_PROJET[p.statut] || albEchapper(p.statut))) + '</span>' +
      (p.source === 'visite' ? '<span class="etiquette">📅 Depuis une demande de visite</span>' : '') + '</div>' +
    '<h3>' + (MODULES_PROJET[p.module] || albEchapper(p.module)) + '</h3>' +
    '<p class="ligne-info">📍 ' + albEchapper([p.zone, p.code_postal].filter(Boolean).join(' · ') || 'Secteur non précisé') + '</p>' +
    '<p class="ligne-info">📝 ' + albEchapper(resumeProjet(p)) + '</p>' +
    (p.description ? '<p class="ligne-info mot">💬 « ' + albEchapper(p.description) + ' »</p>' : '') +
    blocMediasGestion(p.details || {}) +
    ((p.details || {}).mot_alb ? '<p class="ligne-info mot">✍️ Ton mot pour les pros : « ' + albEchapper(p.details.mot_alb) + ' »</p>' : '') +
    '<p class="ligne-info">🎯 ' + (p.mode === 'direct' ? 'Pros choisis par lui' : 'Envoyée aux pros du secteur') + ' · ' + acceptes + ' sur ' + p.quota + ' accepté' + (acceptes > 1 ? 's' : '') +
      ' · ' + (p.appel_autorise ? '📞 accepte d\'être appelé' : '💬 messagerie seulement') + '</p>' +
    (lignes ? '<details class="historique"' + (p.statut === 'sans_suite' || suivisAVerifier(p).length ? ' open' : '') + '><summary>Les pros contactés (' + (p.pros || []).length + ')</summary>' + lignes + '</details>' : '') +
    '<p class="ligne-info" style="color:#7a7a75;">Demandée le ' + dateLisible(p.cree_le) + (p.maj_le && p.maj_le !== p.cree_le ? ' · dernière action le ' + dateLisible(p.maj_le) : '') + '</p>' +
    (peutEnvoyer ? blocEnvoiProjet(p) : '') +
  '</div>';
}

function afficherProjets() {
  const aTraiter = projets.filter(FILTRES_PROJETS[0][2]).length;
  document.getElementById('pastille-projets').textContent = aTraiter;
  document.getElementById('c-pj-traiter').textContent = aTraiter;
  document.getElementById('c-pj-cours').textContent = projets.filter(FILTRES_PROJETS[1][2]).length;
  document.getElementById('c-pj-faites').textContent = projets.filter(FILTRES_PROJETS[2][2]).length;
  document.getElementById('c-pj-acceptes').textContent = projets.reduce(function (n, p) { return n + (p.pros || []).filter(function (l) { return l.statut === 'acceptee'; }).length; }, 0);
  const nbSuivis = projets.reduce(function (n, p) { return n + suivisAVerifier(p).length; }, 0);
  document.getElementById('c-pj-suivis').textContent = nbSuivis;
  document.getElementById('pastille-projets').textContent = aTraiter + nbSuivis;

  if (!filtreProjets) filtreProjets = aTraiter ? 'a_traiter' : nbSuivis ? 'suivis' : 'toutes';
  document.getElementById('filtres-projets').innerHTML = FILTRES_PROJETS.map(function (f) {
    return '<button type="button" class="filtre' + (filtreProjets === f[0] ? ' actif' : '') + '" onclick="choisirFiltreProjets(\'' + f[0] + '\')">' + f[1] + ' <span class="nb">(' + projets.filter(f[2]).length + ')</span></button>';
  }).join('');
  const test = (FILTRES_PROJETS.find(function (f) { return f[0] === filtreProjets; }) || FILTRES_PROJETS[FILTRES_PROJETS.length - 1])[2];
  const recherche = (document.getElementById('recherche-projets').value || '').trim().toLowerCase();
  const liste = projets.filter(test).filter(function (p) {
    if (!recherche) return true;
    const pa = p.particulier || {};
    return [pa.prenom, pa.nom, pa.email, pa.telephone, p.zone, p.code_postal, p.description, MODULES_PROJET[p.module]]
      .concat((p.pros || []).map(function (l) { return ((l.pro || {}).prenom || '') + ' ' + ((l.pro || {}).nom || '') + ' ' + ((l.pro || {}).nom_entreprise || ''); }))
      .some(function (x) { return String(x || '').toLowerCase().includes(recherche); });
  });
  const zone = document.getElementById('liste-projets');
  if (!liste.length) { zone.innerHTML = '<div class="carte vide">Aucun projet ici pour le moment. 🌿</div>'; return; }
  zone.innerHTML = grouperParPersonne(liste, function (p) { return p.particulier || {}; }).map(function (g) {
    return '<div class="proprio' + (g.p.role !== 'particulier' ? ' pro' : '') + '">' + enteteProprio(g.p, g.items.length + ' projet' + (g.items.length > 1 ? 's' : '')) +
      '<div class="liste-fiches">' + g.items.map(ficheProjet).join('') + '</div></div>';
  }).join('');
  chargerMediasGestion();
}

// Photos, plans, vidéo joints par le particulier (fichiers privés : liens temporaires)
function blocMediasGestion(d) {
  const m = Array.isArray(d.medias) ? d.medias : [];
  if (!m.length) return '';
  return '<p class="ligne-info">📷 <strong>Photos, plans, vidéo</strong></p><div class="photos-annonce">' + m.map(function (x) {
    return '<a class="media-projet" target="_blank" rel="noopener" data-chemin="' + albEchapper(x.chemin) + '" title="' + albEchapper(x.nom || '') + '" style="width:96px;height:72px;border-radius:6px;background:#EFEAE3;display:flex;align-items:center;justify-content:center;flex:0 0 auto;text-decoration:none;font-size:0.8rem;font-weight:600;">' +
      (x.type === 'photo' ? '<img alt="">' : (x.type === 'plan' ? '📄 Plan' : '🎬 Vidéo')) + '</a>';
  }).join('') + '</div>';
}
async function chargerMediasGestion() {
  const liens = Array.from(document.querySelectorAll('#liste-projets .media-projet:not([href])'));
  if (!liens.length) return;
  const { data, error } = await albSupabase.storage.from('projets-medias').createSignedUrls(liens.map(function (a) { return a.dataset.chemin; }), 3600);
  if (error || !data) { console.error('[ALB] Fichiers des projets :', error); return; }
  data.forEach(function (x, i) {
    if (!x || !x.signedUrl) return;
    liens[i].href = x.signedUrl;
    const img = liens[i].querySelector('img');
    if (img) img.src = x.signedUrl;
  });
}

// Après ton appel : tu précises les travaux, tu choisis les pros (ou tous ceux qui conviennent) et tu leur laisses un mot
const ROLE_MODULE = { financement: 'courtier', travaux: 'artisan', accompagnement: 'immo' };
function prosPourProjet(p, codes) {
  const dep = p.code_postal ? String(p.code_postal).slice(0, 2) : '';
  return membres.filter(function (m) {
    if (m.role !== ROLE_MODULE[p.module] || !m.statut_verifie || !m.profil_mis_en_ligne) return false;
    return true;
  }).map(function (m) {
    const metiers = m.metiers_artisan || [];
    const fait = p.module !== 'travaux' || !codes.length || !metiers.length || metiers.some(function (c) { return codes.indexOf(c) !== -1; });
    const zones = m.zone_intervention || [];
    const secteur = (p.zone && zones.indexOf(p.zone) !== -1) || (dep && (zones.some(function (z) { return (ZONES_PAR_DEPARTEMENT[dep === '83' ? 'Var' : 'Bouches-du-Rhône'] || []).indexOf(z) !== -1; }) || String(m.code_postal || '').slice(0, 2) === dep));
    return { m: m, fait: fait, secteur: secteur };
  }).sort(function (a, b) { return (b.fait + b.secteur) - (a.fait + a.secteur); });
}
function listeProsEnvoi(p) {
  const codes = Array.from(document.querySelectorAll('#envoi-' + p.id + ' .envoi-metier:checked')).map(function (c) { return c.value; });
  const liste = prosPourProjet(p, codes.filter(function (c) { return c !== 'autre'; }));
  if (!liste.length) return '<p class="aide">Aucun pro validé et en ligne pour ce type de projet pour le moment.</p>';
  return liste.map(function (x) {
    const m = x.m;
    const metiers = (m.metiers_artisan || []).map(function (c) { return c === 'autre' ? (m.artisan_autre || 'Autre') : libProjet('categorie', c); }).join(', ');
    return '<label style="display:flex;gap:8px;align-items:flex-start;font-size:0.86rem;margin:6px 0;"><input type="checkbox" class="envoi-pro" value="' + albEchapper(m.id) + '" style="width:auto;margin-top:3px;">' +
      '<span><strong>' + albEchapper(m.nom_entreprise || ((m.prenom || '') + ' ' + (m.nom || ''))) + '</strong>' +
      (metiers ? ' · ' + albEchapper(metiers) : '') +
      (!x.fait ? ' <span class="etiquette rouge">ne fait pas ces travaux</span>' : '') +
      (!x.secteur ? ' <span class="etiquette or">hors secteur</span>' : '') +
      (m.status_disponibilite === 'non_disponible' ? ' <span class="etiquette rouge">indisponible</span>' : '') + '</span></label>';
  }).join('');
}
function blocEnvoiProjet(p) {
  const codes = categoriesProjet(p.details || {}).map(function (c) { return ANCIENS_CODES[c] || c; });
  return '<div class="decision" id="envoi-' + p.id + '">' +
    '<div class="decision-titre">📞 Après ton appel, envoie sa demande</div>' +
    (p.module === 'travaux' ? '<p class="aide">Quels travaux ? (coche ce que vous avez vu ensemble)</p><div class="cases">' +
      TRAVAUX_CODES.map(function (c) {
        return '<label><input type="checkbox" class="envoi-metier" value="' + c + '"' + (codes.indexOf(c) !== -1 ? ' checked' : '') + ' onchange="majEnvoiProjet(\'' + p.id + '\')"> ' + albEchapper(libProjet('categorie', c)) + '</label>';
      }).join('') + '</div>' : '') +
    '<p class="aide" style="margin-top:10px;">À qui ? Coche jusqu\'à 3 pros, ou ne coche rien pour l\'envoyer à tous ceux ' + (p.module === 'travaux' ? 'qui font ces travaux dans son secteur.' : 'de son secteur.') + '</p>' +
    '<div class="envoi-pros">' + listeProsEnvoi(p) + '</div>' +
    '<label class="petit-champ" style="margin-top:8px;">Ton mot pour les pros <span style="font-weight:400">(facultatif, ils le verront avec la demande)</span>' +
    '<textarea class="envoi-mot" maxlength="1000" placeholder="Ex. : j\'ai eu Madame au téléphone, elle souhaite un devis rapidement pour sa salle de bains…"></textarea></label>' +
    '<div class="actions"><button type="button" class="bouton" onclick="envoyerProjetAuxPros(\'' + p.id + '\', this)">📨 Envoyer la demande</button></div>' +
  '</div>';
}
function majEnvoiProjet(id) {
  const p = projets.find(function (x) { return x.id === id; });
  const bloc = document.getElementById('envoi-' + id);
  if (!p || !bloc) return;
  const coches = Array.from(bloc.querySelectorAll('.envoi-pro:checked')).map(function (c) { return c.value; });
  bloc.querySelector('.envoi-pros').innerHTML = listeProsEnvoi(p);
  coches.forEach(function (v) { const c = bloc.querySelector('.envoi-pro[value="' + v + '"]'); if (c) c.checked = true; });
}

// ---------- Suivi après mise en relation (réponses des particuliers à 30 et 60 jours) ----------
const REPONSES_SUIVI = {
  artisan: { fait: '✅ Travaux faits', en_cours: '🔨 Travaux en cours ou devis signé', pas_encore: '⏳ Pas encore décidé', non: '✗ Pas de suite' },
  courtier: { fait: '✅ Prêt signé', en_cours: '📝 Dossier de prêt en cours', pas_encore: '⏳ Pas encore décidé', non: '✗ Pas de suite' },
  immo: { fait: '✅ Ils travaillent ensemble', en_cours: '💬 Ils en parlent encore', pas_encore: '⏳ Pas encore décidé', non: '✗ Pas de suite' },
  autre: { fait: '✅ C\'est fait', en_cours: '🔄 En cours', pas_encore: '⏳ Pas encore décidé', non: '✗ Pas de suite' }
};
function ligneSuivi(su, pr) {
  if (!su.envoye_le && !su.reponse) return '';
  const textes = REPONSES_SUIVI[pr.role] || REPONSES_SUIVI.autre;
  const aVerifier = (su.reponse === 'fait' || su.reponse === 'en_cours') && !su.traite_le;
  return '<div class="' + (aVerifier ? 'point-a-faire' : 'ligne-info') + '" style="margin:4px 0 8px 12px;">🔎 <strong>Suivi ' + su.etape + ' jours</strong> : ' +
    (su.reponse
      ? albEchapper(textes[su.reponse] || su.reponse) + (su.montant != null ? ' · ' + prixLisible(su.montant) : '') + ' <span style="color:#7a7a75;">(le ' + dateLisible(su.repondu_le) + ')</span>' +
        (su.commentaire ? '<br><span class="mot">💬 « ' + albEchapper(su.commentaire) + ' »</span>' : '')
      : '<span style="color:#7a7a75;">e-mail envoyé le ' + dateLisible(su.envoye_le) + ', pas encore de réponse</span>') +
    (su.traite_le ? '<br><span class="etiquette vert">✓ Vérifié le ' + dateLisible(su.traite_le) + '</span>' + (su.note_jocelyne ? ' <span style="color:#7a7a75;">' + albEchapper(su.note_jocelyne) + '</span>' : '') : '') +
    (aVerifier ? '<div class="actions" style="margin-top:6px;"><button type="button" class="bouton vert" onclick="suiviTraite(\'' + su.id + '\', this)">✓ Vérifié avec le pro</button></div>' : '') +
  '</div>';
}
async function suiviTraite(id, bouton) {
  const note = window.prompt('C\'est vérifié avec le pro ? Un petit mot pour t\'en souvenir (facultatif) — ex. : facture de 8 500 € reçue, 850 € à facturer.', '');
  if (note === null) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_suivi_traite', { p_id: id, p_note: note.trim().slice(0, 1000) || null });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await toutRecharger();
  afficherMessage('message-general', 'succes', '✓ C\'est noté : ce suivi est vérifié.');
}

async function envoyerProjetAuxPros(id, bouton) {
  const bloc = document.getElementById('envoi-' + id);
  const p = projets.find(function (x) { return x.id === id; }) || {};
  const categories = bloc ? Array.from(bloc.querySelectorAll('.envoi-metier:checked')).map(function (c) { return c.value; }) : [];
  const pros = bloc ? Array.from(bloc.querySelectorAll('.envoi-pro:checked')).map(function (c) { return c.value; }) : [];
  const mot = bloc ? bloc.querySelector('.envoi-mot').value.trim() : '';
  if (p.module === 'travaux' && !categories.length) { afficherMessage('message-general', 'erreur', 'Coche au moins un type de travaux avant d\'envoyer.'); return; }
  if (pros.length > 3) { afficherMessage('message-general', 'erreur', 'Coche 3 pros au plus (ou aucun pour l\'envoyer à tous ceux qui conviennent).'); return; }
  if (!confirm(pros.length ? 'Envoyer cette demande aux ' + pros.length + ' pro(s) cochés ?' : 'Envoyer cette demande à tous les pros qui conviennent ?')) return;
  bouton.disabled = true;
  const r = await albAppelerGuichet({ action: 'envoyer_projet', projet_id: id, categories: categories, pros: pros, mot: mot });
  bouton.disabled = false;
  if (!r.ok) { afficherMessage('message-general', 'erreur', r.code === 'DEJA_ENVOYEE' ? 'Cette demande est déjà partie.' : albMessageErreur(r.code)); return; }
  await toutRecharger();
  afficherMessage('message-general', r.nb_pros ? 'succes' : 'info', r.nb_pros
    ? '📨 Demande envoyée à ' + r.nb_pros + ' pro' + (r.nb_pros > 1 ? 's' : '') + '. Le particulier est prévenu par e-mail.'
    : 'Toujours aucun pro disponible dans ce secteur (validé et en ligne). La demande reste « à orienter ».');
}

// ---------- Messages entre membres (lecture seule) ----------
function personneMessage(p) {
  p = p || {};
  return badgeQuiLarge(p) + ' <strong>' + albEchapper(((p.prenom || '') + ' ' + (p.nom || '')).trim()) + '</strong>' +
    (p.nom_entreprise && p.role !== 'particulier' ? ' <span class="etiquette or">' + albEchapper(p.nom_entreprise) + '</span>' : '');
}
function badgeQuiLarge(p) {
  if (p.role === 'immo' || p.role === 'particulier') return badgeQui(p);
  const metiers = { courtier: '🏦 Courtier', artisan: '🔨 Artisan' };
  return '<span class="badge-qui agent">' + (metiers[p.role] || '🤝 Pro') + '</span>';
}
function afficherMessages() {
  const zone = document.getElementById('liste-messages');
  const recherche = (document.getElementById('recherche-messages').value || '').trim().toLowerCase();
  const liste = conversations.filter(function (c) {
    if (!recherche) return true;
    const i = c.initiateur || {}, d = c.destinataire || {};
    return [c.sujet, i.prenom, i.nom, i.nom_entreprise, d.prenom, d.nom, d.nom_entreprise].concat((c.messages || []).map(function (m) { return m.texte; }))
      .some(function (v) { return String(v || '').toLowerCase().includes(recherche); });
  });
  if (!liste.length) { zone.innerHTML = '<div class="carte vide">Aucune conversation pour le moment. 🌿</div>'; return; }
  zone.innerHTML = liste.map(function (c) {
    const i = c.initiateur || {}, d = c.destinataire || {};
    const noms = {}; noms[i.id] = i.prenom || 'Initiateur'; noms[d.id] = d.prenom || 'Destinataire';
    return '<div class="carte fiche">' +
      '<p class="ligne-info">' + personneMessage(i) + ' <span style="color:#7a7a75;">a écrit à</span> ' + personneMessage(d) + '</p>' +
      '<p class="ligne-info">📌 ' + albEchapper(c.sujet) + ' · ' + (c.messages || []).length + ' message' + ((c.messages || []).length > 1 ? 's' : '') + ' · dernier le ' + dateLisible(c.dernier_message_le) + '</p>' +
      '<details class="historique"><summary>Lire la conversation</summary>' +
        (c.messages || []).map(function (m) {
          return '<p class="ligne-info mot"><strong>' + albEchapper(noms[m.auteur_id] || '?') + '</strong> · ' + dateLisible(m.le) + ' : ' + albEchapper(m.texte) + '</p>';
        }).join('') +
      '</details>' +
    '</div>';
  }).join('');
}

// ---------- Vendeurs sous mandat exclusif ----------
function afficherRappelsMandat() {
  const zone = document.getElementById('liste-mandats');
  if (!rappelsMandat.length) { zone.innerHTML = '<div class="carte vide">Personne à rappeler pour le moment. 🌿</div>'; return; }
  zone.innerHTML = rappelsMandat.map(function (r) {
    const tel = (r.telephone || '').replace(/[^0-9+]/g, '');
    const echu = r.fin_mandat && new Date(r.fin_mandat + 'T12:00:00') <= new Date();
    return '<div class="carte fiche">' +
      '<h3>' + albEchapper((r.prenom || '') + ' ' + (r.nom || '')) + '</h3>' +
      (r.fin_mandat ? '<p class="ligne-info">' + (echu ? '🔔 <strong>Mandat terminé le ' : '📅 Fin du mandat le ') + dateLisible(r.fin_mandat) + (echu ? '</strong> : c\'est le moment d\'appeler !' : '') + '</p>' : '<p class="ligne-info">📅 Date de fin non précisée</p>') +
      (tel ? '<p class="ligne-info">📱 <a href="tel:' + albEchapper(tel) + '">' + albEchapper(r.telephone) + '</a></p>' : '') +
      (r.email ? '<p class="ligne-info">✉️ <a href="mailto:' + albEchapper(r.email) + '">' + albEchapper(r.email) + '</a></p>' : '') +
      (r.message ? '<p class="ligne-info mot">💬 « ' + albEchapper(r.message) + ' »</p>' : '') +
      '<p class="ligne-info">🗓️ Demande du ' + dateLisible(r.cree_le) + ' · ✅ accepte d\'être recontacté(e)</p>' +
      '<div class="actions"><button class="bouton discret" onclick="rappelMandatFait(' + Number(r.id) + ', this)">✓ Rappel fait</button></div>' +
    '</div>';
  }).join('');
}

async function rappelMandatFait(id, bouton) {
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_rappel_mandat_traite', { p_id: id });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await toutRecharger();
}

// ---------- Pros à valider ----------
function afficherAValider() {
  const liste = membres.filter(function (m) {
    return (metierDe(m) || m.metier_autre) && !m.statut_verifie && m.statut !== 'refuse';
  });
  const zone = document.getElementById('liste-a-valider');
  if (!liste.length) { zone.innerHTML = '<div class="carte vide">Aucun pro en attente pour le moment. 🌿</div>'; return; }

  zone.innerHTML = liste.map(function (m) {
    const metier = metierDe(m);
    const selectMetier = metier ? '' :
      '<label class="petit-champ">Métier à attribuer' +
      '<select id="metier-' + m.id + '" onchange="afficherNomMetier(\'' + m.id + '\')"><option value="">— Choisir —</option>' +
      Object.keys(METIERS).map(function (k) { return '<option value="' + k + '"' + (k === 'autre' && m.metier_autre ? ' selected' : '') + '>' + METIERS[k] + '</option>'; }).join('') +
      '</select></label>';
    // Nom du métier « autre » : c'est ce libellé qui apparaîtra dans les filtres
    const nomVisible = metier === 'autre' || (!metier && m.metier_autre);
    const nomMetier =
      '<label class="petit-champ' + (nomVisible ? '' : ' cache') + '" id="bloc-nom-metier-' + m.id + '">Nom du métier (affiché dans les filtres)' +
      '<input id="nom-metier-' + m.id + '" maxlength="60" value="' + albEchapper(m.metier_autre || '') + '"></label>';
    const choixMetier = selectMetier + nomMetier;
    return '<div class="carte fiche">' +
      '<h3>' + albEchapper((m.prenom || '') + ' ' + (m.nom || '')) + '</h3>' +
      (m.nom_entreprise ? '<p class="ligne-info">🏢 ' + albEchapper(m.nom_entreprise) + '</p>' : '') +
      etiquettesDe(m) + messageDe(m) + coordonnees(m) +
      '<p class="ligne-info">🗓️ Inscrit le ' + dateLisible(m.date_creation) + '</p>' +
      '<div class="actions">' + choixMetier +
        '<label class="petit-champ">SIRET (14 chiffres)<input id="siret-' + m.id + '" inputmode="numeric" maxlength="17" value="' + albEchapper(m.siret || '') + '"></label>' +
        '<button class="bouton vert" onclick="validerPro(\'' + m.id + '\', this)">✓ Valider</button>' +
        '<button class="bouton rouge" onclick="refuserPro(\'' + m.id + '\', this)">✗ Refuser</button>' +
      '</div></div>';
  }).join('');
}

function afficherNomMetier(id) {
  const autre = document.getElementById('metier-' + id).value === 'autre';
  document.getElementById('bloc-nom-metier-' + id).classList.toggle('cache', !autre);
}

async function validerPro(id, bouton) {
  bouton.disabled = true;
  const membre = membres.find(function (m) { return m.id === id; }) || {};
  const choix = document.getElementById('metier-' + id);
  const metierChoisi = choix ? choix.value : metierDe(membre);
  const nomMetier = document.getElementById('nom-metier-' + id).value.trim();
  if (!metierChoisi) { afficherMessage('message-general', 'erreur', ERREURS.METIER_A_CHOISIR); bouton.disabled = false; return; }
  if (metierChoisi === 'autre' && !nomMetier) { afficherMessage('message-general', 'erreur', ERREURS.METIER_AUTRE_MANQUANT); bouton.disabled = false; return; }
  // On enregistre le métier s'il vient d'être choisi, ou si le nom du métier « autre » a été retouché
  if (choix || (metierChoisi === 'autre' && nomMetier !== (membre.metier_autre || ''))) {
    const { error } = await albSupabase.rpc('alb_gestion_definir_metier', {
      p_id: id, p_metier: metierChoisi, p_metier_autre: metierChoisi === 'autre' ? nomMetier : null
    });
    if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); bouton.disabled = false; return; }
  }
  const siret = document.getElementById('siret-' + id).value;
  const { error } = await albSupabase.rpc('alb_gestion_valider_pro', { p_id: id, p_siret: siret || null });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  afficherMessage('message-general', 'succes', 'Pro validé 🎉 Son e-mail de bienvenue est parti. Complète sa fiche dans « Pros validés », puis mets-le en ligne.');
  await toutRecharger();
}

async function refuserPro(id, bouton) {
  if (!confirm('Refuser ce professionnel ? Il ne pourra pas apparaître sur « Nos pros ALB ».')) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_refuser_pro', { p_id: id });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  afficherMessage('message-general', 'info', 'Pro refusé. Il reste visible dans « Membres ».');
  await toutRecharger();
}

// ---------- Avis sur les pros ----------
const STATUTS_AVIS = { en_attente: '⏳ À relire', publie: '✅ Publié', refuse: '✗ Non publié' };
const FILTRES_AVIS = [
  ['a_relire', '⏳ À relire', function (a) { return a.statut === 'en_attente'; }],
  ['publies', '✅ Publiés', function (a) { return a.statut === 'publie'; }],
  ['refuses', '✗ Non publiés', function (a) { return a.statut === 'refuse'; }],
  ['tous', 'Tous', function () { return true; }]
];

function etoilesAvis(note) {
  const n = Math.max(0, Math.min(5, Number(note) || 0));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function choisirFiltreAvis(nom) { filtreAvis = nom; afficherAvis(); }

function afficherAvis() {
  const aRelire = avis.filter(FILTRES_AVIS[0][2]).length;
  document.getElementById('pastille-avis').textContent = aRelire;
  document.getElementById('c-avis-a-relire').textContent = aRelire;

  document.getElementById('filtres-avis').innerHTML = FILTRES_AVIS.map(function (f) {
    return '<button type="button" class="filtre' + (filtreAvis === f[0] ? ' actif' : '') + '" onclick="choisirFiltreAvis(\'' + f[0] + '\')">' + f[1] + ' <span class="nb">(' + avis.filter(f[2]).length + ')</span></button>';
  }).join('');

  const filtre = (FILTRES_AVIS.find(function (f) { return f[0] === filtreAvis; }) || FILTRES_AVIS[3])[2];
  const recherche = (document.getElementById('recherche-avis').value || '').trim().toLowerCase();
  const liste = avis.filter(filtre).filter(function (a) {
    if (!recherche) return true;
    return [a.pro, a.auteur, a.auteur_email, a.texte].join(' ').toLowerCase().includes(recherche);
  });
  const zone = document.getElementById('liste-avis');
  if (!liste.length) {
    zone.innerHTML = '<div class="carte vide">' + (filtreAvis === 'a_relire' ? 'Aucun avis à relire pour le moment. 🌿' : 'Aucun avis ici.') + '</div>';
    return;
  }
  zone.innerHTML = liste.map(function (a) {
    const modifie = a.maj_le && a.cree_le && (new Date(a.maj_le) - new Date(a.cree_le) > 60000);
    const classeStatut = a.statut === 'publie' ? ' vert' : a.statut === 'refuse' ? ' rouge' : ' or';
    const boutons = [];
    if (a.statut !== 'publie') boutons.push('<button class="bouton vert" onclick="modererAvis(\'' + a.id + '\', \'publie\', this)">✓ Publier</button>');
    if (a.statut === 'en_attente') boutons.push('<button class="bouton rouge" onclick="modererAvis(\'' + a.id + '\', \'refuse\', this)">✗ Ne pas publier</button>');
    if (a.statut === 'publie') boutons.push('<button class="bouton rouge" onclick="modererAvis(\'' + a.id + '\', \'refuse\', this)">Retirer de la fiche</button>');
    return '<div class="carte fiche">' +
      '<h3>⭐ Avis sur ' + albEchapper(a.pro || 'un pro') + '</h3>' +
      '<div class="etiquettes"><span class="etiquette' + classeStatut + '">' + STATUTS_AVIS[a.statut] + '</span>' +
        (modifie ? '<span class="etiquette">✏️ Modifié par son auteur</span>' : '') + '</div>' +
      '<p class="ligne-info"><span class="etoiles-avis">' + etoilesAvis(a.note) + '</span> <strong>' + albEchapper(a.note) + '/5</strong></p>' +
      '<p class="ligne-info mot">« ' + albEchapper(a.texte) + ' »</p>' +
      '<p class="ligne-info">👤 ' + albEchapper(a.auteur || '') + (a.auteur_email ? ' · <a href="mailto:' + albEchapper(a.auteur_email) + '">' + albEchapper(a.auteur_email) + '</a>' : '') + '</p>' +
      '<p class="ligne-info">🗓️ Donné le ' + dateLisible(a.cree_le) + (modifie ? ' · modifié le ' + dateLisible(a.maj_le) : '') + '</p>' +
      '<p class="ligne-info aide-avis">Sur la fiche, seuls le prénom et l\'initiale du nom apparaissent.</p>' +
      '<div class="actions">' + boutons.join('') + '</div>' +
    '</div>';
  }).join('');
}

async function modererAvis(id, statut, bouton) {
  if (statut === 'refuse' && !confirm('Ne pas afficher cet avis sur la fiche du pro ?')) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_moderer_avis', { p_id: id, p_statut: statut });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  afficherMessage('message-general', statut === 'publie' ? 'succes' : 'info',
    statut === 'publie' ? 'Avis publié ✓ Il apparaît maintenant sur la fiche du pro dans « Nos pros ALB ».' : "Cet avis n'apparaît pas sur la fiche du pro. Il reste dans l'onglet « Non publiés ».");
  await toutRecharger();
}

// ---------- Remplacements entre pros (pour info) ----------
const STATUTS_RENVOI = { en_attente: '⏳ En attente de sa réponse', accepte: '✅ Remplacement en cours', refuse: '✗ A refusé', annule: 'Terminé' };
function carteRenvoi(r) {
  const classe = r.statut === 'accepte' ? ' vert' : r.statut === 'en_attente' ? ' or' : '';
  const dispo = r.pro_disponibilite === 'non_disponible' ? 'indisponible' : r.pro_disponibilite === 'occupé' ? 'occupé' : 'disponible';
  return '<div class="carte fiche">' +
    '<div class="etiquettes"><span class="etiquette' + classe + '">' + (STATUTS_RENVOI[r.statut] || albEchapper(r.statut)) + '</span></div>' +
    '<p class="ligne-info"><strong>' + albEchapper(r.remplacant) + '</strong> remplace <strong>' + albEchapper(r.pro) + '</strong></p>' +
    '<p class="ligne-info">🕒 ' + albEchapper(r.pro) + ' est actuellement ' + dispo +
      (r.statut === 'accepte' && dispo !== 'indisponible' ? ' : ses demandes lui reviennent directement.' : '.') + '</p>' +
    (r.message ? '<p class="ligne-info mot">💬 « ' + albEchapper(r.message) + ' »</p>' : '') +
    '<p class="ligne-info">🗓️ Demandé le ' + dateLisible(r.cree_le) + (r.repondu_le ? ' · réponse le ' + dateLisible(r.repondu_le) : '') + '</p>' +
  '</div>';
}
function afficherRenvois() {
  const actifs = renvois.filter(function (r) { return r.statut === 'en_attente' || r.statut === 'accepte'; });
  const anciens = renvois.filter(function (r) { return r.statut !== 'en_attente' && r.statut !== 'accepte'; });
  document.getElementById('c-renvois').textContent = renvois.filter(function (r) { return r.statut === 'accepte'; }).length;
  document.getElementById('liste-renvois').innerHTML =
    (actifs.length ? '<div class="liste-fiches">' + actifs.map(carteRenvoi).join('') + '</div>' : '<div class="carte vide">Aucun remplacement en cours. 🌿</div>') +
    (anciens.length ? '<details class="historique"><summary>🕘 Anciens remplacements (' + anciens.length + ')</summary><div class="liste-fiches">' + anciens.map(carteRenvoi).join('') + '</div></details>' : '');
}

// ---------- Pros validés ----------
function afficherValides() {
  const liste = membres.filter(function (m) { return metierDe(m) && m.statut_verifie; });
  const zone = document.getElementById('liste-valides');
  if (!liste.length) { zone.innerHTML = '<div class="carte vide">Aucun pro validé pour le moment.</div>'; return; }

  zone.innerHTML = liste.map(function (m) {
    const metier = metierDe(m);
    const zones = m.zone_intervention || [];
    const ficheIncomplete = !m.presentation || !m.ville || !zones.length;
    return '<div class="carte fiche">' +
      '<h3>' + albEchapper(m.nom_entreprise || ((m.prenom || '') + ' ' + (m.nom || ''))) + '</h3>' +
      '<p class="ligne-info">👤 ' + albEchapper((m.prenom || '') + ' ' + (m.nom || '')) + '</p>' +
      etiquettesDe(m) + messageDe(m) + coordonnees(m) +
      (ficheIncomplete ? '<p class="ligne-info">⚠️ Fiche à compléter (présentation, ville, zones) avant la mise en ligne.</p>' : '') +
      '<div class="actions">' +
        (m.profil_mis_en_ligne
          ? '<button class="bouton rouge" onclick="mettreEnLigne(\'' + m.id + '\', false, this)">Retirer de Nos pros ALB</button>'
          : '<button class="bouton vert" onclick="mettreEnLigne(\'' + m.id + '\', true, this)">🌐 Mettre en ligne</button>') +
        '<button class="bouton discret" onclick="basculerFiche(\'' + m.id + '\')">✏️ Compléter la fiche</button>' +
      '</div>' +
      formulaireFiche(m, metier) +
      '</div>';
  }).join('');
}

function formulaireFiche(m, metier) {
  const zones = m.zone_intervention || [];
  const dispo = m.status_disponibilite || 'joignable';
  const option = function (valeur, libelle) { return '<option value="' + valeur + '"' + (dispo === valeur ? ' selected' : '') + '>' + libelle + '</option>'; };
  return '<form class="formulaire-fiche cache" id="fiche-' + m.id + '" onsubmit="enregistrerFiche(event, \'' + m.id + '\')">' +
    '<div class="grille">' +
      '<div class="champ"><label>Nom de l\'entreprise</label><input name="nom_entreprise" value="' + albEchapper(m.nom_entreprise || '') + '"></div>' +
      '<div class="champ"><label>Disponibilité</label><select name="status_disponibilite">' +
        option('joignable', 'Disponible') + option('occupé', 'Occupé en ce moment') + option('non_disponible', 'Indisponible') +
      '</select></div>' +
      '<div class="champ large"><label>Présentation (500 caractères maximum)</label><textarea name="presentation" maxlength="500">' + albEchapper(m.presentation || m.bio || '') + '</textarea></div>' +
      '<div class="champ"><label>Ville</label><input name="ville" value="' + albEchapper(m.ville || '') + '"></div>' +
      '<div class="champ"><label>Code postal</label><input name="code_postal" inputmode="numeric" maxlength="5" value="' + albEchapper(m.code_postal || '') + '"></div>' +
      (metier === 'autre' ? '<div class="champ"><label>Nom du métier (affiché dans les filtres)</label><input name="metier_autre" maxlength="60" value="' + albEchapper(m.metier_autre || '') + '"></div>' : '') +
      Object.keys(ZONES_PAR_DEPARTEMENT).map(function (dep) {
        return '<div class="champ large"><label>Zones d\'intervention — ' + dep + '</label><div class="cases">' +
          ZONES_PAR_DEPARTEMENT[dep].map(function (z) {
            return '<label><input type="checkbox" name="zone" value="' + albEchapper(z) + '"' + (zones.includes(z) ? ' checked' : '') + '> ' + albEchapper(z) + '</label>';
          }).join('') +
        '</div></div>';
      }).join('') +
      '<div class="champ large"><label>Autres zones (séparées par une virgule)</label><input name="autres_zones" maxlength="200" placeholder="Ex. : Sainte-Maxime, Avignon" value="' + albEchapper(zones.filter(function (z) { return !ZONES.includes(z); }).join(', ')) + '"><div class="aide">Elles apparaîtront aussi dans les filtres de « Nos pros ALB ».</div></div>' +
      '<div class="champ"><label>Photo ou logo (adresse de l\'image)</label><input name="photo_url" value="' + albEchapper(m.photo_url || '') + '"><div class="aide">Facultatif — l\'envoi de photo depuis le site arrive bientôt.</div></div>' +
      (metier === 'courtier' ? '<div class="champ"><label>Numéro ORIAS</label><input name="numero_orias" value="' + albEchapper(m.numero_orias || '') + '"></div>' : '') +
      (metier === 'agent' || metier === 'mandataire' ? '<div class="champ"><label>Numéro de carte T</label><input name="numero_carte_t" value="' + albEchapper(m.numero_carte_t || '') + '"></div>' : '') +
      (metier === 'artisan' ? '<div class="champ"><label>&nbsp;</label><div class="cases"><label><input type="checkbox" name="label_rge"' + (m.label_rge ? ' checked' : '') + '> Label RGE</label></div></div>' : '') +
      (metier === 'artisan' ? '<div class="champ large"><label>Corps de métier (affichés dans les filtres)</label><div class="cases">' +
        Object.keys(METIERS_ARTISAN).map(function (c) {
          return '<label><input type="checkbox" name="metier_artisan" value="' + c + '"' + ((m.metiers_artisan || []).includes(c) ? ' checked' : '') + '> ' + METIERS_ARTISAN[c] + '</label>';
        }).join('') +
        '</div></div>' +
        '<div class="champ"><label>Si « Autre » : lequel ?</label><input name="artisan_autre" maxlength="60" value="' + albEchapper(m.artisan_autre || '') + '"></div>' : '') +
    '</div>' +
    '<div class="actions"><button type="submit" class="bouton">💾 Enregistrer la fiche</button></div>' +
  '</form>';
}

function basculerFiche(id) {
  document.getElementById('fiche-' + id).classList.toggle('cache');
}

async function enregistrerFiche(event, id) {
  event.preventDefault();
  const f = event.target;
  const valeur = function (nom) { return f.elements[nom] ? f.elements[nom].value : ''; };
  const fiche = {
    nom_entreprise: valeur('nom_entreprise'),
    presentation: valeur('presentation'),
    ville: valeur('ville'),
    code_postal: valeur('code_postal'),
    metier_autre: valeur('metier_autre'),
    zone_intervention: Array.from(f.querySelectorAll('input[name="zone"]:checked')).map(function (c) { return c.value; })
      .concat(valeur('autres_zones').split(',').map(function (z) { return z.trim(); }).filter(Boolean)),
    status_disponibilite: valeur('status_disponibilite'),
    photo_url: valeur('photo_url'),
    numero_orias: valeur('numero_orias'),
    numero_carte_t: valeur('numero_carte_t'),
    label_rge: f.elements['label_rge'] ? f.elements['label_rge'].checked : false
  };
  // Artisan : ses corps de métier
  if (f.querySelector('input[name="metier_artisan"]')) {
    fiche.metiers_artisan = Array.from(f.querySelectorAll('input[name="metier_artisan"]:checked')).map(function (c) { return c.value; });
    fiche.artisan_autre = valeur('artisan_autre');
  }
  const bouton = f.querySelector('button[type="submit"]');
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_modifier_fiche', { p_id: id, p_fiche: fiche });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  afficherMessage('message-general', 'succes', 'Fiche enregistrée ✓');
  await toutRecharger();
}

async function mettreEnLigne(id, enLigne, bouton) {
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_mettre_en_ligne', { p_id: id, p_en_ligne: enLigne });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  afficherMessage('message-general', 'succes', enLigne ? 'Le pro est maintenant visible sur « Nos pros ALB » 🌐' : 'Le pro a été retiré de « Nos pros ALB ».');
  await toutRecharger();
}

// ---------- Membres ----------
function afficherMembres() {
  const recherche = (document.getElementById('recherche-membres').value || '').toLowerCase().trim();
  const liste = membres.filter(function (m) {
    if (!recherche) return true;
    return [m.prenom, m.nom, m.email, m.telephone, m.nom_entreprise, m.ville, m.besoin_autre, m.message_inscription, m.metier_autre]
      .some(function (v) { return String(v || '').toLowerCase().includes(recherche); });
  });
  const zone = document.getElementById('liste-membres');
  if (!liste.length) { zone.innerHTML = '<div class="vide">Aucun membre trouvé.</div>'; return; }
  zone.innerHTML = liste.map(function (m) {
    return '<div class="membre">' +
      '<div class="membre-nom">' + albEchapper((m.prenom || '') + ' ' + (m.nom || '')) + (m.nom_entreprise ? ' · ' + albEchapper(m.nom_entreprise) : '') + '</div>' +
      etiquettesDe(m) + messageDe(m) + coordonnees(m) +
      '<p class="ligne-info">🗓️ Inscrit le ' + dateLisible(m.date_creation) + '</p>' +
      (m.compte_bloque ? '<p class="ligne-info">⛔ <strong>Compte en pause</strong> (trop de codes PIN faux)</p>' : '') +
      '<div class="actions">' +
        '<button class="bouton discret" onclick="basculerAcces(\'' + m.id + '\')">🔑 Accès</button>' +
        (m.compte_bloque ? '<button class="bouton discret" onclick="debloquer(\'' + m.id + '\', this)">🔓 Débloquer</button>' : '') +
      '</div>' +
      blocAcces(m.id, '') +
      historiqueDe(m) +
    '</div>';
  }).join('');
}

// ---------- Accès au compte ----------
function historiqueDe(m) {
  const h = m.historique || [];
  if (!h.length) return '';
  return '<details class="historique"><summary>🕘 Historique du compte</summary><ul>' +
    h.map(function (e) {
      return '<li>' + dateLisible(e.le) + ' : ' + albEchapper(e.evenement) + (e.detail ? ' (' + albEchapper(e.detail) + ')' : '') + '</li>';
    }).join('') + '</ul></details>';
}

// Petit bloc « préparer le lien » (nouvelle adresse facultative)
function blocAcces(id, emailPropose) {
  return '<div class="bloc-acces cache" id="acces-' + id + '">' +
    '<label class="petit-champ">Nouvelle adresse e-mail <span style="font-weight:400">(laisse vide pour un simple nouveau code PIN)</span>' +
    '<input id="acces-email-' + id + '" type="email" value="' + albEchapper(emailPropose || '') + '"></label>' +
    '<div class="actions"><button class="bouton" onclick="preparerLien(\'' + id + '\', this)">✅ C\'est bien lui : préparer le lien</button></div>' +
    '<div id="acces-resultat-' + id + '"></div>' +
    '<p class="ligne-info separation"><strong>📞 Il est au téléphone ?</strong> Tape directement le nouveau code PIN qu\'il te donne : il pourra se connecter tout de suite.</p>' +
    '<div class="actions">' +
      '<label class="petit-champ">Nouveau code PIN<input type="password" inputmode="numeric" maxlength="4" class="pin-direct"></label>' +
      '<label class="petit-champ">Confirme-le<input type="password" inputmode="numeric" maxlength="4" class="pin-direct-confirmation"></label>' +
      '<button class="bouton vert" onclick="mettrePinDirect(\'' + id + '\', this)">🔑 Enregistrer ce code</button>' +
    '</div>' +
    '<div class="resultat-pin"></div>' +
  '</div>';
}

// Jocelyne enregistre elle-même le nouveau code (membre au téléphone)
async function mettrePinDirect(id, bouton) {
  const bloc = bouton.closest('.bloc-acces');
  const pin = bloc.querySelector('.pin-direct').value.trim();
  const confirmation = bloc.querySelector('.pin-direct-confirmation').value.trim();
  const zone = bloc.querySelector('.resultat-pin');
  if (!/^[0-9]{4}$/.test(pin)) { zone.innerHTML = '<p class="ligne-info" style="color:#8A2D2D;">Le code PIN doit contenir exactement 4 chiffres.</p>'; return; }
  if (pin !== confirmation) { zone.innerHTML = '<p class="ligne-info" style="color:#8A2D2D;">Les deux codes ne sont pas identiques.</p>'; return; }
  bouton.disabled = true;
  const resultat = await albAppelerGuichet({ action: 'admin_definir_pin', profile_id: id, pin: pin });
  bouton.disabled = false;
  if (!resultat.ok) {
    zone.innerHTML = '<p class="ligne-info" style="color:#8A2D2D;">' + albEchapper(ERREURS[resultat.code] || albMessageErreur(resultat.code)) + '</p>';
    return;
  }
  const m = membres.find(function (x) { return x.id === id; }) || {};
  bloc.querySelector('.pin-direct').value = '';
  bloc.querySelector('.pin-direct-confirmation').value = '';
  await toutRecharger();
  afficherMessage('message-general', 'succes', '✅ C\'est enregistré ! ' + (m.prenom || 'Le membre') +
    ' peut se connecter tout de suite avec ' + (m.email || 'son adresse') + ' et ce nouveau code. Son compte est débloqué, et il reçoit un e-mail de confirmation.');
}

function basculerAcces(id) {
  document.querySelectorAll('[id="acces-' + id + '"]').forEach(function (b) { b.classList.toggle('cache'); });
}

function afficherDemandesAcces() {
  document.getElementById('pastille-acces').textContent = demandesAcces.length;
  const zone = document.getElementById('liste-acces');
  if (!demandesAcces.length) { zone.innerHTML = '<div class="carte vide">Aucune demande en attente. 🌿</div>'; return; }
  zone.innerHTML = demandesAcces.map(function (d) {
    const membre = membres.find(function (m) { return m.id === d.profile_id; });
    const tel = (d.telephone || '').replace(/[^0-9+]/g, '');
    return '<div class="carte fiche">' +
      '<h3>' + albEchapper((d.prenom || '') + ' ' + (d.nom || '')) + '</h3>' +
      '<p class="ligne-info">🗓️ Demande du ' + dateLisible(d.cree_le) + '</p>' +
      (tel ? '<p class="ligne-info">📱 <a href="tel:' + albEchapper(tel) + '">' + albEchapper(d.telephone) + '</a></p>' : '') +
      (d.email_actuel ? '<p class="ligne-info">✉️ Adresse actuelle : ' + albEchapper(d.email_actuel) + '</p>' : '') +
      (d.nouvel_email ? '<p class="ligne-info">➡️ Nouvelle adresse souhaitée : <strong>' + albEchapper(d.nouvel_email) + '</strong></p>' : '') +
      (d.message ? '<p class="ligne-info mot">💬 « ' + albEchapper(d.message) + ' »</p>' : '') +
      (membre
        ? '<p class="ligne-info">👤 Membre retrouvé : <strong>' + albEchapper((membre.prenom || '') + ' ' + (membre.nom || '')) + '</strong> (' + albEchapper(membre.email) + ')</p>' +
          '<div class="actions"><button class="bouton discret" onclick="basculerAcces(\'' + membre.id + '\')">🔑 Préparer son lien</button>' +
          '<button class="bouton discret" onclick="demandeTraitee(\'' + d.id + '\', this)">✓ Marquer comme traitée</button></div>' +
          blocAcces(membre.id, d.nouvel_email)
        : '<p class="ligne-info">⚠️ Aucun membre retrouvé avec cette adresse ou ce téléphone : appelle cette personne pour comprendre.</p>' +
          '<div class="actions"><button class="bouton discret" onclick="demandeTraitee(\'' + d.id + '\', this)">✓ Marquer comme traitée</button></div>') +
    '</div>';
  }).join('');
}

async function demandeTraitee(id, bouton) {
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_demande_traitee', { p_id: id });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await toutRecharger();
}

async function debloquer(id, bouton) {
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_debloquer', { p_id: id });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  afficherMessage('message-general', 'succes', 'Compte débloqué ✓');
  await toutRecharger();
}

// Prépare le lien, puis les messages tout rédigés à envoyer depuis TA messagerie / TON téléphone
async function preparerLien(id, bouton) {
  const bloc = bouton.closest('.bloc-acces');
  const nouvelEmail = bloc.querySelector('input[type="email"]').value.trim();
  bouton.disabled = true;
  const { data, error } = await albSupabase.rpc('alb_gestion_preparer_lien', { p_id: id, p_nouvel_email: nouvelEmail || null });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }

  const m = membres.find(function (x) { return x.id === id; }) || {};
  const lien = location.origin + '/nouveau-code.html#jeton=' + data.jeton;
  const changement = data.type === 'changement_email';
  const sujet = changement ? 'Votre nouvelle adresse sur ALB Immobilier' : 'Votre nouveau code PIN ALB';
  const texteEmail =
    'Bonjour ' + (m.prenom || '') + ',\n\n' +
    (changement
      ? 'Comme convenu au téléphone, voici votre lien pour enregistrer votre nouvelle adresse e-mail (' + data.email_envoi + ') et choisir un nouveau code PIN :'
      : 'Comme convenu au téléphone, voici votre lien pour choisir un nouveau code PIN :') +
    '\n\n' + lien + '\n\n' +
    'Ce lien est valable 48 heures et ne sert qu\'une seule fois.\n\n' +
    'À la bien, toujours ✨\nJocelyne\nALB Sud Immobilier · 07 45 60 28 05';
  const texteSms = 'Bonjour ' + (m.prenom || '') + ', c\'est Jocelyne d\'ALB. ' +
    (changement ? 'Je viens de vous envoyer par e-mail (' + data.email_envoi + ') le lien pour valider votre nouvelle adresse. ' : 'Voici votre lien pour choisir un nouveau code PIN : ' + lien + ' ') +
    'Valable 48 h. À la bien !';
  const tel = (m.telephone || '').replace(/[^0-9+]/g, '');

  const zone = document.getElementById('acces-resultat-' + id + '') ;
  const cible = bloc.querySelector('[id^="acces-resultat-"]') || zone;
  cible.innerHTML =
    '<p class="ligne-info" style="margin-top:10px;">✅ Lien prêt (valable 48 h). Envoie-le depuis chez toi :</p>' +
    '<p class="ligne-info"><strong>✉️ E-mail à envoyer à ' + albEchapper(data.email_envoi) + '</strong></p>' +
    '<textarea class="texte-pret" readonly>' + albEchapper(texteEmail) + '</textarea>' +
    '<div class="actions">' +
      '<a class="bouton" href="mailto:' + encodeURIComponent(data.email_envoi) + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(texteEmail) + '">Ouvrir ma messagerie</a>' +
      '<button class="bouton discret" type="button" onclick="copier(this)">📋 Copier l\'e-mail</button>' +
    '</div>' +
    '<p class="ligne-info" style="margin-top:12px;"><strong>📱 SMS pour le prévenir</strong>' + (tel ? ' (' + albEchapper(m.telephone) + ')' : '') + '</p>' +
    '<textarea class="texte-pret" readonly>' + albEchapper(texteSms) + '</textarea>' +
    '<div class="actions">' +
      (tel ? '<a class="bouton" href="sms:' + albEchapper(tel) + '?body=' + encodeURIComponent(texteSms) + '">Ouvrir mes SMS</a>' : '') +
      '<button class="bouton discret" type="button" onclick="copier(this)">📋 Copier le SMS</button>' +
    '</div>';
}

// Copie le texte juste au-dessus du bouton
async function copier(bouton) {
  const texte = bouton.closest('.actions').previousElementSibling.value;
  try { await navigator.clipboard.writeText(texte); }
  catch (e) { const t = bouton.closest('.actions').previousElementSibling; t.select(); document.execCommand('copy'); }
  const avant = bouton.textContent;
  bouton.textContent = '✓ Copié';
  setTimeout(function () { bouton.textContent = avant; }, 1500);
}

document.addEventListener('DOMContentLoaded', demarrer);

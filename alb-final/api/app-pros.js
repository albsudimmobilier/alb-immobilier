// ============================================================
// api/app-pros.js — Page "Nos pros ALB"
// ------------------------------------------------------------
// Les pros sont lus via la fonction sécurisée alb_pros_publics2() :
// elle ne renvoie QUE les infos publiques (jamais e-mail, téléphone,
// SIRET ni code PIN), et uniquement les pros validés ET mis en ligne.
//
// Les filtres se construisent tout seuls à partir des pros en ligne :
// dès que Jocelyne valide un pro « autre métier » (notaire, architecte…),
// un artisan avec de nouveaux corps de métier, ou ajoute une « autre zone »,
// ils apparaissent ici sans rien toucher.
// Les pros mettent eux-mêmes à jour leur fiche depuis leur espace ALB
// (photo, présentation, zones, rendez-vous, disponibilité, remplaçant).
//
// Avis : seule une personne qui a échangé avec le pro via ALB (et à qui
// il a répondu) peut donner son avis. Chaque avis est relu par ALB avant
// d'être publié. On n'affiche que le prénom et l'initiale du nom.
//
// « Envoyer un message » : si la personne est connectée, elle écrit depuis
// son espace ALB. Sinon, une petite fenêtre lui demande juste son nom, son
// e-mail, son téléphone, un code PIN et son message : son espace est créé
// en même temps (aucun e-mail automatique), le pro reçoit son message comme
// d'habitude, et la personne arrive dans Gestion du site pour que Jocelyne
// la contacte et lui envoie elle-même son message de bienvenue.
//
// Avis Google : si Jocelyne a enregistré le lien vers les avis Google d'un pro
// (depuis Gestion du site), un bouton « Voir ses avis Google » apparaît sur sa fiche.
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://kutbxyinpokebjdemlnq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wXbJu1TP2jZ05TcuMOut9Q_NcumnpIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mêmes listes que dans « Gestion du site »
const ZONES_PAR_DEPARTEMENT = {
  'Var': ['Toulon et environs', 'Centre Var', 'Est Var/Golfe', 'Dracénie', 'Haut Var/Verdon'],
  'Bouches-du-Rhône': ['Marseille et environs', "Pays d'Aix", 'Aubagne/La Ciotat', 'Étang de Berre/Martigues', "Salon/Pays d'Arles"]
};
const ZONES_CONNUES = Object.values(ZONES_PAR_DEPARTEMENT).flat();

const METIERS = {
  courtier: '🏦 Courtier',
  artisan: '🔨 Artisan',
  agent: '🏠 Agent immobilier',
  mandataire: '📋 Mandataire immobilier'
};

// Les autres professionnels (enregistrés en « autre métier » avec ce nom)
const EMOJIS_AUTRES_PROS = {
  'notaire': '📜', 'diagnostiqueur': '🔍', 'architecte': '📐', 'avocat': '⚖️', 'réseau partenaire': '🤝'
};
const ORDRE_AUTRES_PROS = Object.keys(EMOJIS_AUTRES_PROS).map(nom => 'autre:' + nom);

// Les corps de métier des artisans (mêmes codes que l'inscription)
const METIERS_ARTISAN = {
  macon: 'Maçon', renovation: 'Rénovation générale', plombier: 'Plombier', electricien: 'Électricien',
  peintre: 'Peintre', menuisier: 'Menuisier', couvreur: 'Couvreur', carreleur: 'Carreleur',
  chauffagiste: 'Chauffagiste', climaticien: 'Climaticien', pisciniste: 'Pisciniste', paysagiste: 'Paysagiste',
  terrassier: 'Terrassier – assainissement', facadier: 'Façadier – isolation RGE'
};

const LIBELLES_DISPONIBILITE = {
  joignable: 'Disponible',
  'occupé': 'Occupé en ce moment',
  non_disponible: 'Indisponible pour le moment'
};

let allPros = [];
let liensAvisGoogle = {};   // id du pro → lien vers ses avis Google (enregistré par Jocelyne)
let filteredPros = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 9;

document.addEventListener('DOMContentLoaded', loadPros);

// Petits styles (ajoutés ici pour ne pas toucher la page)
const stylesPros = document.createElement('style');
stylesPros.textContent = '.pro-rdv{font-size:.85rem;color:#4A4A47;margin:8px 0 0;}' +
  '.pro-remplacant{font-size:.85rem;margin:-6px 0 12px;text-align:center;}' +
  '.pro-remplacant a,.fiche-ligne a{color:#4B1A3E;font-weight:600;}' +
  // Boutons de la carte : « Envoyer un message » sur toute la largeur, puis « Avis » et « Profil »
  '.pro-action{flex-wrap:wrap;}.pro-action .btn-primary{flex-basis:100%;}' +
  '.etoiles{color:#B28E3D;letter-spacing:1px;}' +
  '.pro-avis{font-size:.88rem;color:#4A4A47;margin:8px 0 0;}' +
  '.fiche-avis{border-top:1px solid #E8E6E1;margin-top:18px;padding-top:14px;text-align:left;}' +
  '.fiche-avis h3{color:#4B1A3E;font-size:1.05rem;margin-bottom:10px;}' +
  '.un-avis{background:#FBF8F3;border-radius:8px;padding:12px 14px;margin-bottom:10px;}' +
  '.un-avis .qui{font-size:.82rem;color:#7a7a75;margin-top:4px;}' +
  '.modal-content .un-avis p{margin:6px 0 0;line-height:1.55;text-align:left;}' +
  '.avis-info{font-size:.85rem !important;color:#7a7a75 !important;line-height:1.5 !important;text-align:left !important;}' +
  '.choix-note{display:flex;gap:6px;margin:8px 0 16px;}' +
  '.choix-note button{background:none;border:none;font-size:2rem;line-height:1;color:#D8D5CE;cursor:pointer;padding:2px;}' +
  '.choix-note button.allumee{color:#B28E3D;}' +
  '#avis-texte{width:100%;min-height:120px;padding:10px 12px;border:1px solid #D8D5CE;border-radius:6px;font-family:inherit;font-size:.95rem;line-height:1.5;resize:vertical;}' +
  '#avis-texte:focus{outline:2px solid #B28E3D;border-color:#B28E3D;}' +
  '.avis-message{display:none;padding:10px 12px;border-radius:6px;margin-bottom:12px;font-size:.9rem;}' +
  '.avis-message.erreur{display:block;background:#FBECEC;color:#8A2D2D;}' +
  '.avis-message.succes{display:block;background:#EEF6EE;color:#2E6B34;}' +
  '.avis-statut{display:inline-block;font-size:.8rem;font-weight:600;padding:4px 10px;border-radius:20px;background:#F4EEF6;color:#5A3A6A;margin-bottom:12px;}' +
  '.modal-content p.avis-titre-note{margin-bottom:0;}.modal-content p.avis-apres-texte{margin-top:10px;}' +
  '.modal-buttons .modal-btn + .modal-btn{margin-left:8px;}' +
  '.modal-btn.discret{background:white;color:#5A3A6A;border:1px solid #D8D5CE;}' +
  '.modal-btn.discret:hover{background:#F5F3F0;color:#5A3A6A;}' +
  // Bouton « Voir ses avis Google » dans la fiche
  '.modal-content p.fiche-google{text-align:left;margin:14px 0 0;}' +
  '.fiche-google a{display:inline-block;padding:9px 16px;border:1px solid #D8D5CE;border-radius:20px;color:#4B1A3E;font-weight:600;font-size:.9rem;text-decoration:none;background:#fff;}' +
  '.fiche-google a:hover{border-color:#B28E3D;background:#FBF8F3;}' +
  // Fenêtre « Envoyer un message » (sans espace ALB)
  '.contact-form{display:flex;flex-direction:column;gap:12px;text-align:left;}' +
  '.contact-grille{display:grid;grid-template-columns:1fr;gap:12px;}' +
  '@media (min-width:560px){.contact-grille{grid-template-columns:1fr 1fr;}}' +
  '.contact-form label.champ{display:flex;flex-direction:column;gap:4px;font-size:.88rem;font-weight:600;color:#4A4A47;}' +
  '.contact-form input[type=text],.contact-form input[type=email],.contact-form input[type=tel],.contact-form input[type=password],.contact-form textarea{width:100%;padding:10px 12px;border:1px solid #D8D5CE;border-radius:6px;font-family:inherit;font-size:1rem;font-weight:400;color:#2a2a28;background:#fff;}' +
  '.contact-form textarea{min-height:120px;line-height:1.5;resize:vertical;}' +
  '.contact-form input:focus,.contact-form textarea:focus{outline:2px solid #B28E3D;border-color:#B28E3D;}' +
  '.contact-form label.case{display:flex;gap:10px;align-items:flex-start;font-size:.88rem;line-height:1.45;color:#4A4A47;font-weight:400;}' +
  '.contact-form label.case input{width:18px;height:18px;flex:none;margin-top:2px;accent-color:#5A3A6A;}' +
  '.contact-form label.case a{color:#5A3A6A;font-weight:600;}' +
  '.contact-aide{font-size:.82rem;color:#7a7a75;font-weight:400;}' +
  '.modal-content p.contact-deja{background:#FBF8F3;border-radius:8px;padding:10px 12px;font-size:.88rem;color:#4A4A47;text-align:left;line-height:1.5;margin-bottom:0;}' +
  '.contact-deja a{color:#5A3A6A;font-weight:600;}' +
  '.modal-content .contact-form p,.modal-content p.contact-intro{text-align:left;line-height:1.55;margin-bottom:0;}' +
  '.modal-content p.contact-intro{margin-bottom:14px;}' +
  '#contact-envoyer{width:100%;font-weight:700;}' +
  '#contact-envoyer:disabled{opacity:.6;cursor:wait;}';
document.head.appendChild(stylesPros);

// ★★★★☆ pour une note de 1 à 5
function etoiles(note) {
  const pleines = Math.round(Number(note) || 0);
  return '★'.repeat(pleines) + '☆'.repeat(5 - pleines);
}

// « 4,7 · 12 avis »
function resumeAvis(pro) {
  const nombre = Number(pro.avis_nombre) || 0;
  if (!nombre) return '';
  const moyenne = Number(pro.avis_moyenne).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `<span class="etoiles" aria-hidden="true">${etoiles(pro.avis_moyenne)}</span> ${moyenne} · ${nombre} avis`;
}

// Protège le texte écrit par les pros avant de l'afficher
function echapper(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Clé de métier utilisée par les filtres :
// courtier / artisan / agent / mandataire, ou "autre:<nom du métier>"
function cleMetier(pro) {
  if (pro.role === 'immo') return pro.sous_role_immo === 'mandataire' ? 'mandataire' : 'agent';
  if (pro.role === 'autre') return 'autre:' + (pro.metier_autre || 'Autre').trim().toLowerCase();
  return pro.role;
}

function libelleMetier(pro) {
  if (pro.role === 'autre') {
    const nom = (pro.metier_autre || 'Autre métier').trim();
    return (EMOJIS_AUTRES_PROS[nom.toLowerCase()] || '🤝') + ' ' + nom;
  }
  return METIERS[cleMetier(pro)] || pro.role;
}

// Corps de métier d'un artisan : [{ cle, libelle }]
// (le « autre » précisé par l'artisan devient un corps de métier à part entière)
function corpsDeMetier(pro) {
  if (pro.role !== 'artisan') return [];
  return (pro.metiers_artisan || []).map(code => {
    if (code === 'autre') {
      const nom = (pro.artisan_autre || '').trim();
      return nom ? { cle: 'autre:' + nom.toLowerCase(), libelle: nom } : null;
    }
    return METIERS_ARTISAN[code] ? { cle: code, libelle: METIERS_ARTISAN[code] } : null;
  }).filter(Boolean);
}

// « 🔨 Artisan · Plombier, Électricien »
function libelleComplet(pro) {
  const corps = corpsDeMetier(pro).map(c => c.libelle);
  return libelleMetier(pro) + (corps.length ? ' · ' + corps.join(', ') : '');
}

async function loadPros() {
  const [{ data, error }, liens] = await Promise.all([
    supabase.rpc('alb_pros_publics2'),
    supabase.rpc('alb_pros_liens_avis_google')
  ]);
  if (liens.error) console.error('[ALB DEBUG] Liens avis Google :', liens.error);
  else liensAvisGoogle = liens.data || {};

  if (error) {
    console.error('[ALB DEBUG] Nos pros ALB :', error);
    showError('Un petit souci nous empêche d\'afficher nos pros. Réessayez dans un instant.');
    construireFiltres();
    return;
  }

  allPros = data || [];
  console.log(`[ALB DEBUG] ${allPros.length} pros affichés sur Nos pros ALB`);
  construireFiltres();
  applyFilters();

  // Retour après connexion depuis « Donner son avis »
  const avisPour = new URLSearchParams(location.search).get('avis') || '';
  if (/^[0-9a-f-]{36}$/i.test(avisPour)) {
    history.replaceState(null, '', location.pathname);
    if (allPros.some(p => p.id === avisPour)) ouvrirAvis(encodeURIComponent(avisPour));
  }
}

// ---------- Filtres construits à partir des pros en ligne ----------
function caseFiltre(classe, valeur, libelle) {
  return `<label class="filtre-option"><input type="checkbox" class="${classe}" value="${echapper(valeur)}"> ${echapper(libelle)}</label>`;
}

function construireFiltres() {
  // Métiers : les 4 métiers classiques présents + chaque « autre métier »
  const metiers = new Map();
  allPros.forEach(pro => {
    const cle = cleMetier(pro);
    if (!metiers.has(cle)) metiers.set(cle, libelleMetier(pro));
  });
  const ordre = Object.keys(METIERS).concat(ORDRE_AUTRES_PROS);
  const clesMetiers = [...metiers.keys()].sort((a, b) => {
    const ia = ordre.indexOf(a), ib = ordre.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return metiers.get(a).localeCompare(metiers.get(b), 'fr');
  });
  document.getElementById('filtres-metiers').innerHTML = clesMetiers.length
    ? clesMetiers.map(cle => caseFiltre('role-filter', cle, metiers.get(cle))).join('')
    : '<p class="filtre-vide">Bientôt disponibles.</p>';

  // Corps de métier des artisans : dans l'ordre de la liste, puis les « autres »
  const corps = new Map();
  allPros.forEach(pro => corpsDeMetier(pro).forEach(c => { if (!corps.has(c.cle)) corps.set(c.cle, c.libelle); }));
  const ordreCorps = Object.keys(METIERS_ARTISAN);
  const clesCorps = [...corps.keys()].sort((a, b) => {
    const ia = ordreCorps.indexOf(a), ib = ordreCorps.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return corps.get(a).localeCompare(corps.get(b), 'fr');
  });
  let groupeCorps = document.getElementById('groupe-corps-metier');
  if (!groupeCorps) {
    groupeCorps = document.createElement('div');
    groupeCorps.className = 'filtre-groupe';
    groupeCorps.id = 'groupe-corps-metier';
    groupeCorps.innerHTML = '<h4>Corps de métier (artisans)</h4><div id="filtres-corps"></div>';
    const groupeMetiers = document.getElementById('filtres-metiers').closest('.filtre-groupe');
    groupeMetiers.parentNode.insertBefore(groupeCorps, groupeMetiers.nextSibling);
  }
  groupeCorps.style.display = clesCorps.length ? '' : 'none';
  document.getElementById('filtres-corps').innerHTML = clesCorps.map(cle => caseFiltre('corps-filter', cle, corps.get(cle))).join('');

  // Zones : regroupées par département, puis les « autres zones »
  const zonesPresentes = new Set(allPros.flatMap(pro => pro.zone_intervention || []));
  let html = '';
  Object.entries(ZONES_PAR_DEPARTEMENT).forEach(([departement, zones]) => {
    const presentes = zones.filter(z => zonesPresentes.has(z));
    if (presentes.length) {
      html += `<p class="filtre-sous-titre">${echapper(departement)}</p>` +
        presentes.map(z => caseFiltre('zone-filter', z, z)).join('');
    }
  });
  const autres = [...zonesPresentes].filter(z => !ZONES_CONNUES.includes(z)).sort((a, b) => a.localeCompare(b, 'fr'));
  if (autres.length) {
    html += '<p class="filtre-sous-titre">Autres zones</p>' + autres.map(z => caseFiltre('zone-filter', z, z)).join('');
  }
  document.getElementById('filtres-zones').innerHTML = html || '<p class="filtre-vide">Bientôt disponibles.</p>';

  document.querySelectorAll('.role-filter, .corps-filter, .zone-filter').forEach(caseACocher => {
    caseACocher.addEventListener('change', applyFilters);
  });
}

function applyFilters() {
  const selectedRoles = Array.from(document.querySelectorAll('.role-filter:checked')).map(el => el.value);
  const selectedCorps = Array.from(document.querySelectorAll('.corps-filter:checked')).map(el => el.value);
  const selectedZones = Array.from(document.querySelectorAll('.zone-filter:checked')).map(el => el.value);

  filteredPros = allPros.filter(pro => {
    // Métier : un corps de métier coché affine les artisans ;
    // « Courtier » + « Plombier » montre les courtiers ET les plombiers.
    if (pro.role === 'artisan') {
      if (selectedCorps.length > 0) {
        if (!corpsDeMetier(pro).some(c => selectedCorps.includes(c.cle))) return false;
      } else if (selectedRoles.length > 0 && !selectedRoles.includes('artisan')) return false;
    } else if (selectedRoles.length > 0 || selectedCorps.length > 0) {
      if (!selectedRoles.includes(cleMetier(pro))) return false;
    }
    if (selectedZones.length > 0) {
      const proZones = pro.zone_intervention || [];
      if (!selectedZones.some(zone => proZones.includes(zone))) return false;
    }
    return true;
  });

  currentPage = 1;
  renderPros();
  renderPagination();
}

function renderPros() {
  const grid = document.getElementById('pros-grid');
  grid.innerHTML = '';

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pagePros = filteredPros.slice(start, start + ITEMS_PER_PAGE);

  if (pagePros.length === 0) {
    grid.innerHTML = allPros.length
      ? '<p class="vitrine-vide">Aucun pro ne correspond à ces filtres pour le moment. Essayez d\'en retirer un.</p>'
      : '<p class="vitrine-vide">Nos professionnels arrivent très bientôt. Revenez nous voir !</p>';
    return;
  }

  pagePros.forEach(pro => grid.appendChild(createProCard(pro)));
}

function nomAffiche(pro) {
  return pro.nom_entreprise || `${pro.prenom || ''} ${pro.nom || ''}`.trim();
}

function avatarHtml(pro) {
  const initiales = `${pro.prenom?.[0] || ''}${pro.nom?.[0] || ''}`.toUpperCase() || 'PRO';
  if (pro.photo_url && /^https:\/\//i.test(pro.photo_url)) {
    return `<img class="pro-avatar" src="${echapper(pro.photo_url)}" alt="${echapper(nomAffiche(pro))}">`;
  }
  return `<div class="pro-avatar">${echapper(initiales)}</div>`;
}

// Les types de rendez-vous proposés par le pro
function rendezVous(pro) {
  const m = pro.modes || {};
  return [m.telephone ? '📞 Téléphone' : '', m.visio ? '💻 Visio' : '', m.physique ? '🤝 En personne' : ''].filter(Boolean);
}

// Pro indisponible qui a organisé son remplacement
function remplacantHtml(pro, classe) {
  if (!pro.remplace_par || !pro.remplace_par.id) return '';
  return `<p class="${classe}">🔁 En son absence : <a href="espace-alb.html?contacter=${encodeURIComponent(pro.remplace_par.id)}" onclick="return contacterPro(event, '${encodeURIComponent(pro.remplace_par.id)}')">${echapper(pro.remplace_par.nom)}</a></p>`;
}

// Badge « Validé ALB » : calculé par la base à partir des avis publiés
// (au moins 3 avis et 4 étoiles de moyenne ; retiré si la moyenne tombe à 3 ou moins)
const TEXTE_BADGE = 'Badge « Validé ALB » : au moins 3 avis de particuliers, avec une moyenne d’au moins 4 étoiles.';

function createProCard(pro) {
  const zonesHtml = (pro.zone_intervention || [])
    .map(zone => `<span class="zone-tag">${echapper(zone)}</span>`).join('');
  const localisation = `${pro.code_postal || ''} ${pro.ville || ''}`.trim() || 'Var / Bouches-du-Rhône';
  const disponibilite = LIBELLES_DISPONIBILITE[pro.status_disponibilite] || 'Disponible';
  const classeDispo = pro.status_disponibilite && pro.status_disponibilite !== 'joignable' ? 'occupe' : 'disponible';

  const card = document.createElement('div');
  card.className = 'pro-card';
  card.innerHTML = `
    <div class="pro-header">
      ${avatarHtml(pro)}
      <div class="pro-name">${echapper(nomAffiche(pro))}</div>
      <div class="pro-role">${echapper(libelleComplet(pro))}</div>
      ${pro.badge_alb ? `<div class="pro-valide" title="${echapper(TEXTE_BADGE)}">Validé ALB ✓</div>` : ''}
    </div>
    <div class="pro-body">
      <p class="pro-presentation">${echapper(pro.presentation || pro.bio || 'Professionnel du réseau ALB')}</p>
      <p class="pro-localisation"><strong>📍 ${echapper(localisation)}</strong></p>
      ${zonesHtml ? `<div class="pro-zones">${zonesHtml}</div>` : ''}
      ${rendezVous(pro).length ? `<p class="pro-rdv">Rendez-vous : ${echapper(rendezVous(pro).join(' · '))}</p>` : ''}
      ${resumeAvis(pro) ? `<p class="pro-avis">${resumeAvis(pro)}</p>` : ''}
      <div class="pro-status ${classeDispo}">${echapper(disponibilite)}</div>
      ${remplacantHtml(pro, 'pro-remplacant')}
      <div class="pro-action">
        <a href="espace-alb.html?contacter=${encodeURIComponent(pro.id)}" class="btn btn-primary" onclick="return contacterPro(event, '${encodeURIComponent(pro.id)}')">💬 Envoyer un message</a>
        <button type="button" class="btn btn-secondary" onclick="ouvrirAvis('${encodeURIComponent(pro.id)}')">⭐ Donner son avis</button>
        <button type="button" class="btn btn-secondary" onclick="viewProfile('${encodeURIComponent(pro.id)}')">📋 Profil</button>
      </div>
    </div>
  `;
  return card;
}

function renderPagination() {
  const container = document.getElementById('pagination');
  container.innerHTML = '';
  const totalPages = Math.ceil(filteredPros.length / ITEMS_PER_PAGE);
  if (totalPages <= 1) return;

  const allerPage = (page) => {
    currentPage = page;
    renderPros();
    renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const bouton = (texte, page, actif) => {
    const btn = document.createElement('button');
    btn.textContent = texte;
    if (actif) btn.classList.add('active');
    btn.onclick = () => allerPage(page);
    container.appendChild(btn);
  };

  if (currentPage > 1) bouton('← Précédent', currentPage - 1);
  for (let i = 1; i <= totalPages; i++) bouton(String(i), i, i === currentPage);
  if (currentPage < totalPages) bouton('Suivant →', currentPage + 1);
}

// ---------- Fiche détaillée ----------
function viewProfile(proIdEncode) {
  const proId = decodeURIComponent(proIdEncode);
  const pro = allPros.find(p => p.id === proId);
  if (!pro) return;

  const localisation = `${pro.code_postal || ''} ${pro.ville || ''}`.trim();
  const zones = (pro.zone_intervention || []).join(', ');
  const numeros = [];
  if (pro.numero_orias) numeros.push(`<p class="fiche-ligne">🏦 <strong>N° ORIAS :</strong> ${echapper(pro.numero_orias)}</p>`);
  if (pro.numero_carte_t) numeros.push(`<p class="fiche-ligne">🏠 <strong>Carte T :</strong> ${echapper(pro.numero_carte_t)}</p>`);
  if (pro.label_rge) numeros.push('<p class="fiche-ligne">🌿 <strong>Label RGE</strong></p>');

  document.getElementById('fiche-pro-contenu').innerHTML = `
    <h2>${echapper(nomAffiche(pro))}</h2>
    <p class="fiche-role">${echapper(libelleComplet(pro))}${pro.badge_alb ? ' · Validé ALB ✓' : ''}</p>
    ${pro.badge_alb ? `<p class="fiche-ligne">🏅 ${echapper(TEXTE_BADGE)}</p>` : ''}
    ${pro.presentation || pro.bio ? `<p class="fiche-ligne">${echapper(pro.presentation || pro.bio)}</p>` : ''}
    ${localisation ? `<p class="fiche-ligne">📍 ${echapper(localisation)}</p>` : ''}
    ${zones ? `<p class="fiche-ligne">🗺️ <strong>Intervient :</strong> ${echapper(zones)}</p>` : ''}
    ${rendezVous(pro).length ? `<p class="fiche-ligne">🗓️ <strong>Rendez-vous :</strong> ${echapper(rendezVous(pro).join(' · '))}</p>` : ''}
    <p class="fiche-ligne">🕒 ${echapper(LIBELLES_DISPONIBILITE[pro.status_disponibilite] || 'Disponible')}</p>
    ${remplacantHtml(pro, 'fiche-ligne')}
    ${numeros.length ? `<div class="fiche-numeros">${numeros.join('')}</div>` : ''}
    ${lienAvisGoogle(pro)}
    <div class="fiche-avis" id="fiche-avis"><h3>Avis</h3><p class="avis-info">Chargement…</p></div>
  `;
  const contacter = document.getElementById('fiche-pro-contacter');
  contacter.href = 'espace-alb.html?contacter=' + encodeURIComponent(pro.id);
  contacter.textContent = '💬 Envoyer un message';
  contacter.onclick = (ev) => { closeFenetre('fiche-pro-modal'); return contacterPro(ev, encodeURIComponent(pro.id)); };
  // Bouton « Donner son avis » à côté (ajouté une seule fois)
  let boutonAvis = document.getElementById('fiche-pro-avis');
  if (!boutonAvis) {
    boutonAvis = document.createElement('a');
    boutonAvis.id = 'fiche-pro-avis';
    boutonAvis.className = 'modal-btn discret';
    boutonAvis.textContent = '⭐ Donner son avis';
    contacter.parentNode.appendChild(boutonAvis);
  }
  boutonAvis.onclick = () => { closeFenetre('fiche-pro-modal'); ouvrirAvis(encodeURIComponent(pro.id)); return false; };
  document.getElementById('fiche-pro-modal').classList.add('active');
  chargerAvisFiche(pro);
}

// Bouton « Voir ses avis Google » (seulement une adresse https, vérifiée par Jocelyne)
function lienAvisGoogle(pro) {
  const lien = liensAvisGoogle[pro.id];
  if (!lien || !/^https:\/\//i.test(lien)) return '';
  return `<p class="fiche-google"><a href="${echapper(lien)}" target="_blank" rel="noopener noreferrer">⭐ Voir ses avis Google <span aria-hidden="true">↗</span></a></p>`;
}

// ---------- Avis publiés, dans la fiche ----------
async function chargerAvisFiche(pro) {
  const zone = document.getElementById('fiche-avis');
  const { data, error } = await supabase.rpc('alb_avis_du_pro', { p_pro: pro.id });
  if (!zone || !zone.isConnected) return;
  if (error) {
    console.error('[ALB DEBUG] Avis :', error);
    zone.innerHTML = '<h3>Avis</h3><p class="avis-info">Les avis n\'ont pas pu être chargés.</p>';
    return;
  }
  const avis = data || [];
  const entete = avis.length ? `<h3>Avis · ${resumeAvis(pro)}</h3>` : '<h3>Avis</h3>';
  zone.innerHTML = entete + (avis.length
    ? avis.map(a => `<div class="un-avis"><span class="etoiles" aria-label="${a.note} sur 5">${etoiles(a.note)}</span>` +
        `<p>${echapper(a.texte)}</p>` +
        `<div class="qui">${echapper(a.auteur)} · ${echapper(new Date(a.le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))}</div></div>`).join('')
    : '<p class="avis-info">Pas encore d\'avis pour ce pro.</p>') +
    '<p class="avis-info">Avis vérifiés : seules les personnes qui ont échangé avec ce pro via ALB peuvent donner leur avis. Chaque avis est relu par ALB Sud Immobilier avant d\'être publié.</p>';
}

// ---------- Donner son avis ----------
const MESSAGES_AVIS = {
  NON_CONNECTE: 'Votre session s\'est terminée. Reconnectez-vous, puis recommencez.',
  AVIS_PAS_ENCORE_POSSIBLE: 'Vous pourrez donner votre avis dès que ce pro vous aura répondu via ALB.',
  AVIS_SUR_SOI: 'Vous ne pouvez pas donner votre avis sur votre propre fiche.',
  NOTE_INVALIDE: 'Choisissez une note de 1 à 5 étoiles.',
  AVIS_TROP_COURT: 'Écrivez quelques mots (10 caractères au moins).',
  AVIS_TROP_LONG: 'Votre avis est un peu long : 1 000 caractères au maximum.',
  PRO_INTROUVABLE: 'Ce pro n\'est plus présent sur Nos pros ALB.'
};
const LIBELLES_STATUT_AVIS = {
  en_attente: '⏳ Votre avis est en cours de relecture',
  publie: '✅ Votre avis est publié',
  refuse: 'Votre avis n\'a pas été publié'
};

function messageAvis(erreur) {
  const texte = String(erreur?.message || erreur || '');
  const code = Object.keys(MESSAGES_AVIS).find(c => texte.includes(c));
  return code ? MESSAGES_AVIS[code] : 'Un petit souci nous empêche d\'enregistrer votre avis. Réessayez dans un instant.';
}

// La fenêtre « Donner son avis » est créée une seule fois, à la première ouverture
function fenetreAvis() {
  let fenetre = document.getElementById('avis-modal');
  if (fenetre) return fenetre;
  fenetre = document.createElement('div');
  fenetre.id = 'avis-modal';
  fenetre.className = 'modal';
  fenetre.innerHTML = '<div class="modal-content"><span class="modal-close" onclick="closeFenetre(\'avis-modal\')">&times;</span><div id="avis-contenu"></div></div>';
  document.body.appendChild(fenetre);
  return fenetre;
}

function closeFenetre(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

let noteChoisie = 0;
function choisirNote(note) {
  noteChoisie = note;
  document.querySelectorAll('.choix-note button').forEach((b, i) => {
    b.classList.toggle('allumee', i < note);
    b.setAttribute('aria-pressed', i < note ? 'true' : 'false');
  });
}

async function ouvrirAvis(proIdEncode) {
  const proId = decodeURIComponent(proIdEncode);
  const pro = allPros.find(p => p.id === proId);
  if (!pro) return;
  const fenetre = fenetreAvis();
  const contenu = document.getElementById('avis-contenu');
  const titre = `<h2>Votre avis sur ${echapper(nomAffiche(pro))}</h2>`;
  contenu.innerHTML = titre + '<p class="avis-info">Un instant…</p>';
  fenetre.classList.add('active');

  const { data: etat, error } = await supabase.rpc('alb_avis_mon_statut', { p_pro: proId });
  if (error) {
    console.error('[ALB DEBUG] Avis (statut) :', error);
    contenu.innerHTML = titre + '<p>Un petit souci nous empêche d\'ouvrir votre avis. Réessayez dans un instant.</p>';
    return;
  }
  const lienMessage = 'espace-alb.html?contacter=' + encodeURIComponent(proId);

  // Pas connecté : on passe par l'espace ALB, puis on revient ici
  if (!etat || !etat.connecte) {
    contenu.innerHTML = titre +
      '<p>Pour que chaque avis soit vérifié, connectez-vous à votre espace ALB. Vous revenez ensuite ici automatiquement.</p>' +
      `<div class="modal-buttons"><a class="modal-btn" href="espace-alb.html?avis=${encodeURIComponent(proId)}">Me connecter</a></div>`;
    return;
  }
  if (etat.moi_meme) {
    contenu.innerHTML = titre + '<p>C\'est votre propre fiche : vous ne pouvez pas donner votre avis dessus. 😊</p>';
    return;
  }
  // Pas encore d'échange avec ce pro : on propose de lui écrire
  if (!etat.possible) {
    contenu.innerHTML = titre +
      '<p>Pour que chaque avis soit vérifié, vous pourrez donner le vôtre dès que vous aurez échangé avec ce pro via ALB et qu\'il vous aura répondu.</p>' +
      `<div class="modal-buttons"><a class="modal-btn" href="${lienMessage}" onclick="closeFenetre('avis-modal'); return contacterPro(event, '${encodeURIComponent(proId)}')">💬 Envoyer un message</a></div>`;
    return;
  }

  // Le formulaire (pré-rempli si la personne a déjà donné son avis)
  const monAvis = etat.mon_avis;
  contenu.innerHTML = titre +
    (monAvis ? `<span class="avis-statut">${echapper(LIBELLES_STATUT_AVIS[monAvis.statut] || '')}</span>` : '') +
    '<div class="avis-message" id="avis-message"></div>' +
    '<p class="avis-info avis-titre-note">Votre note</p>' +
    '<div class="choix-note" role="group" aria-label="Votre note">' +
      [1, 2, 3, 4, 5].map(n => `<button type="button" aria-label="${n} étoile${n > 1 ? 's' : ''}" onclick="choisirNote(${n})">★</button>`).join('') +
    '</div>' +
    '<label class="avis-info" for="avis-texte">Votre avis</label>' +
    `<textarea id="avis-texte" maxlength="1000" placeholder="Comment s'est passé votre échange ? Qu'avez-vous apprécié ?">${echapper(monAvis ? monAvis.texte : '')}</textarea>` +
    '<p class="avis-info avis-apres-texte">Votre avis est relu par ALB Sud Immobilier avant d\'être publié. Seuls votre prénom et l\'initiale de votre nom apparaissent.' +
      (monAvis ? ' Si vous le modifiez, il repasse en relecture.' : '') + '</p>' +
    `<div class="modal-buttons"><button type="button" class="modal-btn" id="avis-envoyer" onclick="envoyerAvis('${encodeURIComponent(proId)}')">${monAvis ? 'Modifier mon avis' : 'Envoyer mon avis'}</button></div>`;
  choisirNote(monAvis ? monAvis.note : 0);
}

async function envoyerAvis(proIdEncode) {
  const proId = decodeURIComponent(proIdEncode);
  const zoneMessage = document.getElementById('avis-message');
  const texte = document.getElementById('avis-texte').value.trim();
  const afficher = (type, message) => { zoneMessage.className = 'avis-message ' + type; zoneMessage.textContent = message; };
  if (!noteChoisie) return afficher('erreur', MESSAGES_AVIS.NOTE_INVALIDE);
  if (texte.length < 10) return afficher('erreur', MESSAGES_AVIS.AVIS_TROP_COURT);

  const bouton = document.getElementById('avis-envoyer');
  bouton.disabled = true;
  const { error } = await supabase.rpc('alb_avis_donner', { p_pro: proId, p_note: noteChoisie, p_texte: texte });
  bouton.disabled = false;
  if (error) {
    console.error('[ALB DEBUG] Avis (envoi) :', error);
    return afficher('erreur', messageAvis(error));
  }
  document.getElementById('avis-contenu').innerHTML =
    '<h2>Merci pour votre avis ! 💜</h2>' +
    '<p>Il est bien arrivé : ALB Sud Immobilier le relit, puis il apparaîtra sur la fiche de ce pro.</p>' +
    '<div class="modal-buttons"><button type="button" class="modal-btn" onclick="closeFenetre(\'avis-modal\')">Fermer</button></div>';
}

// ---------- « Envoyer un message » sans espace ALB ----------
const GUICHET_ESPACES = SUPABASE_URL + '/functions/v1/alb-espaces';
const MESSAGES_CONTACT = {
  NOM_MANQUANT: 'Indiquez votre prénom et votre nom, pour que le pro sache à qui il parle.',
  EMAIL_INVALIDE: 'L\'adresse e-mail ne semble pas complète. Pouvez-vous la vérifier ?',
  TELEPHONE_INVALIDE: 'Le numéro de téléphone ne semble pas complet. Pouvez-vous le vérifier ?',
  PIN_INVALIDE: 'Votre code PIN doit contenir exactement 4 chiffres.',
  PIN_TROP_SIMPLE: 'Ce code PIN est trop facile à deviner (comme 1234 ou 1111). Choisissez-en un autre pour bien protéger votre espace.',
  PIN_DIFFERENTS: 'Les deux codes PIN ne sont pas identiques. Pouvez-vous les vérifier ?',
  MESSAGE_VIDE: 'Écrivez votre message avant de l\'envoyer.',
  MESSAGE_TROP_LONG: 'Votre message est un peu long : 2 000 caractères au maximum.',
  CGU_NON_ACCEPTEES: 'Pour continuer, merci d\'accepter les conditions générales.',
  RECONTACT_NON_ACCEPTE: 'Pour vous accompagner, nous devons pouvoir vous recontacter : merci de cocher la case prévue.',
  PRO_INTROUVABLE: 'Ce pro n\'est plus présent sur Nos pros ALB.',
  RESEAU: 'On n\'arrive pas à joindre le serveur. Vérifiez votre connexion internet.'
};
function messageContact(code) {
  return MESSAGES_CONTACT[code] || 'Un petit souci technique nous empêche de continuer. Réessayez dans un instant.';
}

// Clic sur « Envoyer un message » : connecté → son espace ; sinon → la petite fenêtre
function contacterPro(ev, proIdEncode) {
  if (ev) ev.preventDefault();
  const proId = decodeURIComponent(proIdEncode);
  supabase.auth.getSession().then(({ data }) => {
    if (data && data.session) location.href = 'espace-alb.html?contacter=' + encodeURIComponent(proId);
    else ouvrirContact(proId);
  });
  return false;
}

function fenetreContact() {
  let fenetre = document.getElementById('contact-modal');
  if (fenetre) return fenetre;
  fenetre = document.createElement('div');
  fenetre.id = 'contact-modal';
  fenetre.className = 'modal';
  fenetre.innerHTML = '<div class="modal-content"><span class="modal-close" onclick="closeFenetre(\'contact-modal\')">&times;</span><div id="contact-contenu"></div></div>';
  document.body.appendChild(fenetre);
  return fenetre;
}

function ouvrirContact(proId) {
  const pro = allPros.find(p => p.id === proId);
  const nom = pro ? nomAffiche(pro) : 'ce pro';
  const lienConnexion = 'espace-alb.html?contacter=' + encodeURIComponent(proId);
  const fenetre = fenetreContact();
  document.getElementById('contact-contenu').innerHTML =
    `<h2>Écrire à ${echapper(nom)}</h2>` +
    '<p class="contact-intro">Votre message part directement au pro, et sa réponse arrivera dans votre espace ALB. ' +
      'Pas encore d\'espace ? Il est créé en même temps, avec votre e-mail et le code PIN que vous choisissez ici. Vos coordonnées restent protégées.</p>' +
    `<p class="contact-deja">Vous avez déjà un espace ALB ? <a href="${lienConnexion}">Connectez-vous ici</a> pour lui écrire.</p>` +
    '<form class="contact-form" id="contact-form" novalidate style="margin-top:14px;">' +
      '<div class="avis-message" id="contact-message"></div>' +
      '<div class="contact-grille">' +
        '<label class="champ">Prénom<input type="text" id="contact-prenom" maxlength="80" autocomplete="given-name" required></label>' +
        '<label class="champ">Nom<input type="text" id="contact-nom" maxlength="80" autocomplete="family-name" required></label>' +
        '<label class="champ">E-mail<input type="email" id="contact-email" maxlength="200" autocomplete="email" required></label>' +
        '<label class="champ">Téléphone<input type="tel" id="contact-telephone" maxlength="20" autocomplete="tel" required></label>' +
        '<label class="champ">Code PIN (4 chiffres)<input type="password" id="contact-pin" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="new-password" required></label>' +
        '<label class="champ">Confirmez le code PIN<input type="password" id="contact-pin2" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="new-password" required></label>' +
      '</div>' +
      '<p class="contact-aide">Votre code PIN vous servira à vous connecter à votre espace ALB, avec votre e-mail. Gardez-le bien.</p>' +
      `<label class="champ">Votre message<textarea id="contact-texte" maxlength="2000" placeholder="Bonjour, je vous contacte au sujet de…" required></textarea></label>` +
      '<label class="case"><input type="checkbox" id="contact-cgu"> <span>J\'accepte les <a href="cgu.html" target="_blank" rel="noopener">conditions générales</a> et la <a href="confidentialite.html" target="_blank" rel="noopener">politique de confidentialité</a>.</span></label>' +
      '<label class="case"><input type="checkbox" id="contact-recontact"> <span>J\'accepte d\'être recontacté(e) par ALB Sud Immobilier pour m\'accompagner dans mon projet.</span></label>' +
      `<button type="submit" class="modal-btn" id="contact-envoyer">💬 Envoyer mon message</button>` +
    '</form>';
  document.getElementById('contact-form').onsubmit = (ev) => { ev.preventDefault(); envoyerContact(proId, nom); };
  fenetre.classList.add('active');
}

async function envoyerContact(proId, nomPro) {
  const v = id => document.getElementById(id).value.trim();
  const zone = document.getElementById('contact-message');
  const erreur = (texte) => { zone.className = 'avis-message erreur'; zone.innerHTML = texte; zone.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  const donnees = {
    action: 'contact_pro', pro_id: proId,
    prenom: v('contact-prenom'), nom: v('contact-nom'), email: v('contact-email'), telephone: v('contact-telephone'),
    pin: v('contact-pin'), message: v('contact-texte'),
    cgu_acceptees: document.getElementById('contact-cgu').checked,
    accepte_recontact: document.getElementById('contact-recontact').checked
  };
  // Vérifications simples avant d'envoyer (le serveur vérifie tout de nouveau)
  if (!donnees.prenom || !donnees.nom) return erreur(echapper(messageContact('NOM_MANQUANT')));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donnees.email)) return erreur(echapper(messageContact('EMAIL_INVALIDE')));
  if (donnees.telephone.replace(/\D/g, '').length < 10) return erreur(echapper(messageContact('TELEPHONE_INVALIDE')));
  if (!/^[0-9]{4}$/.test(donnees.pin)) return erreur(echapper(messageContact('PIN_INVALIDE')));
  if (donnees.pin !== v('contact-pin2')) return erreur(echapper(messageContact('PIN_DIFFERENTS')));
  if (!donnees.message) return erreur(echapper(messageContact('MESSAGE_VIDE')));
  if (!donnees.cgu_acceptees) return erreur(echapper(messageContact('CGU_NON_ACCEPTEES')));
  if (!donnees.accepte_recontact) return erreur(echapper(messageContact('RECONTACT_NON_ACCEPTE')));

  const bouton = document.getElementById('contact-envoyer');
  bouton.disabled = true;
  bouton.textContent = 'Un instant…';
  const lienEspace = 'espace-alb.html?contacter=' + encodeURIComponent(proId);

  // 1. Création de l'espace
  let resultat;
  try {
    const r = await fetch(GUICHET_ESPACES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify(donnees)
    });
    resultat = await r.json();
  } catch (e) {
    console.error('[ALB DEBUG] Contact pro (guichet) :', e);
    resultat = { ok: false, code: 'RESEAU' };
  }
  if (!resultat.ok) {
    bouton.disabled = false;
    bouton.textContent = '💬 Envoyer mon message';
    if (resultat.code === 'EMAIL_DEJA_UTILISE') {
      return erreur(`Vous avez déjà un espace ALB avec cette adresse e-mail. <a href="${lienEspace}">Connectez-vous ici</a> pour écrire à ce pro (votre message sera à recopier). Code PIN oublié ? Vous pourrez en choisir un nouveau sur la page de connexion.`);
    }
    return erreur(echapper(messageContact(resultat.code)));
  }

  // 2. Connexion à son nouvel espace, puis 3. le message au pro
  const { error: erreurSession } = await supabase.auth.verifyOtp({ token_hash: resultat.jeton, type: 'magiclink' });
  let messageParti = false;
  if (erreurSession) console.error('[ALB DEBUG] Contact pro (session) :', erreurSession);
  else {
    const { error: erreurMessage } = await supabase.rpc('alb_message_ecrire', { p_texte: donnees.message, p_destinataire: proId });
    if (erreurMessage) console.error('[ALB DEBUG] Contact pro (message) :', erreurMessage);
    else messageParti = true;
  }

  document.getElementById('contact-contenu').innerHTML = messageParti
    ? `<h2>Votre message est parti ! 💜</h2>` +
      `<p class="contact-intro">${echapper(nomPro)} va le recevoir et vous répondra dans votre espace ALB, rubrique « Mes messages ».</p>` +
      `<p class="contact-intro">Votre espace ALB est créé. Pour vous y connecter, il vous suffit de votre e-mail (<strong>${echapper(donnees.email)}</strong>) et de votre code PIN.</p>` +
      '<p class="contact-intro">Jocelyne, fondatrice d\'ALB Sud Immobilier, prendra contact avec vous très vite pour faire connaissance.</p>' +
      '<div class="modal-buttons"><a class="modal-btn" href="espace-alb.html#messages">Voir mon espace ALB</a>' +
      '<button type="button" class="modal-btn discret" onclick="closeFenetre(\'contact-modal\')">Fermer</button></div>'
    : '<h2>Votre espace ALB est créé</h2>' +
      '<p class="contact-intro">Votre message n\'a pas pu partir tout de suite. Pas d\'inquiétude : ouvrez votre espace, il vous suffira de le renvoyer.</p>' +
      `<p class="contact-intro">Pour vous connecter : votre e-mail (<strong>${echapper(donnees.email)}</strong>) et votre code PIN.</p>` +
      `<div class="modal-buttons"><a class="modal-btn" href="${lienEspace}">Ouvrir mon espace et écrire au pro</a></div>`;
}

function showError(message) {
  document.getElementById('pros-grid').innerHTML = `<p class="vitrine-erreur">${echapper(message)}</p>`;
}

function clearFilters() {
  document.querySelectorAll('.role-filter, .corps-filter, .zone-filter').forEach(el => { el.checked = false; });
  applyFilters();
}

// Rendues accessibles aux boutons de la page (le fichier est un "module")
window.viewProfile = viewProfile;
window.ouvrirAvis = ouvrirAvis;
window.envoyerAvis = envoyerAvis;
window.choisirNote = choisirNote;
window.closeFenetre = closeFenetre;
window.contacterPro = contacterPro;
window.clearFilters = clearFilters;
window.loadPros = loadPros;

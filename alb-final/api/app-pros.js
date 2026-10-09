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
  '.modal-btn.discret:hover{background:#F5F3F0;color:#5A3A6A;}';
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
  const { data, error } = await supabase.rpc('alb_pros_publics2');

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
  return `<p class="${classe}">🔁 En son absence : <a href="espace-alb.html?contacter=${encodeURIComponent(pro.remplace_par.id)}">${echapper(pro.remplace_par.nom)}</a></p>`;
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
        <a href="espace-alb.html?contacter=${encodeURIComponent(pro.id)}" class="btn btn-primary">💬 Envoyer un message</a>
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
    <div class="fiche-avis" id="fiche-avis"><h3>Avis</h3><p class="avis-info">Chargement…</p></div>
  `;
  const contacter = document.getElementById('fiche-pro-contacter');
  contacter.href = 'espace-alb.html?contacter=' + encodeURIComponent(pro.id);
  contacter.textContent = '💬 Envoyer un message';
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
      `<div class="modal-buttons"><a class="modal-btn" href="${lienMessage}">💬 Envoyer un message</a></div>`;
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
window.clearFilters = clearFilters;
window.loadPros = loadPros;

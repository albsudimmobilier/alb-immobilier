// ============================================================
// api/app-pros.js — Page "Nos pros ALB"
// ------------------------------------------------------------
// Les pros sont lus via la fonction sécurisée alb_pros_publics() :
// elle ne renvoie QUE les infos publiques (jamais e-mail, téléphone,
// SIRET ni code PIN), et uniquement les pros validés ET mis en ligne.
//
// Les filtres se construisent tout seuls à partir des pros en ligne :
// dès que Jocelyne valide un pro « autre métier » ou ajoute une
// « autre zone », ils apparaissent ici sans rien toucher.
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
  if (pro.role === 'autre') return '🤝 ' + (pro.metier_autre || 'Autre métier');
  return METIERS[cleMetier(pro)] || pro.role;
}

async function loadPros() {
  const { data, error } = await supabase.rpc('alb_pros_publics');

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
  const ordre = Object.keys(METIERS);
  const clesMetiers = [...metiers.keys()].sort((a, b) => {
    const ia = ordre.indexOf(a), ib = ordre.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return metiers.get(a).localeCompare(metiers.get(b), 'fr');
  });
  document.getElementById('filtres-metiers').innerHTML = clesMetiers.length
    ? clesMetiers.map(cle => caseFiltre('role-filter', cle, metiers.get(cle))).join('')
    : '<p class="filtre-vide">Bientôt disponibles.</p>';

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

  document.querySelectorAll('.role-filter, .zone-filter').forEach(caseACocher => {
    caseACocher.addEventListener('change', applyFilters);
  });
}

function applyFilters() {
  const selectedRoles = Array.from(document.querySelectorAll('.role-filter:checked')).map(el => el.value);
  const selectedZones = Array.from(document.querySelectorAll('.zone-filter:checked')).map(el => el.value);

  filteredPros = allPros.filter(pro => {
    if (selectedRoles.length > 0 && !selectedRoles.includes(cleMetier(pro))) return false;
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
      <div class="pro-role">${echapper(libelleMetier(pro))}</div>
      <div class="pro-valide">Validé ALB ✓</div>
    </div>
    <div class="pro-body">
      <p class="pro-presentation">${echapper(pro.presentation || pro.bio || 'Professionnel validé par ALB')}</p>
      <p class="pro-localisation"><strong>📍 ${echapper(localisation)}</strong></p>
      ${zonesHtml ? `<div class="pro-zones">${zonesHtml}</div>` : ''}
      <div class="pro-status ${classeDispo}">${echapper(disponibilite)}</div>
      <div class="pro-action">
        <a href="espace-alb.html?contacter=${encodeURIComponent(pro.id)}" class="btn btn-primary">💬 Contacter via ALB</a>
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
    <p class="fiche-role">${echapper(libelleMetier(pro))} · Validé ALB ✓</p>
    ${pro.presentation || pro.bio ? `<p class="fiche-ligne">${echapper(pro.presentation || pro.bio)}</p>` : ''}
    ${localisation ? `<p class="fiche-ligne">📍 ${echapper(localisation)}</p>` : ''}
    ${zones ? `<p class="fiche-ligne">🗺️ <strong>Intervient :</strong> ${echapper(zones)}</p>` : ''}
    <p class="fiche-ligne">🕒 ${echapper(LIBELLES_DISPONIBILITE[pro.status_disponibilite] || 'Disponible')}</p>
    ${numeros.length ? `<div class="fiche-numeros">${numeros.join('')}</div>` : ''}
  `;
  document.getElementById('fiche-pro-contacter').href = 'espace-alb.html?contacter=' + encodeURIComponent(pro.id);
  document.getElementById('fiche-pro-modal').classList.add('active');
}

function showError(message) {
  document.getElementById('pros-grid').innerHTML = `<p class="vitrine-erreur">${echapper(message)}</p>`;
}

function clearFilters() {
  document.querySelectorAll('.role-filter, .zone-filter').forEach(el => { el.checked = false; });
  applyFilters();
}

// Rendues accessibles aux boutons de la page (le fichier est un "module")
window.viewProfile = viewProfile;
window.clearFilters = clearFilters;
window.loadPros = loadPros;

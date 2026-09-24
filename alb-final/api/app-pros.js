// ============================================================
// api/app-pros.js — Page "Nos pros ALB"
// ------------------------------------------------------------
// Les pros sont lus via la fonction sécurisée alb_pros_publics() :
// elle ne renvoie QUE les infos publiques (jamais e-mail, téléphone,
// SIRET ni code PIN), et uniquement les pros validés ET mis en ligne.
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://kutbxyinpokebjdemlnq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wXbJu1TP2jZ05TcuMOut9Q_NcumnpIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let allPros = [];
let filteredPros = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 9;

document.addEventListener('DOMContentLoaded', async () => {
  await loadPros();
  setupFilterListeners();
});

// Protège le texte écrit par les pros avant de l'afficher
function echapper(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// profiles.role vaut courtier / artisan / immo. Agent et mandataire partagent
// "immo" : le détail est dans sous_role_immo. On reconstitue le rôle "affiché"
// utilisé par les filtres de la page.
function getFilterRole(pro) {
  if (pro.role === 'immo') {
    return pro.sous_role_immo === 'mandataire' ? 'mandataire_immobilier' : 'agent_immobilier';
  }
  return pro.role;
}

async function loadPros() {
  const { data, error } = await supabase.rpc('alb_pros_publics');

  if (error) {
    console.error('[ALB DEBUG] Nos pros ALB :', error);
    showError('Un petit souci nous empêche d\'afficher nos pros. Réessayez dans un instant.');
    return;
  }

  allPros = data || [];
  console.log(`[ALB DEBUG] ${allPros.length} pros affichés sur Nos pros ALB`);
  applyFilters();
}

function applyFilters() {
  const selectedRoles = Array.from(document.querySelectorAll('.role-filter:checked')).map(el => el.value);
  const selectedZones = Array.from(document.querySelectorAll('.zone-filter:checked')).map(el => el.value);

  filteredPros = allPros.filter(pro => {
    if (selectedRoles.length > 0 && !selectedRoles.includes(getFilterRole(pro))) return false;
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
    grid.innerHTML = '<p class="vitrine-vide">Nos professionnels arrivent très bientôt. Revenez nous voir !</p>';
    return;
  }

  pagePros.forEach(pro => grid.appendChild(createProCard(pro)));
}

const LIBELLES_DISPONIBILITE = {
  joignable: 'Disponible',
  'occupé': 'Occupé en ce moment',
  non_disponible: 'Indisponible pour le moment'
};

function createProCard(pro) {
  const roleLabel = {
    courtier: '🏦 Courtier',
    artisan: '🔨 Artisan',
    agent_immobilier: '🏠 Agent immobilier',
    mandataire_immobilier: '📋 Mandataire'
  }[getFilterRole(pro)] || pro.role;

  const zonesHtml = (pro.zone_intervention || [])
    .map(zone => `<span class="zone-tag">${echapper(zone)}</span>`).join('');
  const initiales = `${pro.prenom?.[0] || ''}${pro.nom?.[0] || ''}`.toUpperCase() || 'PRO';
  const localisation = `${pro.code_postal || ''} ${pro.ville || ''}`.trim() || 'Var / PACA';
  const nomAffiche = pro.nom_entreprise || `${pro.prenom || ''} ${pro.nom || ''}`.trim();
  const disponibilite = LIBELLES_DISPONIBILITE[pro.status_disponibilite] || 'Disponible';
  const classeDispo = pro.status_disponibilite && pro.status_disponibilite !== 'joignable' ? 'occupe' : 'disponible';

  const card = document.createElement('div');
  card.className = 'pro-card';
  card.innerHTML = `
    <div class="pro-header">
      <div class="pro-avatar">${echapper(initiales)}</div>
      <div class="pro-name">${echapper(nomAffiche)}</div>
      <div class="pro-role">${roleLabel}</div>
      <div class="pro-rating">Validé ALB ✓</div>
    </div>
    <div class="pro-body">
      <p class="pro-presentation">${echapper(pro.bio || pro.presentation || 'Professionnel validé par ALB')}</p>
      <p class="pro-localisation"><strong>📍 ${echapper(localisation)}</strong></p>
      ${pro.temps_reponse_moyen ? `<p class="pro-reponse"><strong>⏱️ Répond en moyenne en</strong> ${echapper(pro.temps_reponse_moyen)} h</p>` : ''}
      ${zonesHtml ? `<div class="pro-zones">${zonesHtml}</div>` : ''}
      <div class="pro-status ${classeDispo}">${echapper(disponibilite)}</div>
      <div class="pro-action">
        <a href="espace-alb.html?contacter=${encodeURIComponent(pro.id)}" class="btn btn-primary">💬 Contacter via ALB</a>
        <button class="btn btn-secondary" onclick="viewProfile('${encodeURIComponent(pro.id)}')">📋 Profil</button>
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

  if (currentPage > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Précédent';
    prevBtn.onclick = () => allerPage(currentPage - 1);
    container.appendChild(prevBtn);
  }

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === currentPage) btn.classList.add('active');
    btn.onclick = () => allerPage(i);
    container.appendChild(btn);
  }

  if (currentPage < totalPages) {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Suivant →';
    nextBtn.onclick = () => allerPage(currentPage + 1);
    container.appendChild(nextBtn);
  }
}

function setupFilterListeners() {
  document.querySelectorAll('.role-filter, .zone-filter').forEach(checkbox => {
    checkbox.addEventListener('change', applyFilters);
  });
}

// Fiche détaillée : prévue à l'étape "Profils modifiables + Nos pros ALB"
function viewProfile(proIdEncode) {
  const proId = decodeURIComponent(proIdEncode);
  const pro = allPros.find(p => p.id === proId);
  if (!pro) return;
  alert(`${pro.nom_entreprise || pro.nom}\n\n${pro.presentation || pro.bio || ''}`);
}

function showError(message) {
  document.getElementById('pros-grid').innerHTML = `<p class="vitrine-erreur">${echapper(message)}</p>`;
}

window.clearFilters = () => {
  document.querySelectorAll('.role-filter, .zone-filter').forEach(el => { el.checked = false; });
  applyFilters();
};

// Rendues accessibles aux boutons de la page (le fichier est un "module")
window.viewProfile = viewProfile;
window.loadPros = loadPros;

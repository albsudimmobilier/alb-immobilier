import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Configuration Supabase
const SUPABASE_URL = 'https://kutbxyinpogebjdemlnq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dGJ4eWlucG9nZWJqZGVtbG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjExOTA4NjksImV4cCI6MjAzNjc2NjA2OX0.uN6Bp-AEMmUdwdHpST7lKqqoZd5DnLfPHPpMIHJgWc4';

console.log('🔧 App-pros.js chargé');
console.log('📍 SUPABASE_URL:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// State
let allPros = [];
let filteredPros = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 9;

// Load on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📄 DOM Loaded - Chargement des pros...');
  await loadPros();
  setupFilterListeners();
});

async function loadPros() {
  try {
    console.log('🔄 Requête Supabase: profiles (données sécurisées)');
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['courtier', 'artisan', 'agent_immobilier', 'mandataire_immobilier']);

    if (error) {
      console.error('❌ ERREUR SUPABASE:', error);
      showError(`Erreur: ${error.message || JSON.stringify(error)}`);
      return;
    }

    allPros = data || [];
    console.log(`✅ ${allPros.length} pros chargés depuis profiles_publics`);
    applyFilters();
  } catch (err) {
    console.error('❌ ERREUR CATCH:', err);
    showError('Erreur lors du chargement');
  }
}

function applyFilters() {
  const selectedRoles = Array.from(document.querySelectorAll('.role-filter:checked')).map(el => el.value);
  const selectedZones = Array.from(document.querySelectorAll('.zone-filter:checked')).map(el => el.value);

  filteredPros = allPros.filter(pro => {
    if (selectedRoles.length > 0 && !selectedRoles.includes(pro.role)) return false;
    if (selectedZones.length > 0) {
      const proZones = pro.zone_intervention || [];
      const hasZone = selectedZones.some(zone => proZones.includes(zone));
      if (!hasZone) return false;
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
  const end = start + ITEMS_PER_PAGE;
  const pagePros = filteredPros.slice(start, end);

  if (pagePros.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">Aucun professionnel trouvé.</p>';
    return;
  }

  pagePros.forEach(pro => {
    const card = createProCard(pro);
    grid.appendChild(card);
  });
}

function createProCard(pro) {
  const roleLabel = {
    'courtier': '🏦 Courtier',
    'artisan': '🔨 Artisan',
    'agent_immobilier': '🏠 Agent immobilier',
    'mandataire_immobilier': '📋 Mandataire'
  }[pro.role] || pro.role;

  const zones = pro.zone_intervention || [];
  const zonesHtml = zones.map(zone => `<span class="zone-tag">${zone}</span>`).join('');
  const initials = `${pro.prenom?.[0] || ''}${pro.nom?.[0] || ''}`.toUpperCase() || 'PRO';
  const localisation = `${pro.code_postal || ''} ${pro.ville || ''}`.trim() || 'Var/PACA';

  const card = document.createElement('div');
  card.className = 'pro-card';
  card.innerHTML = `
    <div class="pro-header">
      <div class="pro-avatar">${initials}</div>
      <div class="pro-name">${pro.nom_entreprise || `${pro.prenom} ${pro.nom}`}</div>
      <div class="pro-role">${roleLabel}</div>
      <div class="pro-rating"><span class="stars">★★★★★</span> Vérifié ✓</div>
    </div>
    <div class="pro-body">
      <p style="font-size: 0.9rem; color: #666; margin-bottom: 10px;">
        ${pro.bio || pro.presentation || 'Professionnel vérifié ALB'}
      </p>
      <p style="font-size: 0.85rem; color: #999; margin-bottom: 10px;">
        <strong>📍 ${localisation}</strong>
      </p>
      ${pro.temps_reponse_moyen ? `<p style="font-size: 0.85rem; color: #666; margin-bottom: 10px;"><strong>⏱️ Réponse:</strong> ${pro.temps_reponse_moyen}h</p>` : ''}
      ${zonesHtml ? `<div class="pro-zones">${zonesHtml}</div>` : ''}
      <div class="pro-status disponible">Disponible</div>
      <div class="pro-action">
        <a href="mailto:${pro.email}" class="btn btn-primary" style="text-decoration: none; text-align: center;">📧 Contacter</a>
        <button class="btn btn-secondary" onclick="viewProfile('${pro.id}')">📋 Profil</button>
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

  if (currentPage > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Précédent';
    prevBtn.onclick = () => { currentPage--; renderPros(); renderPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    container.appendChild(prevBtn);
  }

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === currentPage) btn.classList.add('active');
    btn.onclick = () => { currentPage = i; renderPros(); renderPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    container.appendChild(btn);
  }

  if (currentPage < totalPages) {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Suivant →';
    nextBtn.onclick = () => { currentPage++; renderPros(); renderPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    container.appendChild(nextBtn);
  }
}

function setupFilterListeners() {
  document.querySelectorAll('.role-filter, .zone-filter').forEach(checkbox => {
    checkbox.addEventListener('change', applyFilters);
  });
}

function viewProfile(proId) {
  const pro = allPros.find(p => p.id === proId);
  if (!pro) return;
  alert(`Profil de ${pro.nom_entreprise || pro.nom}`);
}

function showError(message) {
  const grid = document.getElementById('pros-grid');
  grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #d32f2f;">${message}</p>`;
}

window.clearFilters = () => {
  document.querySelectorAll('.role-filter, .zone-filter').forEach(el => el.checked = false);
  applyFilters();
};

window.loadPros = loadPros;

// ============================================================
// ALB en chiffres — encadré des pages secteur et tableau de « Nos pros ALB »
// Uniquement des nombres (jamais d'argent ni de nom). Moins de 3 = caché (« – »).
// L'encadré ou le tableau ne s'affiche que s'il y a au moins un chiffre d'activité à 3 ou plus.
// ============================================================
(function () {
  const URL_SB = 'https://kutbxyinpokebjdemlnq.supabase.co';
  const CLE = 'sb_publishable_wXbJu1TP2jZ05TcuMOut9Q_NcumnpIQ';
  const PAGES = {
    'Toulon et environs': 'immobilier-ancien-toulon.html', 'Centre Var': 'immobilier-ancien-centre-var.html',
    'Marseille et environs': 'immobilier-ancien-marseille.html', "Pays d'Aix": 'immobilier-ancien-pays-d-aix.html',
    'Aubagne/La Ciotat': 'immobilier-ancien-aubagne-la-ciotat.html', 'Étang de Berre/Martigues': 'immobilier-ancien-etang-de-berre.html',
    "Salon/Pays d'Arles": 'immobilier-ancien-salon-arles.html'
  };
  const NOMS = { 'Aubagne/La Ciotat': 'Aubagne / La Ciotat', 'Étang de Berre/Martigues': 'Étang de Berre / Martigues', "Salon/Pays d'Arles": "Salon / Pays d'Arles", 'Est Var/Golfe': 'Est Var / Golfe', 'Haut Var/Verdon': 'Haut Var / Verdon' };
  const TITRES = { 'Toulon et environs': 'à Toulon et environs', 'Centre Var': 'dans le Centre Var', 'Marseille et environs': 'à Marseille et environs',
    "Pays d'Aix": "dans le Pays d'Aix", 'Aubagne/La Ciotat': 'à Aubagne et La Ciotat', 'Étang de Berre/Martigues': "autour de l'étang de Berre", "Salon/Pays d'Arles": "à Salon et dans le pays d'Arles" };
  const ACTIVITE = ['vendeurs_particuliers', 'projets', 'visites_particuliers', 'visites_accompagnees', 'ventes_particuliers', 'ventes_accompagnees'];
  const ech = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nb = v => (v == null ? '–' : v);
  const actif = s => ACTIVITE.some(k => s[k] != null);
  const pluriel = (n, un, plusieurs) => n + ' ' + (n > 1 ? plusieurs : un);

  const STYLE = `
    .alb-chiffres { background:#FBF8F3; border:1px solid #E8DFC9; border-radius:12px; padding:18px; margin:24px 0; text-align:left; }
    .alb-chiffres h2 { margin:0 0 10px; }
    .alb-chiffres p { margin:6px 0; }
    .alb-chiffres table { width:100%; border-collapse:collapse; margin-top:10px; font-size:.92rem; background:#fff; }
    .alb-chiffres th, .alb-chiffres td { padding:8px 10px; border-bottom:1px solid #F0EEE9; text-align:left; }
    .alb-chiffres th { background:#F5F0E6; color:#5A3A6A; font-size:.8rem; }
    .alb-chiffres td.n, .alb-chiffres th.n { text-align:right; white-space:nowrap; }
    .alb-chiffres .note { font-size:.8rem; color:#7a7a75; font-style:italic; margin-top:10px; }
    .alb-chiffres .defile { overflow-x:auto; }
    .alb-chiffres details { background:#fff; border:1px solid #E8E6E1; border-radius:10px; margin-top:10px; }
    .alb-chiffres summary { padding:12px 16px; cursor:pointer; font-weight:700; color:#5A3A6A; }
    .alb-chiffres a { color:#4B1A3E; }
    .alb-chiffres td:first-child { white-space:nowrap; }`;

  async function donnees() {
    const r = await fetch(URL_SB + '/rest/v1/rpc/alb_chiffres_publics', {
      method: 'POST', headers: { apikey: CLE, Authorization: 'Bearer ' + CLE, 'Content-Type': 'application/json' }, body: '{}'
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  function encadre(zone, s, annee) {
    const pros = [];
    if (s.artisans) pros.push(pluriel(s.artisans, 'artisan', 'artisans'));
    if (s.courtiers) pros.push(pluriel(s.courtiers, 'courtier', 'courtiers'));
    if (s.agents) pros.push(pluriel(s.agents, 'agent immobilier', 'agents immobiliers'));
    if (s.mandataires) pros.push(pluriel(s.mandataires, 'mandataire', 'mandataires'));
    const visites = s.visites_particuliers != null || s.visites_accompagnees != null;
    const ventes = s.ventes_particuliers != null || s.ventes_accompagnees != null;
    zone.innerHTML = '<h2>ALB ' + ech(TITRES[s.secteur] || ('dans le secteur ' + (NOMS[s.secteur] || s.secteur))) + '</h2>' +
      (pros.length ? '<p>🤝 <strong>Nos pros près de chez vous</strong> : ' + ech(pros.join(' · ')) + '</p>' : '') +
      (s.vendeurs_particuliers != null ? '<p>🏡 <strong>' + s.vendeurs_particuliers + '</strong> particuliers vendent leur bien sur ALB</p>' : '') +
      (s.projets != null ? '<p>📋 <strong>' + s.projets + '</strong> projets accompagnés depuis janvier ' + annee + '</p>' : '') +
      (visites || ventes ? '<div class="defile"><table><thead><tr><th>Depuis janvier ' + annee + '</th><th class="n">Entre particuliers</th><th class="n">Avec un agent ou un mandataire</th></tr></thead><tbody>' +
        (visites ? '<tr><td>👀 Visites</td><td class="n">' + nb(s.visites_particuliers) + '</td><td class="n">' + nb(s.visites_accompagnees) + '</td></tr>' : '') +
        (ventes ? '<tr><td>🔑 Ventes réalisées</td><td class="n">' + nb(s.ventes_particuliers) + '</td><td class="n">' + nb(s.ventes_accompagnees) + '</td></tr>' : '') +
        '</tbody></table></div>' : '') +
      '<p class="note">Chiffres mis à jour automatiquement.</p>';
    zone.hidden = false;
  }

  function tableau(zone, secteurs, annee) {
    const parDep = {};
    secteurs.forEach(s => { (parDep[s.departement] = parDep[s.departement] || []).push(s); });
    const ligne = s => '<tr><td>' + (PAGES[s.secteur] ? '<a href="' + PAGES[s.secteur] + '">' + ech(NOMS[s.secteur] || s.secteur) + '</a>' : ech(NOMS[s.secteur] || s.secteur)) + '</td>' +
      ['artisans', 'courtiers', 'agents', 'mandataires'].map(k => '<td class="n">' + (s[k] || 0) + '</td>').join('') +
      ACTIVITE.filter(k => k !== 'projets').map(k => '<td class="n">' + nb(s[k]) + '</td>').join('') + '</tr>';
    zone.innerHTML = '<h2>ALB en chiffres</h2><p>Les pros de confiance et l\'activité d\'ALB Immobilier, secteur par secteur, depuis janvier ' + annee + '.</p>' +
      Object.entries(parDep).map(([dep, liste]) => '<details><summary>' + ech(dep) + '</summary><div class="defile"><table><thead><tr><th>Secteur</th>' +
        '<th class="n">Artisans</th><th class="n">Courtiers</th><th class="n">Agents</th><th class="n">Mandataires</th><th class="n">Vendeurs particuliers</th>' +
        '<th class="n">Visites entre particuliers</th><th class="n">Visites accompagnées</th><th class="n">Ventes entre particuliers</th><th class="n">Ventes accompagnées</th></tr></thead><tbody>' +
        liste.map(ligne).join('') + '</tbody></table></div></details>').join('') +
      '<p class="note">« – » : moins de 3 pour l\'instant. Chiffres mis à jour automatiquement.</p>';
    zone.hidden = false;
  }

  async function demarrer() {
    const zoneSecteur = document.getElementById('alb-chiffres-secteur');
    const zoneTableau = document.getElementById('alb-chiffres-tableau');
    if (!zoneSecteur && !zoneTableau) return;
    const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);
    try {
      const d = await donnees();
      const secteurs = d.secteurs || [];
      if (zoneSecteur) {
        const s = secteurs.find(x => x.secteur === zoneSecteur.dataset.secteur);
        if (s && actif(s)) encadre(zoneSecteur, s, d.annee);
      }
      if (zoneTableau && secteurs.some(actif)) tableau(zoneTableau, secteurs, d.annee);
    } catch (e) { console.error('[ALB DEBUG] ALB en chiffres :', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();

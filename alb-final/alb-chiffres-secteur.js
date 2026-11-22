// ============================================================
// ALB en chiffres — 3 tableaux en bas de page (comme « Nos secteurs »)
// Uniquement des nombres (jamais d'argent ni de nom). Moins de 3 = « – ».
// Un tableau ne s'affiche que s'il a au moins un chiffre à 3 ou plus (les pros : dès qu'il y en a un).
// ============================================================
(function () {
  const URL_SB = 'https://kutbxyinpokebjdemlnq.supabase.co';
  const CLE = 'sb_publishable_wXbJu1TP2jZ05TcuMOut9Q_NcumnpIQ';
  const PAGES = {
    'Toulon et environs': 'immobilier-ancien-toulon', 'Centre Var': 'immobilier-ancien-centre-var',
    'Marseille et environs': 'immobilier-ancien-marseille', "Pays d'Aix": 'immobilier-ancien-pays-d-aix',
    'Aubagne/La Ciotat': 'immobilier-ancien-aubagne-la-ciotat', 'Étang de Berre/Martigues': 'immobilier-ancien-etang-de-berre',
    "Salon/Pays d'Arles": 'immobilier-ancien-salon-arles'
  };
  const NOMS = { 'Aubagne/La Ciotat': 'Aubagne / La Ciotat', 'Étang de Berre/Martigues': 'Étang de Berre / Martigues', "Salon/Pays d'Arles": "Salon / Pays d'Arles", 'Est Var/Golfe': 'Est Var / Golfe', 'Haut Var/Verdon': 'Haut Var / Verdon' };
  const PROJETS = [['financement', '🏦 Financement'], ['travaux', '🔨 Travaux'], ['accompagnement', '🤝 Vente ou achat accompagné']];
  const ech = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nb = v => (v == null ? '–' : v);

  const STYLE = `
    .footer-chiffres { max-width: 1200px; margin: 10px auto 0; padding: 0 0 10px; text-align: left; }
    .footer-chiffres h5 { margin: 0 0 12px; font-size: .95rem; font-weight: 600; color: #B28E3D; letter-spacing: .3px; }
    .footer-chiffres details { margin: 4px 0; }
    .footer-chiffres summary { cursor: pointer; color: #fff; font-weight: 500; font-size: .9rem; }
    .footer-chiffres details details { margin-left: 14px; }
    .footer-chiffres .defile { overflow-x: auto; margin: 6px 0 10px 14px; }
    .footer-chiffres table { border-collapse: collapse; font-size: .82rem; background: rgba(255,255,255,.06); min-width: 100%; }
    .footer-chiffres th, .footer-chiffres td { padding: 6px 9px; border-bottom: 1px solid rgba(255,255,255,.12); text-align: left; color: #fff; }
    .footer-chiffres th { font-weight: 600; opacity: .85; font-size: .76rem; }
    .footer-chiffres td.n, .footer-chiffres th.n { text-align: right; white-space: nowrap; }
    .footer-chiffres td:first-child { white-space: nowrap; }
    .footer-chiffres a { color: #fff; }
    .footer-chiffres .note { font-size: .74rem; opacity: .75; font-style: italic; margin: 6px 0 0; }`;

  async function donnees() {
    const r = await fetch(URL_SB + '/rest/v1/rpc/alb_chiffres_publics', {
      method: 'POST', headers: { apikey: CLE, Authorization: 'Bearer ' + CLE, 'Content-Type': 'application/json' }, body: '{}'
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  const nomSecteur = s => PAGES[s.secteur] ? '<a href="https://albimmobilier.fr/' + PAGES[s.secteur] + '">' + ech(NOMS[s.secteur] || s.secteur) + '</a>' : ech(NOMS[s.secteur] || s.secteur);

  // Un tableau, découpé par département (Var / Bouches-du-Rhône)
  function bloc(titre, secteurs, entetes, lignes) {
    const parDep = {};
    secteurs.forEach(s => { (parDep[s.departement] = parDep[s.departement] || []).push(s); });
    return '<details><summary>' + titre + '</summary>' + Object.entries(parDep).map(([dep, liste]) =>
      '<details><summary>' + ech(dep) + '</summary><div class="defile"><table><thead><tr>' + entetes.map(e => '<th' + (e[1] ? ' class="n"' : '') + '>' + e[0] + '</th>').join('') +
      '</tr></thead><tbody>' + liste.map(lignes).join('') + '</tbody></table></div></details>').join('') + '</details>';
  }

  function dessiner(zone, d) {
    const sec = d.secteurs || [];
    const a = s => s.activite || {};
    const tableaux = [];
    if (sec.some(s => s.artisans || s.courtiers || s.agents_mandataires)) {
      tableaux.push(bloc('🤝 Nos pros ALB', sec, [['Secteur'], ['Artisans', 1], ['Courtiers', 1], ['Agents / mandataires', 1]],
        s => '<tr><td>' + nomSecteur(s) + '</td><td class="n">' + s.artisans + '</td><td class="n">' + s.courtiers + '</td><td class="n">' + s.agents_mandataires + '</td></tr>'));
    }
    const VV = ['vendeurs_particuliers', 'visites_particuliers', 'visites_accompagnees', 'ventes_particuliers', 'ventes_accompagnees'];
    if (sec.some(s => VV.some(k => a(s)[k] != null))) {
      tableaux.push(bloc('🏡 Visites et ventes', sec, [['Secteur'], ['Agents / mandataires', 1], ['Vendeurs particuliers', 1], ['Visites entre particuliers', 1], ['Visites accompagnées', 1], ['Ventes entre particuliers', 1], ['Ventes accompagnées', 1]],
        s => '<tr><td>' + nomSecteur(s) + '</td><td class="n">' + s.agents_mandataires + '</td>' + VV.map(k => '<td class="n">' + nb(a(s)[k]) + '</td>').join('') + '</tr>'));
    }
    if (sec.some(s => PROJETS.some(p => a(s)['projets_' + p[0]] != null))) {
      tableaux.push(bloc('📋 Projets accompagnés', sec, [['Secteur'], ['Type de projet'], ['Demandes', 1], ['Abouties', 1]],
        s => PROJETS.map((p, i) => '<tr><td>' + (i === 0 ? nomSecteur(s) : '') + '</td><td>' + p[1] + '</td><td class="n">' + nb(a(s)['projets_' + p[0]]) + '</td><td class="n">' + nb(a(s)['abouties_' + p[0]]) + '</td></tr>').join('')));
    }
    if (!tableaux.length) return;
    zone.innerHTML = '<h5>ALB en chiffres</h5>' + tableaux.join('') +
      '<p class="note">Depuis janvier ' + d.annee + '. « – » : moins de 3 pour l\'instant. « Abouties » : un pro a signé (prêt, chantier ou vente). Chiffres mis à jour automatiquement.</p>';
    zone.hidden = false;
  }

  async function demarrer() {
    const zone = document.getElementById('alb-chiffres-tableau');
    if (!zone) return;
    const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);
    try { dessiner(zone, await donnees()); } catch (e) { console.error('[ALB DEBUG] ALB en chiffres :', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();

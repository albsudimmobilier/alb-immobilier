// ============================================================
// Code postal → communes : dès que le code postal a 5 chiffres,
// la liste des communes officielles s'affiche sous le champ Ville
// (une seule commune = remplie toute seule). La saisie libre reste possible.
// ============================================================
(function () {
  const PAIRES = { 'profil-cp': 'profil-ville', 'pp-cp': 'pp-ville', 'code-postal': 'ville' };
  const cache = {};
  async function communes(cp) {
    if (!cache[cp]) cache[cp] = fetch('https://geo.api.gouv.fr/communes?codePostal=' + cp + '&fields=nom')
      .then(function (r) { return r.json(); })
      .then(function (l) { return l.map(function (v) { return v.nom; }).sort(); })
      .catch(function (err) { console.error('[ALB DEBUG] communes :', err); delete cache[cp]; return []; });
    return cache[cp];
  }
  async function maj(champCp) {
    const ville = document.getElementById(PAIRES[champCp.id]);
    if (!ville) return;
    const cp = champCp.value.trim();
    const idListe = 'liste-communes-' + ville.id;
    let liste = document.getElementById(idListe);
    if (!liste) { liste = document.createElement('datalist'); liste.id = idListe; document.body.appendChild(liste); ville.setAttribute('list', idListe); }
    if (!/^[0-9]{5}$/.test(cp)) { liste.innerHTML = ''; return; }
    const noms = await communes(cp);
    if (cp !== champCp.value.trim()) return;
    liste.innerHTML = '';
    noms.forEach(function (n) { const o = document.createElement('option'); o.value = n; liste.appendChild(o); });
    const actuelle = ville.value.trim().toLowerCase();
    if (noms.length === 1 && noms[0].toLowerCase() !== actuelle) { ville.value = noms[0]; ville.dispatchEvent(new Event('input', { bubbles: true })); }
    else if (noms.length > 1 && !noms.some(function (n) { return n.toLowerCase() === actuelle; })) { ville.placeholder = 'Choisissez : ' + noms.slice(0, 3).join(', ') + (noms.length > 3 ? '…' : ''); }
  }
  document.addEventListener('input', function (ev) { if (ev.target && PAIRES[ev.target.id]) maj(ev.target); });
})();

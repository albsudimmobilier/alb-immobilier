// ============================================================
// mes-annonces.js — la rubrique « 🏡 Mes annonces » de Mon espace ALB
// Le propriétaire (particulier, agent ou mandataire) y retrouve ses
// annonces : statut, modifications, photos et disponibilités de visite.
// Les modifications passent directement : Jocelyne reçoit juste une alerte.
// Besoin de : alb-connexion.js (albSupabase, albEchapper)
// ============================================================
(function () {
  'use strict';

  const PHOTOS_MAX = 10;
  const DISPOS_MAX = 60;
  const e = function (t) { return albEchapper(t); };

  const STATUTS = {
    en_attente: { texte: '⏳ En cours d’étude par Jocelyne', classe: 'ma-st-attente', aide: 'Jocelyne vous appelle avant toute mise en ligne. Vous pouvez déjà compléter votre annonce.' },
    disponible: { texte: '🟢 En ligne', classe: 'ma-st-ligne', aide: '' },
    en_pause: { texte: '⏸️ En pause', classe: 'ma-st-pause', aide: 'Votre annonce n’est plus visible pour le moment. Pour la remettre en ligne, appelez Jocelyne.' },
    sous_offre: { texte: '🤝 Sous offre', classe: 'ma-st-offre', aide: '' },
    compromis: { texte: '✍️ Sous compromis', classe: 'ma-st-offre', aide: '' },
    vendu: { texte: '🎉 Vendu', classe: 'ma-st-vendu', aide: 'Félicitations ! Cette annonce est gardée ici en souvenir, elle ne se modifie plus.' },
    refusee: { texte: 'Non publiée', classe: 'ma-st-refus', aide: 'Cette annonce n’a pas été mise en ligne. Une question ? Appelez Jocelyne au 07 45 60 28 05.' },
  };

  const ERREURS = {
    ANNONCE_VENDUE: 'Ce bien est vendu : l’annonce ne se modifie plus.',
    VIDEOS_MAX_2: 'Deux vidéos au maximum.',
    VIDEO_YOUTUBE_SEULEMENT: 'Les vidéos doivent être des liens YouTube.',
    ACCES_REFUSE: 'Cette annonce ne vous appartient pas.',
  };

  let monId = null;
  let annonces = []; // { a, prive, photos }
  let ouvert = {};   // id annonce → 'modifier' | 'photos' | 'dispos'

  // ---------- Petits outils ----------
  function prix(n) { const v = Number(n); return isFinite(v) ? v.toLocaleString('fr-FR') + ' €' : ''; }
  function dateFr(d) {
    if (!d) return '';
    const x = new Date(String(d).length === 10 ? d + 'T12:00:00' : d);
    return isNaN(x) ? '' : x.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function dateCourte(d) {
    if (!d) return '';
    const x = new Date(d);
    return isNaN(x) ? '' : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function aujourdhui() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function messageErreur(err) {
    const brut = String((err && (err.message || err)) || '');
    for (const code in ERREURS) if (brut.indexOf(code) !== -1) return ERREURS[code];
    if (brut.indexOf('annonces_honoraires_pro') !== -1) return 'Merci d’indiquer les honoraires.';
    if (brut.indexOf('annonces_dispos') !== -1) return 'Un créneau n’est pas valable : vérifiez les dates et les heures.';
    return 'Oups, l’enregistrement n’a pas marché. Réessayez dans un instant ou appelez Jocelyne au 07 45 60 28 05.';
  }
  function chemin(url) {
    const i = String(url || '').indexOf('/annonces-photos/');
    return i === -1 ? null : decodeURIComponent(String(url).slice(i + '/annonces-photos/'.length).split('?')[0]);
  }
  function el(id) { return document.getElementById(id); }
  function bloc() { return el('mes-annonces'); }

  function reduirePhoto(fichier) {
    return new Promise(function (resoudre) {
      const lecteur = new FileReader();
      lecteur.onload = function () {
        const image = new Image();
        image.onload = function () {
          const cote = 1600;
          let l = image.width, h = image.height;
          if (l > cote || h > cote) { const r = Math.min(cote / l, cote / h); l = Math.round(l * r); h = Math.round(h * r); }
          const toile = document.createElement('canvas');
          toile.width = l; toile.height = h;
          toile.getContext('2d').drawImage(image, 0, 0, l, h);
          toile.toBlob(function (blob) { resoudre(blob); }, 'image/jpeg', 0.82);
        };
        image.onerror = function () { resoudre(null); };
        image.src = lecteur.result;
      };
      lecteur.onerror = function () { resoudre(null); };
      lecteur.readAsDataURL(fichier);
    });
  }

  function montrerMessage(id, type, texte) {
    const m = el(id);
    if (!m) return;
    m.className = 'message visible ' + type;
    m.textContent = texte;
  }

  // ---------- Chargement ----------
  async function charger() {
    const { data: annoncesBrutes, error } = await albSupabase.from('annonces')
      .select('id, titre, description, prix, ville, code_postal, type_bien, surface_m2, nb_pieces, surface_terrain_m2, dpe, ges, depenses_energie_min, depenses_energie_max, type_vente, agence_nom, honoraires_texte, statut, date_creation, mis_en_ligne_le, date_fin_compromis, disponibilites_visite')
      .eq('vendeur_id', monId)
      .order('date_creation', { ascending: false });
    if (error) { console.error('[ALB DEBUG] mes annonces :', error); throw error; }
    const liste = annoncesBrutes || [];
    const ids = liste.map(function (a) { return a.id; });
    let prives = [], medias = [];
    if (ids.length) {
      const r1 = await albSupabase.from('annonces_prive').select('annonce_id, adresse, telephone, videos').in('annonce_id', ids);
      const r2 = await albSupabase.from('annonce_medias').select('id, annonce_id, url, ordre').in('annonce_id', ids).order('ordre', { ascending: true });
      prives = r1.data || [];
      medias = r2.data || [];
    }
    // Les demandes de visite reçues (le prénom et le créneau ; le reste une fois la visite confirmée)
    let demandes = [];
    if (ids.length) {
      const r3 = await albSupabase.rpc('alb_mes_demandes_recues');
      if (r3.error) console.error('[ALB DEBUG] demandes de visite :', r3.error);
      demandes = r3.data || [];
    }
    annonces = liste.map(function (a) {
      return {
        a: a,
        prive: prives.find(function (p) { return p.annonce_id === a.id; }) || {},
        photos: medias.filter(function (m) { return m.annonce_id === a.id; }),
        visites: demandes.filter(function (d) { return d.annonce_id === a.id; }),
      };
    });
  }

  // ---------- Affichage ----------
  function dessiner() {
    const zone = bloc();
    if (!zone) return;
    let html = '<a class="bouton ma-ajouter" href="vendre-mon-bien.html">➕ Ajouter une annonce</a>';
    if (!annonces.length) {
      html += '<p class="ma-vide">Vous n’avez pas encore d’annonce. Vendez À La Bien : racontez votre bien, ajoutez vos photos, Jocelyne vous appelle avant la mise en ligne.</p>';
      zone.innerHTML = html;
      return;
    }
    annonces.forEach(function (x) { html += carte(x); });
    zone.innerHTML = html;
  }

  function carte(x) {
    const a = x.a;
    const st = STATUTS[a.statut] || { texte: a.statut, classe: '', aide: '' };
    const vendu = a.statut === 'vendu';
    const photo = x.photos[0] ? '<img class="ma-vignette" src="' + e(x.photos[0].url) + '" alt="" loading="lazy">' : '<div class="ma-vignette ma-sans-photo">🏡</div>';
    let aide = st.aide;
    if (a.statut === 'compromis' && a.date_fin_compromis) aide = 'Compromis signé, jusqu’au ' + dateCourte(a.date_fin_compromis) + '.';
    if (a.statut === 'disponible' && a.mis_en_ligne_le) aide = 'En ligne depuis le ' + dateCourte(a.mis_en_ligne_le) + '. Jocelyne vous appelle chaque mois pour faire le point.';
    const typeVente = a.type_vente === 'accompagnee' ? '<span class="ma-type ma-type-pro">🤝 Vente accompagnée</span>' : '<span class="ma-type">🏡 Entre particuliers</span>';

    let rappelDispos = '';
    if (a.type_vente === 'particulier' && !vendu && a.statut !== 'refusee' && !disposAVenir(a).length) {
      rappelDispos = '<div class="ma-rappel">📅 Pensez à indiquer vos disponibilités : c’est parmi elles que les acheteurs choisiront leur créneau de visite.</div>';
    }

    let boutons = '';
    if (!vendu) {
      boutons += '<button type="button" class="ma-btn' + (ouvert[a.id] === 'modifier' ? ' actif' : '') + '" data-action="ouvrir" data-panneau="modifier" data-id="' + e(a.id) + '">✏️ Modifier</button>';
      boutons += '<button type="button" class="ma-btn' + (ouvert[a.id] === 'photos' ? ' actif' : '') + '" data-action="ouvrir" data-panneau="photos" data-id="' + e(a.id) + '">📷 Photos (' + x.photos.length + ')</button>';
      if (a.type_vente === 'particulier') {
        boutons += '<button type="button" class="ma-btn' + (ouvert[a.id] === 'dispos' ? ' actif' : '') + '" data-action="ouvrir" data-panneau="dispos" data-id="' + e(a.id) + '">📅 Mes disponibilités (' + disposAVenir(a).length + ')</button>';
      }
    }

    const aTraiter = x.visites.filter(function (d) { return d.statut === 'en_attente' && d.type_vente === 'particulier'; }).length;
    if (x.visites.length) {
      boutons += '<button type="button" class="ma-btn ma-btn-visites' + (ouvert[a.id] === 'visites' ? ' actif' : '') + (aTraiter ? ' ma-a-traiter' : '') + '" data-action="ouvrir" data-panneau="visites" data-id="' + e(a.id) + '">📬 Demandes de visite (' + x.visites.length + ')' + (aTraiter ? ' · ' + aTraiter + ' à traiter' : '') + '</button>';
    }

    let panneau = '';
    if (ouvert[a.id] === 'visites') panneau = panneauVisites(x);
    if (!vendu && ouvert[a.id] === 'modifier') panneau = panneauModifier(x);
    if (!vendu && ouvert[a.id] === 'photos') panneau = panneauPhotos(x);
    if (!vendu && ouvert[a.id] === 'dispos') panneau = panneauDispos(x);

    return '<div class="ma-annonce" id="ma-' + e(a.id) + '">' +
      '<div class="ma-tete">' + photo +
        '<div class="ma-infos">' +
          '<div class="ma-statut ' + st.classe + '">' + e(st.texte) + '</div>' +
          '<div class="ma-titre">' + e(a.titre) + '</div>' +
          '<div class="ma-prix">' + e(prix(a.prix)) + '</div>' +
          typeVente +
        '</div>' +
      '</div>' +
      (aide ? '<p class="ma-aide">' + e(aide) + '</p>' : '') +
      rappelDispos +
      '<div class="message" id="ma-msg-' + e(a.id) + '"></div>' +
      (boutons ? '<div class="ma-boutons">' + boutons + '</div>' : '') +
      panneau +
    '</div>';
  }

  // ----- Modifier -----
  function option(valeur, texte, choisi) {
    return '<option value="' + e(valeur) + '"' + (String(choisi) === String(valeur) ? ' selected' : '') + '>' + e(texte) + '</option>';
  }
  function lettres(choisi) {
    return ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(function (l) { return option(l, l, choisi); }).join('');
  }
  function champ(id, label, valeur, type, extra) {
    return '<div class="champ"><label for="' + id + '">' + label + '</label><input type="' + (type || 'text') + '" id="' + id + '" value="' + e(valeur ?? '') + '"' + (extra || '') + '></div>';
  }

  function panneauModifier(x) {
    const a = x.a, p = x.prive, v = p.videos || [];
    const pro = a.type_vente === 'accompagnee';
    return '<form class="ma-panneau" data-id="' + e(a.id) + '" data-form="modifier" novalidate>' +
      '<h3>✏️ Modifier mon annonce</h3>' +
      '<p class="ma-petit">Vos changements sont en ligne dès l’enregistrement. Jocelyne est simplement prévenue.</p>' +
      '<div class="deux-colonnes">' +
        '<div class="champ"><label for="m-type">Type de bien</label><select id="m-type">' + option('maison', 'Maison', a.type_bien) + option('appartement', 'Appartement', a.type_bien) + '</select></div>' +
        champ('m-prix', 'Prix (€)', a.prix, 'number', ' min="1000" step="1" inputmode="numeric"') +
        champ('m-surface', 'Surface habitable (m²)', a.surface_m2, 'number', ' min="5" step="0.5" inputmode="decimal"') +
        champ('m-pieces', 'Nombre de pièces', a.nb_pieces, 'number', ' min="1" max="50" step="1" inputmode="numeric"') +
        champ('m-terrain', 'Terrain (m²) — facultatif', a.surface_terrain_m2, 'number', ' min="0" step="1" inputmode="numeric"') +
        champ('m-cp', 'Code postal', a.code_postal, 'text', ' maxlength="5" inputmode="numeric"') +
        champ('m-ville', 'Ville', a.ville) +
        '<div class="champ"><label for="m-dpe">DPE</label><select id="m-dpe">' + lettres(a.dpe) + '</select></div>' +
        '<div class="champ"><label for="m-ges">GES</label><select id="m-ges">' + lettres(a.ges) + '</select></div>' +
        champ('m-dep-min', 'Dépenses d’énergie mini (€/an) — facultatif', a.depenses_energie_min, 'number', ' min="0" step="1" inputmode="numeric"') +
        champ('m-dep-max', 'Dépenses d’énergie maxi (€/an) — facultatif', a.depenses_energie_max, 'number', ' min="0" step="1" inputmode="numeric"') +
      '</div>' +
      champ('m-titre', 'Titre de l’annonce', a.titre, 'text', ' maxlength="120"') +
      '<div class="champ"><label for="m-description">Description</label><textarea id="m-description" rows="7" maxlength="5000">' + e(a.description || '') + '</textarea></div>' +
      (pro ? '<div class="deux-colonnes">' + champ('m-agence', 'Agence ou réseau', a.agence_nom, 'text', ' maxlength="120"') + champ('m-honoraires', 'Honoraires', a.honoraires_texte, 'text', ' maxlength="200"') + '</div>' : '') +
      '<div class="ma-prive"><div class="ma-prive-titre">🔒 Jamais affiché sur le site</div>' +
        champ('m-adresse', 'Adresse du bien', p.adresse, 'text', ' maxlength="200" autocomplete="street-address"') +
        champ('m-tel', 'Téléphone pour cette annonce', p.telephone, 'tel', ' maxlength="20" autocomplete="tel"') +
        '<div class="champ"><label for="m-video1">Vidéos YouTube — facultatif (2 au maximum)</label>' +
          '<input type="url" id="m-video1" value="' + e(v[0] || '') + '" placeholder="https://youtu.be/…" style="margin-bottom:8px;">' +
          '<input type="url" id="m-video2" value="' + e(v[1] || '') + '" placeholder="https://youtu.be/…">' +
          '<div class="aide">Les vidéos sont envoyées aux acheteurs une fois la visite confirmée.</div></div>' +
      '</div>' +
      '<div class="ma-actions"><button type="submit" class="bouton">Enregistrer</button><button type="button" class="bouton bouton-discret" data-action="fermer" data-id="' + e(a.id) + '">Annuler</button></div>' +
    '</form>';
  }

  function nombre(id) { const t = String(el(id).value || '').trim().replace(',', '.'); return t === '' ? null : Number(t); }
  function texte(id) { return String((el(id) && el(id).value) || '').trim(); }

  async function enregistrerModif(id, bouton) {
    const x = annonces.find(function (y) { return y.a.id === id; });
    if (!x) return;
    const pro = x.a.type_vente === 'accompagnee';
    const champs = {
      type_bien: texte('m-type'),
      prix: nombre('m-prix'),
      surface_m2: nombre('m-surface'),
      nb_pieces: nombre('m-pieces'),
      surface_terrain_m2: nombre('m-terrain'),
      code_postal: texte('m-cp'),
      ville: texte('m-ville'),
      dpe: texte('m-dpe'),
      ges: texte('m-ges'),
      depenses_energie_min: nombre('m-dep-min'),
      depenses_energie_max: nombre('m-dep-max'),
      titre: texte('m-titre'),
      description: texte('m-description'),
    };
    if (pro) { champs.agence_nom = texte('m-agence') || null; champs.honoraires_texte = texte('m-honoraires'); }
    const videos = [texte('m-video1'), texte('m-video2')].filter(Boolean);
    const adresse = texte('m-adresse'), tel = texte('m-tel');

    // Vérifications (les mêmes que le serveur)
    let err = '';
    if (['maison', 'appartement'].indexOf(champs.type_bien) === -1) err = 'Choisissez maison ou appartement.';
    else if (!(champs.prix >= 1000 && champs.prix <= 50000000)) err = 'Le prix doit être compris entre 1 000 € et 50 000 000 €.';
    else if (!(champs.surface_m2 >= 5 && champs.surface_m2 <= 5000)) err = 'La surface doit être comprise entre 5 et 5 000 m².';
    else if (champs.nb_pieces !== null && !(Number.isInteger(champs.nb_pieces) && champs.nb_pieces >= 1 && champs.nb_pieces <= 50)) err = 'Le nombre de pièces doit être compris entre 1 et 50.';
    else if (champs.surface_terrain_m2 !== null && !(champs.surface_terrain_m2 >= 0 && champs.surface_terrain_m2 <= 1000000)) err = 'La surface du terrain n’est pas valable.';
    else if (!/^\d{5}$/.test(champs.code_postal)) err = 'Le code postal doit faire 5 chiffres.';
    else if (champs.ville.length < 2) err = 'Indiquez la ville.';
    else if ([champs.depenses_energie_min, champs.depenses_energie_max].some(function (n) { return n !== null && !(Number.isInteger(n) && n >= 0 && n <= 100000); })) err = 'Les dépenses d’énergie doivent être des nombres entiers.';
    else if (champs.depenses_energie_min !== null && champs.depenses_energie_max !== null && champs.depenses_energie_min > champs.depenses_energie_max) err = 'Les dépenses mini doivent être inférieures aux dépenses maxi.';
    else if (champs.titre.length < 5) err = 'Le titre est trop court.';
    else if (champs.description.length < 30) err = 'La description doit faire au moins 30 caractères.';
    else if (pro && !champs.honoraires_texte) err = 'Merci d’indiquer les honoraires.';
    else if (videos.some(function (v) { return !/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(v); })) err = 'Les vidéos doivent être des liens YouTube (https://youtu.be/… ou https://www.youtube.com/…).';
    else if (tel && tel.replace(/\D/g, '').length < 10) err = 'Le numéro de téléphone n’est pas complet.';
    if (err) { montrerMessage('ma-msg-' + id, 'erreur', err); el('ma-msg-' + id).scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }

    // Seulement ce qui a changé
    const change = {};
    Object.keys(champs).forEach(function (k) {
      const avant = x.a[k] === undefined ? null : x.a[k];
      const apres = champs[k];
      if (String(avant ?? '') !== String(apres ?? '')) change[k] = apres;
    });
    const v0 = x.prive.videos || [];
    const priveChange = adresse !== String(x.prive.adresse || '') || tel !== String(x.prive.telephone || '') || videos.join('|') !== v0.join('|');

    if (!Object.keys(change).length && !priveChange) {
      montrerMessage('ma-msg-' + id, 'info', 'Rien n’a changé.');
      return;
    }

    bouton.disabled = true;
    bouton.textContent = 'Enregistrement…';
    try {
      if (Object.keys(change).length) {
        const { error } = await albSupabase.from('annonces').update(change).eq('id', id);
        if (error) throw error;
      }
      if (priveChange) {
        const { error } = await albSupabase.rpc('alb_annonce_prive_modifier', { p_id: id, p_adresse: adresse, p_telephone: tel, p_videos: videos });
        if (error) throw error;
      }
      ouvert[id] = null;
      await rafraichir();
      montrerMessage('ma-msg-' + id, 'succes', 'C’est enregistré ✅');
    } catch (ex) {
      console.error('[ALB DEBUG] modification annonce :', ex);
      montrerMessage('ma-msg-' + id, 'erreur', messageErreur(ex));
      bouton.disabled = false;
      bouton.textContent = 'Enregistrer';
    }
  }

  // ----- Photos -----
  function panneauPhotos(x) {
    const a = x.a;
    const grille = x.photos.map(function (m, i) {
      return '<div class="ma-photo"><img src="' + e(m.url) + '" alt="Photo ' + (i + 1) + '" loading="lazy">' +
        (i === 0 ? '<span class="ma-une">Photo principale</span>' : '') +
        '<button type="button" class="ma-retirer" data-action="retirer-photo" data-id="' + e(a.id) + '" data-media="' + e(m.id) + '" aria-label="Retirer cette photo">✕</button></div>';
    }).join('');
    const place = PHOTOS_MAX - x.photos.length;
    return '<div class="ma-panneau">' +
      '<h3>📷 Mes photos</h3>' +
      '<p class="ma-petit">' + x.photos.length + ' / ' + PHOTOS_MAX + ' photos. La première est la photo principale. Les photos sont allégées automatiquement.</p>' +
      (grille ? '<div class="ma-grille">' + grille + '</div>' : '<p class="ma-petit">Pas encore de photo.</p>') +
      (place > 0
        ? '<label class="bouton bouton-discret ma-ajout-photo">➕ Ajouter des photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-action="ajouter-photos" data-id="' + e(a.id) + '" hidden></label>'
        : '<p class="ma-petit">Vous avez atteint le maximum de ' + PHOTOS_MAX + ' photos.</p>') +
      '<div class="ma-progression" id="ma-prog-' + e(a.id) + '"></div>' +
    '</div>';
  }

  async function ajouterPhotos(id, fichiers) {
    const x = annonces.find(function (y) { return y.a.id === id; });
    if (!x) return;
    const liste = Array.from(fichiers || []).filter(function (f) { return /^image\/(jpeg|png|webp)$/.test(f.type); });
    const place = PHOTOS_MAX - x.photos.length;
    const aEnvoyer = liste.slice(0, Math.max(0, place));
    if (!aEnvoyer.length) { montrerMessage('ma-msg-' + id, 'erreur', 'Choisissez des photos au format JPEG, PNG ou WebP.'); return; }
    const prog = el('ma-prog-' + id);
    let ordre = x.photos.reduce(function (m, p) { return Math.max(m, Number(p.ordre) || 0); }, -1);
    let ratees = 0;
    for (let i = 0; i < aEnvoyer.length; i++) {
      if (prog) prog.textContent = 'Envoi des photos… (' + (i + 1) + '/' + aEnvoyer.length + ')';
      const blob = await reduirePhoto(aEnvoyer[i]);
      if (!blob) { ratees++; continue; }
      const cheminPhoto = monId + '/' + id + '/' + Date.now() + '-' + i + '.jpg';
      const envoi = await albSupabase.storage.from('annonces-photos').upload(cheminPhoto, blob, { contentType: 'image/jpeg', upsert: false });
      if (envoi.error) { console.error('[ALB DEBUG] photo :', envoi.error); ratees++; continue; }
      const adresse = albSupabase.storage.from('annonces-photos').getPublicUrl(cheminPhoto).data.publicUrl;
      ordre++;
      const fiche = await albSupabase.from('annonce_medias').insert({ annonce_id: id, url: adresse, type_media: 'photo', type: 'photo', ordre: ordre });
      if (fiche.error) {
        console.error('[ALB DEBUG] fiche photo :', fiche.error);
        await albSupabase.storage.from('annonces-photos').remove([cheminPhoto]);
        ratees++;
      }
    }
    await rafraichir();
    const refus = liste.length - aEnvoyer.length;
    if (ratees || refus) {
      montrerMessage('ma-msg-' + id, 'erreur',
        (ratees ? ratees + ' photo(s) n’ont pas pu être envoyées. ' : '') +
        (refus ? refus + ' photo(s) en trop : ' + PHOTOS_MAX + ' au maximum.' : ''));
    } else {
      montrerMessage('ma-msg-' + id, 'succes', 'Photos ajoutées ✅');
    }
  }

  async function retirerPhoto(id, mediaId) {
    const x = annonces.find(function (y) { return y.a.id === id; });
    const m = x && x.photos.find(function (p) { return p.id === mediaId; });
    if (!m) return;
    if (!window.confirm('Retirer cette photo de votre annonce ?')) return;
    const { error } = await albSupabase.from('annonce_medias').delete().eq('id', mediaId);
    if (error) { console.error('[ALB DEBUG] retrait photo :', error); montrerMessage('ma-msg-' + id, 'erreur', messageErreur(error)); return; }
    const c = chemin(m.url);
    if (c) {
      const r = await albSupabase.storage.from('annonces-photos').remove([c]);
      if (r.error) console.error('[ALB DEBUG] fichier photo :', r.error);
    }
    await rafraichir();
    montrerMessage('ma-msg-' + id, 'succes', 'Photo retirée.');
  }

  // ----- Disponibilités (vente entre particuliers) -----
  function disposAVenir(a) {
    const auj = aujourdhui();
    return (Array.isArray(a.disponibilites_visite) ? a.disponibilites_visite : [])
      .filter(function (d) { return d && d.date >= auj; })
      .sort(function (p, q) { return (p.date + p.debut).localeCompare(q.date + q.debut); });
  }

  function panneauDispos(x) {
    const a = x.a;
    const liste = disposAVenir(a).map(function (d, i) {
      return '<li><span>📅 ' + e(dateFr(d.date)) + ' · ' + e(d.debut) + ' – ' + e(d.fin) + '</span>' +
        '<button type="button" class="ma-retirer-dispo" data-action="retirer-dispo" data-id="' + e(a.id) + '" data-index="' + i + '" aria-label="Retirer ce créneau">✕</button></li>';
    }).join('');
    return '<div class="ma-panneau">' +
      '<h3>📅 Mes disponibilités pour les visites</h3>' +
      '<p class="ma-petit">Les acheteurs choisissent un créneau parmi ceux-ci. Vous acceptez ou proposez un autre moment ensuite. Les créneaux passés disparaissent tout seuls.</p>' +
      (liste ? '<ul class="ma-dispos">' + liste + '</ul>' : '<p class="ma-petit"><strong>Aucun créneau pour le moment.</strong></p>') +
      '<div class="ma-nouveau-dispo">' +
        '<div class="champ"><label for="d-date">Jour</label><input type="date" id="d-date" min="' + aujourdhui() + '"></div>' +
        '<div class="champ"><label for="d-debut">De</label><input type="time" id="d-debut" value="14:00" step="900"></div>' +
        '<div class="champ"><label for="d-fin">À</label><input type="time" id="d-fin" value="18:00" step="900"></div>' +
      '</div>' +
      '<button type="button" class="bouton" data-action="ajouter-dispo" data-id="' + e(a.id) + '">➕ Ajouter ce créneau</button>' +
    '</div>';
  }

  async function enregistrerDispos(id, nouvelles, texteOk) {
    const { error } = await albSupabase.from('annonces').update({ disponibilites_visite: nouvelles }).eq('id', id);
    if (error) { console.error('[ALB DEBUG] disponibilités :', error); montrerMessage('ma-msg-' + id, 'erreur', messageErreur(error)); return; }
    await rafraichir();
    montrerMessage('ma-msg-' + id, 'succes', texteOk);
  }

  async function ajouterDispo(id) {
    const x = annonces.find(function (y) { return y.a.id === id; });
    if (!x) return;
    const date = texte('d-date'), debut = texte('d-debut'), fin = texte('d-fin');
    let err = '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) err = 'Choisissez un jour.';
    else if (date < aujourdhui()) err = 'Ce jour est déjà passé.';
    else if (!/^\d{2}:\d{2}$/.test(debut) || !/^\d{2}:\d{2}$/.test(fin)) err = 'Indiquez les heures de début et de fin.';
    else if (fin <= debut) err = 'L’heure de fin doit être après l’heure de début.';
    const avenir = disposAVenir(x.a);
    if (!err && avenir.some(function (d) { return d.date === date && debut < d.fin && fin > d.debut; })) err = 'Ce créneau chevauche un créneau déjà prévu ce jour-là.';
    if (!err && avenir.length >= DISPOS_MAX) err = 'Vous avez déjà ' + DISPOS_MAX + ' créneaux : retirez-en avant d’en ajouter.';
    if (err) { montrerMessage('ma-msg-' + id, 'erreur', err); return; }
    const nouvelles = avenir.concat([{ date: date, debut: debut, fin: fin }])
      .sort(function (p, q) { return (p.date + p.debut).localeCompare(q.date + q.debut); });
    await enregistrerDispos(id, nouvelles, 'Créneau ajouté ✅');
  }

  async function retirerDispo(id, index) {
    const x = annonces.find(function (y) { return y.a.id === id; });
    if (!x) return;
    const avenir = disposAVenir(x.a);
    avenir.splice(index, 1);
    await enregistrerDispos(id, avenir, 'Créneau retiré.');
  }

  // ----- Demandes de visite reçues -----
  const STATUTS_VISITE = {
    en_attente: '⏳ À traiter', acceptee: '✅ Visite confirmée', autre_moment: '📅 Autre moment proposé, en attente de sa réponse',
    refusee: 'Refusée', annulee: 'Annulée', effectuee: 'Effectuée',
  };
  function moment(jour, heure) { return jour && heure ? dateFr(jour) + ' à ' + String(heure).replace(':', 'h') : ''; }

  function panneauVisites(x) {
    const lignes = x.visites.map(function (d) {
      const passee = d.statut === 'acceptee' && d.creneau_date && d.creneau_date < aujourdhui();
      let html = '<div class="ma-visite" id="mv-' + e(d.id) + '">' +
        '<div class="ma-visite-tete"><strong>' + e(((d.acheteur_prenom || '') + ' ' + (d.acheteur_nom || '')).trim() || 'Un acheteur') + '</strong>' +
        '<span class="ma-visite-statut">' + e(passee ? 'Visite passée' : (STATUTS_VISITE[d.statut] || d.statut)) + '</span></div>';
      if (d.type_vente === 'accompagnee') {
        html += '<div class="ma-petit">Demande du ' + e(dateCourte(d.cree_le)) + '. Il a accepté que vous l’appeliez pour fixer la visite.</div>';
      } else {
        const quand = d.statut === 'autre_moment' ? moment(d.nouveau_creneau_date, d.nouveau_creneau_heure) : moment(d.creneau_date, d.creneau_heure);
        html += '<div class="ma-visite-quand">' + (quand ? '📅 ' + e(quand) : 'Aucun de vos créneaux ne lui convenait : proposez-lui un moment.') + '</div>';
      }
      if (d.acheteur_telephone) html += '<div>📱 <a href="tel:' + e(String(d.acheteur_telephone).replace(/[^0-9+]/g, '')) + '">' + e(d.acheteur_telephone) + '</a></div>';
      if (d.budget_ok === true) html += '<div class="ma-petit">✅ Budget vérifié avec le simulateur ALB : ce bien entre dans son budget.</div>';
      if (d.message) html += '<div class="ma-visite-mot">💬 ' + e(d.message) + '</div>';

      if (d.type_vente === 'particulier' && !passee) {
        if (d.statut === 'en_attente') {
          html += '<div class="ma-boutons">' +
            (d.creneau_date ? '<button type="button" class="ma-btn ma-btn-oui" data-action="visite" data-decision="accepter" data-demande="' + e(d.id) + '" data-id="' + e(x.a.id) + '">✅ Accepter</button>' : '') +
            '<button type="button" class="ma-btn" data-action="visite-autre" data-demande="' + e(d.id) + '">📅 Proposer un autre moment</button>' +
            '<button type="button" class="ma-btn" data-action="visite" data-decision="refuser" data-demande="' + e(d.id) + '" data-id="' + e(x.a.id) + '">Refuser</button>' +
          '</div>';
        } else if (d.statut === 'autre_moment') {
          html += '<div class="ma-boutons"><button type="button" class="ma-btn" data-action="visite-autre" data-demande="' + e(d.id) + '">📅 Proposer un autre moment</button>' +
            '<button type="button" class="ma-btn" data-action="visite" data-decision="refuser" data-demande="' + e(d.id) + '" data-id="' + e(x.a.id) + '">Refuser</button></div>';
        } else if (d.statut === 'acceptee') {
          html += '<div class="ma-boutons"><button type="button" class="ma-btn" data-action="visite" data-decision="annuler" data-demande="' + e(d.id) + '" data-id="' + e(x.a.id) + '">Annuler la visite</button></div>';
        }
        html += '<div class="ma-autre cache" id="ma-autre-' + e(d.id) + '">' +
          '<div class="ma-nouveau-dispo">' +
            '<div class="champ"><label for="va-date-' + e(d.id) + '">Jour</label><input type="date" id="va-date-' + e(d.id) + '" min="' + aujourdhui() + '"></div>' +
            '<div class="champ"><label for="va-heure-' + e(d.id) + '">Heure</label><input type="time" id="va-heure-' + e(d.id) + '" step="900" value="14:00"></div>' +
          '</div>' +
          '<div class="champ"><label for="va-mot-' + e(d.id) + '">Un petit mot <span style="font-weight:400;">(facultatif)</span></label><input type="text" id="va-mot-' + e(d.id) + '" maxlength="300"></div>' +
          '<button type="button" class="bouton" data-action="visite" data-decision="autre_moment" data-demande="' + e(d.id) + '" data-id="' + e(x.a.id) + '">Envoyer ma proposition</button>' +
        '</div>';
      }
      return html + '</div>';
    }).join('');
    return '<div class="ma-panneau"><h3>📬 Demandes de visite</h3>' +
      (x.a.type_vente === 'particulier'
        ? '<p class="ma-petit">Vous voyez le prénom et le moment demandé. Dès que vous acceptez, vous recevez tous les deux les coordonnées par e-mail, et un rappel la veille.</p>'
        : '<p class="ma-petit">Chaque acheteur a accepté que vous l’appeliez pour fixer la visite. Vous avez reçu ses coordonnées par e-mail.</p>') +
      lignes + '</div>';
  }

  async function repondreVisite(bouton) {
    const id = bouton.dataset.id, demande = bouton.dataset.demande, decision = bouton.dataset.decision;
    const corps = { action: 'reponse_visite', demande_id: demande, decision: decision };
    if (decision === 'autre_moment') {
      corps.date = texte('va-date-' + demande); corps.heure = texte('va-heure-' + demande); corps.message = texte('va-mot-' + demande);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(corps.date) || corps.date < aujourdhui() || !/^\d{2}:\d{2}$/.test(corps.heure)) {
        montrerMessage('ma-msg-' + id, 'erreur', 'Choisissez un jour à venir et une heure.');
        return;
      }
    }
    if (decision === 'refuser' && !window.confirm('Refuser cette demande de visite ? L’acheteur sera prévenu gentiment.')) return;
    if (decision === 'annuler' && !window.confirm('Annuler cette visite ? Le visiteur sera prévenu par e-mail.')) return;
    bouton.disabled = true;
    const r = await albAppelerGuichet(corps);
    if (!r.ok) {
      bouton.disabled = false;
      const textes = { CRENEAU_PASSE: 'Ce moment est déjà passé : proposez-en un autre.', CRENEAU_INVALIDE: 'Choisissez un jour à venir et une heure.', DECISION_IMPOSSIBLE: 'Cette demande a déjà changé : rechargez la page.' };
      montrerMessage('ma-msg-' + id, 'erreur', textes[r.code] || albMessageErreur(r.code));
      return;
    }
    await rafraichir();
    montrerMessage('ma-msg-' + id, 'succes', {
      accepter: 'Visite confirmée ✅ Vous recevez tous les deux un e-mail avec les coordonnées.',
      autre_moment: 'Votre proposition est partie 📅 Il vous répondra depuis son espace.',
      refuser: 'C’est noté. L’acheteur est prévenu.',
      annuler: 'Visite annulée. Le visiteur est prévenu.',
    }[decision]);
  }

  // ---------- Clics ----------
  async function rafraichir() {
    try { await charger(); } catch (ex) { /* on garde l'affichage précédent */ }
    dessiner();
  }

  function brancher() {
    const zone = bloc();
    if (!zone || zone.dataset.branche) return;
    zone.dataset.branche = '1';

    zone.addEventListener('click', function (ev) {
      const cible = ev.target.closest('[data-action]');
      if (!cible || cible.tagName === 'INPUT') return;
      const id = cible.dataset.id;
      const action = cible.dataset.action;
      if (action === 'ouvrir') {
        ouvert[id] = ouvert[id] === cible.dataset.panneau ? null : cible.dataset.panneau;
        dessiner();
        const c = el('ma-' + id);
        if (c) c.scrollIntoView({ block: 'start', behavior: 'smooth' });
      } else if (action === 'fermer') {
        ouvert[id] = null;
        dessiner();
      } else if (action === 'retirer-photo') {
        retirerPhoto(id, cible.dataset.media);
      } else if (action === 'ajouter-dispo') {
        cible.disabled = true;
        ajouterDispo(id).finally(function () { cible.disabled = false; });
      } else if (action === 'visite') {
        repondreVisite(cible);
      } else if (action === 'visite-autre') {
        const bloc = el('ma-autre-' + cible.dataset.demande);
        if (bloc) bloc.classList.toggle('cache');
      } else if (action === 'retirer-dispo') {
        retirerDispo(id, Number(cible.dataset.index));
      }
    });

    zone.addEventListener('change', function (ev) {
      const t = ev.target;
      if (t.dataset && t.dataset.action === 'ajouter-photos') {
        const fichiers = Array.from(t.files || []);
        t.value = '';
        ajouterPhotos(t.dataset.id, fichiers);
      }
    });

    zone.addEventListener('submit', function (ev) {
      const f = ev.target;
      if (f.dataset.form !== 'modifier') return;
      ev.preventDefault();
      enregistrerModif(f.dataset.id, f.querySelector('button[type="submit"]'));
    });
  }

  // ---------- Styles de la rubrique ----------
  function styles() {
    if (el('ma-styles')) return;
    const s = document.createElement('style');
    s.id = 'ma-styles';
    s.textContent = [
      '.ma-ajouter{margin:14px 0 6px;}',
      '.ma-vide{margin-top:12px;font-size:.93rem;}',
      '.ma-annonce{border:1px solid #E8E6E1;border-radius:10px;padding:14px;margin-top:16px;background:#FFFFFF;}',
      '.ma-tete{display:flex;gap:14px;align-items:flex-start;}',
      '.ma-vignette{width:96px;height:72px;border-radius:6px;object-fit:cover;flex-shrink:0;background:#F5F3F0;}',
      '.ma-sans-photo{display:flex;align-items:center;justify-content:center;font-size:1.8rem;}',
      '.ma-infos{min-width:0;}',
      '.ma-statut{display:inline-block;font-size:.8rem;font-weight:700;padding:3px 10px;border-radius:20px;margin-bottom:6px;}',
      '.ma-st-attente{background:#FBF3E4;color:#8A6420;}',
      '.ma-st-ligne{background:#EEF6EE;color:#2E6B34;}',
      '.ma-st-pause{background:#F0EFEC;color:#5f5f5a;}',
      '.ma-st-offre{background:#F4EEF6;color:#5A3A6A;}',
      '.ma-st-vendu{background:#5A3A6A;color:#FFFFFF;}',
      '.ma-st-refus{background:#FBECEC;color:#8A2D2D;}',
      '.ma-titre{font-weight:700;color:#2a2a28;line-height:1.3;overflow-wrap:anywhere;}',
      '.ma-prix{color:#5A3A6A;font-weight:700;margin:2px 0 4px;}',
      '.ma-type{display:inline-block;font-size:.78rem;color:#4A4A47;background:#FBF8F3;border:1px solid #E8E6E1;padding:2px 8px;border-radius:12px;}',
      '.ma-type-pro{border-color:#B28E3D;color:#8A6420;}',
      '.ma-aide{font-size:.85rem;color:#6a6a65;margin-top:10px;}',
      '.ma-rappel{font-size:.85rem;background:#FBF3E4;border-left:3px solid #B28E3D;padding:8px 10px;border-radius:4px;margin-top:10px;}',
      '.ma-annonce .message{margin:10px 0 0;}',
      '.ma-boutons{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}',
      '.ma-btn{border:1px solid #D8D5CE;background:#FBF8F3;color:#4A4A47;border-radius:6px;padding:9px 12px;font-family:inherit;font-size:.9rem;font-weight:600;cursor:pointer;}',
      '.ma-btn:hover,.ma-btn.actif{border-color:#5A3A6A;background:#5A3A6A;color:#FFFFFF;}',
      '.ma-panneau{border-top:1px dashed #D8D5CE;margin-top:14px;padding-top:14px;}',
      '.ma-panneau h3{font-size:1.02rem;margin-bottom:6px;}',
      '.ma-petit{font-size:.85rem;color:#6a6a65;margin-bottom:12px;}',
      '.ma-prive{background:#F4EEF6;border-radius:8px;padding:12px 12px 2px;margin-bottom:14px;}',
      '.ma-prive-titre{font-weight:700;color:#5A3A6A;font-size:.88rem;margin-bottom:10px;}',
      '.ma-actions{display:flex;flex-direction:column;gap:10px;}',
      '.ma-grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin-bottom:12px;}',
      '.ma-photo{position:relative;}',
      '.ma-photo img{width:100%;height:84px;object-fit:cover;border-radius:6px;display:block;}',
      '.ma-une{position:absolute;left:4px;bottom:4px;background:rgba(90,58,106,.9);color:#FFFFFF;font-size:.68rem;padding:2px 6px;border-radius:10px;}',
      '.ma-retirer{position:absolute;top:4px;right:4px;width:28px;height:28px;border-radius:50%;border:none;background:rgba(0,0,0,.65);color:#FFFFFF;font-size:.9rem;cursor:pointer;}',
      '.ma-ajout-photo{display:inline-block;cursor:pointer;}',
      '.ma-progression{font-size:.85rem;color:#5A3A6A;margin-top:8px;}',
      '.ma-dispos{list-style:none;padding:0;margin:0 0 14px;}',
      '.ma-dispos li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;border:1px solid #E8E6E1;border-radius:6px;margin-bottom:6px;font-size:.9rem;background:#FBF8F3;}',
      '.ma-dispos li span::first-letter{text-transform:uppercase;}',
      '.ma-retirer-dispo{border:none;background:none;color:#8A2D2D;font-size:1rem;cursor:pointer;padding:4px 8px;}',
      '.ma-visite{border:1px solid #E8E6E1;border-radius:8px;padding:12px;margin-bottom:10px;background:#FBF8F3;font-size:.9rem;}',
      '.ma-visite a{color:#5A3A6A;font-weight:600;}',
      '.ma-visite-tete{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:4px;}',
      '.ma-visite-statut{font-size:.8rem;font-weight:700;color:#5A3A6A;}',
      '.ma-visite-quand{font-weight:600;color:#2a2a28;}',
      '.ma-visite-quand::first-letter{text-transform:uppercase;}',
      '.ma-visite-mot{margin-top:6px;font-style:italic;overflow-wrap:anywhere;}',
      '.ma-visite .ma-boutons{margin-top:10px;}',
      '.ma-autre{margin-top:10px;}',
      '.ma-btn-oui{background:#EEF6EE;border-color:#CBE3CD;color:#2E6B34;}',
      '.ma-a-traiter{border-color:#B28E3D;background:#FBF3E4;color:#8A6420;}',
      '.ma-nouveau-dispo{display:grid;grid-template-columns:1fr;gap:0 10px;}',
      '@media (min-width:600px){.ma-nouveau-dispo{grid-template-columns:2fr 1fr 1fr;}.ma-actions{flex-direction:row;}.ma-vignette{width:128px;height:96px;}}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------- Point d'entrée, appelé par espace-alb.html ----------
  // Renvoie vrai si la personne a au moins une annonce
  window.albMesAnnonces = async function (profil) {
    if (!profil || !profil.id) return false;
    monId = profil.id;
    ouvert = {};
    styles();
    brancher();
    try {
      await charger();
    } catch (ex) {
      const zone = bloc();
      if (zone) zone.innerHTML = '<div class="message visible erreur">Vos annonces n’ont pas pu être chargées. Rechargez la page dans un instant.</div>';
      return false;
    }
    dessiner();
    return annonces.length > 0;
  };
})();

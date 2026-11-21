// ============================================================
// mes-questionnaires-particulier.js — « Questionnaire de votre bien » pour les vendeurs particuliers
// Dans Mon espace ALB > Mes annonces : une proposition facultative sous chaque annonce
// « vente entre particuliers ». Le vendeur remplit un questionnaire (maison, maison de village
// ou appartement), enregistré en brouillon automatiquement, puis l'envoie à Jocelyne.
// Les réponses arrivent dans Gestion du site > Questionnaires de biens.
// Ce fichier ne modifie pas mes-annonces.js : il ajoute ses éléments après chaque affichage.
// Besoin de : alb-connexion.js (albSupabase, albEchapper)
// ============================================================
(function () {
  'use strict';

  const SEP = ' · ';
  const e = function (t) { return albEchapper(t); };

  // ---------- Listes communes ----------
  const SOL = ['Carrelage', 'Parquet', 'Stratifié', 'Pierre, tomette'];
  const EQUIP = ['Placard', 'Clim.'];
  const FENETRES = ['Simple vitrage', 'Double vitrage', 'PVC', 'Aluminium', 'Bois', 'Volets'];
  const CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const DISTANCES = ['À pied, moins de 5 min', 'À pied, moins de 15 min', 'En voiture, moins de 10 min', 'Plus loin'];
  const TROIS = ['Fait', 'À faire', 'Ne sait pas'];
  const SALLES = ['Baignoire', 'Douche', "Douche à l'italienne", 'Lavabo', 'Double vasque', 'Meuble vasque', 'WC', 'Bidet', 'Sèche-serviettes'];
  const CUISINE_TYPE = ['Ouverte sur le séjour', 'Fermée', 'Américaine (avec bar)', 'Îlot central'];
  const CUISINE_EQ = ['Entièrement équipée', 'Aménagée (meubles, sans électroménager)', 'Non équipée'];
  const CUISINE_DEDANS = ['Plaque gaz', 'Plaque induction', 'Plaque électrique, vitrocéramique', 'Four', 'Four micro-ondes', 'Hotte', 'Réfrigérateur', 'Congélateur', 'Lave-vaisselle', 'Lave-linge', 'Meubles hauts et bas', 'Plan de travail', 'Évier', 'Cellier, arrière-cuisine'];
  const NIV_MAISON = ['Sous-sol', 'RDC', '1er étage', '2e étage', '3e étage', 'Mezzanine', 'Duplex'];
  const NIV_APPART = ['Niveau 1', 'Niveau 2', 'Mezzanine', 'Duplex'];
  const TYPES_PIECES = ['Entrée', 'Séjour, salon', 'Cuisine', 'Chambre', 'Bureau', 'Salle de bains', "Salle d'eau", 'WC', 'Dressing', 'Buanderie, cellier', 'Couloir, palier', 'Balcon, terrasse', 'Cave', 'Garage', 'Véranda', 'Mezzanine', 'Combles, grenier', 'Toit-terrasse', 'Autre (à préciser)'];
  const NUMEROTEES = ['Chambre', 'Salle de bains', "Salle d'eau", 'WC'];
  const SEC_PIECES = 'Pièce par pièce';

  const MSG_MANDAT = 'Un bien sous mandat exclusif ne peut pas être présenté ici. Vos réponses restent enregistrées : vous pourrez envoyer le questionnaire plus tard.';
  const ERREURS = {
    PAS_PARTICULIER: 'Ce questionnaire est réservé aux vendeurs particuliers.',
    TYPE_INVALIDE: 'Choisissez d’abord le type de bien.',
    TROP_LONG: 'Le questionnaire est trop long : raccourcissez les textes libres.',
    ANNONCE_INTROUVABLE: 'Cette annonce ne vous appartient pas.',
    MANDAT_EXCLUSIF: MSG_MANDAT,
    ADRESSE_OBLIGATOIRE: "Indiquez l'adresse du bien pour envoyer le questionnaire.",
    DEJA_EXISTANT: 'Un questionnaire existe déjà pour cette annonce. Fermez cette fenêtre et rouvrez-le depuis votre annonce.',
    INTROUVABLE_OU_DEJA_ENVOYE: 'Ce questionnaire a déjà été envoyé : il ne se modifie plus.',
  };

  // ---------- Contenu des trois questionnaires (les mêmes que les fichiers Word validés) ----------
  const ENVIRONS = function (extra) {
    return [
      { groupe: 'Commerces', lignes: ['Boulangerie, petits commerces', 'Supermarché'] },
      { groupe: 'Écoles', lignes: ['Crèche, maternelle, primaire', 'Collège, lycée'] },
      { groupe: 'Santé', lignes: ['Médecin, pharmacie', 'Hôpital, urgences'] },
      { groupe: 'Transports', lignes: ['Arrêt de bus', 'Gare', 'Autoroute, grand axe'] },
      { groupe: 'Nature et loisirs', lignes: ['Plage, mer', 'Rivière, lac', 'Forêt, randonnées', 'Parc, aire de jeux', 'Sport (stade, piscine)', 'Restaurants, cafés'] },
      { groupe: 'Services', lignes: ['Mairie, poste', 'Banque, distributeur'].concat(extra || []) },
    ];
  };
  const DIAGS_COMMUNS = [['Amiante', 'Permis de construire avant juillet 1997'], ['Plomb', 'Logement construit avant 1949'], ['Termites', 'Zone concernée par un arrêté de la préfecture'], ['Gaz', 'Installation de plus de 15 ans'], ['Électricité', 'Installation de plus de 15 ans'], ['Risques naturels et technologiques', 'Toujours']];
  const DIAGS_MAISON = DIAGS_COMMUNS.concat([['Assainissement', "Fosse ou micro-station (pas de tout-à-l'égout)"], ['Audit énergétique', 'Maison classée E, F ou G au DPE']]);

  const CFG = {
    appartement: {
      libelle: 'Appartement', titre: 'Votre appartement', copro: true, assainissement: false, terrain: null,
      diags: DIAGS_COMMUNS.concat([['Mesurage loi Carrez', 'Appartement en copropriété']]),
      niveaux: NIV_APPART, atelier: false, envExtra: [],
      selon: [
        { k: 'champs', items: [{ l: 'Étage du logement' }, { l: "Nombre d'étages de l'immeuble" }, { l: 'Surface du balcon, de la terrasse (m²)' }, { l: "Nombre d'appartements dans l'immeuble" }] },
        { k: 'cases', l: 'Accès', opts: ['Ascenseur', "Pas d'ascenseur (marches : ____)", 'Rez-de-chaussée', 'Dernier étage', 'Traversant (fenêtres sur deux côtés)', 'Sur deux niveaux'] },
        { k: 'cases', l: 'Extérieur et annexes', opts: ['Balcon', 'Terrasse', 'Loggia', 'Cave', 'Grenier ou chambre de service', 'Jardin privatif'] },
        { k: 'cases', l: 'Où se garer ?', opts: ['Garage ou box fermé', 'Place de parking privée', "Parking collectif de l'immeuble", 'Dans la rue', 'Pas de stationnement'] },
        { k: 'cases', l: 'Copropriété', opts: ['Syndic professionnel (nom : ______)', 'Syndic bénévole', 'Travaux votés ou prévus (lesquels : ______)', 'Procès en cours dans la copropriété'] },
      ],
    },
    maison: {
      libelle: 'Maison', titre: 'Votre maison', copro: false, assainissement: true, terrain: 'Superficie du terrain (m²)',
      diags: DIAGS_MAISON, niveaux: NIV_MAISON, atelier: true, envExtra: [],
      selon: [
        { k: 'champs', items: [{ l: 'Superficie du terrain (m²)' }, { l: 'Nombre de niveaux' }] },
        { k: 'cases', l: 'Niveaux', opts: ['De plain-pied', 'Un étage', 'Deux étages ou plus', 'Combles aménagés', 'Sous-sol ou cave'] },
        { k: 'cases', l: 'Terrain', opts: ['Plat', 'En pente', 'Clos entièrement', 'Non clos'] },
        { k: 'cases', l: 'Piscine', opts: ['Pas de piscine', 'Piscine existante', 'Terrain piscinable (assez de place, pente acceptable)', 'Terrain pas piscinable', 'Je ne sais pas'] },
        { k: 'cases', l: 'Où se garer ?', opts: ['Garage fermé (voitures : ___)', 'Carport (abri ouvert)', 'Dans la cour ou sur le terrain', 'Dans la rue', 'Pas de stationnement'] },
        { k: 'cases', l: 'Portail', opts: ['Électrique', 'Manuel', 'Pas de portail'] },
        { k: 'cases', l: 'Voisinage', opts: ['Maison isolée', "Mitoyenne d'un côté", 'Mitoyenne des deux côtés', 'Vis-à-vis'] },
        { k: 'cases', l: 'Extérieur', opts: ['Terrasse', 'Abri de jardin', 'Dépendance (atelier, gîte…)', 'Autre : ______'] },
      ],
    },
    village: {
      libelle: 'Maison de village', titre: 'Votre maison de village', copro: false, assainissement: true, terrain: null,
      diags: DIAGS_MAISON, niveaux: NIV_MAISON, atelier: true, envExtra: ['Place du village, marché'],
      selon: [
        { k: 'champs', items: [{ l: "Nombre d'étages (rez-de-chaussée compris)" }, { l: "Surface de l'extérieur (cour, terrasse, jardin) en m²" }] },
        { k: 'cases', l: 'Dans la maison', opts: ['Escalier étroit ou raide', 'Cave', 'Grenier ou combles', 'Toit-terrasse', 'Cheminée ou poêle', 'Poutres ou pierres apparentes', 'Vue dégagée'] },
        { k: 'cases', l: 'Extérieur', opts: ['Cour', 'Terrasse', 'Petit jardin', 'Aucun extérieur'] },
        { k: 'cases', l: 'Où se garer ?', opts: ['Garage', 'Place privée', 'Dans la rue devant la maison', 'Parking public à proximité (distance : ____ m)', 'Pas de stationnement facile', 'Portail ou porte de garage électrique'] },
        { k: 'cases', l: 'Voisinage', opts: ["Mitoyenne d'un côté", 'Mitoyenne des deux côtés', 'Rue étroite ou piétonne', 'Rue calme'] },
      ],
    },
  };

  // Les sections et les blocs. Le titre de la section sert de clé dans les réponses.
  function construireSections(type) {
    const cfg = CFG[type];
    const S = [];

    S.push({ titre: 'Vous', blocs: [
      { k: 'champs', items: [{ l: 'Nom et prénom' }, { l: 'Téléphone', t: 'tel' }, { l: 'E-mail', t: 'email' }] },
      { k: 'sous', l: 'Adresse du bien et visites' },
      { k: 'champs', items: [{ l: 'N° et rue' }, { l: 'Code postal' }, { l: 'Commune' }]
        .concat(cfg.copro ? [{ l: 'Bâtiment, étage, n° de porte' }] : [])
        .concat([{ l: "Code d'accès, interphone (facultatif)" }]) },
      { k: 'cases', l: 'Comment visiter ?', opts: ['Vendeur présent', 'Boîte à clés', 'Sur rendez-vous uniquement', 'Bien libre, vide'] },
      { k: 'cases', l: 'Le bien est actuellement', cle: 'actuel', opts: ['Occupé', 'Libre', 'Loué', 'Résidence secondaire'] },
    ] });

    S.push({ titre: 'Votre situation', blocs: [
      { k: 'cases', l: 'Vous vendez', opts: ['Seul(e)', 'À deux (couple)', 'À plusieurs (indivision)'] },
      { k: 'cases', l: 'Pourquoi vendez-vous ? (plusieurs réponses possibles)', opts: ['Déménagement ou mutation', "La famille s'agrandit (bien devenu trop petit)", 'Bien devenu trop grand', 'Succession', 'Séparation ou divorce', 'La retraite', "Besoin d'argent pour un autre projet", 'Autre : ________'] },
      { k: 'cases', l: 'Préférence', aff: ' ', opts: ['Je préfère en parler au téléphone'] },
      { k: 'sous', l: 'Tous les propriétaires sont-ils d’accord pour vendre ?' },
      { k: 'note', texte: 'À remplir seulement en cas de succession, de séparation ou de vente à plusieurs.' },
      { k: 'cases', l: "Accord des propriétaires", aff: ' ', opts: ['Oui', 'Pas encore', 'Je ne sais pas'] },
      { k: 'cases', l: 'Quand souhaitez-vous avoir vendu ?', opts: ['Le plus vite possible', 'Dans les 3 à 6 mois', 'Je ne suis pas pressé(e)'] },
    ] });

    S.push({ titre: 'Votre bien et les agences', blocs: [
      { k: 'mandat' },
    ] });

    S.push({ titre: 'La vente', blocs: [
      { k: 'cases', l: 'Depuis quand est-il en vente ?', opts: ['Pas encore mis en vente', "Moins d'un mois", '1 à 3 mois', '3 à 6 mois', '6 mois à 1 an', "Plus d'un an"] },
      { k: 'cases', l: 'Où est-il déjà annoncé ?', opts: ['Nulle part', 'Sur un site entre particuliers', 'Sur plusieurs sites', 'En agence', 'Par le bouche-à-oreille', 'Autre : ________'] },
      { k: 'cases', l: 'Visites déjà faites', opts: ['Aucune', '1 à 5', '6 à 15', 'Plus de 15'] },
      { k: 'champs', items: [{ l: 'Prix demandé (€)' }] },
      { k: 'cases', l: 'Le prix', opts: ['Prix négociable', 'Prix déjà baissé (ancien prix : ______ €)'] },
    ] });

    S.push({ titre: 'Le bien en chiffres', blocs: [
      { k: 'champs', items: [{ l: 'Surface habitable (m²)' }, { l: 'Nombre de pièces' }, { l: 'Nombre de chambres' }, { l: "Salles de bains ou salles d'eau" }, { l: 'Année de construction (environ)' }] },
      { k: 'cases', l: 'État général', opts: ['Très bon état, rien à prévoir', 'Bon état', 'À rafraîchir (peintures, sols)', 'À rénover (travaux importants)'] },
    ] });

    S.push({ titre: 'Ce qui a été fait', blocs: [
      { k: 'cases', l: "Travaux déjà faits (cochez et notez l'année)", opts: ['Aucun', 'Toiture : ____', 'Façade : ____', 'Isolation : ____', 'Fenêtres : ____', 'Chauffage : ____', 'Électricité : ____', 'Plomberie : ____', 'Cuisine : ____', 'Salle de bains : ____', 'Autre : ____'] },
      { k: 'cases', l: 'Avez-vous gardé les factures ?', opts: ['Oui, toutes', 'Certaines', 'Non'] },
      { k: 'long', l: 'Travaux que vous savez devoir faire', lignes: 3 },
    ] });

    const blocsChauf = [
      { k: 'cases', l: 'Chauffage', opts: ['Électrique', 'Gaz', 'Fioul', 'Pompe à chaleur', 'Poêle ou cheminée', 'Chauffage collectif', 'Autre : ________'] },
    ];
    if (cfg.assainissement) {
      blocsChauf.push(
        { k: 'cases', l: 'Eaux usées', opts: ["Tout-à-l'égout", 'Fosse septique', 'Micro-station', 'Je ne sais pas'] },
        { k: 'note', texte: 'Si fosse septique :' },
        { k: 'champs', items: [{ l: 'Dernière vidange en (année)' }, { l: 'Contrôle de la commune fait ? (oui / non)' }] }
      );
    }
    blocsChauf.push(
      { k: 'cases', l: 'Problèmes connus', opts: ['Aucun', 'Humidité', 'Fissures', 'Fuite de toiture', 'Termites', 'Autre : ________'] },
      { k: 'choix', l: 'Diagnostic énergie (DPE) — classe', opts: CLASSES },
      { k: 'choix', l: 'Gaz à effet de serre (GES) — classe', opts: CLASSES },
      { k: 'sous', l: 'Les autres diagnostics' },
      { k: 'note', texte: "Ils dépendent de l'âge et de la situation du bien. En cas de doute, choisissez « Ne sait pas » : on regarde ensemble." }
    );
    cfg.diags.forEach(function (d) { blocsChauf.push({ k: 'choix', l: d[0], aide: d[1], opts: TROIS }); });
    S.push({ titre: 'Chauffage, eau et diagnostics', blocs: blocsChauf });

    S.push({ titre: 'Les coûts', blocs: [
      { k: 'champs', items: (cfg.copro
        ? ['Taxe foncière (€ par an)', 'Charges de copropriété (€ par mois)', 'Eau, électricité, chauffage (€ par an)', 'Autres charges (€ par an, à préciser)']
        : ['Taxe foncière (€ par an)', 'Eau, électricité, chauffage (€ par an)', 'Autres charges (€ par an, à préciser)']).map(function (l) { return { l: l }; }) },
      { k: 'cases', l: 'Prêt en cours sur le bien', opts: ['Oui', 'Non'] },
      { k: 'loyer' },
    ] });

    const blocsEnv = [
      { k: 'cases', l: 'Le lieu', opts: ['Centre-ville, centre du village', 'Quartier résidentiel', 'Lotissement', 'Campagne', 'Bord de mer', 'Pied de montagne'] },
      { k: 'cases', l: "L'ambiance", opts: ['Très calme', 'Calme', 'Animé'] },
      { k: 'cases', l: 'Exposition et vue', opts: ['Nord', 'Sud', 'Est', 'Ouest', 'Vue dégagée', 'Vue mer ou montagne', 'Vis-à-vis'] },
      { k: 'cases', l: 'Nuisances connues', opts: ['Aucune', 'Bruit de la route', 'Bruit des voisins', 'Odeurs', 'Chantier ou projet proche', 'Autre : ________'] },
      { k: 'sous', l: 'Ce qu’il y a autour (choisissez la distance)' },
    ];
    ENVIRONS(cfg.envExtra).forEach(function (g) {
      blocsEnv.push({ k: 'sous2', l: g.groupe });
      g.lignes.forEach(function (n) { blocsEnv.push({ k: 'dist', l: n }); });
    });
    S.push({ titre: 'Les environs', blocs: blocsEnv });

    S.push({ titre: cfg.titre, blocs: cfg.selon });

    S.push({ titre: SEC_PIECES, blocs: [{ k: 'pieces' }] });

    S.push({ titre: 'Ce que vous attendez de nous', blocs: [
      { k: 'cases', l: "Qu'attendez-vous d'ALB Sud Immobilier ?", opts: ['Être plus visible', "Être aidé pour rédiger l'annonce", 'Être aidé pour les diagnostics et les papiers', "Être mis en relation avec un courtier (financement de l'acheteur)", "Être mis en relation avec un artisan (devis pour des travaux)", 'Être mis en relation avec un agent ou un mandataire', 'Recevoir des nouvelles régulièrement', 'Autre : ________'] },
      { k: 'cases', l: 'Comment préférez-vous être contacté ?', opts: ['Téléphone', 'SMS', 'E-mail'] },
      { k: 'accords' },
      { k: 'champs', items: [{ l: 'Jours et heures qui vous arrangent' }] },
      { k: 'champs', items: [{ l: 'Le point fort de votre bien, en une phrase' }] },
      { k: 'champs', items: [{ l: 'Le point d’attention à dire avec honnêteté' }] },
    ] });

    S.push({ titre: 'À vous la parole', blocs: [
      { k: 'note', texte: 'Cette page est la vôtre. Écrivez comme vous parleriez à quelqu’un de confiance : il n’y a ni bonne ni mauvaise réponse.' },
      { k: 'long', l: 'L’histoire de votre bien : ce qu’il représente pour vous, ce que vous y avez vécu', lignes: 5 },
      { k: 'long', l: 'Ce que vous aimez le plus chez vous (et que l’on ne voit pas sur les photos)', lignes: 5 },
      { k: 'long', l: 'Ce qui vous inquiète ou vous questionne dans cette vente', lignes: 5 },
      { k: 'long', l: 'Ce que vous aimeriez que l’acheteur sache ou ressente en entrant', lignes: 5 },
      { k: 'long', l: 'Tout ce que vous souhaitez ajouter, librement', lignes: 5 },
    ] });
    return S;
  }

  // ---------- Petits outils ----------
  function trou(opt) {
    const m = /_{3,}/.exec(opt);
    return m ? { avant: opt.slice(0, m.index), apres: opt.slice(m.index + m[0].length) } : null;
  }
  function nettoyer(t) { return String(t == null ? '' : t).replace(/\s·\s/g, ' - ').trim(); }
  function echapperRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function dateCourte(d) {
    if (!d) return '';
    const x = new Date(d);
    return isNaN(x) ? '' : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function messageErreur(err) {
    const brut = String((err && (err.message || err)) || '');
    for (const code in ERREURS) if (brut.indexOf(code) !== -1) return ERREURS[code];
    return 'Oups, cela n’a pas marché. Réessayez dans un instant ou appelez Jocelyne au 07 45 60 28 05.';
  }
  function memoire(cle, valeur) {
    try {
      if (valeur === undefined) return window.localStorage.getItem(cle);
      window.localStorage.setItem(cle, valeur);
    } catch (ex) { /* stockage indisponible : sans gravité */ }
    return null;
  }

  // ---------- État ----------
  let monId = null;
  let estPart = false;
  let annonces = [];          // { id, titre, type_vente, statut, type_bien }
  let questionnaires = [];    // résumé renvoyé par alb_part_mes_questionnaires
  let etat = null;            // questionnaire ouvert
  let champs = [];            // registre des champs du formulaire ouvert
  let racine = null;          // la fenêtre ouverte

  // ---------- Construction du formulaire ----------
  function nouvelId(c) { champs.push(c); return champs.length - 1; }

  function htmlOption(i, opt) {
    const t = trou(opt);
    const texte = t
      ? e(t.avant) + '<input type="text" class="mqp-trou" maxlength="80" aria-label="Précision">' + e(t.apres)
      : e(opt);
    return '<label class="mqp-case"><input type="checkbox" data-o="' + i + '"><span>' + texte + '</span></label>';
  }

  function htmlChamps(sec, items, attr) {
    return '<div class="mqp-grille"' + (attr || '') + '>' + items.map(function (it) {
      const c = { k: 'texte', s: sec.titre, l: it.l, t: it.t || 'text' };
      const i = nouvelId(c);
      const numerique = /\(m²\)|Nombre|Année|Étage|\(€|Prix|Superficie|en m²/.test(it.l) && !/Autres charges|à préciser/.test(it.l);
      const type = ['email', 'tel'].indexOf(c.t) !== -1 ? c.t : 'text';
      return '<div class="mqp-champ"><label for="mqp-c' + i + '">' + e(it.l) + '</label>' +
        '<input id="mqp-c' + i + '" data-i="' + i + '" type="' + type + '"' + (numerique ? ' inputmode="decimal"' : '') + ' maxlength="200"></div>';
    }).join('') + '</div>';
  }

  function htmlBloc(sec, b) {
    if (b.k === 'sous') return '<div class="mqp-sous">' + e(b.l) + '</div>';
    if (b.k === 'sous2') return '<div class="mqp-sous2">' + e(b.l) + '</div>';
    if (b.k === 'note') return '<p class="mqp-note">' + e(b.texte) + '</p>';
    if (b.k === 'champs') return htmlChamps(sec, b.items);

    if (b.k === 'loyer') {
      return '<div data-si="loue" hidden><p class="mqp-note">Si le bien est loué :</p>' + htmlChamps(sec, [{ l: 'Loyer mensuel (€)' }]) + '</div>';
    }

    if (b.k === 'mandat') {
      return '<label class="mqp-case mqp-mandat"><input type="checkbox" id="mqp-mandat"><span>Je confirme que mon bien n\'est pas sous mandat exclusif avec une agence ou un mandataire.</span></label>' +
        '<p class="mqp-note">Un bien sous mandat exclusif ne peut pas être présenté ici.</p>';
    }

    if (b.k === 'accords') {
      return '<div class="mqp-bloc"><div class="mqp-cases">' +
        '<label class="mqp-case"><input type="checkbox" id="mqp-recontact"><span>Je souhaite être recontacté(e) par Jocelyne, d\'ALB Sud Immobilier.</span></label>' +
        '<label class="mqp-case"><input type="checkbox" id="mqp-reseaux"><span>J\'autorise ALB Sud Immobilier à présenter mon bien sur ses réseaux sociaux.</span></label>' +
        '</div></div>';
    }

    if (b.k === 'long') {
      const i = nouvelId({ k: 'long', s: sec.titre, l: b.l });
      return '<div class="mqp-champ"><label for="mqp-c' + i + '">' + e(b.l) + '</label><textarea id="mqp-c' + i + '" data-i="' + i + '" rows="' + (b.lignes || 4) + '" maxlength="3000"></textarea></div>';
    }

    if (b.k === 'cases') {
      const i = nouvelId({ k: 'cases', s: sec.titre, l: b.l, opts: b.opts });
      return '<div class="mqp-bloc">' + (b.aff === ' ' ? '' : '<div class="mqp-sous">' + e(b.l) + '</div>') +
        '<div class="mqp-cases" data-i="' + i + '"' + (b.cle ? ' data-cle="' + b.cle + '"' : '') + '>' +
        b.opts.map(function (o, n) { return htmlOption(n, o); }).join('') + '</div></div>';
    }

    if (b.k === 'choix') {
      const i = nouvelId({ k: 'choix', s: sec.titre, l: b.l, opts: b.opts });
      return '<div class="mqp-ligne"><label for="mqp-c' + i + '">' + e(b.l) + (b.aide ? ' <small>' + e(b.aide) + '</small>' : '') + '</label>' +
        '<select id="mqp-c' + i + '" data-i="' + i + '"><option value="">—</option>' +
        b.opts.map(function (o) { return '<option value="' + e(o) + '">' + e(o) + '</option>'; }).join('') + '</select></div>';
    }

    if (b.k === 'dist') {
      const i = nouvelId({ k: 'dist', s: sec.titre, l: b.l });
      return '<div class="mqp-ligne mqp-dist" data-i="' + i + '"><span>' + e(b.l) + '</span>' +
        '<select class="mqp-d-sel" aria-label="Distance : ' + e(b.l) + '"><option value="">—</option>' +
        DISTANCES.map(function (o) { return '<option value="' + e(o) + '">' + e(o) + '</option>'; }).join('') + '</select>' +
        '<input type="text" class="mqp-d-nom" maxlength="80" placeholder="Nom ou distance" aria-label="Nom ou distance : ' + e(b.l) + '"></div>';
    }

    if (b.k === 'pieces') {
      const i = nouvelId({ k: 'pieces', s: sec.titre, l: 'pieces' });
      return '<p class="mqp-note">Ajoutez une pièce à la fois : pour chacune, indiquez le niveau, la surface, le sol et ce qui s’y trouve. Une case vide veut dire « non » ou « je ne sais pas ».</p>' +
        '<div class="mqp-pieces" data-i="' + i + '"></div>' +
        '<p class="mqp-vide mqp-note">Aucune pièce pour l’instant.</p>' +
        '<button type="button" class="mqp-ajouter" data-mqp-act="ouvrir-ajout">+ Ajouter une pièce</button>' +
        '<div class="mqp-ajout-panneau" hidden></div>';
    }
    return '';
  }

  // Une carte de pièce
  function htmlCarte(nom, type, niveau, ouverte) {
    const niveaux = CFG[etat.type].niveaux;
    function groupe(titre, liste) {
      return '<div class="mqp-sous">' + e(titre) + '</div><div class="mqp-cases">' + liste.map(function (v) {
        return '<label class="mqp-case"><input type="checkbox" data-v="' + e(v) + '"><span>' + e(v) + '</span></label>';
      }).join('') + '</div>';
    }
    let extra = '';
    if (type === 'Cuisine') {
      extra = groupe('Type de cuisine', CUISINE_TYPE) + groupe('Équipement de la cuisine', CUISINE_EQ) + groupe("Ce qu'il y a dedans", CUISINE_DEDANS);
    } else if (type === 'Salle de bains' || type === "Salle d'eau") {
      extra = groupe("Ce qu'il y a dedans", SALLES);
    }
    return '<details class="mqp-piece" data-type="' + e(type) + '" data-nom="' + e(nom) + '"' + (ouverte ? ' open' : '') + '>' +
      '<summary><span class="mqp-piece-nom">' + e(nom || 'Nouvelle pièce') + '</span><span class="mqp-resume"></span></summary>' +
      '<div class="mqp-piece-corps">' +
        (type === 'Autre (à préciser)' ? '<div class="mqp-champ"><label>Nom de la pièce</label><input type="text" class="mqp-nom" maxlength="60" value="' + e(nom === 'Autre pièce' ? '' : nom) + '"></div>' : '') +
        '<div class="mqp-grille"><div class="mqp-champ"><label>Niveau</label><select class="mqp-niv"><option value="">—</option>' +
          niveaux.map(function (n) { return '<option value="' + e(n) + '"' + (n === niveau ? ' selected' : '') + '>' + e(n) + '</option>'; }).join('') + '</select></div>' +
        '<div class="mqp-champ"><label>Surface (m²)</label><input type="text" class="mqp-m2" inputmode="decimal" maxlength="8"></div></div>' +
        groupe('Sol', SOL) + groupe('Équipement', EQUIP) + groupe('Fenêtres', FENETRES) + extra +
        '<div class="mqp-champ"><label>Notes</label><input type="text" class="mqp-notes" maxlength="200"></div>' +
        '<button type="button" class="mqp-supprimer" data-mqp-act="retirer-piece">Supprimer cette pièce</button>' +
      '</div></details>';
  }

  function typesDisponibles() {
    return TYPES_PIECES.flatMap(function (t) { return t === 'Garage' && CFG[etat.type].atelier ? [t, 'Atelier'] : [t]; });
  }
  function typeDeNom(nom) {
    const base = String(nom).replace(/\s\(\d+\)$/, '').replace(/\s\d+$/, '');
    return typesDisponibles().indexOf(base) !== -1 ? base : 'Autre (à préciser)';
  }
  function nomSuivant(type) {
    const n = racine.querySelectorAll('.mqp-piece[data-type="' + type.replace(/"/g, '') + '"]').length;
    if (type === 'Autre (à préciser)') return 'Autre pièce';
    if (NUMEROTEES.indexOf(type) !== -1) return type + ' ' + (n + 1);
    return n === 0 ? type : type + ' (' + (n + 1) + ')';
  }
  function majVide() {
    const v = racine.querySelector('.mqp-vide');
    if (v) v.hidden = racine.querySelectorAll('.mqp-piece').length > 0;
  }

  function htmlPanneauAjout() {
    const chip = function (nom, valeur) {
      return '<label class="mqp-chip"><input type="radio" name="' + nom + '" value="' + e(valeur) + '"><span>' + e(valeur) + '</span></label>';
    };
    return '<div class="mqp-panneau"><div class="mqp-panneau-titre">Quelle pièce voulez-vous ajouter ?</div>' +
      '<div class="mqp-sous">Type de pièce</div><div class="mqp-chips">' + typesDisponibles().map(function (t) { return chip('mqp-type', t); }).join('') + '</div>' +
      '<div class="mqp-sous">Niveau</div><div class="mqp-chips">' + CFG[etat.type].niveaux.map(function (t) { return chip('mqp-niveau', t); }).join('') + '</div>' +
      '<p class="mqp-note">Plusieurs chambres ? Ajoutez-les une par une : elles s’appellent « Chambre 1 », « Chambre 2 »… toutes seules.</p>' +
      '<div id="mqp-ajout-msg" class="mqp-msg erreur" aria-live="polite"></div>' +
      '<div class="mqp-boutons-ligne"><button type="button" class="bouton" data-mqp-act="valider-ajout">Ajouter cette pièce</button>' +
      '<button type="button" class="bouton bouton-discret" data-mqp-act="annuler-ajout">Annuler</button></div></div>';
  }

  // ---------- Lecture et remise en place des réponses ----------
  function zone(i) { return racine.querySelector('[data-i="' + i + '"]'); }

  function lireCases(c, el) {
    const sortie = [];
    c.opts.forEach(function (opt, n) {
      const cb = el.querySelector('input[data-o="' + n + '"]');
      if (!cb || !cb.checked) return;
      const t = trou(opt);
      if (!t) { sortie.push(opt); return; }
      const saisi = nettoyer(cb.closest('label').querySelector('.mqp-trou').value);
      sortie.push(t.avant + (saisi || '…') + t.apres);
    });
    return sortie.join(SEP);
  }
  function poserCases(c, el, valeur) {
    const jetons = String(valeur || '').split(SEP);
    c.opts.forEach(function (opt, n) {
      const cb = el.querySelector('input[data-o="' + n + '"]');
      if (!cb) return;
      const t = trou(opt);
      if (!t) { cb.checked = jetons.indexOf(opt) !== -1; return; }
      const re = new RegExp('^' + echapperRe(t.avant) + '(.*)' + echapperRe(t.apres) + '$');
      cb.checked = false;
      for (let k = 0; k < jetons.length; k++) {
        const m = re.exec(jetons[k]);
        if (m) { cb.checked = true; cb.closest('label').querySelector('.mqp-trou').value = m[1] === '…' ? '' : m[1]; break; }
      }
    });
  }

  function lireChamp(c, el) {
    if (c.k === 'texte' || c.k === 'long') return el.value.trim();
    if (c.k === 'choix') return el.value;
    if (c.k === 'cases') return lireCases(c, el);
    if (c.k === 'dist') {
      const t = []; const d = el.querySelector('.mqp-d-sel').value; const n = nettoyer(el.querySelector('.mqp-d-nom').value);
      if (d) t.push(d);
      if (n) t.push('Nom : ' + n);
      return t.join(SEP);
    }
    return '';
  }
  function poserChamp(c, el, valeur) {
    const v = String(valeur == null ? '' : valeur);
    if (c.k === 'texte' || c.k === 'long') { el.value = v; }
    else if (c.k === 'choix') { el.value = c.opts.indexOf(v) !== -1 ? v : ''; }
    else if (c.k === 'cases') { poserCases(c, el, v); }
    else if (c.k === 'dist') {
      v.split(SEP).forEach(function (j) {
        if (j.indexOf('Nom : ') === 0) el.querySelector('.mqp-d-nom').value = j.slice(6);
        else if (DISTANCES.indexOf(j) !== -1) el.querySelector('.mqp-d-sel').value = j;
      });
    }
  }

  function nomDePiece(d) {
    return d.dataset.type === 'Autre (à préciser)' ? nettoyer(d.querySelector('.mqp-nom').value) : d.dataset.nom;
  }
  function lirePiece(d) {
    const t = [];
    const niv = d.querySelector('.mqp-niv').value; if (niv) t.push(niv);
    const m2 = nettoyer(d.querySelector('.mqp-m2').value); if (m2) t.push(m2 + ' m²');
    d.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { if (cb.checked) t.push(cb.dataset.v); });
    const notes = nettoyer(d.querySelector('.mqp-notes').value); if (notes) t.push('Notes : ' + notes);
    return { nom: nomDePiece(d), valeur: t.join(SEP) };
  }
  function poserPiece(d, valeur) {
    const jetons = String(valeur || '').split(SEP);
    d.querySelector('.mqp-niv').value = '';
    d.querySelector('.mqp-m2').value = '';
    d.querySelector('.mqp-notes').value = '';
    d.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = jetons.indexOf(cb.dataset.v) !== -1; });
    jetons.forEach(function (j) {
      if (/^[\d.,]+ m²$/.test(j)) d.querySelector('.mqp-m2').value = j.replace(' m²', '');
      else if (j.indexOf('Notes : ') === 0) d.querySelector('.mqp-notes').value = j.slice(8);
      else if (CFG[etat.type].niveaux.indexOf(j) !== -1) d.querySelector('.mqp-niv').value = j;
    });
    majResume(d);
  }
  function majResume(d) {
    const p = lirePiece(d);
    const m2 = d.querySelector('.mqp-m2').value;
    d.querySelector('.mqp-resume').textContent = p.valeur ? '✔ ' + (m2 ? m2 + ' m²' : 'rempli') : '';
    if (d.dataset.type === 'Autre (à préciser)') d.querySelector('.mqp-piece-nom').textContent = p.nom || 'Nouvelle pièce';
  }

  // Montre le loyer seulement si « Loué » est coché
  function majConditions() {
    const bloc = racine.querySelector('[data-cle="actuel"]');
    const loue = !!(bloc && bloc.querySelector('input[data-o="2"]') && bloc.querySelector('input[data-o="2"]').checked);
    racine.querySelectorAll('[data-si="loue"]').forEach(function (n) { n.hidden = !loue; });
  }
  function majEnvoi() {
    const case_ = racine && racine.querySelector('#mqp-mandat');
    if (!case_) return; // le formulaire n'est plus affiché (écran « envoyé »)
    const coche = case_.checked;
    const bouton = racine.querySelector('[data-mqp-act="envoyer"]');
    const msg = racine.querySelector('#mqp-bloque');
    if (bouton) bouton.disabled = !coche;
    if (msg) msg.hidden = coche;
  }

  function collecter() {
    const rep = {};
    champs.forEach(function (c, i) {
      if (c.k === 'pieces') return;
      const el = zone(i);
      if (!el) return;
      const cache = el.closest('[data-si]');
      if (cache && cache.hidden) return;
      const v = lireChamp(c, el);
      if (!v) return;
      if (!rep[c.s]) rep[c.s] = {};
      rep[c.s][c.l] = v;
    });
    racine.querySelectorAll('.mqp-piece').forEach(function (d) {
      const p = lirePiece(d);
      if (!p.valeur) return;
      let nom = p.nom || 'Autre pièce';
      if (!rep[SEC_PIECES]) rep[SEC_PIECES] = {};
      let n = 2; const base = nom;
      while (rep[SEC_PIECES][nom]) { nom = base + ' (' + n + ')'; n++; }
      rep[SEC_PIECES][nom] = p.valeur;
    });
    const sv = rep['Vous'] || {};
    const adresse = [sv['N° et rue'], [sv['Code postal'], sv['Commune']].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return {
      rep: rep, adresse: adresse, rue: sv['N° et rue'] || '', commune: sv['Commune'] || '',
      mandat: racine.querySelector('#mqp-mandat').checked,
      recontact: racine.querySelector('#mqp-recontact').checked,
      reseaux: racine.querySelector('#mqp-reseaux').checked,
    };
  }

  function remettre(q) {
    const rep = q.reponses || {};
    champs.forEach(function (c, i) {
      if (c.k === 'pieces') return;
      const el = zone(i);
      if (!el) return;
      const v = rep[c.s] && rep[c.s][c.l];
      if (v != null) poserChamp(c, el, v);
    });
    const sp = rep[SEC_PIECES];
    if (sp) {
      const conteneur = racine.querySelector('.mqp-pieces');
      Object.keys(sp).forEach(function (nom) {
        conteneur.insertAdjacentHTML('beforeend', htmlCarte(nom, typeDeNom(nom), '', false));
        poserPiece(conteneur.lastElementChild, sp[nom]);
      });
    }
    racine.querySelector('#mqp-mandat').checked = !!q.sans_mandat_exclusif;
    racine.querySelector('#mqp-recontact').checked = !!q.recontact_ok;
    racine.querySelector('#mqp-reseaux').checked = !!q.reseaux_ok;
  }

  // Valeurs proposées d'après l'annonce et le compte (seulement si le champ est vide)
  function preremplir(defauts) {
    champs.forEach(function (c, i) {
      const v = defauts[c.s + '|' + c.l];
      if (v == null || v === '' || c.k === 'pieces') return;
      const el = zone(i);
      if (!el) return;
      if (c.k === 'texte' && !el.value) el.value = String(v);
      else if (c.k === 'choix' && !el.value && c.opts.indexOf(String(v)) !== -1) el.value = String(v);
    });
  }

  // ---------- Enregistrement ----------
  let minuteur = null;
  let file = Promise.resolve();

  function afficherMessage(type, texte) {
    const m = racine && racine.querySelector('#mqp-msg');
    if (!m) return;
    m.className = 'mqp-msg ' + (texte ? 'visible ' + type : '');
    m.textContent = texte || '';
  }

  function planifier() {
    etat.modifie = true;
    clearTimeout(minuteur);
    minuteur = setTimeout(function () { sauvegarder(false, true); }, 2500);
  }

  function sauvegarder(envoyer, silencieux) {
    file = file.then(async function () {
      if (!etat || !racine || !racine.querySelector('.mqp-formulaire')) return false;
      clearTimeout(minuteur);
      const d = collecter();
      if (envoyer) {
        if (!d.mandat) { afficherMessage('erreur', MSG_MANDAT); return false; }
        if (!d.rue || !d.commune) { afficherMessage('erreur', ERREURS.ADRESSE_OBLIGATOIRE); return false; }
      }
      try {
        const { data, error } = await albSupabase.rpc('alb_part_questionnaire_enregistrer', {
          p_id: etat.qid || null,
          p_annonce_id: etat.annonce.id,
          p_type: etat.type,
          p_adresse: d.adresse,
          p_reponses: d.rep,
          p_sans_mandat_exclusif: d.mandat,
          p_recontact_ok: d.recontact,
          p_reseaux_ok: d.reseaux,
          p_envoyer: !!envoyer,
        });
        if (error) throw error;
        etat.qid = data;
        etat.modifie = false;
        if (!envoyer) afficherMessage('info', silencieux ? 'Brouillon enregistré automatiquement.' : 'Brouillon enregistré. Vous pourrez le terminer plus tard.');
        return true;
      } catch (ex) {
        console.error('[ALB DEBUG] questionnaire particulier :', ex);
        afficherMessage('erreur', messageErreur(ex));
        return false;
      }
    });
    return file;
  }

  const TEXTE_ENVOYE = '<div class="mqp-fin"><h3>Votre questionnaire est bien envoyé.</h3><p>Votre projet est entre de bonnes mains. Merci de nous avoir accordé votre confiance.</p><p class="mqp-signature">À la bien, toujours ✨</p></div>';

  async function envoyer() {
    const ok = await sauvegarder(true, false);
    if (!ok) return;
    racine.querySelector('.mqp-corps').innerHTML = TEXTE_ENVOYE;
    racine.querySelector('.mqp-pied').innerHTML = '<button type="button" class="bouton" data-mqp-act="fermer">Fermer</button>';
    racine.querySelector('.mqp-corps').scrollTop = 0;
    etat.modifie = false;
    await rafraichir();
  }

  // ---------- Fenêtre ----------
  function creerFenetre(titre, corps, pied) {
    fermerFenetre();
    const f = document.createElement('div');
    f.className = 'mqp-fond';
    f.setAttribute('role', 'dialog');
    f.setAttribute('aria-modal', 'true');
    f.setAttribute('aria-label', titre);
    f.innerHTML = '<div class="mqp-boite">' +
      '<div class="mqp-tete"><strong>' + e(titre) + '</strong><button type="button" class="mqp-x" data-mqp-act="fermer" aria-label="Fermer">✕</button></div>' +
      '<div class="mqp-corps">' + corps + '</div>' +
      '<div class="mqp-pied">' + pied + '</div></div>';
    document.body.appendChild(f);
    document.body.style.overflow = 'hidden';
    racine = f;
    f.addEventListener('click', clicFenetre);
    f.addEventListener('input', surSaisie);
    f.addEventListener('change', surSaisie);
    return f;
  }
  function fermerFenetre() {
    if (racine && racine.parentNode) racine.parentNode.removeChild(racine);
    racine = null;
    document.body.style.overflow = '';
  }
  async function fermer() {
    if (etat && etat.modifie && racine && racine.querySelector('.mqp-formulaire')) await sauvegarder(false, true);
    clearTimeout(minuteur);
    fermerFenetre();
    etat = null;
    champs = [];
    await rafraichir();
  }

  function surSaisie(ev) {
    if (!etat || !racine || !racine.querySelector('.mqp-formulaire')) return;
    if (ev.target.closest && ev.target.closest('.mqp-ajout-panneau')) return; // le choix d'une pièce n'est pas une réponse
    const d = ev.target.closest && ev.target.closest('.mqp-piece');
    if (d) majResume(d);
    majConditions();
    majEnvoi();
    planifier();
  }

  function ajouterPiece() {
    const type = (racine.querySelector('input[name="mqp-type"]:checked') || {}).value;
    const niveau = (racine.querySelector('input[name="mqp-niveau"]:checked') || {}).value || '';
    const msg = racine.querySelector('#mqp-ajout-msg');
    if (!type) { msg.textContent = 'Choisissez d’abord le type de pièce.'; msg.classList.add('visible'); return; }
    const conteneur = racine.querySelector('.mqp-pieces');
    conteneur.insertAdjacentHTML('beforeend', htmlCarte(nomSuivant(type), type, niveau, true));
    const carte = conteneur.lastElementChild;
    racine.querySelector('.mqp-ajout-panneau').hidden = true;
    racine.querySelector('.mqp-ajout-panneau').innerHTML = '';
    majVide();
    carte.scrollIntoView({ block: 'center', behavior: 'smooth' });
    planifier();
  }

  function clicFenetre(ev) {
    const b = ev.target.closest('[data-mqp-act]');
    if (!b) return;
    const act = b.dataset.mqpAct;
    if (act === 'fermer' || act === 'plus-tard') fermer();
    else if (act === 'enregistrer-fermer') sauvegarder(false, false).then(function (ok) { if (ok) fermer(); });
    else if (act === 'envoyer') { b.disabled = true; envoyer().finally(function () { if (racine) majEnvoi(); }); }
    else if (act === 'commencer') {
      const t = racine.querySelector('input[name="mqp-bien"]:checked');
      if (!t) { const m = racine.querySelector('#mqp-choix-msg'); m.textContent = 'Choisissez d’abord le type de votre bien.'; m.classList.add('visible'); return; }
      afficherFormulaire(t.value);
    }
    else if (act === 'ouvrir-ajout') {
      const p = racine.querySelector('.mqp-ajout-panneau');
      p.innerHTML = htmlPanneauAjout();
      p.hidden = false;
      p.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    else if (act === 'annuler-ajout') {
      const p = racine.querySelector('.mqp-ajout-panneau');
      p.hidden = true; p.innerHTML = '';
    }
    else if (act === 'valider-ajout') ajouterPiece();
    else if (act === 'retirer-piece') {
      const d = b.closest('.mqp-piece');
      if (d && window.confirm('Supprimer cette pièce du questionnaire ?')) { d.parentNode.removeChild(d); majVide(); planifier(); }
    }
  }

  // ---------- Écrans ----------
  function afficherChoixType(preselection) {
    const radio = function (v, t) {
      return '<label class="mqp-grand"><input type="radio" name="mqp-bien" value="' + v + '"' + (v === preselection ? ' checked' : '') + '><span>' + e(t) + '</span></label>';
    };
    creerFenetre('Questionnaire de votre bien',
      '<h3>Questionnaire de votre bien</h3><p>Quelques minutes pour nous parler de votre projet. Vos réponses s’enregistrent toutes seules.</p>' +
      '<div class="mqp-sous">Votre bien est</div>' +
      '<div class="mqp-choix">' + radio('maison', 'Une maison') + radio('village', 'Une maison de village') + radio('appartement', 'Un appartement') + '</div>' +
      '<div id="mqp-choix-msg" class="mqp-msg erreur" aria-live="polite"></div>',
      '<div class="mqp-boutons"><button type="button" class="bouton bouton-discret" data-mqp-act="plus-tard">Plus tard</button>' +
      '<button type="button" class="bouton" data-mqp-act="commencer">Commencer</button></div>');
  }

  function afficherEnvoye() {
    creerFenetre('Questionnaire envoyé', TEXTE_ENVOYE,
      '<button type="button" class="bouton" data-mqp-act="fermer">Fermer</button>');
  }

  async function afficherFormulaire(type, brouillon) {
    etat.type = type;
    champs = [];
    const sections = construireSections(type);
    const html = '<div class="mqp-formulaire">' +
      '<p class="mqp-intro">Il n’y a ni bonne ni mauvaise réponse. Prenez quelques minutes pour nous parler de votre projet : plus nous le comprendrons, mieux nous pourrons vous accompagner. Vous ne savez pas ? Laissez vide, on verra ensemble.</p>' +
      '<p class="mqp-confid">Vos réponses sont lues uniquement par l’équipe ALB Sud Immobilier. Elles ne sont transmises à personne sans votre accord.</p>' +
      sections.map(function (s, n) {
        return '<section class="mqp-section"><h3>' + (n + 1) + '. ' + e(s.titre) + '</h3>' +
          s.blocs.map(function (b) { return htmlBloc(s, b); }).join('') + '</section>';
      }).join('') + '</div>';
    creerFenetre('Questionnaire de votre bien — ' + CFG[type].libelle, html,
      '<div id="mqp-bloque" class="mqp-msg visible erreur">' + e(MSG_MANDAT) + '</div>' +
      '<div id="mqp-msg" class="mqp-msg" aria-live="polite"></div>' +
      '<div class="mqp-boutons"><button type="button" class="bouton bouton-discret" data-mqp-act="enregistrer-fermer">Enregistrer et fermer</button>' +
      '<button type="button" class="bouton" data-mqp-act="envoyer" disabled>Envoyer le questionnaire</button></div>');

    if (brouillon) remettre(brouillon);
    preremplir(etat.defauts);
    racine.querySelectorAll('.mqp-piece').forEach(majResume);
    majVide();
    majConditions();
    majEnvoi();
    etat.modifie = false;
  }

  // ---------- Ouverture depuis une annonce ----------
  async function ouvrir(annonceId) {
    const a = annonces.find(function (x) { return x.id === annonceId; });
    if (!a) return;
    etat = { annonce: a, qid: null, type: null, modifie: false, defauts: {} };
    const existant = questionnaires.find(function (q) { return q.annonce_id === annonceId; });
    if (existant && existant.statut === 'envoye') { afficherEnvoye(); return; }

    // Les informations de l'annonce et du compte, pour éviter de tout retaper
    const [rAnn, rPrive, rProfil] = await Promise.all([
      albSupabase.from('annonces').select('id, prix, ville, code_postal, type_bien, surface_m2, nb_pieces, surface_terrain_m2, dpe, ges').eq('id', annonceId).maybeSingle(),
      albSupabase.from('annonces_prive').select('adresse, telephone').eq('annonce_id', annonceId).maybeSingle(),
      albSupabase.from('profiles').select('prenom, nom, email, telephone').eq('id', monId).maybeSingle(),
    ]);
    const an = rAnn.data || {}, pr = rPrive.data || {}, pf = rProfil.data || {};
    const D = etat.defauts;
    D['Vous|Nom et prénom'] = [pf.prenom, pf.nom].filter(Boolean).join(' ');
    D['Vous|Téléphone'] = pr.telephone || pf.telephone || '';
    D['Vous|E-mail'] = pf.email || '';
    D['Vous|N° et rue'] = pr.adresse || '';
    D['Vous|Code postal'] = an.code_postal || '';
    D['Vous|Commune'] = an.ville || '';
    D['La vente|Prix demandé (€)'] = an.prix != null ? String(an.prix) : '';
    D['Le bien en chiffres|Surface habitable (m²)'] = an.surface_m2 != null ? String(an.surface_m2) : '';
    D['Le bien en chiffres|Nombre de pièces'] = an.nb_pieces != null ? String(an.nb_pieces) : '';
    D['Votre maison|Superficie du terrain (m²)'] = an.surface_terrain_m2 != null ? String(an.surface_terrain_m2) : '';
    D['Chauffage, eau et diagnostics|Diagnostic énergie (DPE) — classe'] = an.dpe || '';
    D['Chauffage, eau et diagnostics|Gaz à effet de serre (GES) — classe'] = an.ges || '';

    if (existant) {
      // Brouillon déjà commencé : on le rouvre
      const { data, error } = await albSupabase.rpc('alb_part_questionnaire_lire', { p_annonce_id: annonceId });
      if (!error && data && CFG[data.type_bien]) {
        etat.qid = data.id;
        await afficherFormulaire(data.type_bien, data);
        return;
      }
    }
    afficherChoixType(an.type_bien === 'appartement' || an.type_bien === 'maison' ? an.type_bien : '');
  }

  // ---------- Dans « Mes annonces » ----------
  async function charger() {
    const r1 = await albSupabase.from('annonces').select('id, titre, type_vente, statut, type_bien').eq('vendeur_id', monId);
    const r2 = await albSupabase.rpc('alb_part_mes_questionnaires');
    if (r2.error) throw r2.error;
    annonces = r1.data || [];
    questionnaires = r2.data || [];
  }

  async function rafraichir() {
    try { await charger(); } catch (ex) { /* on garde l'affichage précédent */ }
    document.querySelectorAll('.mqp-ajout').forEach(function (n) { n.parentNode.removeChild(n); });
    injecter();
  }

  function injecter() {
    const zoneAnnonces = document.getElementById('mes-annonces');
    if (!estPart || !zoneAnnonces) return;
    zoneAnnonces.querySelectorAll('.ma-annonce').forEach(function (carte) {
      if (carte.querySelector('.mqp-ajout')) return;
      const id = String(carte.id || '').replace(/^ma-/, '');
      const a = annonces.find(function (x) { return x.id === id; });
      if (!a || a.type_vente !== 'particulier' || a.statut === 'vendu' || a.statut === 'refusee') return;
      const q = questionnaires.find(function (x) { return x.annonce_id === id; });
      const ferme = memoire('alb-mqp-ferme-' + id) === '1';
      let html = '';
      if (!q && !ferme) {
        html = '<div class="mqp-offre"><div class="mqp-offre-titre">Un coup de main pour présenter votre bien ?</div>' +
          '<p>Racontez-nous votre bien en quelques minutes, nous vous aiderons à rédiger une annonce qui lui ressemble. C’est facultatif : vous pouvez vous arrêter et reprendre quand vous voulez.</p>' +
          '<div class="mqp-offre-boutons"><button type="button" class="ma-btn ma-btn-oui" data-mqp-ouvrir="' + e(id) + '">Remplir le questionnaire</button>' +
          '<button type="button" class="ma-btn" data-mqp-complete="' + e(id) + '">Mon annonce est complète</button></div></div>';
      } else {
        const libelle = q && q.statut === 'envoye' ? '✅ Questionnaire envoyé' : q ? '📝 Continuer le questionnaire' : '📝 Questionnaire du bien';
        html = '<div class="mqp-offre-boutons"><button type="button" class="ma-btn" data-mqp-ouvrir="' + e(id) + '">' + libelle + '</button></div>';
      }
      const w = document.createElement('div');
      w.className = 'mqp-ajout';
      w.innerHTML = html;
      const ref = carte.querySelector('.ma-boutons');
      if (ref) carte.insertBefore(w, ref); else carte.appendChild(w);
    });
  }

  document.addEventListener('click', function (ev) {
    const o = ev.target.closest && ev.target.closest('[data-mqp-ouvrir]');
    if (o) { ouvrir(o.dataset.mqpOuvrir); return; }
    const c = ev.target.closest && ev.target.closest('[data-mqp-complete]');
    if (c) {
      memoire('alb-mqp-ferme-' + c.dataset.mqpComplete, '1');
      const w = c.closest('.mqp-ajout');
      if (w && w.parentNode) w.parentNode.removeChild(w);
      injecter();
    }
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && racine) fermer(); });

  // ---------- Styles (charte ALB : aubergine, or, crème) ----------
  function styles() {
    if (document.getElementById('mqp-styles')) return;
    const s = document.createElement('style');
    s.id = 'mqp-styles';
    s.textContent = [
      '.mqp-offre{background:#F7F3EA;border:1px solid #E3D6B8;border-radius:8px;padding:12px;margin-top:12px;}',
      '.mqp-offre-titre{font-weight:700;color:#4B1A3E;}',
      '.mqp-offre p{font-size:.9rem;margin:4px 0 10px;}',
      '.mqp-offre-boutons{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}',
      '.mqp-offre .mqp-offre-boutons{margin-top:0;}',
      '.mqp-fond{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;justify-content:center;}',
      '.mqp-boite{background:#FFFFFF;width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;}',
      '.mqp-tete{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:2px solid #B28E3D;color:#4B1A3E;}',
      '.mqp-x{border:none;background:none;font-size:1.3rem;cursor:pointer;padding:4px 10px;color:#4A4A47;}',
      '.mqp-corps{flex:1;overflow-y:auto;padding:16px;}',
      '.mqp-pied{border-top:1px solid #E8E6E1;padding:10px 16px;background:#F7F3EA;}',
      '.mqp-boutons{display:flex;flex-direction:column;gap:8px;}',
      '.mqp-boutons-ligne{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;}',
      '.mqp-intro{font-size:.92rem;color:#6a6a65;margin-bottom:6px;}',
      '.mqp-confid{font-weight:700;color:#4B1A3E;border-bottom:2px solid #B28E3D;padding-bottom:8px;margin-bottom:14px;font-size:.92rem;}',
      '.mqp-section{margin-bottom:22px;}',
      '.mqp-section h3{background:#4B1A3E;color:#FFFFFF;padding:8px 12px;border-radius:6px;font-size:1rem;margin-bottom:10px;}',
      '.mqp-sous{font-weight:700;color:#4B1A3E;font-size:.9rem;margin:14px 0 6px;}',
      '.mqp-sous2{font-weight:700;background:#F7F3EA;border-radius:4px;padding:4px 8px;font-size:.85rem;margin:10px 0 4px;}',
      '.mqp-note{font-size:.85rem;color:#6a6a65;margin:6px 0 10px;}',
      '.mqp-grille{display:grid;grid-template-columns:1fr;gap:0 12px;}',
      '.mqp-champ{margin-bottom:10px;}',
      '.mqp-champ label,.mqp-ligne label{display:block;font-size:.85rem;font-weight:600;color:#4A4A47;margin-bottom:3px;}',
      '.mqp-champ input,.mqp-champ select,.mqp-champ textarea,.mqp-ligne select,.mqp-ligne input{width:100%;box-sizing:border-box;font:inherit;padding:8px;border:1px solid #D8D5CE;border-radius:6px;background:#FFFFFF;}',
      '.mqp-cases{display:grid;grid-template-columns:1fr;gap:4px 12px;}',
      '.mqp-case{display:flex;align-items:flex-start;gap:8px;font-size:.9rem;padding:4px 0;cursor:pointer;}',
      '.mqp-case input[type="checkbox"]{margin-top:3px;flex-shrink:0;}',
      '.mqp-mandat{font-weight:600;}',
      '.mqp-trou{width:7em;max-width:100%;margin:0 4px;padding:2px 6px;font:inherit;border:1px solid #D8D5CE;border-radius:4px;}',
      '.mqp-ligne{display:grid;grid-template-columns:1fr;gap:4px;padding:6px 0;border-bottom:1px solid #F0EFEC;font-size:.9rem;}',
      '.mqp-ligne small{font-weight:400;color:#6a6a65;}',
      '.mqp-piece{border:1px solid #E8E6E1;border-radius:8px;margin-bottom:8px;background:#FFFFFF;}',
      '.mqp-piece summary{cursor:pointer;padding:9px 12px;display:flex;justify-content:space-between;gap:10px;font-size:.92rem;font-weight:600;color:#4B1A3E;}',
      '.mqp-resume{color:#2E6B34;font-size:.82rem;font-weight:400;}',
      '.mqp-piece-corps{padding:4px 12px 12px;}',
      '.mqp-ajouter{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border:1.5px dashed #4B1A3E;border-radius:6px;background:#FFFFFF;color:#4B1A3E;font:inherit;font-weight:600;cursor:pointer;margin:4px 0 10px;}',
      '.mqp-supprimer{margin-top:6px;min-height:36px;padding:0 12px;border:1px solid #D8B4B4;border-radius:6px;background:#FFFFFF;color:#8A2D2D;font:inherit;font-size:.85rem;font-weight:600;cursor:pointer;}',
      '.mqp-panneau{border:2px solid #4B1A3E;border-radius:10px;background:#FFFFFF;padding:16px;margin-bottom:10px;}',
      '.mqp-panneau-titre{font-size:1.05rem;font-weight:700;color:#4B1A3E;margin-bottom:4px;}',
      '.mqp-chips{display:flex;flex-wrap:wrap;gap:8px;}',
      '.mqp-chip{cursor:pointer;}',
      '.mqp-chip input{position:absolute;opacity:0;pointer-events:none;}',
      '.mqp-chip span{display:inline-block;padding:7px 12px;border:1px solid #D8D5CE;border-radius:999px;font-size:.88rem;background:#FFFFFF;}',
      '.mqp-chip input:checked+span{background:#4B1A3E;border-color:#4B1A3E;color:#FFFFFF;}',
      '.mqp-chip input:focus-visible+span{outline:2px solid #B28E3D;outline-offset:2px;}',
      '.mqp-msg{font-size:.88rem;margin-bottom:8px;display:none;}',
      '.mqp-msg.visible{display:block;}',
      '.mqp-msg.erreur{color:#8A2D2D;}',
      '.mqp-msg.info{color:#2E6B34;}',
      '#mqp-bloque[hidden]{display:none;}',
      '.mqp-choix{display:grid;grid-template-columns:1fr;gap:10px;margin-top:6px;}',
      '.mqp-grand{display:flex;align-items:center;gap:10px;border:1px solid #D8D5CE;background:#F7F3EA;border-radius:10px;padding:16px;font-weight:600;cursor:pointer;}',
      '.mqp-grand:has(input:checked){border-color:#4B1A3E;background:#FFFFFF;box-shadow:0 0 0 2px #B28E3D;}',
      '.mqp-fin{text-align:center;padding:30px 10px;}',
      '.mqp-fin h3{color:#4B1A3E;margin-bottom:8px;}',
      '.mqp-signature{color:#B28E3D;font-weight:700;margin-top:14px;}',
      '@media (min-width:700px){',
      '.mqp-boite{max-width:860px;height:auto;max-height:92vh;margin:4vh 16px;border-radius:12px;}',
      '.mqp-grille{grid-template-columns:1fr 1fr;}',
      '.mqp-cases{grid-template-columns:1fr 1fr;}',
      '.mqp-ligne{grid-template-columns:1.3fr 1fr;align-items:center;}',
      '.mqp-dist{grid-template-columns:1.2fr 1.2fr 1fr;}',
      '.mqp-boutons{flex-direction:row;justify-content:flex-end;}',
      '.mqp-choix{grid-template-columns:1fr 1fr 1fr;}',
      '}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------- Démarrage : attend la connexion, repère les particuliers, surveille « Mes annonces » ----------
  let observateur = null;
  let observee = null;
  function surveiller() {
    const z = document.getElementById('mes-annonces');
    if (z && z !== observee) {
      if (observateur) observateur.disconnect();
      observee = z;
      observateur = new MutationObserver(function () { injecter(); });
      observateur.observe(z, { childList: true, subtree: true });
    }
    injecter();
  }

  async function demarrer() {
    let essais = 0;
    const tour = async function () {
      essais++;
      try {
        if (typeof albSupabase === 'undefined') throw new Error('PAS_PRET');
        const s = await albSupabase.auth.getSession();
        monId = s && s.data && s.data.session && s.data.session.user ? s.data.session.user.id : null;
        if (!monId) throw new Error('PAS_CONNECTE');
        await charger();
        estPart = true;
        styles();
        surveiller();
        setInterval(surveiller, 3000);
        return;
      } catch (ex) {
        if (String((ex && ex.message) || ex).indexOf('PAS_PARTICULIER') !== -1) return; // un pro : rien à faire ici
      }
      if (essais < 40) setTimeout(tour, 3000);
    };
    tour();
  }

  window.albQuestionnaireParticulier = { ouvrir: ouvrir };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();

// ============================================================
// mes-questionnaires-biens.js — « Questionnaire du bien » pour les agents et mandataires
// Dans Mon espace ALB > Mes annonces : une proposition facultative sous chaque annonce
// de vente accompagnée. Le pro remplit un questionnaire (appartement, maison ou maison
// de village), enregistré en brouillon automatiquement, puis l'envoie à Jocelyne.
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
  const ETATS_TRAVAUX = ['Déjà refait', 'Rien à prévoir', 'À rafraîchir', 'À refaire'];
  const TROIS = ['Fait', 'À faire', 'Ne sait pas'];
  const NIV_MAISON = ['Sous-sol', 'RDC', '1er étage', '2e étage', '3e étage', 'Mezzanine', 'Duplex'];
  const TYPES_LIBELLE = { appartement: 'appartement', maison: 'maison', village: 'maison de village' };
  const NIV_APPART = ['RDC', 'Niveau 1', 'Niveau 2', 'Mezzanine', 'Duplex'];
  const NIV4 = NIV_MAISON;
  const CUISINE_TYPE = ['Ouverte sur le séjour', 'Fermée', 'Américaine (avec bar)', 'Îlot central'];
  const CUISINE_EQ = ['Entièrement équipée', 'Aménagée (meubles, sans électroménager)', 'Non équipée'];
  const CUISINE_DEDANS = ['Plaque gaz', 'Plaque induction', 'Plaque électrique, vitrocéramique', 'Four', 'Four micro-ondes', 'Hotte', 'Réfrigérateur', 'Congélateur', 'Lave-vaisselle', 'Lave-linge', 'Meubles hauts et bas', 'Plan de travail', 'Évier', 'Cellier, arrière-cuisine'];
  const TYPES_PIECES = ['Entrée', 'Séjour, salon', 'Cuisine', 'Chambre', 'Bureau', 'Salle de bains', "Salle d'eau", 'WC', 'Dressing', 'Buanderie, cellier', 'Couloir, palier', 'Balcon, terrasse', 'Cave', 'Garage', 'Véranda', 'Mezzanine', 'Combles, grenier', 'Toit-terrasse', 'Autre (à préciser)'];
  const NUMEROTEES = ['Chambre', 'Salle de bains', "Salle d'eau", 'WC'];
  const SEC_PIECES = 'Pièce par pièce';
  const MSG_RECONTACT = 'Pour vous accompagner, nous devons pouvoir vous recontacter : merci de cocher la case prévue.';
  const TEXTE_RECONTACT = "Je souhaite être recontacté(e) par Jocelyne, d'ALB Sud Immobilier.";
  const SALLES = ['Baignoire', 'Douche', "Douche à l'italienne", 'Lavabo', 'Double vasque', 'Meuble vasque', 'WC', 'Bidet', 'Sèche-serviettes'];

  const ERREURS = {
    PAS_PRO: 'Ce questionnaire est réservé aux professionnels.',
    RECONTACT_NON_ACCEPTE: MSG_RECONTACT,
    TROP_LONG: 'Le questionnaire est trop long : raccourcissez les textes libres.',
    ADRESSE_OBLIGATOIRE: "Indiquez l'adresse du bien pour envoyer le questionnaire.",
    INTROUVABLE_OU_DEJA_ENVOYE: 'Ce questionnaire a déjà été envoyé : il ne se modifie plus.',
    ANNONCE_INTROUVABLE: 'Cette annonce ne vous appartient pas.',
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
      libelle: 'Appartement', copro: true, assainissement: false,
      diags: DIAGS_COMMUNS.concat([['Mesurage loi Carrez', 'Appartement en copropriété']]),
      chiffres: ['Surface habitable (m²)', 'Surface Carrez (m²)', 'Nombre de pièces', 'Chambres', 'Autre (à préciser)', 'Année de construction', "Étages de l'immeuble", "Appartements dans l'immeuble", 'Extérieur : balcon, terrasse (m²)', 'Extérieur : jardin privatif (m²)'],
      niveaux: NIV_APPART, atelier: false,
      pieces: ['Entrée', 'Séjour, salle à manger', 'Cuisine', 'Chambre 1', 'Chambre 2', 'Chambre 3', 'Bureau', 'Salle de bains 1', 'Salle de bains 2', "Salle d'eau 1", "Salle d'eau 2", 'WC 1', 'WC 2', 'Dressing', 'Buanderie, cellier', 'Couloir', 'Balcon, terrasse'],
      acces: [
        ["Entrée de l'immeuble", ['Interphone', 'Digicode', 'Visiophone', 'Gardien', 'Local vélos, poussettes', 'Porte blindée']],
        ['Étage et accès', ['Ascenseur', "Pas d'ascenseur (marches : ____)", 'Rez-de-chaussée', 'Dernier étage', 'Traversant', 'Sur deux niveaux']],
        ['Annexes', ['Loggia', 'Cave', 'Grenier, chambre de service', "Piscine de la résidence", 'Espaces verts', 'Autre (à préciser) : ______']],
        ['Où se garer ?', ['Garage, box fermé', 'Place de parking privée', 'Parking collectif', 'Dans la rue', 'Pas de stationnement']],
      ],
      postes: ['Fenêtres, volets', 'Chauffage, eau chaude', 'Électricité', 'Plomberie', 'Cuisine', 'Salle de bains', 'Sols', 'Peintures', 'Humidité, fissures', 'Autre poste (à préciser dans les remarques)'],
      plus: ['Très lumineux', 'Vue dégagée', 'Calme', 'Dernier étage', 'Traversant', 'Ascenseur', 'Balcon, terrasse', 'Parking, box', 'Cave', 'Rénové récemment', 'Charges faibles', 'Proche transports', 'Commerces à pied', 'Résidence sécurisée', 'Piscine, espaces verts'],
      moins: ["Pas d'ascenseur", 'Rez-de-chaussée', 'Vis-à-vis', 'Bruit (route, voisins)', 'Pas de stationnement', 'Charges élevées', 'Travaux de copropriété prévus', 'Procès en copropriété', 'Peu lumineux', 'Humidité', "Pas d'extérieur", 'DPE E, F ou G', 'Chauffage ancien', 'Cuisine ou salle de bains à refaire'],
      envExtra: [],
    },
    maison: {
      libelle: 'Maison', copro: false, assainissement: true,
      diags: DIAGS_MAISON,
      chiffres: ['Surface habitable (m²)', 'Nombre de pièces', 'Chambres', 'Autre (à préciser)', 'Année de construction', 'Nombre de niveaux', 'Terrain (m²)', 'Extérieur : terrasse (m²)'],
      niveaux: NIV4, atelier: true,
      pieces: ['Entrée', 'Séjour, salle à manger', 'Cuisine', 'Chambre 1', 'Chambre 2', 'Chambre 3', 'Bureau', 'Salle de bains 1', 'Salle de bains 2', "Salle d'eau 1", "Salle d'eau 2", 'WC 1', 'WC 2', 'Dressing', 'Buanderie', 'Cellier', 'Palier, couloir', 'Véranda', 'Mezzanine', 'Combles, grenier', 'Garage', 'Cave'],
      acces: [
        ['Portail et entrée', ['Portail électrique', 'Portail manuel', 'Pas de portail', 'Interphone, visiophone', 'Clos entièrement', 'Non clos']],
        ['Niveaux', ['De plain-pied', 'Un étage', 'Deux étages ou plus', 'Combles aménagés', 'Sous-sol, cave']],
        ['Terrain', ['Plat', 'En pente', 'Arboré', 'Arrosage automatique', 'Puits, forage', "Récupérateur d'eau de pluie"]],
        ['Piscine', ['Pas de piscine', 'Piscine existante', 'Piscine chauffée', 'Terrain piscinable', 'Pas piscinable', 'Je ne sais pas']],
        ['Où se garer ?', ['Garage fermé (voitures : ___)', 'Carport', 'Dans la cour, sur le terrain', 'Dans la rue', 'Pas de stationnement']],
        ['Dépendances', ['Abri de jardin', 'Dépendance (atelier, gîte…)', "Cuisine d'été, barbecue", 'Pool house', 'Terrasse couverte', 'Terrain de pétanque', 'Autre (à préciser) : ______']],
        ['Voisinage', ['Maison isolée', "Mitoyenne d'un côté", 'Mitoyenne des deux côtés', 'Vis-à-vis']],
      ],
      postes: ['Toiture', 'Façade', 'Isolation', 'Fenêtres, volets', 'Chauffage, eau chaude', 'Électricité', 'Plomberie', 'Assainissement', 'Cuisine', 'Salle(s) de bains', 'Sols', 'Peintures', 'Humidité, fissures', 'Autre poste (à préciser dans les remarques)'],
      plus: ['Très lumineuse', 'Vue dégagée', 'Calme', 'Grand terrain', 'Piscine ou piscinable', 'Plain-pied', 'Rénovée récemment', 'Garage', 'Pas de vis-à-vis', 'Dépendance, gîte possible', 'Extension possible', 'Proche écoles', 'Proche axes routiers', 'Bon DPE (A à C)', 'Terrasse agréable'],
      moins: ['Bruit (route, voisins)', 'Vis-à-vis', 'Terrain en pente', 'Non clos', 'Isolée, éloignée', 'Toiture à refaire', 'Assainissement à refaire', 'DPE E, F ou G', 'Humidité', 'Peu de stationnement', "Beaucoup d'entretien", 'Chauffage ancien', 'Cuisine ou salle de bains à refaire'],
      envExtra: [],
    },
    village: {
      libelle: 'Maison de village', copro: false, assainissement: true,
      diags: DIAGS_MAISON,
      chiffres: ['Surface habitable (m²)', 'Nombre de pièces', 'Chambres', 'Autre (à préciser)', 'Année de construction', 'Étages (rez-de-chaussée compris)', 'Extérieur : cour (m²)', 'Extérieur : terrasse (m²)', 'Extérieur : jardin (m²)'],
      niveaux: NIV4, atelier: true,
      pieces: ['Entrée', 'Séjour, salle à manger', 'Cuisine', 'Chambre 1', 'Chambre 2', 'Chambre 3', 'Bureau', 'Salle de bains 1', 'Salle de bains 2', "Salle d'eau 1", "Salle d'eau 2", 'WC 1', 'WC 2', 'Dressing', 'Buanderie', 'Cellier', 'Palier, couloir', 'Mezzanine', 'Combles, grenier', 'Toit-terrasse', 'Garage', 'Cave'],
      acces: [
        ['Accès à la maison', ['Rue étroite ou piétonne', "Voiture jusqu'à la porte", 'Rue calme', 'Rue animée', 'Interphone', 'Portail, porte de garage électrique']],
        ['Où se garer ?', ['Garage', 'Place privée', 'Dans la rue devant la maison', 'Parking public proche (distance : ____ m)', 'Pas de stationnement facile']],
        ['Dans la maison', ['Escalier étroit ou raide', 'Cave (voûtée ?)', 'Grenier, combles', 'Toit-terrasse', 'Cheminée ou poêle', 'Poutres, pierres apparentes', 'Vue dégagée', 'Plafonds hauts']],
        ['Voisinage', ["Mitoyenne d'un côté", 'Mitoyenne des deux côtés', 'Vis-à-vis']],
      ],
      postes: ['Toiture', 'Façade', 'Isolation', 'Fenêtres, volets', 'Chauffage, eau chaude', 'Électricité', 'Plomberie', 'Assainissement', 'Cuisine', 'Salle(s) de bains', 'Sols', 'Peintures', 'Humidité, fissures', 'Autre poste (à préciser dans les remarques)'],
      plus: ["Charme de l'ancien", 'Pierres, poutres apparentes', 'Vue dégagée', 'Toit-terrasse', 'Calme', 'Au cœur du village', 'Commerces à pied', 'Rénovée récemment', 'Cave', 'Cheminée', 'Extérieur (cour, terrasse)', 'Combles à aménager', 'Très lumineuse', 'Pas de gros travaux', 'Garage, stationnement'],
      moins: ['Escalier raide', 'Rue étroite', 'Stationnement difficile', "Pas d'extérieur", 'Peu de lumière', 'Humidité', 'Bruit (rue, place)', 'Vis-à-vis', 'Mitoyenne', 'DPE E, F ou G', 'Travaux importants', 'Pas de garage', 'Toiture à refaire', 'Assainissement à refaire'],
      envExtra: ['Place du village, marché'],
    },
  };

  // Les sections et les blocs de chaque type. Le titre de la section sert de clé dans les réponses.
  function construireSections(type) {
    const cfg = CFG[type];
    const S = [];

    S.push({ titre: 'Vous et le bien', blocs: [
      { k: 'champs', items: [{ l: 'Nom et prénom' }, { l: 'Agence ou réseau' }, { l: 'Téléphone', t: 'tel' }, { l: 'E-mail', t: 'email' }, { l: 'Carte professionnelle n°' }] },
      { k: 'cases', l: 'Vous êtes', opts: ['Agent en agence', 'Mandataire indépendant', 'Autre : ________'] },
      { k: 'sous', l: 'Adresse du bien et visites' },
      { k: 'champs', items: [{ l: 'N° et rue' }, { l: 'Code postal' }, { l: 'Commune' }]
        .concat(type === 'appartement' ? [{ l: 'Bâtiment, étage, n° de porte' }] : [])
        .concat([{ l: "Code d'accès, interphone (facultatif)" }, { l: 'Qui fait les visites ? Nom et téléphone' }]) },
      { k: 'cases', l: 'Comment visiter ?', opts: ['Vous accompagnez', 'Vendeur présent', "Clés à l'agence", 'Boîte à clés', 'Sur rendez-vous uniquement', 'Bien libre, vide'] },
    ] });

    S.push({ titre: 'Mandat, vente et prix', blocs: [
      { k: 'cases', l: 'Type de mandat', opts: ['Simple', 'Exclusif', 'Semi-exclusif', 'Partagé (avec : ______)', 'Pas encore de mandat'] },
      { k: 'champs', items: [{ l: 'Date de signature du mandat', t: 'date' }, { l: 'Date de fin du mandat (facultatif)', t: 'date', special: 'fin' }] },
      { k: 'note', texte: "Jocelyne vous fait un point à l'approche de la date de fin du mandat." },
      { k: 'cases', l: 'Durée du mandat', opts: ['3 mois', '6 mois', '12 mois', 'Autre : ________', 'Je ne sais pas'] },
      { k: 'cases', l: 'En vente depuis', opts: ['Pas encore diffusé', "Moins d'un mois", '1 à 3 mois', '3 à 6 mois', '6 mois à 1 an', "Plus d'un an"] },
      { k: 'cases', l: 'Où est-il diffusé ?', opts: ['Votre site', "Un ou plusieurs sites d'annonces", 'Réseaux sociaux', "Vitrine de l'agence", "Fichier d'acheteurs", 'Pas encore diffusé'] },
      { k: 'cases', l: 'Visites et offres', opts: ['Aucune visite', '1 à 5 visites', '6 à 15 visites', 'Plus de 15 visites', 'Une ou plusieurs offres', 'Aucune offre'] },
      { k: 'cases', l: 'Pourquoi le vendeur vend-il ?', opts: ['Déménagement, mutation', 'Bien trop grand', 'Bien trop petit', 'Succession', 'Séparation', 'Autre : ________'] },
      { k: 'cases', l: 'Délai souhaité', opts: ['Le plus vite possible', 'Dans les 3 à 6 mois', 'Pas pressé'] },
      { k: 'cases', l: 'Déjà fait pour la vente', opts: ['Estimation', 'Diagnostics', 'Annonce rédigée'] },
    ] });

    S.push({ titre: 'Photos et vidéos', blocs: [
      { k: 'photos' },
      { k: 'choix', l: 'Photos professionnelles', opts: ['Déjà faites', 'À faire', 'Pas prévues'] },
      { k: 'choix', l: 'Vidéo', opts: ['Déjà faite', 'À faire', 'Pas prévue'] },
      { k: 'choix', l: 'Visite virtuelle', opts: ['Déjà faite', 'À faire', 'Pas prévue'] },
      { k: 'choix', l: 'Plans du bien', opts: ['Disponibles', 'À faire', 'Pas prévus'] },
      { k: 'champs', items: [{ l: 'Lien YouTube de la vidéo ou de la visite virtuelle (facultatif)', t: 'url' }] },
      { k: 'note', texte: 'Les vidéos ne sont pas affichées sur le site : elles sont envoyées aux acheteurs une fois leur visite confirmée.' },
    ] });

    const labelsFin = ['Prix de vente (€)', 'Honoraires (€ ou %)', 'Taxe foncière (€ par an)', 'Eau, électricité, chauffage (€ par an)'];
    if (cfg.copro) labelsFin.push('Charges de copropriété (€ par mois)', 'Autres charges à préciser (€ par an)', 'Loyer mensuel si loué (€)');
    else labelsFin.push('Loyer mensuel si loué (€)', 'Autres charges à préciser (€ par an)');
    const blocsFin = [
      { k: 'champs', items: labelsFin.map(function (l) { return { l: l }; }) },
      { k: 'cases', l: 'Prix', opts: ['Négociable', 'Déjà baissé (ancien prix : ______ €)', 'Prix non modifié'] },
      { k: 'cases', l: 'Honoraires à la charge', opts: ['Du vendeur', "De l'acquéreur"] },
    ];
    if (cfg.copro) blocsFin.push({ k: 'cases', l: 'Copropriété', opts: ['Syndic professionnel (nom : ______)', 'Syndic bénévole', 'Travaux votés ou prévus (lesquels, combien : ______)', 'Procès en cours', 'Fonds de travaux alimenté'] });
    S.push({ titre: 'Le financier', blocs: blocsFin });

    S.push({ titre: 'Le bien en chiffres', blocs: [
      { k: 'champs', items: cfg.chiffres.map(function (l) { return { l: l }; }) },
    ].concat(type === 'appartement' ? [
      { k: 'choix', l: 'Étage du logement', opts: ['Rez-de-chaussée (RDC)', '1er étage', '2e étage', '3e étage', '4e étage', '5e étage', '6e étage ou plus', 'Dernier étage'] },
    ] : []).concat([
      { k: 'cases', l: 'État général', opts: ['Très bon état, rien à prévoir', 'Bon état', 'À rafraîchir (peintures, sols)', 'À rénover (travaux importants)'] },
    ]) });

    S.push({ titre: 'Pièce par pièce', blocs: [{ k: 'note', texte: 'Merci de tout vérifier, même ce qui est déjà rempli : les pièces ont été reprises de votre annonce et peuvent contenir des erreurs ou des oublis.' }, { k: 'note', texte: "Vous avez vos diagnostics (DPE, mesurage…) ? Déposez-les dans « Accès et équipements » : ils nous permettent de reprendre les surfaces pièce par pièce, sans que vous ayez à les saisir." }, { k: 'pieces' }] });

    const blocsEq = [];
    cfg.acces.forEach(function (a) { blocsEq.push({ k: 'cases', l: a[0], opts: a[1] }); });
    blocsEq.push(
      { k: 'cases', l: 'Chauffage', opts: ['Électrique', 'Gaz', 'Fioul', 'Pompe à chaleur', 'Poêle ou cheminée', cfg.copro ? 'Collectif' : 'Bois, granulés'] },
      { k: 'cases', l: 'Eau chaude', opts: ['Ballon électrique', 'Chaudière gaz', 'Thermodynamique', 'Solaire', 'Collective'] },
      { k: 'cases', l: 'Autres équipements', opts: ['Climatisation', 'Fibre optique', 'Panneaux solaires', 'Alarme', 'Porte blindée', 'Volets électriques', 'Électricité refaite aux normes'] }
    );
    if (cfg.assainissement) blocsEq.push({ k: 'cases', l: 'Eaux usées', opts: ["Tout-à-l'égout", 'Fosse septique', 'Micro-station', 'Je ne sais pas', 'Contrôle de la commune fait', 'Dernière vidange : ______'] });
    blocsEq.push(
      { k: 'fichiers' },
      { k: 'choix', l: 'Diagnostic énergie (DPE) — classe', aff: 'Diagnostic énergie (DPE) : classe', opts: CLASSES },
      { k: 'choix', l: 'Gaz à effet de serre (GES) — classe', aff: 'Gaz à effet de serre (GES) : classe', opts: CLASSES },
      { k: 'sous', l: 'Les autres diagnostics' },
      { k: 'note', texte: "Ils dépendent de l'âge et de la situation du bien. En cas de doute, choisissez « Ne sait pas » : on regarde ensemble." }
    );
    cfg.diags.forEach(function (d) { blocsEq.push({ k: 'choix', l: d[0], aide: d[1], opts: TROIS }); });
    S.push({ titre: 'Accès et équipements', blocs: blocsEq });

    const blocsEnv = [
      { k: 'cases', l: 'Le lieu', opts: ['Centre-ville, centre du village', 'Quartier résidentiel', 'Lotissement', 'Campagne', 'Bord de mer', 'Pied de montagne'] },
      { k: 'cases', l: "L'ambiance", opts: ['Très calme', 'Calme', 'Animé'] },
      { k: 'cases', l: 'Exposition et vue', opts: ['Nord', 'Sud', 'Est', 'Ouest', 'Vue dégagée', 'Vue mer ou montagne', 'Vis-à-vis'] },
      { k: 'cases', l: 'Nuisances connues', opts: ['Aucune', 'Bruit de la route', 'Bruit des voisins', 'Odeurs', 'Chantier ou projet proche', 'Autre : ________'] },
      { k: 'sous', l: "Ce qu'il y a autour (choisissez la distance)" },
    ];
    ENVIRONS(cfg.envExtra).forEach(function (g) {
      blocsEnv.push({ k: 'sous2', l: g.groupe });
      g.lignes.forEach(function (n) { blocsEnv.push({ k: 'dist', l: n }); });
    });
    S.push({ titre: 'Les environs', blocs: blocsEnv });

    const blocsFinal = [{ k: 'sous', l: 'Travaux : ce qui est fait et ce qui reste à faire' }];
    cfg.postes.forEach(function (p) { blocsFinal.push({ k: 'travail', l: p }); });
    blocsFinal.push(
      { k: 'cases', l: 'Factures des travaux gardées ?', opts: ['Oui, toutes', 'Certaines', 'Non'] },
      { k: 'cases', l: 'Problèmes connus', opts: ['Aucun', 'Humidité', 'Fissures', 'Fuite de toiture', 'Termites', 'Autre : ________'] },
      { k: 'cases', l: 'Les plus du bien — ce que les acquéreurs aiment', opts: cfg.plus },
      { k: 'cases', l: 'Les moins du bien — à dire avec honnêteté', opts: cfg.moins },
      { k: 'champs', items: [{ l: 'Le point fort en une phrase' }, { l: "Le point d'attention en une phrase" }] },
      { k: 'long', l: 'Autre chose à nous dire sur ce bien (histoire, atouts, freins, travaux votés…)' },
      { k: 'recontact' },
      { k: 'cases', l: 'Diffusion par ALB', opts: ["J'autorise ALB Sud Immobilier à diffuser l'annonce sur ses réseaux sociaux"] }
    );
    S.push({ titre: 'Travaux, plus et moins', blocs: blocsFinal });
    return S;
  }

  // ---------- Petits outils ----------
  function trou(opt) {
    const m = /_{3,}/.exec(opt);
    return m ? { avant: opt.slice(0, m.index), apres: opt.slice(m.index + m[0].length) } : null;
  }
  function nettoyer(t) { return String(t == null ? '' : t).replace(/\s·\s/g, ' - ').trim(); }
  function echapperRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function isoVersFr(v) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function frVersIso(v) { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v || ''); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }
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
  let estPro = false;
  let annonces = [];          // { id, titre, type_vente, statut, type_bien }
  let questionnaires = [];    // résumé renvoyé par alb_pro_mes_questionnaires
  let etat = null;            // questionnaire ouvert
  let champs = [];            // registre des champs du formulaire ouvert
  let racine = null;          // la fenêtre ouverte

  // ---------- Construction du formulaire ----------
  function nouvelId(c) { champs.push(c); return champs.length - 1; }

  function htmlOption(i, opt) {
    const t = trou(opt);
    const texte = t
      ? e(t.avant) + '<input type="text" class="mqb-trou" maxlength="80" aria-label="Précision">' + e(t.apres)
      : e(opt);
    return '<label class="mqb-case"><input type="checkbox" data-o="' + i + '"><span>' + texte + '</span></label>';
  }

  function htmlBloc(sec, b, niveaux) {
    if (b.k === 'sous') return '<div class="mqb-sous">' + e(b.l) + '</div>';
    if (b.k === 'sous2') return '<div class="mqb-sous2">' + e(b.l) + '</div>';
    if (b.k === 'note') return '<p class="mqb-note">' + e(b.texte) + '</p>';
    if (b.k === 'fichiers') return (globalThis.albDiagnostics && !(etat && (etat.admin || !(etat.annonce && etat.annonce.id)))) ? globalThis.albDiagnostics.html() : '';
    if (b.k === 'photos') return '<p class="mqb-note" id="mqb-photos-info"></p><div id="mqb-photos-vignettes" style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 14px;"></div>';

    if (b.k === 'champs') {
      return '<div class="mqb-grille">' + b.items.map(function (it) {
        const c = { k: 'texte', s: sec.titre, l: it.l, t: it.t || 'text', special: it.special };
        const i = nouvelId(c);
        const numerique = /\(m²\)|Nombre|Chambres|Année|Étage|\(€|Appartements/.test(it.l) && !/Honoraires|Autre/.test(it.l);
        const type = ['date', 'email', 'tel', 'url'].indexOf(c.t) !== -1 ? c.t : 'text';
        return '<div class="mqb-champ"><label for="mqb-c' + i + '">' + e(it.l) + '</label>' +
          '<input id="mqb-c' + i + '" data-i="' + i + '" type="' + type + '"' + (numerique ? ' inputmode="decimal"' : '') + ' maxlength="200"></div>';
      }).join('') + '</div>';
    }

    if (b.k === 'long') {
      const i = nouvelId({ k: 'long', s: sec.titre, l: b.l });
      return '<div class="mqb-champ"><label for="mqb-c' + i + '">' + e(b.l) + '</label><textarea id="mqb-c' + i + '" data-i="' + i + '" rows="4" maxlength="3000"></textarea></div>';
    }

    if (b.k === 'cases') {
      const i = nouvelId({ k: 'cases', s: sec.titre, l: b.l, opts: b.opts });
      return '<div class="mqb-bloc"><div class="mqb-sous">' + e(b.aff || b.l) + '</div>' +
        '<div class="mqb-cases" data-i="' + i + '">' + b.opts.map(function (o, n) { return htmlOption(n, o); }).join('') + '</div></div>';
    }

    if (b.k === 'choix') {
      const i = nouvelId({ k: 'choix', s: sec.titre, l: b.l, opts: b.opts });
      return '<div class="mqb-ligne"><label for="mqb-c' + i + '">' + e(b.aff || b.l) + (b.aide ? ' <small>' + e(b.aide) + '</small>' : '') + '</label>' +
        '<select id="mqb-c' + i + '" data-i="' + i + '"><option value="">—</option>' +
        b.opts.map(function (o) { return '<option value="' + e(o) + '">' + e(o) + '</option>'; }).join('') + '</select></div>';
    }

    if (b.k === 'dist') {
      const i = nouvelId({ k: 'dist', s: sec.titre, l: b.l });
      return '<div class="mqb-ligne mqb-dist" data-i="' + i + '"><span>' + e(b.l) + '</span>' +
        '<select class="mqb-d-sel" aria-label="Distance : ' + e(b.l) + '"><option value="">—</option>' +
        DISTANCES.map(function (o) { return '<option value="' + e(o) + '">' + e(o) + '</option>'; }).join('') + '</select>' +
        '<input type="text" class="mqb-d-nom" maxlength="80" placeholder="Nom ou distance" aria-label="Nom ou distance : ' + e(b.l) + '"></div>';
    }

    if (b.k === 'travail') {
      const i = nouvelId({ k: 'travail', s: sec.titre, l: b.l });
      return '<div class="mqb-travail" data-i="' + i + '"><div class="mqb-travail-nom">' + e(b.l) + '</div><div class="mqb-grille">' +
        '<select class="mqb-t-etat" aria-label="État : ' + e(b.l) + '"><option value="">—</option>' +
        ETATS_TRAVAUX.map(function (o) { return '<option value="' + e(o) + '">' + e(o) + '</option>'; }).join('') + '</select>' +
        '<input type="text" class="mqb-t-annee" inputmode="numeric" maxlength="4" placeholder="Année" aria-label="Année : ' + e(b.l) + '">' +
        '<input type="text" class="mqb-t-cout" inputmode="decimal" maxlength="9" placeholder="Coût estimé (€)" aria-label="Coût estimé : ' + e(b.l) + '">' +
        '<input type="text" class="mqb-t-rem" maxlength="150" placeholder="Remarques" aria-label="Remarques : ' + e(b.l) + '"></div></div>';
    }

    if (b.k === 'recontact') {
      const i = nouvelId({ k: 'cases', s: 'Accords', l: 'Recontact', opts: [TEXTE_RECONTACT] });
      return '<div class="mqb-bloc"><div class="mqb-cases" data-i="' + i + '"><label class="mqb-case" id="mqb-recontact-case"><input type="checkbox" data-o="0"><span>' + e(TEXTE_RECONTACT) + '</span></label></div></div>';
    }

    if (b.k === 'pieces') {
      const i = nouvelId({ k: 'pieces', s: sec.titre, l: 'pieces' });
      return '<p class="mqb-note">Ajoutez une pièce à la fois : pour chacune, indiquez le niveau, la surface, le sol et ce qui s’y trouve. Une case vide veut dire « non » ou « je ne sais pas ».</p>' +
        '<div class="mqb-pieces" data-i="' + i + '"></div>' +
        '<p class="mqb-vide mqb-note">Aucune pièce pour l’instant.</p>' +
        '<button type="button" class="mqb-ajouter" data-mqb-act="ouvrir-ajout">+ Ajouter une pièce</button>' +
        '<div class="mqb-ajout-panneau" hidden></div>';
    }
    return '';
  }

  // Une carte de pièce
  function htmlCarte(nom, type, niveau, ouverte) {
    const niveaux = CFG[etat.type].niveaux;
    function groupe(titre, liste) {
      return '<div class="mqb-sous">' + e(titre) + '</div><div class="mqb-cases">' + liste.map(function (v) {
        return '<label class="mqb-case"><input type="checkbox" data-v="' + e(v) + '"><span>' + e(v) + '</span></label>';
      }).join('') + '</div>';
    }
    let extra = '';
    if (type === 'Cuisine') {
      extra = groupe('Type de cuisine', CUISINE_TYPE) + groupe('Équipement de la cuisine', CUISINE_EQ) + groupe("Ce qu'il y a dedans", CUISINE_DEDANS);
    } else if (type === 'Salle de bains' || type === "Salle d'eau") {
      extra = groupe("Ce qu'il y a dedans", SALLES);
    }
    return '<details class="mqb-piece" data-type="' + e(type) + '" data-nom="' + e(nom) + '"' + (ouverte ? ' open' : '') + '>' +
      '<summary><span class="mqb-piece-nom">' + e(nom || 'Nouvelle pièce') + '</span><span class="mqb-resume"></span></summary>' +
      '<div class="mqb-piece-corps">' +
        (type === 'Autre (à préciser)' ? '<div class="mqb-champ"><label>Nom de la pièce</label><input type="text" class="mqb-nom" maxlength="60" value="' + e(nom === 'Autre pièce' ? '' : nom) + '"></div>' : '') +
        '<div class="mqb-grille"><div class="mqb-champ"><label>Niveau</label><select class="mqb-niv"><option value="">—</option>' +
          niveaux.map(function (n) { return '<option value="' + e(n) + '"' + (n === niveau ? ' selected' : '') + '>' + e(n) + '</option>'; }).join('') + '</select></div>' +
        '<div class="mqb-champ"><label>Surface (m²)</label><input type="text" class="mqb-m2" inputmode="decimal" maxlength="8"></div></div>' +
        groupe('Sol', SOL) + groupe('Équipement', EQUIP) + groupe('Fenêtres', FENETRES) + extra +
        '<div class="mqb-champ"><label>Notes</label><input type="text" class="mqb-notes" maxlength="200"></div>' +
        '<button type="button" class="mqb-supprimer" data-mqb-act="retirer-piece">Supprimer cette pièce</button>' +
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
    const n = racine.querySelectorAll('.mqb-piece[data-type="' + type.replace(/"/g, '') + '"]').length;
    if (type === 'Autre (à préciser)') return 'Autre pièce';
    if (NUMEROTEES.indexOf(type) !== -1) return type + ' ' + (n + 1);
    return n === 0 ? type : type + ' (' + (n + 1) + ')';
  }
  function majVide() {
    const v = racine.querySelector('.mqb-vide');
    if (v) v.hidden = racine.querySelectorAll('.mqb-piece').length > 0;
  }

  function htmlPanneauAjout() {
    const chip = function (nom, valeur) {
      return '<label class="mqb-chip"><input type="radio" name="' + nom + '" value="' + e(valeur) + '"><span>' + e(valeur) + '</span></label>';
    };
    return '<div class="mqb-panneau"><div class="mqb-panneau-titre">Quelle pièce voulez-vous ajouter ?</div>' +
      '<div class="mqb-sous">Type de pièce</div><div class="mqb-chips">' + typesDisponibles().map(function (t) { return chip('mqb-type', t); }).join('') + '</div>' +
      '<div class="mqb-sous">Niveau</div><div class="mqb-chips">' + CFG[etat.type].niveaux.map(function (t) { return chip('mqb-niveau', t); }).join('') + '</div>' +
      '<p class="mqb-note">Plusieurs chambres ? Ajoutez-les une par une : elles s’appellent « Chambre 1 », « Chambre 2 »… toutes seules.</p>' +
      '<div id="mqb-ajout-msg" class="mqb-msg erreur" aria-live="polite"></div>' +
      '<div class="mqb-boutons-ligne"><button type="button" class="bouton" data-mqb-act="valider-ajout">Ajouter cette pièce</button>' +
      '<button type="button" class="bouton bouton-discret" data-mqb-act="annuler-ajout">Annuler</button></div></div>';
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
      const saisi = nettoyer(cb.closest('label').querySelector('.mqb-trou').value);
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
        if (m) { cb.checked = true; cb.closest('label').querySelector('.mqb-trou').value = m[1] === '…' ? '' : m[1]; break; }
      }
    });
  }

  function lireChamp(c, el) {
    if (c.k === 'texte') { const v = el.value.trim(); return c.t === 'date' ? isoVersFr(v) : v; }
    if (c.k === 'long') return el.value.trim();
    if (c.k === 'choix') return el.value;
    if (c.k === 'cases') return lireCases(c, el);
    if (c.k === 'dist') {
      const t = []; const d = el.querySelector('.mqb-d-sel').value; const n = nettoyer(el.querySelector('.mqb-d-nom').value);
      if (d) t.push(d); if (n) t.push('Nom : ' + n);
      return t.join(SEP);
    }
    if (c.k === 'travail') {
      const t = []; const s = el.querySelector('.mqb-t-etat').value;
      const a = nettoyer(el.querySelector('.mqb-t-annee').value), k = nettoyer(el.querySelector('.mqb-t-cout').value), r = nettoyer(el.querySelector('.mqb-t-rem').value);
      if (s) t.push(s); if (a) t.push('Année : ' + a); if (k) t.push('Coût : ' + k + ' €'); if (r) t.push('Remarques : ' + r);
      return t.join(SEP);
    }
    return '';
  }
  function poserChamp(c, el, valeur) {
    const v = String(valeur == null ? '' : valeur);
    if (c.k === 'texte') { el.value = c.t === 'date' ? frVersIso(v) : v; }
    else if (c.k === 'long') { el.value = v; }
    else if (c.k === 'choix') { el.value = c.opts.indexOf(v) !== -1 ? v : ''; }
    else if (c.k === 'cases') { poserCases(c, el, v); }
    else if (c.k === 'dist') {
      v.split(SEP).forEach(function (j) {
        if (j.indexOf('Nom : ') === 0) el.querySelector('.mqb-d-nom').value = j.slice(6);
        else if (DISTANCES.indexOf(j) !== -1) el.querySelector('.mqb-d-sel').value = j;
      });
    } else if (c.k === 'travail') {
      v.split(SEP).forEach(function (j) {
        if (ETATS_TRAVAUX.indexOf(j) !== -1) el.querySelector('.mqb-t-etat').value = j;
        else if (j.indexOf('Année : ') === 0) el.querySelector('.mqb-t-annee').value = j.slice(8);
        else if (j.indexOf('Coût : ') === 0) el.querySelector('.mqb-t-cout').value = j.slice(7).replace(/ €$/, '');
        else if (j.indexOf('Remarques : ') === 0) el.querySelector('.mqb-t-rem').value = j.slice(12);
      });
    }
  }

  function nomDePiece(d) {
    return d.dataset.type === 'Autre (à préciser)' ? nettoyer(d.querySelector('.mqb-nom').value) : d.dataset.nom;
  }
  function lirePiece(d) {
    const t = [];
    const niv = d.querySelector('.mqb-niv').value; if (niv) t.push(niv);
    const m2 = nettoyer(d.querySelector('.mqb-m2').value); if (m2) t.push(m2 + ' m²');
    d.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { if (cb.checked) t.push(cb.dataset.v); });
    const notes = nettoyer(d.querySelector('.mqb-notes').value); if (notes) t.push('Notes : ' + notes);
    return { nom: nomDePiece(d), valeur: t.join(SEP) };
  }
  function poserPiece(d, valeur) {
    const jetons = String(valeur || '').split(SEP);
    d.querySelector('.mqb-niv').value = '';
    d.querySelector('.mqb-m2').value = '';
    d.querySelector('.mqb-notes').value = '';
    d.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = jetons.indexOf(cb.dataset.v) !== -1; });
    jetons.forEach(function (j) {
      if (/^[\d.,]+ m²$/.test(j)) d.querySelector('.mqb-m2').value = j.replace(' m²', '');
      else if (j.indexOf('Notes : ') === 0) d.querySelector('.mqb-notes').value = j.slice(8);
      else if (CFG[etat.type].niveaux.indexOf(j) !== -1) d.querySelector('.mqb-niv').value = j;
    });
    majResume(d);
  }
  function majResume(d) {
    const p = lirePiece(d);
    const m2 = d.querySelector('.mqb-m2').value;
    d.querySelector('.mqb-resume').textContent = p.valeur ? '✔ ' + (m2 ? m2 + ' m²' : 'rempli') : '';
    if (d.dataset.type === 'Autre (à préciser)') d.querySelector('.mqb-piece-nom').textContent = p.nom || 'Nouvelle pièce';
  }

  // Le rouge disparaît dès que la case « recontact » est cochée
  function recontactCoche() {
    const cb = racine && racine.querySelector('#mqb-recontact-case input');
    return !!(cb && cb.checked);
  }
  function majAccord() {
    const cas = racine && racine.querySelector('#mqb-recontact-case');
    if (cas && recontactCoche()) {
      cas.classList.remove('mqb-erreur');
      const m = racine.querySelector('#mqb-msg');
      if (m && m.textContent === MSG_RECONTACT) afficherMessage('', '');
    }
  }

  function collecter() {
    const rep = {};
    let fin = '';
    champs.forEach(function (c, i) {
      if (c.k === 'pieces') return;
      const el = zone(i);
      if (!el) return;
      const v = lireChamp(c, el);
      if (c.special === 'fin') { fin = frVersIso(isoVersFr(el.value.trim())) || el.value.trim(); return; }
      if (!v) return;
      if (!rep[c.s]) rep[c.s] = {};
      rep[c.s][c.l] = v;
    });
    const sectionPieces = 'Pièce par pièce';
    racine.querySelectorAll('.mqb-piece').forEach(function (d) {
      const p = lirePiece(d);
      if (!p.valeur) return;
      let nom = p.nom || 'Autre pièce';
      if (!rep[sectionPieces]) rep[sectionPieces] = {};
      let n = 2; const base = nom;
      while (rep[sectionPieces][nom]) { nom = base + ' (' + n + ')'; n++; }
      rep[sectionPieces][nom] = p.valeur;
    });
    const sv = rep['Vous et le bien'] || {};
    const adresse = [sv['N° et rue'], [sv['Code postal'], sv['Commune']].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return { rep: rep, adresse: adresse, fin: fin, rue: sv['N° et rue'] || '', commune: sv['Commune'] || '', recontact: recontactCoche() };
  }

  function remettre(rep, fin) {
    champs.forEach(function (c, i) {
      if (c.k === 'pieces') return;
      const el = zone(i);
      if (!el) return;
      if (c.special === 'fin') { el.value = fin || ''; return; }
      const v = rep && rep[c.s] && rep[c.s][c.l];
      if (v != null) poserChamp(c, el, v);
    });
    const sp = rep && rep[SEC_PIECES];
    if (sp) {
      const conteneur = racine.querySelector('.mqb-pieces');
      Object.keys(sp).forEach(function (nom) {
        conteneur.insertAdjacentHTML('beforeend', htmlCarte(nom, typeDeNom(nom), '', false));
        poserPiece(conteneur.lastElementChild, sp[nom]);
      });
    }
  }

  // Valeurs proposées d'après l'annonce et le compte du pro (seulement si le champ est vide)
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
    const m = racine && racine.querySelector('#mqb-msg');
    if (!m) return;
    m.className = 'mqb-msg ' + (texte ? 'visible ' + type : '');
    m.textContent = texte || '';
  }

  function planifier() {
    etat.modifie = true;
    clearTimeout(minuteur);
    minuteur = setTimeout(function () { sauvegarder(false, true); }, 2500);
  }

  function sauvegarder(envoyer, silencieux) {
    file = file.then(async function () {
      if (!etat || !racine) return false;
      clearTimeout(minuteur);
      const d = collecter();
      if (envoyer) {
        if (!d.recontact) {
          // Sans l'accord de recontact, rien ne part : la case passe en rouge
          const cas = racine.querySelector('#mqb-recontact-case');
          cas.classList.add('mqb-erreur');
          cas.scrollIntoView({ block: 'center', behavior: 'smooth' });
          afficherMessage('erreur', MSG_RECONTACT);
          return false;
        }
        if (!d.rue || !d.commune) { afficherMessage('erreur', ERREURS.ADRESSE_OBLIGATOIRE); return false; }
        const lien = d.rep['Photos et vidéos'] && d.rep['Photos et vidéos']['Lien YouTube de la vidéo ou de la visite virtuelle (facultatif)'];
        if (lien && !/^https:\/\//i.test(lien)) { afficherMessage('erreur', 'Le lien de la vidéo doit commencer par https://'); return false; }
      }
      try {
        const { data, error } = etat.admin
          ? (etat.adminMembre && !etat.qid
            ? await albSupabase.rpc('alb_admin_questionnaire_creer_membre', {
                p_profile_id: etat.adminMembre, p_type: etat.type, p_adresse: d.adresse, p_reponses: d.rep, p_fin_mandat: d.fin || null,
              })
            : etat.adminParId
            ? await albSupabase.rpc('alb_admin_questionnaire_enregistrer_id', {
                p_id: etat.qid, p_type: etat.type, p_adresse: d.adresse, p_reponses: d.rep, p_fin_mandat: d.fin || null,
              })
            : await albSupabase.rpc('alb_admin_questionnaire_enregistrer', {
                p_id: etat.qid || null, p_type: etat.type, p_adresse: d.adresse, p_reponses: d.rep, p_fin_mandat: d.fin || null, p_annonce_id: etat.annonce.id,
              }))
          : await albSupabase.rpc('alb_pro_questionnaire_enregistrer', {
          p_id: etat.qid || null,
          p_type: etat.type,
          p_adresse: d.adresse,
          p_reponses: d.rep,
          p_fin_mandat: d.fin || null,
          p_envoyer: !!envoyer,
          p_annonce_id: etat.annonce.id,
        });
        if (error) throw error;
        etat.qid = data;
        etat.modifie = false;
        if (etat.admin) await enregistrerMarques();
        if (!envoyer) afficherMessage('info', silencieux ? 'Brouillon enregistré automatiquement.' : 'Brouillon enregistré. Vous pourrez le terminer plus tard.');
        return true;
      } catch (ex) {
        console.error('[ALB DEBUG] questionnaire du bien :', ex);
        afficherMessage('erreur', messageErreur(ex));
        return false;
      }
    });
    return file;
  }

  async function envoyer() {
    const ok = await sauvegarder(true, false);
    if (!ok) return;
    const corps = racine.querySelector('.mqb-corps');
    racine.querySelector('.mqb-pied').innerHTML = '<button type="button" class="bouton" data-mqb-act="fermer">Fermer</button>';
    corps.innerHTML = '<div class="mqb-fin"><h3>Merci, votre questionnaire est envoyé.</h3><p>Jocelyne vous contacte pour rédiger la description avec vous.</p></div>';
    corps.scrollTop = 0;
    await rafraichir();
  }

  // ---------- Fenêtre ----------
  function creerFenetre(titre, corps, pied) {
    fermerFenetre();
    const f = document.createElement('div');
    f.className = 'mqb-fond';
    f.setAttribute('role', 'dialog');
    f.setAttribute('aria-modal', 'true');
    f.setAttribute('aria-label', titre);
    f.innerHTML = '<div class="mqb-boite">' +
      '<div class="mqb-tete"><strong>' + e(titre) + '</strong><button type="button" class="mqb-x" data-mqb-act="fermer" aria-label="Fermer">✕</button></div>' +
      '<div class="mqb-corps">' + corps + '</div>' +
      '<div class="mqb-pied">' + pied + '</div></div>';
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
    if (etat && etat.modifie && racine && racine.querySelector('.mqb-formulaire')) await sauvegarder(false, true);
    clearTimeout(minuteur);
    fermerFenetre();
    const etaitAdmin = !!(etat && etat.admin);
    etat = null;
    champs = [];
    if (etaitAdmin) { if (typeof surFermetureAdmin === 'function') surFermetureAdmin(); return; }
    await rafraichir();
  }


  // ---------- ⚑ Questions à compléter (marquées par Jocelyne) ----------
  function cleChamp(i) {
    const c = champs[i];
    return c && c.k !== 'pieces' && c.s !== 'Accords' && c.l ? c.s + '|' + c.l : null;
  }
  function enveloppeChamp(i) {
    const z = zone(i);
    return z && z.closest ? z.closest('.mqb-champ,.mqb-bloc,.mqb-ligne,.mqb-travail') : null;
  }
  function majMarques() {
    if (!etat || !etat.aCompleter) return;
    let restantes = 0;
    champs.forEach(function (c, i) {
      const w = enveloppeChamp(i);
      if (!w || !w.dataset.cle) return;
      const marque = etat.aCompleter.has(w.dataset.cle);
      const el = zone(i);
      const vide = el ? !lireChamp(c, el) : true;
      const actif = marque && (etat.admin || vide);
      if (actif && !etat.admin) restantes++;
      w.classList.toggle('mqb-manque', actif);
      const b = w.querySelector(':scope > .mqb-flag, :scope > .mqb-flag-ligne > .mqb-flag');
      if (b) { b.textContent = marque ? '⚑ Marquée : à compléter' : '⚑ À compléter'; b.classList.toggle('actif', marque); }
    });
    const n = racine && racine.querySelector('#mqb-manque-nb');
    if (n) n.textContent = restantes ? 'Il reste ' + restantes + ' question' + (restantes > 1 ? 's' : '') + ' à compléter.' : 'Tout est complété, merci !';
  }
  function installerMarques(brouillon) {
    etat.aCompleter = new Set(Array.isArray(brouillon && brouillon.a_completer) ? brouillon.a_completer : []);
    etat.messageManque = (brouillon && brouillon.message_a_completer) || '';
    etat.marquesModifiees = false;
    champs.forEach(function (c, i) {
      const cle = cleChamp(i), w = enveloppeChamp(i);
      if (!cle || !w) return;
      w.dataset.cle = cle;
      if (etat.admin) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'mqb-flag'; b.dataset.mqbFlag = cle; b.textContent = '⚑ À compléter';
        w.insertBefore(b, w.firstChild);
      }
    });
    const form = racine.querySelector('.mqb-formulaire');
    if (etat.admin) {
      const box = document.createElement('div');
      box.style.cssText = 'background:#FFF6DC;border:1px solid #E5C770;padding:8px 10px;border-radius:6px;margin-bottom:10px;';
      box.innerHTML = '<strong>⚑ Questions à compléter</strong><p style="font-size:.85rem;margin:4px 0;">Appuie sur « ⚑ À compléter » à côté d’une question : elle apparaîtra en jaune chez la personne, jusqu’à ce qu’elle réponde. Ton message (facultatif) s’affiche en haut.</p>' +
        '<textarea id="mqb-msg-manque" rows="2" maxlength="1000" style="width:100%;box-sizing:border-box;" placeholder="Un mot pour la personne (facultatif)"></textarea>';
      box.querySelector('textarea').value = etat.messageManque;
      form.insertBefore(box, form.firstChild);
    } else if (etat.aCompleter.size) {
      const box = document.createElement('div');
      box.style.cssText = 'background:#FFF6DC;border:1px solid #E5C770;padding:10px 12px;border-radius:6px;margin-bottom:12px;';
      box.innerHTML = '<strong>⚑ Jocelyne vous demande de compléter quelques réponses</strong>' +
        (etat.messageManque ? '<p style="margin:6px 0;white-space:pre-line;"></p>' : '') +
        '<p id="mqb-manque-nb" style="margin:6px 0 0;font-weight:600;"></p>';
      const p = box.querySelector('p'); if (etat.messageManque && p) p.textContent = etat.messageManque;
      form.insertBefore(box, form.firstChild);
    }
    majMarques();
  }
  function basculerMarque(cle) {
    if (!etat || !etat.aCompleter) return;
    if (etat.aCompleter.has(cle)) etat.aCompleter.delete(cle); else etat.aCompleter.add(cle);
    etat.marquesModifiees = true;
    majMarques();
    planifier();
  }
  // Après chaque enregistrement par Jocelyne : les questions marquées sont gardées
  async function enregistrerMarques() {
    if (!etat || !etat.admin || !etat.qid || !racine) return;
    const m = racine.querySelector('#mqb-msg-manque');
    const message = m ? m.value : '';
    if (!etat.marquesModifiees && message === etat.messageManque) return;
    const { error } = await albSupabase.rpc('alb_admin_questionnaire_marquer', { p_id: etat.qid, p_cles: Array.from(etat.aCompleter), p_message: message });
    if (error) { console.log('[ALB DEBUG] questions à compléter : enregistrement impossible', error); return; }
    etat.marquesModifiees = false; etat.messageManque = message;
  }

  function surSaisie(ev) {
    if (!etat || !racine || !racine.querySelector('.mqb-formulaire')) return;
    if (ev.target.closest && ev.target.closest('.mqb-ajout-panneau')) return; // le choix d'une pièce n'est pas une réponse
    const d = ev.target.closest && ev.target.closest('.mqb-piece');
    if (d) majResume(d);
    majAccord();
    majMarques();
    planifier();
  }

  function clicFenetre(ev) {
    const fl = ev.target.closest && ev.target.closest('[data-mqb-flag]');
    if (fl) { basculerMarque(fl.dataset.mqbFlag); return; }
    const b = ev.target.closest('[data-mqb-act]');
    if (!b) return;
    const act = b.dataset.mqbAct;
    if (act === 'fermer' || act === 'plus-tard') fermer();
    else if (act === 'brouillon') sauvegarder(false, false);
    else if (act === 'envoyer') { b.disabled = true; envoyer().finally(function () { b.disabled = false; }); }
    else if (act === 'type-appartement') afficherFormulaire('appartement');
    else if (act === 'type-maison') afficherFormulaire('maison');
    else if (act === 'type-village') afficherFormulaire('village');
    else if (act === 'ouvrir-ajout') {
      const pa = racine.querySelector('.mqb-ajout-panneau');
      pa.innerHTML = htmlPanneauAjout();
      pa.hidden = false;
      pa.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    else if (act === 'annuler-ajout') {
      const pa = racine.querySelector('.mqb-ajout-panneau');
      pa.hidden = true; pa.innerHTML = '';
    }
    else if (act === 'valider-ajout') ajouterPiece();
    else if (act === 'retirer-piece') {
      const d = b.closest('.mqb-piece');
      if (d && window.confirm('Supprimer cette pièce du questionnaire ?')) { d.parentNode.removeChild(d); majVide(); planifier(); }
    }
  }

  function ajouterPiece() {
    const type = (racine.querySelector('input[name="mqb-type"]:checked') || {}).value;
    const niveau = (racine.querySelector('input[name="mqb-niveau"]:checked') || {}).value || '';
    const msg = racine.querySelector('#mqb-ajout-msg');
    if (!type) { msg.textContent = 'Choisissez d’abord le type de pièce.'; msg.classList.add('visible'); return; }
    const conteneur = racine.querySelector('.mqb-pieces');
    conteneur.insertAdjacentHTML('beforeend', htmlCarte(nomSuivant(type), type, niveau, true));
    const carte = conteneur.lastElementChild;
    racine.querySelector('.mqb-ajout-panneau').hidden = true;
    racine.querySelector('.mqb-ajout-panneau').innerHTML = '';
    majVide();
    carte.scrollIntoView({ block: 'center', behavior: 'smooth' });
    planifier();
  }

  // ---------- Écrans ----------
  const INTRO = 'Pour que Jocelyne puisse vous aider à rédiger la description de votre annonce, remplissez le questionnaire de ce bien. Vous pouvez l’enregistrer en brouillon et le terminer plus tard.';

  function afficherChoixType(avecAppartement) {
    creerFenetre('Questionnaire du bien',
      '<h3>Questionnaire du bien</h3><p>' + e(INTRO) + '</p>' +
      '<div class="mqb-choix">' + (avecAppartement ? '<button type="button" class="mqb-grand" data-mqb-act="type-appartement">🏢<br>Appartement</button>' : '') + '<button type="button" class="mqb-grand" data-mqb-act="type-maison">🏠<br>Maison</button>' +
      '<button type="button" class="mqb-grand" data-mqb-act="type-village">🏘️<br>Maison de village</button></div>',
      '<button type="button" class="bouton bouton-discret" data-mqb-act="plus-tard">Plus tard</button>');
  }

  function afficherEnvoye(q) {
    creerFenetre('Questionnaire du bien',
      '<div class="mqb-fin"><h3>Questionnaire envoyé</h3><p>Questionnaire envoyé le ' + e(dateCourte(q.envoye_le) || 'jour de l’envoi') + '. Une précision à ajouter ? Appelez Jocelyne au 07 45 60 28 05.</p></div>',
      '<button type="button" class="bouton" data-mqb-act="fermer">Fermer</button>');
  }

  async function afficherFormulaire(type, brouillon) {
    etat.type = type;
    champs = [];
    const sections = construireSections(type);
    const niveaux = CFG[type].niveaux;
    const html = '<div class="mqb-formulaire"><p class="mqb-intro">' + e(INTRO) + '</p>' +
      sections.map(function (s, n) {
        return '<section class="mqb-section"><h3>' + (n + 1) + '. ' + e(s.titre) + '</h3>' +
          s.blocs.map(function (b) { return htmlBloc(s, b, niveaux); }).join('') + '</section>';
      }).join('') + '</div>';
    creerFenetre('Questionnaire du bien — ' + CFG[type].libelle, html,
      '<div id="mqb-msg" class="mqb-msg" aria-live="polite"></div>' +
      '<div class="mqb-boutons"><button type="button" class="bouton bouton-discret" data-mqb-act="brouillon">Enregistrer le brouillon</button>' +
      (etat.admin ? '<button type="button" class="bouton" data-mqb-act="fermer">Fermer</button>' : '<button type="button" class="bouton" data-mqb-act="envoyer">Envoyer à Jocelyne</button>') + '</div>');

    if (etat.admin) {
      const ban = document.createElement('p');
      ban.className = 'mqb-note';
      ban.style.cssText = 'background:#FFF6DC;border:1px solid #E5C770;padding:8px 10px;border-radius:6px;';
      ban.textContent = etat.dejaEnvoye
        ? 'Tu modifies un questionnaire déjà envoyé par le professionnel. Tes changements sont enregistrés tout de suite.'
        : 'Tu remplis ce questionnaire à la place du professionnel. Il reste en brouillon dans son espace : c\u2019est lui qui l\u2019enverra.';
      racine.querySelector('.mqb-formulaire').insertBefore(ban, racine.querySelector('.mqb-formulaire').firstChild);
    }
    if (!etat.admin && globalThis.albDiagnostics && etat.annonce && etat.annonce.id) globalThis.albDiagnostics.brancher(racine, etat.annonce.id);
    const vign = racine.querySelector('#mqb-photos-vignettes');
    if (vign && etat.photos && etat.photos.length) {
      vign.innerHTML = etat.photos.map(function (u) {
        return '<a href="' + e(u) + '" target="_blank" rel="noopener"><img src="' + e(u) + '" alt="Photo de l\u2019annonce" loading="lazy" style="width:110px;height:82px;object-fit:cover;border-radius:6px;border:1px solid #ddd;"></a>';
      }).join('');
    }
    const info = racine.querySelector('#mqb-photos-info');
    if (info) {
      info.textContent = etat.nbPhotos > 0
        ? 'Les photos et les vidéos se gèrent dans votre annonce (une photo au minimum, dix au maximum). Photos dans votre annonce : ' + etat.nbPhotos + '. Indiquez simplement ce qui existe pour ce bien.'
        : 'Les photos et les vidéos se gèrent dans votre annonce (une photo au minimum, dix au maximum). Votre annonce n’a pas encore de photo : ajoutez-en depuis le bouton « Photos » de l’annonce. Indiquez simplement ce qui existe pour ce bien.';
    }
    if (brouillon) remettre(brouillon.reponses || {}, brouillon.fin_mandat || '');
    preremplir(etat.defauts);
    installerMarques(brouillon);
    racine.querySelectorAll('.mqb-piece').forEach(majResume);
    majVide();
    etat.modifie = false;
  }

  // ---------- Ouverture depuis une annonce ----------
  async function ouvrir(annonceId) {
    const a = annonces.find(function (x) { return x.id === annonceId; });
    if (!a) return;
    etat = { annonce: a, qid: null, type: null, modifie: false, nbPhotos: 0, defauts: {} };
    const existant = questionnaires.find(function (q) { return q.annonce_id === annonceId; });
    if (existant && existant.statut === 'envoye') { afficherEnvoye(existant); return; }

    // Les informations de l'annonce et du compte, pour éviter de tout retaper
    const [rAnn, rPrive, rMed, rProfil] = await Promise.all([
      albSupabase.from('annonces').select('id, prix, ville, code_postal, type_bien, surface_m2, nb_pieces, surface_terrain_m2, dpe, ges, honoraires_texte, agence_nom').eq('id', annonceId).maybeSingle(),
      albSupabase.from('annonces_prive').select('adresse, telephone').eq('annonce_id', annonceId).maybeSingle(),
      albSupabase.from('annonce_medias').select('id, url, ordre, type_media').eq('annonce_id', annonceId).order('ordre', { ascending: true }),
      albSupabase.from('profiles').select('prenom, nom, nom_entreprise, email, telephone').eq('id', monId).maybeSingle(),
    ]);
    const an = rAnn.data || {}, pr = rPrive.data || {}, pf = rProfil.data || {};
    etat.nbPhotos = (rMed.data || []).length;
    etat.photos = (rMed.data || []).filter(function (m) { return m.url && (!m.type_media || m.type_media === 'photo'); }).map(function (m) { return m.url; });
    const V = 'Vous et le bien';
    etat.defauts[V + '|Nom et prénom'] = [pf.prenom, pf.nom].filter(Boolean).join(' ');
    etat.defauts[V + '|Agence ou réseau'] = an.agence_nom || pf.nom_entreprise || '';
    etat.defauts[V + '|Téléphone'] = pr.telephone || pf.telephone || '';
    etat.defauts[V + '|E-mail'] = pf.email || '';
    etat.defauts[V + '|N° et rue'] = pr.adresse || '';
    etat.defauts[V + '|Code postal'] = an.code_postal || '';
    etat.defauts[V + '|Commune'] = an.ville || '';
    etat.defauts['Le financier|Prix de vente (€)'] = an.prix != null ? String(an.prix) : '';
    etat.defauts['Le financier|Honoraires (€ ou %)'] = an.honoraires_texte || '';
    etat.defauts['Le bien en chiffres|Surface habitable (m²)'] = an.surface_m2 != null ? String(an.surface_m2) : '';
    etat.defauts['Le bien en chiffres|Nombre de pièces'] = an.nb_pieces != null ? String(an.nb_pieces) : '';
    etat.defauts['Le bien en chiffres|Terrain (m²)'] = an.surface_terrain_m2 != null ? String(an.surface_terrain_m2) : '';
    etat.defauts['Accès et équipements|Diagnostic énergie (DPE) — classe'] = an.dpe || '';
    etat.defauts['Accès et équipements|Gaz à effet de serre (GES) — classe'] = an.ges || '';

    if (existant) {
      // Brouillon déjà commencé : on le rouvre
      const { data, error } = await albSupabase.rpc('alb_pro_questionnaire_lire', { p_id: existant.id });
      if (!error && data) {
        etat.qid = existant.id;
        await afficherFormulaire(data.type_bien, data);
        return;
      }
    }
    // Le type de bien se reconnaît tout seul : un appartement, ou une maison avec un terrain (jardin)
    // s'ouvre directement. Sans terrain, on laisse le choix (maison ou maison de village).
    if (an.type_bien === 'appartement') await afficherFormulaire('appartement');
    else if (an.type_bien === 'maison' && Number(an.surface_terrain_m2) > 0) await afficherFormulaire('maison');
    else afficherChoixType();
  }

  // ---------- Jocelyne remplit à la place du pro (depuis Gestion du site) ----------
  let surFermetureAdmin = null;
  async function ouvrirPourAdmin(annonceId, quandFerme) {
    styles();
    surFermetureAdmin = quandFerme || null;
    const { data, error } = await albSupabase.rpc('alb_admin_questionnaire_charger', { p_annonce_id: annonceId });
    if (error || !data) { console.log('[ALB DEBUG] questionnaire admin : chargement impossible', error); alert('Le questionnaire n\u2019a pas pu être ouvert.'); return; }
    const an = data.annonce || {}, pr = data.prive || {}, pf = data.profil || {};
    etat = { annonce: { id: annonceId }, qid: null, type: null, modifie: false, nbPhotos: Number(data.nb_photos) || 0, photos: Array.isArray(data.photos) ? data.photos : [], defauts: {}, admin: true };
    const V = 'Vous et le bien';
    etat.defauts[V + '|Nom et prénom'] = [pf.prenom, pf.nom].filter(Boolean).join(' ');
    etat.defauts[V + '|Agence ou réseau'] = an.agence_nom || pf.nom_entreprise || '';
    etat.defauts[V + '|Téléphone'] = pr.telephone || pf.telephone || '';
    etat.defauts[V + '|E-mail'] = pf.email || '';
    etat.defauts[V + '|N° et rue'] = pr.adresse || '';
    etat.defauts[V + '|Code postal'] = an.code_postal || '';
    etat.defauts[V + '|Commune'] = an.ville || '';
    etat.defauts['Le financier|Prix de vente (€)'] = an.prix != null ? String(an.prix) : '';
    etat.defauts['Le financier|Honoraires (€ ou %)'] = an.honoraires_texte || '';
    etat.defauts['Le bien en chiffres|Surface habitable (m²)'] = an.surface_m2 != null ? String(an.surface_m2) : '';
    etat.defauts['Le bien en chiffres|Nombre de pièces'] = an.nb_pieces != null ? String(an.nb_pieces) : '';
    etat.defauts['Le bien en chiffres|Terrain (m²)'] = an.surface_terrain_m2 != null ? String(an.surface_terrain_m2) : '';
    etat.defauts['Accès et équipements|Diagnostic énergie (DPE) — classe'] = an.dpe || '';
    etat.defauts['Accès et équipements|Gaz à effet de serre (GES) — classe'] = an.ges || '';
    const q = data.questionnaire;
    if (q) { etat.qid = q.id; await afficherFormulaire(q.type_bien, q); return; }
    const type = an.type_bien === 'appartement' ? 'appartement' : 'maison';
    await afficherFormulaire(type);
  }

  // Jocelyne ouvre un questionnaire déjà lancé (brouillon ou envoyé), à partir de son numéro
  async function ouvrirPourAdminId(qid, quandFerme) {
    styles();
    surFermetureAdmin = quandFerme || null;
    const { data, error } = await albSupabase.rpc('alb_admin_questionnaire_lire_id', { p_id: qid });
    if (error || !data || !data.questionnaire) { console.log('[ALB DEBUG] questionnaire admin : chargement impossible', error); alert('Le questionnaire n\u2019a pas pu être ouvert.'); return; }
    const q = data.questionnaire, an = data.annonce || {}, pr = data.prive || {}, pf = data.profil || {};
    etat = { annonce: { id: an.id || null }, qid: q.id, type: null, modifie: false, nbPhotos: Number(data.nb_photos) || 0, photos: Array.isArray(data.photos) ? data.photos : [], defauts: {}, admin: true, adminParId: true, dejaEnvoye: q.statut === 'envoye' };
    const V = 'Vous et le bien';
    etat.defauts[V + '|Nom et prénom'] = [pf.prenom, pf.nom].filter(Boolean).join(' ');
    etat.defauts[V + '|Agence ou réseau'] = an.agence_nom || pf.nom_entreprise || '';
    etat.defauts[V + '|Téléphone'] = pr.telephone || pf.telephone || '';
    etat.defauts[V + '|E-mail'] = pf.email || '';
    etat.defauts[V + '|N° et rue'] = pr.adresse || '';
    etat.defauts[V + '|Code postal'] = an.code_postal || '';
    etat.defauts[V + '|Commune'] = an.ville || '';
    etat.defauts['Le financier|Prix de vente (€)'] = an.prix != null ? String(an.prix) : '';
    etat.defauts['Le financier|Honoraires (€ ou %)'] = an.honoraires_texte || '';
    etat.defauts['Le bien en chiffres|Surface habitable (m²)'] = an.surface_m2 != null ? String(an.surface_m2) : '';
    etat.defauts['Le bien en chiffres|Nombre de pièces'] = an.nb_pieces != null ? String(an.nb_pieces) : '';
    etat.defauts['Le bien en chiffres|Terrain (m²)'] = an.surface_terrain_m2 != null ? String(an.surface_terrain_m2) : '';
    etat.defauts['Accès et équipements|Diagnostic énergie (DPE) — classe'] = an.dpe || '';
    etat.defauts['Accès et équipements|Gaz à effet de serre (GES) — classe'] = an.ges || '';
    await afficherFormulaire(q.type_bien, q);
  }

  // Valeurs déjà connues du compte, pour un questionnaire sans annonce
  function defautsCompte(pf) {
    const V = 'Vous et le bien', D = {};
    D[V + '|Nom et prénom'] = [pf.prenom, pf.nom].filter(Boolean).join(' ');
    D[V + '|Agence ou réseau'] = pf.nom_entreprise || '';
    D[V + '|Téléphone'] = pf.telephone || '';
    D[V + '|E-mail'] = pf.email || '';
    return D;
  }

  // Le pro ouvre un questionnaire que Jocelyne a préparé pour lui (sans annonce)
  async function ouvrirSansAnnonce(qid) {
    const existant = questionnaires.find(function (q) { return q.id === qid; });
    if (!existant) return;
    etat = { annonce: { id: null }, qid: null, type: null, modifie: false, nbPhotos: 0, photos: [], defauts: {} };
    if (existant.statut === 'envoye') { afficherEnvoye(existant); return; }
    const rProfil = await albSupabase.from('profiles').select('prenom, nom, nom_entreprise, email, telephone').eq('id', monId).maybeSingle();
    etat.defauts = defautsCompte(rProfil.data || {});
    const { data, error } = await albSupabase.rpc('alb_pro_questionnaire_lire', { p_id: qid });
    if (error || !data) { console.log('[ALB DEBUG] questionnaire sans annonce : lecture impossible', error); return; }
    etat.qid = qid;
    await afficherFormulaire(data.type_bien, data);
  }

  // Jocelyne prépare un questionnaire vierge pour une personne qui n'a pas (encore) d'annonce
  async function ouvrirPourAdminMembre(profileId, quandFerme) {
    styles();
    surFermetureAdmin = quandFerme || null;
    const { data, error } = await albSupabase.rpc('alb_admin_questionnaire_charger_membre', { p_profile_id: profileId });
    if (error || !data) { console.log('[ALB DEBUG] questionnaire admin : membre introuvable', error); alert('La personne n\u2019a pas été trouvée.'); return; }
    etat = { annonce: { id: null }, qid: null, type: null, modifie: false, nbPhotos: 0, photos: [], defauts: defautsCompte(data.profil || {}), admin: true, adminParId: true, adminMembre: profileId, dejaEnvoye: false };
    afficherChoixType(true);
  }

  // ---------- Dans « Mes annonces » ----------
  async function charger() {
    const r1 = await albSupabase.from('annonces').select('id, titre, type_vente, statut, type_bien').eq('vendeur_id', monId);
    const r2 = await albSupabase.rpc('alb_pro_mes_questionnaires');
    if (r2.error) throw r2.error;
    annonces = r1.data || [];
    questionnaires = r2.data || [];
  }

  async function rafraichir() {
    try { await charger(); } catch (ex) { /* on garde l'affichage précédent */ }
    document.querySelectorAll('.mqb-ajout').forEach(function (n) { n.parentNode.removeChild(n); });
    injecter();
  }

  // Les questionnaires préparés avec Jocelyne, qui ne sont pas liés à une annonce
  function injecterSansAnnonce(zone) {
    const sans = questionnaires.filter(function (q) { return !q.annonce_id; });
    const ancien = zone.querySelector('.mqb-sans');
    if (!sans.length) { if (ancien) ancien.parentNode.removeChild(ancien); return; }
    const html = '<div class="mqb-offre-titre">Questionnaire préparé avec Jocelyne</div>' +
      '<p>Vérifiez-le, complétez-le si besoin, puis envoyez-le : vous seul(e) décidez.</p><div class="mqb-offre-boutons">' +
      sans.map(function (q) {
        const nom = TYPES_LIBELLE[q.type_bien] || 'bien';
        const lib = q.statut === 'envoye' ? '✅ Questionnaire envoyé' : '📝 Continuer le questionnaire';
        return '<button type="button" class="ma-btn' + (q.statut === 'envoye' ? '' : ' ma-btn-oui') + '" data-mqb-sans="' + e(q.id) + '">' + lib + ' (' + e(q.adresse || nom) + ')</button>';
      }).join('') + '</div>';
    if (ancien && ancien.dataset.sig === html) return;
    if (ancien) ancien.parentNode.removeChild(ancien);
    const w = document.createElement('div');
    w.className = 'mqb-offre mqb-sans';
    w.dataset.sig = html;
    w.innerHTML = html;
    zone.insertBefore(w, zone.firstChild);
  }

  function injecter() {
    const zoneAnnonces = document.getElementById('mes-annonces');
    if (!estPro || !zoneAnnonces) return;
    injecterSansAnnonce(zoneAnnonces);
    zoneAnnonces.querySelectorAll('.ma-annonce').forEach(function (carte) {
      if (carte.querySelector('.mqb-ajout')) return;
      const id = String(carte.id || '').replace(/^ma-/, '');
      const a = annonces.find(function (x) { return x.id === id; });
      if (!a || a.type_vente !== 'accompagnee' || a.statut === 'vendu' || a.statut === 'refusee') return;
      const q = questionnaires.find(function (x) { return x.annonce_id === id; });
      const ferme = memoire('alb-mqb-ferme-' + id) === '1';
      let html = '';
      if (!q && !ferme) {
        html = '<div class="mqb-offre"><div class="mqb-offre-titre">Besoin d’aide pour rédiger la description ?</div>' +
          '<p>Remplissez le questionnaire du bien : Jocelyne s’appuie dessus pour vous proposer un texte. C’est facultatif.</p>' +
          '<div class="mqb-offre-boutons"><button type="button" class="ma-btn ma-btn-oui" data-mqb-ouvrir="' + e(id) + '">Remplir le questionnaire</button>' +
          '<button type="button" class="ma-btn" data-mqb-complete="' + e(id) + '">Mon annonce est complète</button></div></div>';
      } else {
        const libelle = q && q.statut === 'envoye' ? '✅ Questionnaire envoyé' : q ? '📝 Continuer le questionnaire du bien' : '📝 Questionnaire du bien';
        html = '<div class="mqb-offre-boutons"><button type="button" class="ma-btn" data-mqb-ouvrir="' + e(id) + '">' + libelle + '</button></div>';
      }
      const w = document.createElement('div');
      w.className = 'mqb-ajout';
      w.innerHTML = html;
      const ref = carte.querySelector('.ma-boutons');
      if (ref) carte.insertBefore(w, ref); else carte.appendChild(w);
    });
  }

  document.addEventListener('click', function (ev) {
    const s = ev.target.closest && ev.target.closest('[data-mqb-sans]');
    if (s) { ouvrirSansAnnonce(s.dataset.mqbSans); return; }
    const o = ev.target.closest && ev.target.closest('[data-mqb-ouvrir]');
    if (o) { ouvrir(o.dataset.mqbOuvrir); return; }
    const c = ev.target.closest && ev.target.closest('[data-mqb-complete]');
    if (c) {
      memoire('alb-mqb-ferme-' + c.dataset.mqbComplete, '1');
      const w = c.closest('.mqb-ajout');
      if (w && w.parentNode) w.parentNode.removeChild(w);
      injecter();
    }
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && racine) fermer(); });

  // ---------- Styles ----------
  function styles() {
    if (document.getElementById('mqb-styles')) return;
    const s = document.createElement('style');
    s.id = 'mqb-styles';
    s.textContent = [
      '.mqb-flag{float:right;border:1px solid #E5C770;background:#FFF6DC;color:#7A5B00;border-radius:12px;font-size:.72rem;padding:2px 8px;cursor:pointer;margin:0 0 4px 8px;}',
      '.mqb-flag.actif{background:#E5A100;color:#fff;border-color:#E5A100;}',
      '.mqb-manque{background:#FFF6DC !important;outline:2px solid #E5C770;border-radius:6px;padding:6px;}',
      '.mqb-offre{background:#F4EEF6;border:1px solid #D9C9E0;border-radius:8px;padding:12px;margin-top:12px;}',
      '.mqb-offre-titre{font-weight:700;color:#5A3A6A;}',
      '.mqb-offre p{font-size:.9rem;margin:4px 0 10px;}',
      '.mqb-offre-boutons{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}',
      '.mqb-offre .mqb-offre-boutons{margin-top:0;}',
      '.mqb-fond{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;justify-content:center;}',
      '.mqb-boite{background:#FFFFFF;width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;}',
      '.mqb-tete{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #E8E6E1;color:#5A3A6A;}',
      '.mqb-x{border:none;background:none;font-size:1.3rem;cursor:pointer;padding:4px 10px;color:#4A4A47;}',
      '.mqb-corps{flex:1;overflow-y:auto;padding:16px;}',
      '.mqb-pied{border-top:1px solid #E8E6E1;padding:10px 16px;background:#FBF8F3;}',
      '.mqb-boutons{display:flex;flex-direction:column;gap:8px;}',
      '.mqb-intro{font-size:.92rem;color:#6a6a65;margin-bottom:8px;}',
      '.mqb-section{margin-bottom:22px;}',
      '.mqb-section h3{background:#5A3A6A;color:#FFFFFF;padding:8px 12px;border-radius:6px;font-size:1rem;margin-bottom:10px;}',
      '.mqb-sous{font-weight:700;color:#5A3A6A;font-size:.9rem;margin:14px 0 6px;}',
      '.mqb-sous2{font-weight:700;background:#FBF8F3;border-radius:4px;padding:4px 8px;font-size:.85rem;margin:10px 0 4px;}',
      '.mqb-note{font-size:.85rem;color:#6a6a65;margin:6px 0 10px;}',
      '.mqb-grille{display:grid;grid-template-columns:1fr;gap:0 12px;}',
      '.mqb-champ{margin-bottom:10px;}',
      '.mqb-champ label,.mqb-ligne label{display:block;font-size:.85rem;font-weight:600;color:#4A4A47;margin-bottom:3px;}',
      '.mqb-champ input,.mqb-champ select,.mqb-champ textarea,.mqb-ligne select,.mqb-ligne input,.mqb-travail select,.mqb-travail input{width:100%;box-sizing:border-box;font:inherit;padding:8px;border:1px solid #D8D5CE;border-radius:6px;background:#FFFFFF;}',
      '.mqb-cases{display:grid;grid-template-columns:1fr;gap:4px 12px;}',
      '.mqb-case{display:flex;align-items:flex-start;gap:8px;font-size:.9rem;padding:4px 0;cursor:pointer;}',
      '.mqb-case input[type="checkbox"]{margin-top:3px;flex-shrink:0;}',
      '.mqb-trou{width:7em;max-width:100%;margin:0 4px;padding:2px 6px;font:inherit;border:1px solid #D8D5CE;border-radius:4px;}',
      '.mqb-ligne{display:grid;grid-template-columns:1fr;gap:4px;padding:6px 0;border-bottom:1px solid #F0EFEC;font-size:.9rem;}',
      '.mqb-ligne small{font-weight:400;color:#6a6a65;}',
      '.mqb-travail{padding:8px 0;border-bottom:1px solid #F0EFEC;}',
      '.mqb-travail-nom{font-weight:600;font-size:.9rem;margin-bottom:4px;}',
      '.mqb-travail .mqb-grille{gap:6px 10px;}',
      '.mqb-piece{border:1px solid #E8E6E1;border-radius:8px;margin-bottom:6px;background:#FFFFFF;}',
      '.mqb-piece summary{cursor:pointer;padding:9px 12px;display:flex;justify-content:space-between;gap:10px;font-size:.92rem;}',
      '.mqb-resume{color:#2E6B34;font-size:.82rem;}',
      '.mqb-piece-corps{padding:4px 12px 12px;}',
      '.mqb-msg{font-size:.88rem;margin-bottom:8px;display:none;}',
      '.mqb-msg.visible{display:block;}',
      '.mqb-msg.erreur{color:#8A2D2D;}',
      '.mqb-msg.info{color:#2E6B34;}',
      '.mqb-choix{display:grid;grid-template-columns:1fr;gap:10px;margin-top:14px;}',
      '.mqb-grand{border:1px solid #D8D5CE;background:#FBF8F3;border-radius:10px;padding:18px 10px;font:inherit;font-weight:600;cursor:pointer;}',
      '.mqb-grand:hover{border-color:#5A3A6A;background:#F4EEF6;}',
      '.mqb-fin{text-align:center;padding:30px 10px;}',
      '.mqb-fin h3{color:#5A3A6A;margin-bottom:8px;}',
      '.mqb-boutons-ligne{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;}',
      '.mqb-case.mqb-erreur{color:#B00020;font-weight:700;border:2px solid #B00020;border-radius:6px;padding:6px 8px;background:#FDF0F0;}',
      '.mqb-ajouter{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border:1.5px dashed #5A3A6A;border-radius:6px;background:#FFFFFF;color:#5A3A6A;font:inherit;font-weight:600;cursor:pointer;margin:4px 0 10px;}',
      '.mqb-supprimer{margin-top:6px;min-height:36px;padding:0 12px;border:1px solid #D8B4B4;border-radius:6px;background:#FFFFFF;color:#8A2D2D;font:inherit;font-size:.85rem;font-weight:600;cursor:pointer;}',
      '.mqb-panneau{border:2px solid #5A3A6A;border-radius:10px;background:#FFFFFF;padding:16px;margin-bottom:10px;}',
      '.mqb-panneau-titre{font-size:1.05rem;font-weight:700;color:#5A3A6A;margin-bottom:4px;}',
      '.mqb-chips{display:flex;flex-wrap:wrap;gap:8px;}',
      '.mqb-chip{cursor:pointer;}',
      '.mqb-chip input{position:absolute;opacity:0;pointer-events:none;}',
      '.mqb-chip span{display:inline-block;padding:7px 12px;border:1px solid #D8D5CE;border-radius:999px;font-size:.88rem;background:#FFFFFF;}',
      '.mqb-chip input:checked+span{background:#5A3A6A;border-color:#5A3A6A;color:#FFFFFF;}',
      '.mqb-chip input:focus-visible+span{outline:2px solid #B28E3D;outline-offset:2px;}',
      '@media (min-width:700px){',
      '.mqb-boite{max-width:860px;height:auto;max-height:92vh;margin:4vh 16px;border-radius:12px;}',
      '.mqb-grille{grid-template-columns:1fr 1fr;}',
      '.mqb-cases{grid-template-columns:1fr 1fr;}',
      '.mqb-ligne{grid-template-columns:1.3fr 1fr;align-items:center;}',
      '.mqb-dist{grid-template-columns:1.2fr 1.2fr 1fr;}',
      '.mqb-boutons{flex-direction:row;justify-content:flex-end;}',
      '.mqb-choix{grid-template-columns:1fr 1fr;}',
      '}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------- Démarrage : attend la connexion, repère les pros, surveille « Mes annonces » ----------
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
        estPro = true;
        styles();
        surveiller();
        setInterval(surveiller, 3000);
        return;
      } catch (ex) {
        if (String((ex && ex.message) || ex).indexOf('PAS_PRO') !== -1) return; // pas un pro : rien à faire
      }
      if (essais < 40) setTimeout(tour, 3000);
    };
    tour();
  }

  window.albQuestionnaireBien = { ouvrir: ouvrir, ouvrirPourAdmin: ouvrirPourAdmin, ouvrirPourAdminId: ouvrirPourAdminId, ouvrirPourAdminMembre: ouvrirPourAdminMembre };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();

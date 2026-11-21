// ============================================================
// annonce-proposee.js — « Annonce proposée » à partir d'un questionnaire de bien
// Transforme les réponses d'un questionnaire (particulier ou pro) en une annonce
// structurée : l'intérieur par niveau, l'extérieur, bon à savoir (les plus et les
// moins), les chiffres, les travaux, autour. Tout ce que le vendeur a déclaré pour
// le bien y figure, dans l'ordre, sans rien inventer.
//
// CONFIDENTIALITÉ : par défaut, une réponse n'est PAS publiée. Seules les réponses
// reconnues comme des informations du bien passent dans l'annonce. Les informations
// privées (nom, téléphone, e-mail, adresse précise, code d'accès, raison de la vente,
// mandats, prêt, historique de la vente, accords) n'y entrent jamais. Une réponse
// que le générateur ne reconnaît pas reste dans « À vérifier », jamais dans l'annonce.
//
// Utilisation : albAnnonceProposee.creer(questionnaire) renvoie
//   { texte, blocs, accroche, pourJoce }
// où `texte` est l'annonce prête à relire et à copier, et `pourJoce` ce qui reste
// visible seulement par Jocelyne (ses mots, à décider, à vérifier, non publié).
// Aucun accès à Supabase : ce fichier ne fait que lire le questionnaire qu'on lui donne.
// ============================================================
(function (global) {
  'use strict';

  const SEP = ' · ';

  // ---------- Listes de référence (les mêmes que dans les questionnaires) ----------
  const SOL = ['Carrelage', 'Parquet', 'Stratifié', 'Pierre, tomette'];
  const EQUIP_PIECE = ['Placard', 'Clim.'];
  const FENETRES = ['Simple vitrage', 'Double vitrage', 'PVC', 'Aluminium', 'Bois', 'Volets'];
  const CUISINE_TYPE = ['Ouverte sur le séjour', 'Fermée', 'Américaine (avec bar)', 'Îlot central'];
  const CUISINE_EQ = ['Entièrement équipée', 'Aménagée (meubles, sans électroménager)', 'Non équipée'];
  const CUISINE_DEDANS = ['Plaque gaz', 'Plaque induction', 'Plaque électrique, vitrocéramique', 'Four', 'Four micro-ondes', 'Hotte', 'Réfrigérateur', 'Congélateur', 'Lave-vaisselle', 'Lave-linge', 'Meubles hauts et bas', 'Plan de travail', 'Évier', 'Cellier, arrière-cuisine'];
  const SALLES = ['Baignoire', 'Douche', "Douche à l'italienne", 'Lavabo', 'Double vasque', 'Meuble vasque', 'WC', 'Bidet', 'Sèche-serviettes'];
  const DISTANCES = ['À pied, moins de 5 min', 'À pied, moins de 15 min', 'En voiture, moins de 10 min', 'Plus loin'];
  const ORDRE_NIVEAUX = ['Sous-sol', 'RDC', 'Niveau 1', '1er étage', 'Niveau 2', '2e étage', '3e étage', 'Mezzanine', 'Duplex'];
  const NOM_NIVEAU = { 'RDC': 'Rez-de-chaussée' };

  const TYPES_BIEN = { appartement: 'Appartement', maison: 'Maison', village: 'Maison de village' };

  const GROUPES_ENVIRONS = [
    ['Commerces', ['Boulangerie, petits commerces', 'Supermarché']],
    ['Écoles', ['Crèche, maternelle, primaire', 'Collège, lycée']],
    ['Santé', ['Médecin, pharmacie', 'Hôpital, urgences']],
    ['Transports', ['Arrêt de bus', 'Gare', 'Autoroute, grand axe']],
    ['Nature et loisirs', ['Plage, mer', 'Rivière, lac', 'Forêt, randonnées', 'Parc, aire de jeux', 'Sport (stade, piscine)', 'Restaurants, cafés']],
    ['Services', ['Mairie, poste', 'Banque, distributeur', 'Place du village, marché']],
  ];
  const LIBELLES_ENVIRONS = [].concat.apply([], GROUPES_ENVIRONS.map(function (g) { return g[1]; }));

  const DIAGNOSTICS = ['Amiante', 'Plomb', 'Termites', 'Gaz', 'Électricité', 'Risques naturels et technologiques', 'Assainissement', 'Audit énergétique', 'Mesurage loi Carrez'];
  const POSTES_TRAVAUX = ['Toiture', 'Façade', 'Isolation', 'Fenêtres, volets', 'Chauffage, eau chaude', 'Électricité', 'Plomberie', 'Assainissement', 'Cuisine', 'Salle de bains', 'Salle(s) de bains', 'Sols', 'Peintures', 'Humidité, fissures', 'Autre poste (à préciser dans les remarques)'];

  // Sections entièrement privées : on ne publie rien de ce qui s'y trouve
  const SECTIONS_PRIVEES = {
    'Vous': 'coordonnées du vendeur et accès au bien',
    'Vous et le bien': 'coordonnées, mandat et accès au bien',
    'Votre situation': 'situation du vendeur',
    'Votre bien et les agences': 'mandat',
    'Mandat, vente et prix': 'mandat et historique de la vente',
    'La vente': 'historique de la vente',
    'Photos et vidéos': 'photos et vidéos (elles se gèrent dans l’annonce)',
    'Ce que vous attendez de nous': 'attentes et accords du vendeur',
  };

  // ---------- Petits outils ----------
  function texteDe(v) { return String(v == null ? '' : v).trim(); }

  // Retire les « trous » non remplis (« Toiture : … », « (voitures : …) »)
  function sansTrous(t) {
    return t.replace(/\s*\([^()]*…[^()]*\)/g, '').replace(/\s*:\s*…/g, '').replace(/\s*…/g, '').replace(/\s+/g, ' ').trim();
  }
  function morceaux(v) {
    return texteDe(v).split(SEP).map(function (s) { return sansTrous(s.trim()); }).filter(Boolean);
  }
  function morceauxBruts(v) {
    return texteDe(v).split(SEP).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  // « Parquet » devient « parquet », mais « PVC » et « DPE » restent en majuscules
  function enMinuscule(t) {
    const s = texteDe(t);
    if (!s) return s;
    if (/^[A-ZÀ-Ý0-9]{2,}\b/.test(s)) return s;
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  function majuscule(t) {
    const s = texteDe(t);
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }
  function nombreDe(t) {
    const s = String(t == null ? '' : t).replace(/[\s  ]/g, '').replace(',', '.');
    return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null;
  }
  function milliers(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function montant(t, unite) {
    const n = nombreDe(t);
    return n === null ? texteDe(t) : milliers(n) + ' ' + unite;
  }
  function surface(t) {
    const n = nombreDe(t);
    if (n !== null) return String(n).replace('.', ',') + ' m²';
    const s = texteDe(t);
    return /m²/.test(s) ? s : s + ' m²';
  }
  function apostrophes(t) { return String(t).replace(/’/g, "'"); }
  function listeFr(tab) { return tab.join(', '); }

  // ---------- Une pièce devient une ligne ----------
  function lignePiece(nom, valeur) {
    let niveau = '', m2 = '', notes = '';
    const sols = [], equip = [], fen = [], cuisType = [], cuisEq = [], cuisDedans = [], salle = [], autres = [];
    morceauxBruts(valeur).forEach(function (j) {
      if (ORDRE_NIVEAUX.indexOf(j) !== -1) niveau = j;
      else if (/^[\d.,]+ m²$/.test(j)) m2 = surface(j.replace(' m²', ''));
      else if (j.indexOf('Notes : ') === 0) notes = j.slice(8).trim();
      else if (SOL.indexOf(j) !== -1) sols.push(j);
      else if (EQUIP_PIECE.indexOf(j) !== -1) equip.push(j);
      else if (FENETRES.indexOf(j) !== -1) fen.push(j);
      else if (CUISINE_TYPE.indexOf(j) !== -1) cuisType.push(j);
      else if (CUISINE_EQ.indexOf(j) !== -1) cuisEq.push(j);
      else if (CUISINE_DEDANS.indexOf(j) !== -1) cuisDedans.push(j);
      else if (SALLES.indexOf(j) !== -1) salle.push(j);
      else autres.push(j);
    });

    const c = [];
    if (m2) c.push(m2);
    sols.forEach(function (s) { c.push('sol en ' + (s === 'Pierre, tomette' ? 'pierre ou tomette' : enMinuscule(s))); });
    equip.forEach(function (x) { c.push(x === 'Clim.' ? 'climatisation' : enMinuscule(x)); });

    if (cuisEq.length || cuisDedans.length) {
      const eq = cuisEq.map(enMinuscule).join(', ');
      const dedans = cuisDedans.map(enMinuscule).join(', ');
      if (eq && dedans) {
        // « Entièrement équipée (plaque induction, four…) » : on dit de quoi elle est équipée
        c.push(cuisEq[0] === 'Entièrement équipée' ? eq + ' (' + dedans + ')' : eq + ', avec ' + dedans);
      } else if (eq) c.push(eq);
      else c.push('équipements : ' + dedans);
    }
    cuisType.forEach(function (x) { c.push(enMinuscule(x)); });
    if (salle.length) c.push(salle.map(enMinuscule).join(', '));
    if (fen.length) c.push('fenêtres : ' + fen.map(enMinuscule).join(', '));
    autres.forEach(function (x) { c.push(sansTrous(x)); });
    if (notes) c.push(notes);

    return { niveau: niveau, texte: nom + (c.length ? ' : ' + c.join(', ') : '') };
  }

  // Les pièces, regroupées par niveau (rez-de-chaussée, étages…)
  function sousBlocsPieces(pieces) {
    const parNiveau = {};
    const ordre = [];
    Object.keys(pieces).forEach(function (nom) {
      const p = lignePiece(nom, pieces[nom]);
      const cle = p.niveau || '';
      if (!parNiveau[cle]) { parNiveau[cle] = []; ordre.push(cle); }
      parNiveau[cle].push(p.texte);
    });
    ordre.sort(function (a, b) {
      if (a === '') return 1;
      if (b === '') return -1;
      return ORDRE_NIVEAUX.indexOf(a) - ORDRE_NIVEAUX.indexOf(b);
    });
    // Un seul niveau (ou aucun) : pas de titre de niveau, juste la liste
    if (ordre.length === 1) return [{ titre: '', lignes: parNiveau[ordre[0]] }];
    return ordre.map(function (cle) {
      return { titre: cle === '' ? 'Autres pièces' : (NOM_NIVEAU[cle] || cle), lignes: parNiveau[cle] };
    });
  }

  // ---------- Où va chaque réponse ? ----------
  function classer(section, labelBrut) {
    const l = apostrophes(labelBrut);
    if (/^Le point fort/.test(l)) return 'point_fort';
    if (/^Le point d'attention/.test(l)) return 'point_attention';
    if (section === 'À vous la parole' || /^Autre chose à nous dire/.test(l)) return 'mots';
    if (section === 'La vente' && l === 'Prix demandé (€)') return 'prix';
    if (section === 'La vente' && l === 'Le prix') return 'decider';
    if (SECTIONS_PRIVEES[section]) return 'prive';
    if (section === 'Pièce par pièce') return 'pieces';

    if (l === 'Prix de vente (€)') return 'prix';
    if (l === 'Prix') return 'decider';
    if (/^Honoraires \(/.test(l)) return 'honoraires';
    if (l === 'Honoraires à la charge') return 'honoraires_charge';
    if (l === 'Prêt en cours sur le bien') return 'pret';
    if (l === 'Diffusion par ALB') return 'prive';
    if (/^Loyer mensuel/.test(l)) return 'loyer';
    if (/^(Taxe foncière|Eau, électricité|Charges de copropriété|Autres charges)/.test(l)) return 'cout';

    if (l === 'État général') return 'etat';
    if (l === 'Niveaux') return 'int_niveaux';
    if (l === 'Dans la maison') return 'int_caractere';
    if (['Terrain', 'Piscine', 'Portail', 'Portail et entrée', 'Dépendances', 'Extérieur', 'Extérieur et annexes', 'Annexes'].indexOf(l) !== -1) return 'ext_cases';
    if (['Accès', "Entrée de l'immeuble", 'Étage et accès', 'Où se garer ?', 'Accès à la maison', 'Voisinage'].indexOf(l) !== -1) return 'pratique';
    if (l === 'Copropriété') return 'copro';
    if (['Chauffage', 'Eau chaude', 'Autres équipements', 'Eaux usées'].indexOf(l) !== -1) return 'equip';
    if (/^Dernière vidange/.test(l) || /^Contrôle de la commune/.test(l)) return 'assain_extra';
    if (l === 'Problèmes connus') return 'problemes';
    if (l === 'Nuisances connues') return 'nuisances';
    if (/^Diagnostic énergie \(DPE\)/.test(l)) return 'dpe';
    if (/^Gaz à effet de serre/.test(l)) return 'ges';
    if (section !== 'Travaux, plus et moins' && DIAGNOSTICS.indexOf(l) !== -1) return 'diag';
    if (['Le lieu', "L'ambiance", 'Exposition et vue'].indexOf(l) !== -1) return 'situation';
    if (/^Travaux déjà faits/.test(l)) return 'travaux_faits';
    if (/^(Avez-vous gardé les factures|Factures des travaux gardées)/.test(l)) return 'factures';
    if (/^Travaux que vous savez devoir faire/.test(l)) return 'travaux_prevoir';
    if (/^Les plus du bien/.test(l)) return 'plus';
    if (/^Les moins du bien/.test(l)) return 'moins';
    if (section === 'Travaux, plus et moins' && POSTES_TRAVAUX.indexOf(l) !== -1) return 'poste';
    if (section === 'Les environs' && LIBELLES_ENVIRONS.indexOf(l) !== -1) return 'dist';

    // Les champs chiffrés (surface, pièces, terrain, balcon…)
    if (/m²|^Nombre|^Étage|^Étages|^Année|^Salles de bains|^Chambres$|^Autre \(à préciser\)$|Appartements dans/.test(l)) {
      return /(Terrain|Superficie du terrain|^Extérieur|balcon|terrasse|jardin|cour\b|Surface de l'extérieur)/i.test(l) && /m²/.test(l) ? 'ext_champs' : 'bref_champs';
    }
    return 'inconnu';
  }

  function ligneChampChiffre(labelBrut, valeur) {
    let nom = apostrophes(labelBrut).replace(/\s+en m²$/, '').replace(/\s*\(m²\)$/, '').replace(/^Extérieur : /, '');
    if (nom === 'Autre (à préciser)') nom = 'Autres pièces';
    if (nom === 'Chambres') nom = 'Chambres';
    const v = /m²/.test(labelBrut) ? surface(valeur) : texteDe(valeur);
    return majuscule(nom) + ' : ' + v;
  }

  function ligneCout(labelBrut, valeur) {
    const l = apostrophes(labelBrut);
    const v = texteDe(valeur);
    let nom = l.replace(/\s*\((€[^)]*)\)\s*$/, '').replace(/\s*à préciser\s*$/, '').replace(/,\s*à préciser/, '').trim();
    if (/^Autres charges/.test(l)) nom = 'Autres charges';
    let unite = /par mois/.test(l) ? '€ par mois' : '€ par an';
    return nom + ' : ' + montant(v, unite);
  }

  function texteDiagnostic(statut) {
    if (statut === 'Fait') return 'réalisé';
    if (statut === 'À faire') return 'à réaliser';
    return 'à confirmer';
  }

  // Une réponse à cocher devient une liste de petits morceaux lisibles
  function jetonsLisibles(v) {
    return morceaux(v).map(function (t) { return enMinuscule(t); });
  }

  function ligneDistance(libelle, valeur) {
    let dist = '', nom = '';
    morceauxBruts(valeur).forEach(function (j) {
      if (j.indexOf('Nom : ') === 0) nom = j.slice(6).trim();
      else if (DISTANCES.indexOf(j) !== -1) dist = enMinuscule(j);
    });
    if (!dist && !nom) return '';
    return libelle + ' : ' + [dist, nom ? '(' + nom + ')' : ''].filter(Boolean).join(' ');
  }

  // ---------- L'annonce ----------
  function creer(q) {
    q = q || {};
    const rep = (q.reponses && typeof q.reponses === 'object') ? q.reponses : {};
    const estPro = q.origine !== 'particulier';
    const typeBien = TYPES_BIEN[q.type_bien] || 'Bien';

    const k = {
      pieces: {}, bref: [], etat: '', ext: [], intNiveaux: '', intCaractere: '',
      plus: [], moins: [], pointFort: '', pointAttention: '',
      pratique: [], copro: '', equip: {}, assainExtra: [], problemes: '', nuisances: '',
      dpe: '', ges: '', diag: [], situation: [],
      prix: '', honoraires: '', honorairesCharge: '', couts: [], loyer: '',
      faits: [], aPrevoir: [], postesFaits: [], postesAPrevoir: [], factures: '',
      dist: {},
    };
    const pourJoce = { mots: [], decider: [], aVerifier: [], nonPublie: [], cible: '' };
    const nonPublieParRaison = {};

    function noterPrive(raison, label) {
      if (!nonPublieParRaison[raison]) nonPublieParRaison[raison] = [];
      nonPublieParRaison[raison].push(label);
    }

    Object.keys(rep).forEach(function (section) {
      const bloc = rep[section];
      if (!bloc || typeof bloc !== 'object' || Array.isArray(bloc)) return;
      Object.keys(bloc).forEach(function (label) {
        const valeur = bloc[label];
        const texte = texteDe(valeur);
        if (!texte) return;
        const ou = classer(section, label);

        if (ou === 'pieces') { k.pieces[label] = valeur; return; }
        if (ou === 'prive') { noterPrive(SECTIONS_PRIVEES[section] || 'attentes et accords du vendeur', label); return; }
        if (ou === 'pret') { noterPrive('prêt en cours', label); return; }
        if (ou === 'mots') { pourJoce.mots.push({ question: label, texte: texte }); return; }
        if (ou === 'decider') { pourJoce.decider.push({ question: label, reponse: morceaux(valeur).join(', ') }); return; }
        if (ou === 'inconnu') { pourJoce.aVerifier.push('Réponse non reprise (jamais publiée sans ton accord) : « ' + label + ' »'); return; }

        if (ou === 'point_fort') k.pointFort = texte;
        else if (ou === 'point_attention') k.pointAttention = texte;
        else if (ou === 'prix') k.prix = texte;
        else if (ou === 'honoraires') { if (estPro) k.honoraires = texte; else noterPrive('honoraires (réservés aux annonces de pros)', label); }
        else if (ou === 'honoraires_charge') { if (estPro) k.honorairesCharge = texte; }
        else if (ou === 'loyer') k.loyer = texte;
        else if (ou === 'cout') k.couts.push(ligneCout(label, valeur));
        else if (ou === 'etat') k.etat = morceaux(valeur).join(', ');
        else if (ou === 'bref_champs') k.bref.push(ligneChampChiffre(label, valeur));
        else if (ou === 'ext_champs') k.ext.push(ligneChampChiffre(label, valeur));
        else if (ou === 'int_niveaux') k.intNiveaux = jetonsLisibles(valeur).join(', ');
        else if (ou === 'int_caractere') k.intCaractere = jetonsLisibles(valeur).join(', ');
        else if (ou === 'ext_cases') k.ext.push(majuscule(apostrophes(label)) + ' : ' + jetonsLisibles(valeur).join(', '));
        else if (ou === 'pratique') k.pratique.push({ nom: label === 'Où se garer ?' ? 'Stationnement' : apostrophes(label), texte: jetonsLisibles(valeur).join(', ') });
        else if (ou === 'copro') k.copro = jetonsLisibles(valeur).join(', ');
        else if (ou === 'equip') k.equip[label] = jetonsLisibles(valeur);
        else if (ou === 'assain_extra') {
          const l2 = apostrophes(label);
          if (/^Dernière vidange/.test(l2)) k.assainExtra.push('dernière vidange : ' + texte);
          else k.assainExtra.push('contrôle de la commune : ' + enMinuscule(texte));
        }
        else if (ou === 'problemes') k.problemes = morceaux(valeur);
        else if (ou === 'nuisances') k.nuisances = morceaux(valeur);
        else if (ou === 'dpe') k.dpe = texte;
        else if (ou === 'ges') k.ges = texte;
        else if (ou === 'diag') k.diag.push({ nom: label, statut: texte });
        else if (ou === 'situation') k.situation.push({ nom: apostrophes(label) === "L'ambiance" ? 'Ambiance' : label, texte: jetonsLisibles(valeur).join(', ') });
        else if (ou === 'travaux_faits') k.faits = morceaux(valeur).filter(function (t) { return t !== 'Aucun'; });
        else if (ou === 'travaux_prevoir') k.aPrevoir = texte.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
        else if (ou === 'factures') k.factures = texte;
        else if (ou === 'plus') k.plus = morceaux(valeur);
        else if (ou === 'moins') k.moins = morceaux(valeur);
        else if (ou === 'poste') {
          // « Déjà refait · Année : 2018 · Coût : 5000 € · Remarques : … »
          let etat = '', annee = '', cout = '', rem = '';
          morceauxBruts(valeur).forEach(function (j) {
            if (/^(Déjà refait|Rien à prévoir|À rafraîchir|À refaire)$/.test(j)) etat = j;
            else if (j.indexOf('Année : ') === 0) annee = j.slice(8).trim();
            else if (j.indexOf('Coût : ') === 0) cout = j.slice(7).trim();
            else if (j.indexOf('Remarques : ') === 0) rem = j.slice(12).trim();
          });
          const nomPoste = apostrophes(label).replace(/\s*\(à préciser dans les remarques\)/, '');
          if (etat === 'Déjà refait') k.postesFaits.push(nomPoste + (annee ? ' (' + annee + ')' : '') + (rem ? ' — ' + rem : ''));
          else if (etat === 'À rafraîchir' || etat === 'À refaire') {
            k.postesAPrevoir.push(nomPoste + ' : ' + enMinuscule(etat) + (cout ? ' (coût estimé : ' + montant(cout.replace(/\s*€$/, ''), '€') + ')' : '') + (rem ? ' — ' + rem : ''));
          }
        }
        else if (ou === 'dist') k.dist[label] = valeur;
      });
    });

    // ----- Titre et accroche factuelle -----
    const commune = texteDe(
      (rep['Vous'] && rep['Vous']['Commune']) ||
      (rep['Vous et le bien'] && rep['Vous et le bien']['Commune']) ||
      (q.annonce && q.annonce.ville) || ''
    );
    const titre = typeBien + (commune ? ' à ' + commune : '');

    function champ(re) {
      for (let i = 0; i < k.bref.length; i++) { if (re.test(k.bref[i])) return k.bref[i].split(' : ').slice(1).join(' : '); }
      return '';
    }
    function champExt(re) {
      for (let i = 0; i < k.ext.length; i++) { if (re.test(k.ext[i])) return k.ext[i].split(' : ').slice(1).join(' : '); }
      return '';
    }
    const surfaceHab = champ(/^Surface habitable/);
    const nbPieces = champ(/^Nombre de pièces/);
    const nbChambres = champ(/^(Nombre de chambres|Chambres)/);
    const terrain = champExt(/^(Superficie du terrain|Terrain)/);

    const morceauxAccroche = [];
    morceauxAccroche.push(typeBien + (surfaceHab ? ' de ' + surfaceHab : '') + (commune ? ' à ' + commune : ''));
    const detailPieces = [];
    if (nbPieces) detailPieces.push(nbPieces + ' pièce' + (nombreDe(nbPieces) > 1 ? 's' : ''));
    if (nbChambres) detailPieces.push((detailPieces.length ? 'dont ' : '') + nbChambres + ' chambre' + (nombreDe(nbChambres) > 1 ? 's' : ''));
    if (detailPieces.length) morceauxAccroche.push(detailPieces.join(' '));
    if (terrain) morceauxAccroche.push('sur un terrain de ' + terrain);
    const accroche = morceauxAccroche.join(', ') + '.';

    // ----- Les blocs de l'annonce -----
    const blocs = [];

    // Le bien en bref
    const bref = k.bref.slice();
    if (k.etat) bref.push('État général : ' + k.etat);
    if (bref.length) blocs.push({ emoji: '📐', titre: 'Le bien en bref', lignes: bref, sousBlocs: [] });

    // L'intérieur : par niveau, une ligne par pièce
    const interieur = { emoji: '🏠', titre: 'L’intérieur', lignes: [], sousBlocs: [] };
    if (k.intNiveaux) interieur.lignes.push('Niveaux : ' + k.intNiveaux);
    if (k.intCaractere) interieur.lignes.push('À noter dans la maison : ' + k.intCaractere);
    if (Object.keys(k.pieces).length) interieur.sousBlocs = sousBlocsPieces(k.pieces);
    if (interieur.lignes.length || interieur.sousBlocs.length) blocs.push(interieur);

    // L'extérieur
    if (k.ext.length) blocs.push({ emoji: '🌿', titre: 'L’extérieur', lignes: k.ext, sousBlocs: [] });

    // Bon à savoir : les plus, les moins, le pratique, les diagnostics
    const savoir = { emoji: '✅', titre: 'Bon à savoir', lignes: [], sousBlocs: [] };
    const lesPlus = k.plus.slice();
    if (k.pointFort) lesPlus.push(k.pointFort);
    if (lesPlus.length) savoir.sousBlocs.push({ titre: 'Les plus', lignes: lesPlus });

    const lesMoins = k.moins.slice();
    (k.nuisances || []).filter(function (t) { return !/^aucun/i.test(t); }).forEach(function (t) { lesMoins.push('Nuisance : ' + enMinuscule(t)); });
    (k.problemes || []).filter(function (t) { return !/^aucun/i.test(t); }).forEach(function (t) { lesMoins.push('Problème connu : ' + enMinuscule(t)); });
    if (k.pointAttention) lesMoins.push(k.pointAttention);
    if (lesMoins.length) savoir.sousBlocs.push({ titre: 'Les moins (dits en toute transparence)', lignes: lesMoins });

    const pratique = [];
    k.situation.forEach(function (s) { /* la situation va dans « Autour » */ });
    k.pratique.forEach(function (p) { pratique.push(majuscule(p.nom) + ' : ' + p.texte); });
    if (k.copro) pratique.push('Copropriété : ' + k.copro);
    ['Chauffage', 'Eau chaude', 'Eaux usées', 'Autres équipements'].forEach(function (nom) {
      if (!k.equip[nom] || !k.equip[nom].length) return;
      let ligne = (nom === 'Eaux usées' ? 'Assainissement' : nom) + ' : ' + k.equip[nom].join(', ');
      if (nom === 'Eaux usées' && k.assainExtra.length) ligne += ' (' + k.assainExtra.join(', ') + ')';
      pratique.push(ligne);
    });
    if (!k.equip['Eaux usées'] && k.assainExtra.length) pratique.push('Assainissement : ' + k.assainExtra.join(', '));
    if (k.problemes && k.problemes.length && k.problemes.every(function (t) { return /^aucun/i.test(t); })) pratique.push('Problèmes connus : aucun');
    if (pratique.length) savoir.sousBlocs.push({ titre: 'Pratique', lignes: pratique });

    const diagLignes = [];
    if (k.dpe) diagLignes.push('Diagnostic énergie (DPE) : classe ' + k.dpe);
    if (k.ges) diagLignes.push('Gaz à effet de serre (GES) : classe ' + k.ges);
    if (k.diag.length) diagLignes.push('Autres diagnostics : ' + k.diag.map(function (d) { return enMinuscule(d.nom) + ' (' + texteDiagnostic(d.statut) + ')'; }).join(', '));
    if (diagLignes.length) savoir.sousBlocs.push({ titre: 'Diagnostics', lignes: diagLignes });
    if (savoir.sousBlocs.length) blocs.push(savoir);

    // Les chiffres
    const chiffres = [];
    const prixTexte = k.prix || (q.annonce && q.annonce.prix != null ? String(q.annonce.prix) : '');
    if (prixTexte) chiffres.push('Prix : ' + montant(prixTexte, '€'));
    if (k.honoraires) {
      let h = texteDe(k.honoraires);
      const n = nombreDe(h);
      if (n !== null) {
        // Sans unité, on devine : un petit nombre est un pourcentage
        h = n <= 100 ? String(n).replace('.', ',') + ' %' : milliers(n) + ' €';
        pourJoce.aVerifier.push('Honoraires : l’unité n’était pas précisée, j’ai compris « ' + h + ' » : à vérifier.');
      }
      chiffres.push('Honoraires : ' + h + (k.honorairesCharge ? ' (à la charge ' + enMinuscule(k.honorairesCharge) + ')' : ''));
    }
    k.couts.forEach(function (c) { chiffres.push(c); });
    if (k.loyer) chiffres.push('Bien actuellement loué, loyer : ' + montant(k.loyer, '€ par mois'));
    if (chiffres.length) blocs.push({ emoji: '💶', titre: 'Les chiffres', lignes: chiffres, sousBlocs: [] });

    // Les travaux
    const travaux = { emoji: '🔧', titre: 'Les travaux', lignes: [], sousBlocs: [] };
    const faits = k.faits.map(function (t) { return t.replace(/^(.*?)\s*:\s*(.+)$/, '$1 ($2)'); }).concat(k.postesFaits);
    if (k.factures) {
      const f = { 'Oui, toutes': 'toutes conservées', 'Certaines': 'certaines conservées', 'Non': 'pas de facture conservée' }[k.factures] || enMinuscule(k.factures);
      faits.push('Factures des travaux : ' + f);
    }
    if (faits.length) travaux.sousBlocs.push({ titre: 'Déjà réalisés', lignes: faits });
    const aPrevoir = k.aPrevoir.concat(k.postesAPrevoir);
    if (aPrevoir.length) travaux.sousBlocs.push({ titre: 'À prévoir', lignes: aPrevoir });
    else if (/rien à prévoir/i.test(k.etat)) travaux.sousBlocs.push({ titre: 'À prévoir', lignes: ['Rien à prévoir'] });
    if (travaux.sousBlocs.length) blocs.push(travaux);

    // Autour
    const autour = { emoji: '📍', titre: 'Autour', lignes: [], sousBlocs: [] };
    k.situation.forEach(function (s) { autour.lignes.push(majuscule(s.nom) + ' : ' + s.texte); });
    GROUPES_ENVIRONS.forEach(function (g) {
      const lignes = g[1].map(function (libelle) { return k.dist[libelle] ? ligneDistance(libelle, k.dist[libelle]) : ''; }).filter(Boolean);
      if (lignes.length) autour.sousBlocs.push({ titre: g[0], lignes: lignes });
    });
    if (autour.lignes.length || autour.sousBlocs.length) blocs.push(autour);

    // ----- Texte à copier -----
    const sortie = [titre, accroche];
    blocs.forEach(function (b) {
      sortie.push('');
      sortie.push(b.emoji + ' ' + b.titre);
      b.lignes.forEach(function (l) { sortie.push('- ' + l); });
      b.sousBlocs.forEach(function (sb) {
        if (sb.titre) sortie.push(sb.titre);
        sb.lignes.forEach(function (l) { sortie.push('- ' + l); });
      });
    });
    // Questionnaire sans aucune réponse utile : pas de texte du tout
    const texteFinal = blocs.length ? sortie.join('\n') : '';

    // ----- Ce que Jocelyne est seule à voir -----
    if (!prixTexte) pourJoce.aVerifier.push('Aucun prix dans le questionnaire ni dans l’annonce.');
    if (!k.dpe && !k.ges) pourJoce.aVerifier.push('DPE et GES non indiqués : la classe énergie et la classe climat doivent figurer dans une annonce.');
    else if (!k.dpe || !k.ges) pourJoce.aVerifier.push('Une des deux classes (DPE ou GES) manque : les deux doivent figurer dans une annonce.');
    const nbAConfirmer = k.diag.filter(function (d) { return d.statut === 'Ne sait pas'; }).length;
    if (nbAConfirmer) pourJoce.aVerifier.push(nbAConfirmer + ' diagnostic' + (nbAConfirmer > 1 ? 's' : '') + ' à confirmer avec le vendeur (marqué' + (nbAConfirmer > 1 ? 's' : '') + ' « à confirmer » dans l’annonce).');
    if (q.type_bien === 'appartement' && !k.couts.some(function (c) { return /^Charges de copropriété/.test(c); })) {
      pourJoce.aVerifier.push('Charges de copropriété non indiquées : à demander au vendeur avant de diffuser.');
    }
    if (!Object.keys(k.pieces).length) pourJoce.aVerifier.push('Aucune pièce décrite : l’intérieur de l’annonce est vide.');

    Object.keys(nonPublieParRaison).forEach(function (raison) {
      pourJoce.nonPublie.push({ raison: raison, questions: nonPublieParRaison[raison] });
    });

    // Cible possible (pour t’aider à choisir l’accroche)
    const nbCh = nombreDe(nbChambres);
    const ecoleProche = k.dist['Crèche, maternelle, primaire'] && /moins de (5|15) min/.test(String(k.dist['Crèche, maternelle, primaire']));
    if (k.loyer) pourJoce.cible = 'Investisseur : le bien est loué (loyer indiqué).';
    else if ((nbCh !== null && nbCh >= 3) || terrain || ecoleProche) pourJoce.cible = 'Famille : ' + [nbCh !== null && nbCh >= 3 ? nbCh + ' chambres' : '', terrain ? 'du terrain' : '', ecoleProche ? 'école proche' : ''].filter(Boolean).join(', ') + '.';
    else if (nbCh !== null && nbCh <= 2) pourJoce.cible = 'Jeune couple ou premier achat : ' + nbCh + ' chambre' + (nbCh > 1 ? 's' : '') + '.';

    return { titre: titre, accroche: accroche, blocs: blocs, texte: texteFinal, pourJoce: pourJoce };
  }

  global.albAnnonceProposee = { creer: creer };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.albAnnonceProposee;
})(typeof window !== 'undefined' ? window : globalThis);

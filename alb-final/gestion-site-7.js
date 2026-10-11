// ============================================================
// Gestion du site — partie 7 : 👥 Suivi des membres
// Chaque membre : ce qu'il fait sur la plateforme, où tu en es avec lui,
// et tes SMS, mails, appels et notes. Tu envoies toi-même (ton téléphone,
// ta messagerie), puis tu cliques « C'est fait » : la date est gardée.
// Remplace l'ancienne liste des membres (partie 2).
// ============================================================

let suiviMembres = {};          // id du membre → activité, étape, contacts
let filtreQui = 'tous';         // tous | particuliers | pros | relancer
let filtreSous = 'tous';        // vendeurs, acheteurs, clients_pro / courtier, artisan, agent, mandataire, autre
let filtreEtape = 'toutes';
let triMembres = 'recents';
let panneauOuvert = {};         // id du membre → panneau ouvert (sms, mail, appel, note, suivi)

ERREURS.TROP_TARD = 'Ce contact a plus de 24 h : il ne peut plus être effacé. Ajoute plutôt une note.';
ERREURS.TEXTE_MANQUANT = 'Écris d\'abord ta note.';
ERREURS.MEMBRE_INTROUVABLE = 'Ce membre n\'existe plus.';

const ETAPES = {
  a_contacter: ['🆕 À contacter', ''],
  en_cours: ['💬 En cours', 'or'],
  a_relancer: ['⏰ À relancer', 'rouge'],
  ok: ['✅ Tout va bien', 'vert'],
  pause: ['⏸️ En pause', '']
};
const CANAUX = { sms: '📱 SMS', mail: '📧 Mail', appel: '📞 Appel', note: '📝 Note' };

async function chargerSuiviMembres() {
  const { data, error } = await albSupabase.rpc('alb_gestion_suivi_membres');
  if (error) { console.error('[ALB DEBUG] suivi membres :', error); return; }
  suiviMembres = {};
  (data || []).forEach(function (s) { suiviMembres[s.id] = s; });
  afficherMembres();
}

// ----- Qui est qui -----
function estPro(m) { return m.role && m.role !== 'particulier'; }
function suiviDe(m) { return suiviMembres[m.id] || { activite: {}, contacts: [], etape: 'a_contacter' }; }
function aujourdhuiIso() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function aRelancer(m) {
  const s = suiviDe(m);
  return !!s.relancer_le && s.relancer_le <= aujourdhuiIso() && s.etape !== 'ok' && s.etape !== 'pause';
}
function membresAffichables() { return membres.filter(function (m) { return !m.est_admin; }); }

const SOUS_FILTRES = {
  particuliers: [['tous', 'Tous'], ['vendeurs', '🏡 Vendeurs'], ['acheteurs', '🔎 Acheteurs'], ['clients_pro', '🛠️ Clients pro']],
  pros: [['tous', 'Tous'], ['courtier', '🏦 Courtiers'], ['artisan', '🔨 Artisans'], ['agent', '🏠 Agents'], ['mandataire', '📋 Mandataires'], ['autre', '🤝 Autres']]
};
function passeSousFiltre(m) {
  if (filtreSous === 'tous') return true;
  if (filtreQui === 'particuliers') {
    const a = suiviDe(m).activite || {};
    if (filtreSous === 'vendeurs') return m.est_vendeur || a.annonces > 0;
    if (filtreSous === 'acheteurs') return m.est_acquereur || a.visites_demandees > 0;
    if (filtreSous === 'clients_pro') return m.est_client_pro;
  }
  if (filtreQui === 'pros') return (metierDe(m) || 'autre') === filtreSous;
  return true;
}
function choisirFiltreMembres(cle, valeur) {
  if (cle === 'qui') { filtreQui = valeur; filtreSous = 'tous'; }
  if (cle === 'sous') filtreSous = valeur;
  if (cle === 'etape') filtreEtape = valeur;
  afficherMembres();
}

function boutonsFiltre(cle, options, actif) {
  return options.map(function (o) {
    return '<button type="button" class="filtre' + (actif === o[0] ? ' actif' : '') + '" onclick="choisirFiltreMembres(\'' + cle + '\', \'' + o[0] + '\')">' + o[1] +
      (o[2] != null ? ' <span class="nb">' + o[2] + '</span>' : '') + '</button>';
  }).join('');
}

// ----- La liste -----
afficherMembres = function () {
  const zone = document.getElementById('liste-membres');
  if (!zone) return;
  const tous = membresAffichables();
  const nbPart = tous.filter(function (m) { return !estPro(m); }).length;
  const nbPros = tous.length - nbPart;
  const nbRelance = tous.filter(aRelancer).length;
  document.getElementById('filtres-membres').innerHTML =
    boutonsFiltre('qui', [['tous', '👥 Tous', tous.length], ['particuliers', '🙋 Particuliers', nbPart], ['pros', '🧑‍💼 Professionnels', nbPros], ['relancer', '⏰ À relancer', nbRelance]], filtreQui);
  document.getElementById('filtres-membres-sous').innerHTML = SOUS_FILTRES[filtreQui] ? boutonsFiltre('sous', SOUS_FILTRES[filtreQui], filtreSous) : '';
  document.getElementById('filtres-membres-etape').innerHTML =
    boutonsFiltre('etape', [['toutes', 'Toutes les étapes']].concat(Object.keys(ETAPES).map(function (k) { return [k, ETAPES[k][0]]; })), filtreEtape);

  const recherche = (document.getElementById('recherche-membres').value || '').toLowerCase().trim();
  let liste = tous.filter(function (m) {
    if (filtreQui === 'particuliers' && estPro(m)) return false;
    if (filtreQui === 'pros' && !estPro(m)) return false;
    if (filtreQui === 'relancer' && !aRelancer(m)) return false;
    if (!passeSousFiltre(m)) return false;
    if (filtreEtape !== 'toutes' && suiviDe(m).etape !== filtreEtape) return false;
    if (!recherche) return true;
    return [m.prenom, m.nom, m.email, m.telephone, m.nom_entreprise, m.ville, m.code_postal, m.besoin_autre, m.message_inscription, m.metier_autre]
      .concat((suiviDe(m).contacts || []).map(function (c) { return (c.objet || '') + ' ' + (c.texte || ''); }))
      .some(function (v) { return String(v || '').toLowerCase().includes(recherche); });
  });
  triMembres = document.getElementById('tri-membres').value || 'recents';
  liste.sort(function (a, b) {
    if (triMembres === 'connexion') return String(suiviDe(b).derniere_connexion || '').localeCompare(String(suiviDe(a).derniere_connexion || ''));
    if (triMembres === 'contact') return String(dernierContact(a) || '').localeCompare(String(dernierContact(b) || '')); // jamais contactés d'abord
    if (triMembres === 'nom') return ((a.prenom || '') + (a.nom || '')).localeCompare((b.prenom || '') + (b.nom || ''), 'fr');
    return String(b.date_creation || '').localeCompare(String(a.date_creation || ''));
  });
  document.getElementById('compte-membres').textContent = liste.length + ' membre' + (liste.length > 1 ? 's' : '');
  zone.innerHTML = liste.length ? liste.map(carteMembre).join('') : '<div class="vide">Aucun membre trouvé.</div>';
};

function dernierContact(m) { const c = (suiviDe(m).contacts || [])[0]; return c ? c.le : null; }

function depuis(iso) {
  if (!iso) return '';
  const j = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (j <= 0) return 'aujourd\'hui';
  if (j === 1) return 'hier';
  if (j < 31) return 'il y a ' + j + ' jours';
  return 'le ' + dateLisible(iso);
}

function activiteDe(m) {
  const a = suiviDe(m).activite || {};
  const morceaux = [];
  function ajoute(n, un, plusieurs, emoji, plus) { if (n > 0) morceaux.push('<span class="etiquette">' + emoji + ' ' + n + ' ' + (n > 1 ? plusieurs : un) + (plus || '') + '</span>'); }
  if (estPro(m)) {
    ajoute(a.demandes_recues, 'demande reçue', 'demandes reçues', '📨');
    ajoute(a.demandes_acceptees, 'acceptée', 'acceptées', '🤝');
    if (a.demandes_en_attente > 0) morceaux.push('<span class="etiquette or">⏳ ' + a.demandes_en_attente + ' sans réponse</span>');
    ajoute(a.signees, 'signée', 'signées', '✍️');
    if (a.points_envoyes > 0) morceaux.push('<span class="etiquette' + (a.points_repondus < a.points_envoyes ? ' or' : '') + '">📆 Points du mois : ' + a.points_repondus + '/' + a.points_envoyes + '</span>');
    if (a.avis_recus > 0) morceaux.push('<span class="etiquette">⭐ ' + String(a.note_moyenne).replace('.', ',') + ' (' + a.avis_recus + ' avis)</span>');
    ajoute(a.annonces_en_ligne, 'annonce en ligne', 'annonces en ligne', '🏠');
  } else {
    ajoute(a.annonces, 'annonce', 'annonces', '🏡', a.annonces_en_ligne ? ' (' + a.annonces_en_ligne + ' en ligne)' : '');
    ajoute(a.annonces_vendues, 'bien vendu', 'biens vendus', '🎉');
    ajoute(a.visites_recues, 'visite demandée chez lui', 'visites demandées chez lui', '🏠');
    ajoute(a.visites_demandees, 'visite demandée', 'visites demandées', '🔑');
    ajoute(a.projets, 'projet', 'projets', '🤝');
    ajoute(a.avis_donnes, 'avis donné', 'avis donnés', '⭐');
  }
  ajoute(a.messages, 'message envoyé', 'messages envoyés', '💬');
  return morceaux.length ? '<div class="etiquettes">' + morceaux.join('') + '</div>' : '<p class="ligne-info" style="color:#7a7a75;">🌱 Pas encore d\'activité sur la plateforme.</p>';
}

function carteMembre(m) {
  const s = suiviDe(m);
  const etape = ETAPES[s.etape] || ETAPES.a_contacter;
  const relance = s.relancer_le ? '<span class="etiquette ' + (aRelancer(m) ? 'rouge' : '') + '">⏰ Relancer le ' + albEchapper(dateLisible(s.relancer_le + 'T12:00:00')) + '</span>' : '';
  const qui = estPro(m) ? '<span class="badge-qui agent">🧑‍💼 Pro</span>' : '<span class="badge-qui particulier">🙋 Particulier</span>';
  const contacts = s.contacts || [];
  const dernier = contacts[0];
  return '<div class="carte membre-suivi" id="membre-' + m.id + '">' +
    '<div class="proprio-tete" style="margin-bottom:6px;">' + qui +
      '<span class="proprio-nom">' + albEchapper(((m.prenom || '') + ' ' + (m.nom || '')).trim() || 'Sans nom') + '</span>' +
      (m.nom_entreprise ? '<span class="etiquette or">' + albEchapper(m.nom_entreprise) + '</span>' : '') +
      '<span class="etiquette ' + etape[1] + '">' + etape[0] + '</span>' + relance +
    '</div>' +
    etiquettesDe(m) + messageDe(m) + coordonnees(m) +
    '<p class="ligne-info">🗓️ Inscrit le ' + dateLisible(m.date_creation) + (m.ville ? ' · 📍 ' + albEchapper(m.ville) : '') +
      ' · ' + (s.derniere_connexion ? '🔓 Dernière connexion ' + depuis(s.derniere_connexion) : '🔒 Jamais connecté') + '</p>' +
    (m.compte_bloque ? '<p class="ligne-info">⛔ <strong>Compte en pause</strong> (trop de codes PIN faux)</p>' : '') +
    '<p class="ligne-info" style="font-weight:700;margin-top:8px;">Sur la plateforme</p>' + activiteDe(m) +
    '<p class="ligne-info" style="margin-top:6px;">📒 ' + (dernier
      ? 'Ton dernier contact : ' + CANAUX[dernier.canal] + ' ' + depuis(dernier.le) + (dernier.objet ? ' · « ' + albEchapper(dernier.objet) + ' »' : '')
      : '<span style="color:#7a7a75;">Tu ne l\'as pas encore contacté.</span>') + '</p>' +
    '<div class="actions">' +
      '<button type="button" class="bouton" onclick="ouvrirPanneauMembre(\'' + m.id + '\', \'sms\')">📱 SMS</button>' +
      '<button type="button" class="bouton" onclick="ouvrirPanneauMembre(\'' + m.id + '\', \'mail\')">📧 Mail</button>' +
      '<button type="button" class="bouton discret" onclick="ouvrirPanneauMembre(\'' + m.id + '\', \'appel\')">📞 Appel</button>' +
      '<button type="button" class="bouton discret" onclick="ouvrirPanneauMembre(\'' + m.id + '\', \'note\')">📝 Note</button>' +
      '<button type="button" class="bouton discret" onclick="ouvrirPanneauMembre(\'' + m.id + '\', \'suivi\')">📋 Où j\'en suis</button>' +
      '<button type="button" class="bouton discret" onclick="basculerAcces(\'' + m.id + '\')">🔑 Accès</button>' +
      (m.compte_bloque ? '<button type="button" class="bouton discret" onclick="debloquer(\'' + m.id + '\', this)">🔓 Débloquer</button>' : '') +
    '</div>' +
    '<div id="panneau-membre-' + m.id + '">' + (panneauOuvert[m.id] ? panneauMembre(m, panneauOuvert[m.id]) : '') + '</div>' +
    blocAcces(m.id, '') +
    journalDe(m) +
    historiqueDe(m) +
  '</div>';
}

// ----- Ton journal avec ce membre -----
function journalDe(m) {
  const c = suiviDe(m).contacts || [];
  if (!c.length) return '';
  return '<details class="historique"><summary>📒 Ton suivi avec ' + albEchapper(m.prenom || 'ce membre') + ' (' + c.length + ')</summary><ul style="list-style:none;margin-left:0;">' +
    c.map(function (x) {
      const recent = Date.now() - new Date(x.le).getTime() < 86400000;
      return '<li style="margin:8px 0;padding:8px 10px;background:#FBF8F3;border-radius:6px;color:#4A4A47;">' +
        '<strong>' + CANAUX[x.canal] + '</strong> · ' + albEchapper(new Date(x.le).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })) +
        (x.objet ? '<br><strong>' + albEchapper(x.objet) + '</strong>' : '') +
        (x.texte ? '<div style="white-space:pre-line;margin-top:4px;">' + albEchapper(x.texte) + '</div>' : '') +
        (recent ? '<button type="button" class="bouton discret" style="margin-top:6px;padding:4px 10px;font-size:0.78rem;" onclick="annulerContact(\'' + x.id + '\', this)">Effacer (erreur)</button>' : '') +
      '</li>';
    }).join('') + '</ul></details>';
}

// ----- Les panneaux SMS / mail / appel / note / suivi -----
function ouvrirPanneauMembre(id, quoi) {
  panneauOuvert[id] = panneauOuvert[id] === quoi ? null : quoi;
  const m = membres.find(function (x) { return x.id === id; });
  document.getElementById('panneau-membre-' + id).innerHTML = panneauOuvert[id] ? panneauMembre(m, quoi) : '';
}

function signature() { return '\n\nÀ la bien, toujours ✨\nJocelyne Rimlinger\nFondatrice · ALB Sud Immobilier\n07 45 60 28 05'; }
function modelesPour(m) {
  const p = m.prenom || '';
  const pro = estPro(m);
  return {
    libre: { nom: '✏️ Message libre', objet: '', sms: 'Bonjour ' + p + ', ', mail: 'Bonjour ' + p + ',\n\n' },
    nouvelles: {
      nom: '👋 Prendre des nouvelles',
      objet: 'Des nouvelles d\'ALB Immobilier',
      sms: 'Bonjour ' + p + ', c\'est Jocelyne d\'ALB Immobilier. Je prends de vos nouvelles : tout se passe bien sur la plateforme ? Je reste disponible si besoin. Belle journée !',
      mail: 'Bonjour ' + p + ',\n\nJe prends de vos nouvelles : tout se passe bien sur ALB Immobilier ?\n\n' +
        (pro ? 'Si quelque chose peut être amélioré pour vous (demandes reçues, votre fiche, votre espace), dites-le-moi : vos retours m\'aident beaucoup.'
             : 'Si vous avez une question sur votre projet ou sur le site, je suis là pour vous aider.') +
        '\n\nRépondez simplement à ce mail ou appelez-moi.'
    },
    profil: {
      nom: pro ? '✍️ Compléter sa fiche' : '✍️ Compléter son espace',
      objet: pro ? 'Votre fiche sur ALB Immobilier' : 'Votre espace ALB Immobilier',
      sms: pro
        ? 'Bonjour ' + p + ', c\'est Jocelyne d\'ALB Immobilier. Il manque encore quelques informations sur votre fiche pour qu\'elle soit complète. Ça prend 5 minutes depuis votre espace : albimmobilier.fr/espace-alb.html'
        : 'Bonjour ' + p + ', c\'est Jocelyne d\'ALB Immobilier. Votre espace vous attend : vous pouvez y suivre vos projets et vos demandes. albimmobilier.fr/espace-alb.html',
      mail: pro
        ? 'Bonjour ' + p + ',\n\nVotre fiche sur ALB Immobilier n\'est pas encore tout à fait complète. Une fiche bien remplie (présentation, secteur, papiers) inspire confiance et vous apporte plus de demandes.\n\nÇa prend 5 minutes depuis votre espace :\nhttps://albimmobilier.fr/espace-alb.html'
        : 'Bonjour ' + p + ',\n\nVotre espace ALB Immobilier vous attend : vous pouvez y suivre vos projets, vos demandes de visite et vos messages.\n\nhttps://albimmobilier.fr/espace-alb.html\n\nUne question ? Je suis là.'
    },
    relance: {
      nom: '🔔 Relance',
      objet: 'Je reviens vers vous',
      sms: 'Bonjour ' + p + ', c\'est Jocelyne d\'ALB Immobilier. Je reviens vers vous suite à mon dernier message. Pouvez-vous me rappeler quand vous avez un moment ? Merci !',
      mail: 'Bonjour ' + p + ',\n\nJe reviens vers vous suite à mon dernier message. Avez-vous eu le temps d\'y jeter un œil ?\n\nRépondez simplement à ce mail, ou appelez-moi quand vous avez un moment.'
    }
  };
}

function panneauMembre(m, quoi) {
  const id = m.id;
  const num = String(m.telephone || '').replace(/[^0-9+]/g, '');
  const modeles = modelesPour(m);
  const choixModele = '<label class="petit-champ" style="margin-bottom:8px;">Modèle<select onchange="appliquerModele(\'' + id + '\', \'' + quoi + '\', this.value)">' +
    Object.keys(modeles).map(function (k) { return '<option value="' + k + '">' + modeles[k].nom + '</option>'; }).join('') + '</select></label>';
  if (quoi === 'sms') {
    if (!num) return '<div class="decision"><p class="ligne-info">📱 Pas de numéro de téléphone pour ce membre.</p></div>';
    return '<div class="decision"><div class="decision-titre">📱 SMS à ' + albEchapper(m.prenom || '') + ' · ' + albEchapper(m.telephone) + '</div>' + choixModele +
      '<textarea class="texte-pret" id="texte-' + id + '">' + albEchapper(modeles.libre.sms) + '</textarea>' +
      '<div class="actions">' +
        '<button type="button" class="bouton" onclick="ouvrirSms(\'' + id + '\', \'' + albEchapper(num) + '\')">📱 Ouvrir le SMS</button>' +
        '<button type="button" class="bouton discret" onclick="copierTexte(\'' + id + '\', this)">📋 Copier</button>' +
        '<button type="button" class="bouton vert" onclick="noterContact(\'' + id + '\', \'sms\', this)">✓ C\'est fait, je l\'ai envoyé</button>' +
      '</div><p class="aide">Le SMS s\'ouvre sur ton téléphone avec le texte prêt (ouvre cette page sur ton téléphone). Une fois envoyé, clique « C\'est fait » pour le garder en mémoire.</p></div>';
  }
  if (quoi === 'mail') {
    return '<div class="decision"><div class="decision-titre">📧 Mail à ' + albEchapper(m.prenom || '') + ' · ' + albEchapper(m.email || '') + '</div>' + choixModele +
      '<label class="petit-champ">Objet<input type="text" maxlength="200" id="objet-' + id + '" value=""></label>' +
      '<textarea class="texte-pret" id="texte-' + id + '" style="min-height:200px;margin-top:8px;">' + albEchapper(modeles.libre.mail + signature()) + '</textarea>' +
      '<div class="actions">' +
        '<button type="button" class="bouton" onclick="ouvrirMail(\'' + id + '\', \'' + albEchapper(m.email || '') + '\')">📧 Ouvrir le mail</button>' +
        '<button type="button" class="bouton discret" onclick="copierTexte(\'' + id + '\', this)">📋 Copier</button>' +
        '<button type="button" class="bouton vert" onclick="noterContact(\'' + id + '\', \'mail\', this)">✓ C\'est fait, je l\'ai envoyé</button>' +
      '</div><p class="aide">Le mail s\'ouvre dans ta messagerie avec l\'objet et le texte. Envoie-le, puis clique « C\'est fait ».</p></div>';
  }
  if (quoi === 'appel' || quoi === 'note') {
    const titre = quoi === 'appel' ? '📞 Appel avec ' + albEchapper(m.prenom || 'ce membre') + (num ? ' · <a href="tel:' + albEchapper(num) + '">' + albEchapper(m.telephone) + '</a>' : '') : '📝 Note sur ' + albEchapper(m.prenom || 'ce membre');
    return '<div class="decision"><div class="decision-titre">' + titre + '</div>' +
      '<textarea class="texte-pret" id="texte-' + id + '" placeholder="' + (quoi === 'appel' ? 'Ce que vous vous êtes dit (facultatif)' : 'Ta note') + '"></textarea>' +
      '<div class="actions"><button type="button" class="bouton vert" onclick="noterContact(\'' + id + '\', \'' + quoi + '\', this)">💾 Enregistrer</button></div></div>';
  }
  // Où j'en suis
  const s = suiviDe(m);
  return '<div class="decision"><div class="decision-titre">📋 Où tu en es avec ' + albEchapper(m.prenom || 'ce membre') + '</div>' +
    '<div class="grille">' +
      '<label class="petit-champ">Étape<select id="etape-' + id + '">' + Object.keys(ETAPES).map(function (k) {
        return '<option value="' + k + '"' + (s.etape === k ? ' selected' : '') + '>' + ETAPES[k][0] + '</option>'; }).join('') + '</select></label>' +
      '<label class="petit-champ">Le relancer le (facultatif)<input type="date" id="relance-' + id + '" value="' + albEchapper(s.relancer_le || '') + '"></label>' +
    '</div>' +
    '<div class="actions">' +
      '<button type="button" class="bouton discret" onclick="dansJours(\'' + id + '\', 3)">Dans 3 jours</button>' +
      '<button type="button" class="bouton discret" onclick="dansJours(\'' + id + '\', 7)">Dans 1 semaine</button>' +
      '<button type="button" class="bouton discret" onclick="dansJours(\'' + id + '\', 30)">Dans 1 mois</button>' +
      '<button type="button" class="bouton discret" onclick="document.getElementById(\'relance-' + id + '\').value=\'\'">Pas de relance</button>' +
    '</div>' +
    '<div class="actions"><button type="button" class="bouton vert" onclick="enregistrerSuivi(\'' + id + '\', this)">💾 Enregistrer</button></div>' +
    '<p class="aide">Le jour de la relance, ce membre apparaît dans « À faire aujourd\'hui ».</p></div>';
}

function appliquerModele(id, quoi, cle) {
  const m = membres.find(function (x) { return x.id === id; });
  const md = modelesPour(m)[cle];
  const t = document.getElementById('texte-' + id);
  if (quoi === 'sms') t.value = md.sms;
  else { t.value = md.mail + signature(); document.getElementById('objet-' + id).value = md.objet; }
}
function ouvrirSms(id, num) { window.location.href = 'sms:' + num + '?&body=' + encodeURIComponent(document.getElementById('texte-' + id).value); }
function ouvrirMail(id, email) {
  window.location.href = 'mailto:' + email + '?subject=' + encodeURIComponent(document.getElementById('objet-' + id).value) + '&body=' + encodeURIComponent(document.getElementById('texte-' + id).value);
}
async function copierTexte(id, bouton) {
  const t = document.getElementById('texte-' + id);
  try { await navigator.clipboard.writeText(t.value); } catch (e) { t.select(); document.execCommand('copy'); }
  const avant = bouton.textContent; bouton.textContent = '✓ Copié';
  setTimeout(function () { bouton.textContent = avant; }, 1500);
}
function dansJours(id, n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  document.getElementById('relance-' + id).value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function noterContact(id, canal, bouton) {
  const texte = document.getElementById('texte-' + id).value;
  const objetChamp = document.getElementById('objet-' + id);
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_contact_noter', { p_profile: id, p_canal: canal, p_objet: objetChamp ? objetChamp.value : null, p_texte: texte });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  panneauOuvert[id] = 'suivi'; // juste après : proposer de noter quand relancer
  await chargerSuiviMembres();
  afficherAFaire();
  afficherMessage('message-general', 'succes', CANAUX[canal] + ' gardé en mémoire ✓ Tu peux indiquer quand le relancer.');
}

async function annulerContact(idContact, bouton) {
  if (!confirm('Effacer ce contact noté par erreur ?')) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_contact_annuler', { p_id: idContact });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerSuiviMembres();
}

async function enregistrerSuivi(id, bouton) {
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_suivi_maj', {
    p_profile: id, p_etape: document.getElementById('etape-' + id).value, p_relancer_le: document.getElementById('relance-' + id).value || null
  });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  panneauOuvert[id] = null;
  await chargerSuiviMembres();
  afficherAFaire();
  afficherMessage('message-general', 'succes', 'Suivi enregistré ✓');
}

// « À faire aujourd'hui » : les membres à relancer
LIGNES_A_FAIRE.push({
  calcul: function () { return membresAffichables().filter(aRelancer).length; },
  un: 'membre à relancer aujourd\'hui', plusieurs: 'membres à relancer aujourd\'hui', emoji: '⏰', onglet: 'membres',
  filtre: function () { choisirFiltreMembres('qui', 'relancer'); }
});

(function () {
  const toutRechargerAvantSuivi = toutRecharger;
  toutRecharger = async function () {
    await Promise.all([toutRechargerAvantSuivi(), chargerSuiviMembres()]);
    afficherAFaire();
  };
})();

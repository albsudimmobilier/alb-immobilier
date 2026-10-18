// ============================================================
// Gestion du site — partie 8 : 📞 Demandes de rappel (Projets ALB)
// Un particulier qui ne sait pas par où commencer laisse son prénom
// et son numéro sur Projets ALB : Jocelyne le rappelle, puis note
// ce qu'ils se sont dit et clique « C'est fait ».
// Pendant l'appel, Jocelyne peut aussi lui créer son espace (particulier ou pro) :
// la personne reçoit ensuite (de Jocelyne) un lien pour choisir son code PIN
// et accepter elle-même les conditions générales.
// Le même formulaire sert dans 👥 Suivi des membres : « ➕ Ajouter un membre »
// (par exemple un pro qu'elle a au téléphone), avec la liste des espaces
// pas encore activés pour pouvoir relancer leur lien.
// Et sur chaque carte de membre : « ✏️ Corriger son profil » (prénom, nom,
// téléphone, particulier ou pro, et quel métier), par exemple quand quelqu'un
// s'est trompé ou a coché « Autre » en s'inscrivant.
// Dans 🤝 Projets : « 💬 Nouveaux venus via Nos pros ALB » — les personnes
// sans espace qui ont écrit à un pro (leur espace a été créé en même temps).
// Jocelyne leur envoie elle-même son message de bienvenue, puis fait le suivi.
// ============================================================

let demandesRappel = [];
let espacesCrees = {};      // id de la demande → { profile_id, prenom, nom, email, active }
let liensActivation = {};   // id de la demande → lien d'activation tout juste préparé
let formulaireEspace = {};  // id de la demande → formulaire « Créer son espace » ouvert
let espacesNonActives = []; // membres créés par Jocelyne qui n'ont pas encore activé leur espace
const AJOUT = 'nouveau';    // clé du formulaire « Ajouter un membre » (Suivi des membres)
ERREURS.DEMANDE_INTROUVABLE = 'Cette demande n\'existe plus.';
ERREURS.DEJA_ACTIVE = 'Cette personne a déjà activé son espace : elle peut se connecter.';
ERREURS.PROFIL_INTROUVABLE = 'Ce membre n\'existe plus.';
const MOMENTS_RAPPEL = { matin: '🌅 Le matin', midi: '🍽️ Entre midi et deux', apres_midi: '☀️ L\'après-midi', soir: '🌆 En fin de journée', peu_importe: '🕐 Peu importe' };

async function chargerDemandesRappel() {
  const [lesDemandes, lesEspaces] = await Promise.all([
    albSupabase.rpc('alb_gestion_demandes_rappel'),
    albSupabase.rpc('alb_gestion_espaces_crees')
  ]);
  if (lesDemandes.error) { console.error('[ALB DEBUG] demandes de rappel :', lesDemandes.error); return; }
  demandesRappel = lesDemandes.data || [];
  espacesCrees = {};
  if (lesEspaces.error) console.error('[ALB DEBUG] espaces créés :', lesEspaces.error);
  else (lesEspaces.data || []).forEach(function (e) { espacesCrees[e.demande] = e; });
  afficherDemandesRappel();
}

function demandesRappelEnAttente() { return demandesRappel.filter(function (d) { return !d.traitee_le; }); }

function afficherDemandesRappel() {
  const zone = document.getElementById('liste-demandes-rappel');
  if (!zone) return;
  const attente = demandesRappelEnAttente();
  const faites = demandesRappel.filter(function (d) { return d.traitee_le; });
  document.getElementById('titre-demandes-rappel').textContent = '📞 Demandes de rappel' + (attente.length ? ' (' + attente.length + ' à rappeler)' : '');
  if (!demandesRappel.length) { zone.innerHTML = '<div class="vide">Aucune demande de rappel pour l\'instant. 🌿</div>'; return; }
  zone.innerHTML = '<div class="liste-fiches">' + attente.map(carteDemandeRappel).join('') + '</div>' +
    (faites.length ? '<details class="historique"><summary>✅ Déjà rappelés (' + faites.length + ')</summary><div class="liste-fiches" style="margin-top:8px;">' + faites.map(carteDemandeRappel).join('') + '</div></details>' : '');
}

function carteDemandeRappel(d) {
  const num = String(d.telephone || '').replace(/[^0-9+]/g, '');
  const ancien = Math.floor((Date.now() - new Date(d.cree_le).getTime()) / 3600000);
  const retard = !d.traitee_le && ancien >= 24;
  return '<div class="carte"' + (d.traitee_le ? ' style="opacity:0.8;"' : '') + '>' +
    '<h3 style="font-family:Montserrat,sans-serif;font-size:1.05rem;">' + albEchapper(d.prenom) +
      (d.traitee_le ? ' <span class="etiquette vert">✅ Rappelé le ' + albEchapper(dateLisible(d.traitee_le)) + '</span>' : (retard ? ' <span class="etiquette rouge">⏳ Depuis ' + Math.floor(ancien / 24) + ' j</span>' : ' <span class="etiquette or">🆕 À rappeler</span>')) + '</h3>' +
    '<p class="ligne-info">📱 <a href="tel:' + albEchapper(num) + '"><strong>' + albEchapper(d.telephone) + '</strong></a>' + (d.code_postal ? ' · 📍 ' + albEchapper(d.code_postal) : '') + '</p>' +
    '<p class="ligne-info">' + (MOMENTS_RAPPEL[d.moment] || '') + ' · demandé le ' + albEchapper(new Date(d.cree_le).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) + '</p>' +
    (d.message ? '<p class="ligne-info mot">💬 « ' + albEchapper(d.message) + ' »</p>' : '') +
    blocEspace(d) +
    (d.traitee_le
      ? (d.note ? '<p class="ligne-info">📝 ' + albEchapper(d.note) + '</p>' : '') +
        '<div class="actions"><button type="button" class="bouton discret" onclick="demandeRappelTraitee(\'' + d.id + '\', false, this)">Annuler « c\'est fait »</button></div>'
      : '<label class="petit-champ" style="margin-top:8px;">Ce que vous vous êtes dit (facultatif)<textarea id="note-rappel-' + d.id + '" maxlength="1000" style="min-height:70px;"></textarea></label>' +
        '<div class="actions">' + (num ? '<a class="bouton" href="tel:' + albEchapper(num) + '">📞 Appeler</a>' : '') +
        (espacesCrees[d.id] ? '' : '<button type="button" class="bouton discret" onclick="ouvrirFormulaireEspace(\'' + d.id + '\')">👤 Créer son espace</button>') +
        '<button type="button" class="bouton vert" onclick="demandeRappelTraitee(\'' + d.id + '\', true, this)">✓ C\'est fait, je l\'ai rappelé</button></div>') +
  '</div>';
}

// ----- Son espace ALB -----
function blocEspace(d) {
  const e = espacesCrees[d.id];
  let html = '';
  if (e) {
    html += '<p class="ligne-info">👤 Espace créé : <strong>' + albEchapper(((e.prenom || '') + ' ' + (e.nom || '')).trim()) + '</strong> · ' + albEchapper(e.email || '') + ' · ' +
      (e.active ? '<span class="etiquette vert">✅ Activé</span>' : '<span class="etiquette or">⏳ Pas encore activé</span>') + '</p>';
    if (!e.active && !liensActivation[d.id]) {
      html += '<div class="actions"><button type="button" class="bouton discret" onclick="refaireLienActivation(\'' + d.id + '\', this)">🔗 Préparer un nouveau lien d\'activation</button></div>';
    }
  }
  if (liensActivation[d.id]) html += blocLienActivation(d);
  if (!e && formulaireEspace[d.id]) html += formulaireCreerEspace(d);
  return html;
}

function ouvrirFormulaireEspace(id) {
  formulaireEspace[id] = !formulaireEspace[id];
  afficherDemandesRappel();
}

function formulaireCreerEspace(d) {
  const id = d.id;
  const coche = function (nom, texte) { return '<label class="case-ligne" style="display:flex;gap:6px;align-items:center;margin:4px 12px 4px 0;"><input type="checkbox" style="width:auto;flex:none;" id="es-' + nom + '-' + id + '"> ' + texte + '</label>'; };
  return '<div class="decision" id="form-espace-' + id + '"><div class="decision-titre">' + (id === AJOUT ? '➕ Ajouter un membre' : '👤 Créer l\'espace de ' + albEchapper(d.prenom)) + '</div>' +
    '<p class="aide">Remplis pendant l\'appel. Aucun mail ne part tout seul : tu reçois ensuite un lien d\'activation à lui envoyer toi-même. ' +
      'C\'est en l\'ouvrant qu\'il choisit son code PIN et accepte les conditions générales.</p>' +
    '<div class="grille">' +
      '<label class="petit-champ">Prénom<input type="text" id="es-prenom-' + id + '" maxlength="80" value="' + albEchapper(d.prenom || '') + '"></label>' +
      '<label class="petit-champ">Nom<input type="text" id="es-nom-' + id + '" maxlength="80"></label>' +
      '<label class="petit-champ">E-mail<input type="email" id="es-email-' + id + '" maxlength="200" autocomplete="off"></label>' +
      '<label class="petit-champ">Téléphone<input type="tel" id="es-tel-' + id + '" maxlength="20" value="' + albEchapper(d.telephone || '') + '"></label>' +
    '</div>' +
    '<p class="ligne-info" style="font-weight:700;margin-top:10px;">C\'est…</p>' +
    '<div class="actions" style="margin-top:4px;">' +
      '<label style="display:flex;gap:6px;align-items:center;margin-right:14px;"><input type="radio" style="width:auto;flex:none;" name="es-qui-' + id + '" value="particulier" checked onchange="basculerQuiEspace(\'' + id + '\')"> 🙋 Un particulier</label>' +
      '<label style="display:flex;gap:6px;align-items:center;"><input type="radio" style="width:auto;flex:none;" name="es-qui-' + id + '" value="pro" onchange="basculerQuiEspace(\'' + id + '\')"> 🧑‍💼 Un professionnel</label>' +
    '</div>' +
    '<div id="es-part-' + id + '"><p class="aide" style="margin:6px 0 2px;">Son projet (plusieurs choix possibles) :</p><div style="display:flex;flex-wrap:wrap;">' +
      coche('acheteur', '🔎 Il achète') + coche('vendeur', '🏡 Il vend') + coche('clientpro', '🛠️ Il cherche un pro (travaux, financement…)') + '</div></div>' +
    '<div id="es-pro-' + id + '" class="cache"><div class="grille">' +
      '<label class="petit-champ">Métier<select id="es-metier-' + id + '" onchange="basculerQuiEspace(\'' + id + '\')">' +
        '<option value="courtier">🏦 Courtier</option><option value="artisan">🔨 Artisan</option><option value="agent">🏠 Agent immobilier</option>' +
        '<option value="mandataire">📋 Mandataire</option><option value="autre">🤝 Autre métier</option></select></label>' +
      '<label class="petit-champ" id="es-metier-autre-bloc-' + id + '" style="display:none;">Lequel ?<input type="text" id="es-metier-autre-' + id + '" maxlength="100"></label>' +
      '<label class="petit-champ">Entreprise<input type="text" id="es-entreprise-' + id + '" maxlength="150"></label>' +
      '<label class="petit-champ">SIRET (facultatif)<input type="text" id="es-siret-' + id + '" maxlength="17" inputmode="numeric"></label>' +
    '</div><p class="aide">Il arrivera dans « Pros à valider », comme une inscription normale.</p></div>' +
    '<label class="petit-champ" style="margin-top:8px;">Ce que tu retiens de l\'appel (facultatif, visible seulement par toi)<textarea id="es-note-' + id + '" maxlength="1000" style="min-height:60px;">' + albEchapper(d.message || '') + '</textarea></label>' +
    '<div class="actions"><button type="button" class="bouton vert" onclick="creerEspace(\'' + id + '\', this)">✅ Créer son espace</button>' +
    '<button type="button" class="bouton discret" onclick="' + (id === AJOUT ? 'ouvrirAjoutMembre()' : 'ouvrirFormulaireEspace(\'' + id + '\')') + '">Annuler</button></div>' +
    '<div class="message" id="es-message-' + id + '"></div></div>';
}

function basculerQuiEspace(id) {
  const pro = document.querySelector('input[name="es-qui-' + id + '"]:checked').value === 'pro';
  document.getElementById('es-part-' + id).classList.toggle('cache', pro);
  document.getElementById('es-pro-' + id).classList.toggle('cache', !pro);
  document.getElementById('es-metier-autre-bloc-' + id).style.display = document.getElementById('es-metier-' + id).value === 'autre' ? '' : 'none';
}

async function creerEspace(id, bouton) {
  const v = function (nom) { const c = document.getElementById('es-' + nom + '-' + id); return c ? c.value.trim() : ''; };
  const coche = function (nom) { return document.getElementById('es-' + nom + '-' + id).checked; };
  const pro = document.querySelector('input[name="es-qui-' + id + '"]:checked').value === 'pro';
  const donnees = {
    demande_rappel: id === AJOUT ? '' : id,
    prenom: v('prenom'), nom: v('nom'), email: v('email'), telephone: v('tel'), note: v('note'),
    metier_pro: pro ? v('metier') : '',
    metier_autre: pro ? v('metier-autre') : '',
    nom_entreprise: pro ? v('entreprise') : '',
    siret: pro ? v('siret') : '',
    est_acquereur: !pro && coche('acheteur'),
    est_vendeur: !pro && coche('vendeur'),
    est_client_pro: !pro && coche('clientpro')
  };
  const zone = document.getElementById('es-message-' + id);
  bouton.disabled = true;
  const resultat = await albCreerEspace(donnees);
  bouton.disabled = false;
  if (!resultat.ok) {
    zone.className = 'message visible erreur';
    zone.textContent = resultat.code === 'CASQUETTE_MANQUANTE' ? 'Coche au moins une case : il achète, il vend ou il cherche un pro.'
      : resultat.code === 'EMAIL_DEJA_UTILISE' ? 'Cette adresse e-mail a déjà un espace ALB. Cherche-la dans « Suivi des membres ».'
      : albMessageErreur(resultat.code);
    return;
  }
  formulaireEspace[id] = false;
  if (id === AJOUT) {
    // Le lien s'affiche dans la liste « pas encore activés », sous le nom de la personne
    liensActivation['p-' + resultat.profile_id] = { jeton: resultat.jeton, email: resultat.email, prenom: donnees.prenom, telephone: donnees.telephone };
  } else {
    liensActivation[id] = { jeton: resultat.jeton, email: resultat.email, prenom: donnees.prenom, telephone: donnees.telephone };
  }
  await toutRecharger();
  afficherMessage('message-general', 'succes', 'Espace créé ✓ Envoie-lui maintenant son lien d\'activation.');
}

async function refaireLienActivation(id, bouton) {
  const e = espacesCrees[id];
  if (!e) return;
  bouton.disabled = true;
  const { data, error } = await albSupabase.rpc('alb_gestion_lien_activation', { p_id: e.profile_id });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  liensActivation[id] = { jeton: data.jeton, email: data.email, prenom: e.prenom };
  afficherDemandesRappel();
}

function blocLienActivation(d) {
  const l = liensActivation[d.id];
  const lien = location.origin + '/nouveau-code.html#jeton=' + l.jeton;
  const tel = String(l.telephone || d.telephone || '').replace(/[^0-9+]/g, '');
  const sms = 'Bonjour ' + (l.prenom || '') + ', c\'est Jocelyne d\'ALB Immobilier. Comme convenu, votre espace est prêt ! Pour l\'activer, choisissez votre code PIN ici (lien valable 7 jours) : ' + lien + ' À la bien !';
  const mail = 'Bonjour ' + (l.prenom || '') + ',\n\nMerci pour notre échange ! Comme convenu, votre espace ALB Immobilier est prêt.\n\n' +
    'Pour l\'activer, il vous suffit de choisir votre code PIN (4 chiffres) en cliquant sur ce lien :\n' + lien + '\n\n' +
    'Ce lien est valable 7 jours et ne sert qu\'une seule fois. Ensuite, vous vous connecterez avec votre adresse e-mail (' + (l.email || '') + ') et votre code PIN.\n\n' +
    'À la bien, toujours ✨\nJocelyne Rimlinger\nFondatrice · ALB Sud Immobilier\n07 45 60 28 05';
  const sujet = 'Votre espace ALB Immobilier est prêt';
  return '<div class="decision"><div class="decision-titre">🔗 Son lien d\'activation (valable 7 jours)</div>' +
    '<p class="aide">Envoie-le toi-même, par SMS ou par mail. Tant qu\'il ne l\'a pas ouvert, son espace reste « pas encore activé ».</p>' +
    '<p class="ligne-info"><strong>📱 SMS</strong></p><textarea class="texte-pret" id="sms-activation-' + d.id + '" readonly>' + albEchapper(sms) + '</textarea>' +
    '<div class="actions">' +
      (tel ? '<a class="bouton" href="sms:' + albEchapper(tel) + '?&body=' + encodeURIComponent(sms) + '">📱 Ouvrir le SMS</a>' : '') +
      '<button type="button" class="bouton discret" onclick="copierActivation(\'sms-activation-' + d.id + '\', this)">📋 Copier</button></div>' +
    '<p class="ligne-info" style="margin-top:8px;"><strong>📧 Mail à ' + albEchapper(l.email || '') + '</strong></p><textarea class="texte-pret" id="mail-activation-' + d.id + '" readonly style="min-height:160px;">' + albEchapper(mail) + '</textarea>' +
    '<div class="actions">' +
      '<a class="bouton" href="mailto:' + albEchapper(l.email || '') + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(mail) + '">📧 Ouvrir le mail</a>' +
      '<button type="button" class="bouton discret" onclick="copierActivation(\'mail-activation-' + d.id + '\', this)">📋 Copier</button></div>' +
    '<p class="aide">' + (/^p-/.test(d.id) ? 'Une fois envoyé, plus rien à faire : la personne sort de cette liste dès qu\'elle a activé son espace.' : 'Une fois envoyé, tu peux cliquer « C\'est fait, je l\'ai rappelé » plus bas (ou plus tard).') + '</p></div>';
}

async function copierActivation(idChamp, bouton) {
  const t = document.getElementById(idChamp);
  try { await navigator.clipboard.writeText(t.value); } catch (e) { t.select(); document.execCommand('copy'); }
  const avant = bouton.textContent; bouton.textContent = '✓ Copié';
  setTimeout(function () { bouton.textContent = avant; }, 1500);
}

// ----- « ➕ Ajouter un membre » dans Suivi des membres -----
async function chargerEspacesNonActives() {
  const { data, error } = await albSupabase.rpc('alb_gestion_espaces_non_actives');
  if (error) { console.error('[ALB DEBUG] espaces non activés :', error); return; }
  espacesNonActives = data || [];
}

function ouvrirAjoutMembre() {
  formulaireEspace[AJOUT] = !formulaireEspace[AJOUT];
  afficherAjoutMembre();
}

function afficherAjoutMembre() {
  const panneau = document.getElementById('panneau-membres');
  if (!panneau) return;
  let zone = document.getElementById('zone-ajout-membre');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'zone-ajout-membre';
    zone.style.marginBottom = '14px';
    const recherche = document.getElementById('recherche-membres');
    panneau.insertBefore(zone, recherche);
  }
  zone.innerHTML =
    '<div class="actions" style="margin-top:0;">' +
      '<button type="button" class="bouton vert" onclick="ouvrirAjoutMembre()">' + (formulaireEspace[AJOUT] ? '✖ Fermer' : '➕ Ajouter un membre') + '</button>' +
    '</div>' +
    (formulaireEspace[AJOUT] ? formulaireCreerEspace({ id: AJOUT, prenom: '', telephone: '', message: '' }) : '') +
    (espacesNonActives.length
      ? '<details class="historique"' + (Object.keys(liensActivation).some(function (k) { return /^p-/.test(k); }) ? ' open' : '') + '><summary>⏳ Espaces créés, pas encore activés (' + espacesNonActives.length + ')</summary>' +
          espacesNonActives.map(function (m) {
            const cle = 'p-' + m.id;
            const d = { id: cle, telephone: m.telephone };
            return '<div class="carte" style="margin-top:8px;">' +
              '<p class="ligne-info"><strong>' + albEchapper(((m.prenom || '') + ' ' + (m.nom || '')).trim()) + '</strong>' +
                (m.nom_entreprise ? ' · ' + albEchapper(m.nom_entreprise) : '') + ' · ' + albEchapper(m.email || '') +
                ' · créé le ' + albEchapper(dateLisible(m.date_creation)) + '</p>' +
              (liensActivation[cle] ? blocLienActivation(d)
                : '<div class="actions"><button type="button" class="bouton discret" onclick="lienActivationMembre(\'' + m.id + '\', this)">🔗 Préparer son lien d\'activation</button></div>') +
            '</div>';
          }).join('') + '</details>'
      : '');
}

async function lienActivationMembre(profileId, bouton) {
  const m = espacesNonActives.find(function (x) { return x.id === profileId; }) || {};
  bouton.disabled = true;
  const { data, error } = await albSupabase.rpc('alb_gestion_lien_activation', { p_id: profileId });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  liensActivation['p-' + profileId] = { jeton: data.jeton, email: data.email, prenom: m.prenom, telephone: m.telephone };
  afficherAjoutMembre();
}

async function demandeRappelTraitee(id, fait, bouton) {
  const champ = document.getElementById('note-rappel-' + id);
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_demande_rappel_traitee', { p_id: id, p_note: champ ? champ.value : null, p_fait: fait });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerDemandesRappel();
  afficherAFaire();
  afficherMessage('message-general', 'succes', fait ? 'Rappel noté ✓' : 'C\'est de nouveau à rappeler.');
}

// ----- « ✏️ Corriger son profil » (Suivi des membres) -----
ERREURS.ENTREPRISE_MANQUANTE = 'Indique le nom de son entreprise.';
ERREURS.CASQUETTE_MANQUANTE = 'Coche au moins une case : il achète, il vend ou il cherche un pro.';
ERREURS.NOM_MANQUANT = 'Le prénom et le nom sont obligatoires.';
ERREURS.TELEPHONE_INVALIDE = 'Le numéro de téléphone ne semble pas complet.';
ERREURS.METIER_INVALIDE = 'Choisis son métier dans la liste.';

// Le bouton s'ajoute sur chaque carte, juste avant « 🔑 Accès »
(function () {
  const carteMembreAvantCorriger = carteMembre;
  carteMembre = function (m) {
    return carteMembreAvantCorriger(m).replace(
      '<button type="button" class="bouton discret" onclick="basculerAcces(',
      '<button type="button" class="bouton discret" onclick="ouvrirPanneauMembre(\'' + m.id + '\', \'corriger\')">✏️ Corriger son profil</button>' +
      '<button type="button" class="bouton discret" onclick="basculerAcces(');
  };
  const panneauMembreAvantCorriger = panneauMembre;
  panneauMembre = function (m, quoi) {
    return quoi === 'corriger' ? panneauCorriger(m) : panneauMembreAvantCorriger(m, quoi);
  };
})();

function panneauCorriger(m) {
  const id = m.id;
  const pro = m.role && m.role !== 'particulier';
  const metier = metierDe(m) || (pro ? 'autre' : 'courtier');
  const coche = function (nom, texte, valeur) {
    return '<label style="display:flex;gap:6px;align-items:center;margin:4px 12px 4px 0;"><input type="checkbox" style="width:auto;flex:none;" id="co-' + nom + '-' + id + '"' + (valeur ? ' checked' : '') + '> ' + texte + '</label>';
  };
  const option = function (v, t) { return '<option value="' + v + '"' + (metier === v ? ' selected' : '') + '>' + t + '</option>'; };
  return '<div class="decision"><div class="decision-titre">✏️ Corriger le profil de ' + albEchapper(m.prenom || 'ce membre') + '</div>' +
    (m.besoin_autre || m.metier_autre ? '<p class="ligne-info mot">💬 Ce qu\'il a écrit en s\'inscrivant : « ' + albEchapper(m.metier_autre || m.besoin_autre) + ' »</p>' : '') +
    '<div class="grille">' +
      '<label class="petit-champ">Prénom<input type="text" id="co-prenom-' + id + '" maxlength="80" value="' + albEchapper(m.prenom || '') + '"></label>' +
      '<label class="petit-champ">Nom<input type="text" id="co-nom-' + id + '" maxlength="80" value="' + albEchapper(m.nom || '') + '"></label>' +
      '<label class="petit-champ">Téléphone<input type="tel" id="co-tel-' + id + '" maxlength="20" value="' + albEchapper(m.telephone || '') + '"></label>' +
    '</div>' +
    '<p class="aide" style="margin-top:4px;">L\'e-mail se change avec le bouton 🔑 Accès (il faut un lien pour la nouvelle adresse).</p>' +
    '<p class="ligne-info" style="font-weight:700;margin-top:10px;">C\'est…</p>' +
    '<div class="actions" style="margin-top:4px;">' +
      '<label style="display:flex;gap:6px;align-items:center;margin-right:14px;"><input type="radio" style="width:auto;flex:none;" name="co-qui-' + id + '" value="particulier"' + (pro ? '' : ' checked') + ' onchange="basculerQuiCorriger(\'' + id + '\')"> 🙋 Un particulier</label>' +
      '<label style="display:flex;gap:6px;align-items:center;"><input type="radio" style="width:auto;flex:none;" name="co-qui-' + id + '" value="pro"' + (pro ? ' checked' : '') + ' onchange="basculerQuiCorriger(\'' + id + '\')"> 🧑‍💼 Un professionnel</label>' +
    '</div>' +
    '<div id="co-part-' + id + '"' + (pro ? ' class="cache"' : '') + '><p class="aide" style="margin:6px 0 2px;">Son projet (plusieurs choix possibles) :</p><div style="display:flex;flex-wrap:wrap;">' +
      coche('acheteur', '🔎 Il achète', m.est_acquereur) + coche('vendeur', '🏡 Il vend', m.est_vendeur) + coche('clientpro', '🛠️ Il cherche un pro', m.est_client_pro) + '</div></div>' +
    '<div id="co-pro-' + id + '"' + (pro ? '' : ' class="cache"') + '><div class="grille">' +
      '<label class="petit-champ">Métier<select id="co-metier-' + id + '" onchange="basculerQuiCorriger(\'' + id + '\')">' +
        option('courtier', '🏦 Courtier') + option('artisan', '🔨 Artisan') + option('agent', '🏠 Agent immobilier') + option('mandataire', '📋 Mandataire') + option('autre', '🤝 Autre métier') + '</select></label>' +
      '<label class="petit-champ" id="co-metier-autre-bloc-' + id + '"' + (metier === 'autre' ? '' : ' style="display:none;"') + '>Nom du métier (affiché dans les filtres)<input type="text" id="co-metier-autre-' + id + '" maxlength="100" value="' + albEchapper(m.metier_autre || '') + '"></label>' +
      '<label class="petit-champ">Entreprise<input type="text" id="co-entreprise-' + id + '" maxlength="150" value="' + albEchapper(m.nom_entreprise || '') + '"></label>' +
    '</div></div>' +
    '<p class="aide">' + (pro
      ? 'Si tu le passes en particulier : sa fiche sort de « Nos pros ALB » et il ne reçoit plus de demandes.'
      : 'Si tu le passes en professionnel : il arrive dans « Pros à valider », comme une inscription normale.') +
      ' Aucun message ne lui est envoyé. Tout est noté dans son historique.</p>' +
    '<div class="actions"><button type="button" class="bouton vert" onclick="enregistrerCorrection(\'' + id + '\', this)">💾 Enregistrer</button>' +
    '<button type="button" class="bouton discret" onclick="ouvrirPanneauMembre(\'' + id + '\', \'corriger\')">Annuler</button></div></div>';
}

function basculerQuiCorriger(id) {
  const pro = document.querySelector('input[name="co-qui-' + id + '"]:checked').value === 'pro';
  document.getElementById('co-part-' + id).classList.toggle('cache', pro);
  document.getElementById('co-pro-' + id).classList.toggle('cache', !pro);
  document.getElementById('co-metier-autre-bloc-' + id).style.display = document.getElementById('co-metier-' + id).value === 'autre' ? '' : 'none';
}

async function enregistrerCorrection(id, bouton) {
  const v = function (nom) { const c = document.getElementById('co-' + nom + '-' + id); return c ? c.value.trim() : ''; };
  const c = function (nom) { return document.getElementById('co-' + nom + '-' + id).checked; };
  const pro = document.querySelector('input[name="co-qui-' + id + '"]:checked').value === 'pro';
  const m = membres.find(function (x) { return x.id === id; }) || {};
  const fiche = {
    qui: pro ? 'pro' : 'particulier',
    prenom: v('prenom'), nom: v('nom'), telephone: v('tel'),
    metier: pro ? v('metier') : '', metier_autre: pro ? v('metier-autre') : '', nom_entreprise: pro ? v('entreprise') : '',
    est_acquereur: !pro && c('acheteur'), est_vendeur: !pro && c('vendeur'), est_client_pro: !pro && c('clientpro'),
    besoin_autre: pro ? '' : (m.besoin_autre || '')
  };
  const etaitPro = m.role && m.role !== 'particulier';
  if (etaitPro && !pro && m.statut_verifie && !confirm('Passer ce pro validé en particulier ? Sa fiche sortira de « Nos pros ALB ».')) return;
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_corriger_membre', { p_id: id, p_fiche: fiche });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  panneauOuvert[id] = null;
  await toutRecharger();
  afficherMessage('message-general', 'succes', !etaitPro && pro ? 'Profil corrigé ✓ Il est maintenant dans « Pros à valider ».' : 'Profil corrigé ✓');
}


// ----- « 💬 Nouveaux venus via Nos pros ALB » (onglet 🤝 Projets) -----
let contactsVitrine = [];

async function chargerContactsVitrine() {
  const { data, error } = await albSupabase.rpc('alb_gestion_contacts_vitrine');
  if (error) { console.error('[ALB DEBUG] contacts Nos pros ALB :', error); return; }
  contactsVitrine = data || [];
  afficherContactsVitrine();
}

function contactsVitrineASuivre() { return contactsVitrine.filter(function (c) { return !c.traite_le; }); }

function nomProContact(c) { return c.pro_entreprise || ((c.pro_prenom || '') + ' ' + (c.pro_nom || '')).trim() || 'le pro'; }

function afficherContactsVitrine() {
  const panneau = document.getElementById('panneau-projets');
  if (!panneau) return;
  let zone = document.getElementById('zone-contacts-vitrine');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'zone-contacts-vitrine';
    const rappels = document.getElementById('zone-demandes-rappel');
    panneau.insertBefore(zone, rappels ? rappels.nextSibling : panneau.firstChild);
  }
  const aSuivre = contactsVitrineASuivre();
  const faits = contactsVitrine.filter(function (c) { return c.traite_le; });
  zone.innerHTML = '<h2 class="titre-section">💬 Nouveaux venus via « Nos pros ALB »' + (aSuivre.length ? ' (' + aSuivre.length + ' à contacter)' : '') + '</h2>' +
    '<p class="aide">Des personnes qui n\'avaient pas d\'espace ALB et ont écrit à un pro : leur espace a été créé en même temps, avec le code PIN qu\'elles ont choisi. ' +
      'Aucun mail ne leur est parti : envoie-leur ton message de bienvenue (prêt ci-dessous), contacte-les, puis clique « C\'est fait ».</p>' +
    (contactsVitrine.length
      ? '<div class="liste-fiches">' + aSuivre.map(carteContactVitrine).join('') + '</div>' +
        (faits.length ? '<details class="historique"><summary>✅ Déjà contactés (' + faits.length + ')</summary><div class="liste-fiches" style="margin-top:8px;">' + faits.map(carteContactVitrine).join('') + '</div></details>' : '')
      : '<div class="vide">Personne pour l\'instant. 🌿</div>');
}

function carteContactVitrine(c) {
  const num = String(c.telephone || '').replace(/[^0-9+]/g, '');
  const heures = Math.floor((Date.now() - new Date(c.cree_le).getTime()) / 3600000);
  const pro = nomProContact(c);
  return '<div class="carte"' + (c.traite_le ? ' style="opacity:0.8;"' : '') + '>' +
    '<h3 style="font-family:Montserrat,sans-serif;font-size:1.05rem;">' + albEchapper(((c.prenom || '') + ' ' + (c.nom || '')).trim()) +
      (c.traite_le ? ' <span class="etiquette vert">✅ Contacté le ' + albEchapper(dateLisible(c.traite_le)) + '</span>'
        : (heures >= 24 ? ' <span class="etiquette rouge">⏳ Depuis ' + Math.floor(heures / 24) + ' j</span>' : ' <span class="etiquette or">🆕 À contacter</span>')) + '</h3>' +
    '<p class="ligne-info">📱 <a href="tel:' + albEchapper(num) + '"><strong>' + albEchapper(c.telephone || '') + '</strong></a> · 📧 ' + albEchapper(c.email || '') + '</p>' +
    '<p class="ligne-info">💬 A écrit à <strong>' + albEchapper(pro) + '</strong> le ' + albEchapper(new Date(c.cree_le).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) + '</p>' +
    (c.message ? '<p class="ligne-info mot">« ' + albEchapper(c.message) + ' »</p>' : '') +
    '<p class="ligne-info">' + (c.message_parti ? '<span class="etiquette vert">✅ Message bien arrivé chez le pro</span>' : '<span class="etiquette rouge">⚠️ Message pas encore parti : la personne doit le renvoyer depuis son espace</span>') +
      ' ' + (c.pro_a_repondu ? '<span class="etiquette vert">✅ Le pro a répondu</span>' : '<span class="etiquette or">⏳ Le pro n\'a pas encore répondu</span>') + '</p>' +
    blocBienvenueContact(c) +
    (c.traite_le
      ? (c.note ? '<p class="ligne-info">📝 ' + albEchapper(c.note) + '</p>' : '') +
        '<div class="actions"><button type="button" class="bouton discret" onclick="contactVitrineMaj(\'' + c.id + '\', \'suivi\', false, this)">Annuler « c\'est fait »</button></div>'
      : '<label class="petit-champ" style="margin-top:8px;">Ce que vous vous êtes dit (facultatif)<textarea id="note-contact-' + c.id + '" maxlength="1000" style="min-height:70px;"></textarea></label>' +
        '<div class="actions">' + (num ? '<a class="bouton" href="tel:' + albEchapper(num) + '">📞 Appeler</a>' : '') +
        '<button type="button" class="bouton vert" onclick="contactVitrineMaj(\'' + c.id + '\', \'suivi\', true, this)">✓ C\'est fait, je l\'ai contacté</button></div>') +
  '</div>';
}

// Le message de bienvenue : prêt à envoyer par SMS ou par mail, c'est Jocelyne qui l'envoie
function blocBienvenueContact(c) {
  if (c.bienvenue_le) {
    return '<p class="ligne-info"><span class="etiquette vert">💜 Bienvenue envoyée le ' + albEchapper(dateLisible(c.bienvenue_le)) + '</span> ' +
      '<button type="button" class="bouton discret" onclick="contactVitrineMaj(\'' + c.id + '\', \'bienvenue\', false, this)">Annuler</button></p>';
  }
  const pro = nomProContact(c);
  const num = String(c.telephone || '').replace(/[^0-9+]/g, '');
  const lien = 'https://albimmobilier.fr/espace-alb.html';
  const sms = 'Bonjour ' + (c.prenom || '') + ', c\'est Jocelyne, fondatrice d\'ALB Immobilier. Merci pour votre message à ' + pro + ', il l\'a bien reçu ! ' +
    'Votre espace ALB est prêt : connectez-vous sur ' + lien + ' avec votre e-mail (' + (c.email || '') + ') et le code PIN que vous avez choisi. ' +
    'Vous y trouverez sa réponse. Je vous appelle très vite pour faire connaissance. À la bien !';
  const sujet = 'Bienvenue chez ALB Sud Immobilier, ' + (c.prenom || '');
  const mail = 'Bonjour ' + (c.prenom || '') + ',\n\n' +
    'Merci pour votre message à ' + pro + ' via ALB Immobilier, et bienvenue !\n\n' +
    'Votre espace ALB est prêt. Pour vous connecter, rendez-vous sur ' + lien + ' avec votre adresse e-mail (' + (c.email || '') + ') et le code PIN que vous avez choisi.\n\n' +
    'C\'est là que vous retrouverez la réponse de ' + pro + ', dans la rubrique « Mes messages ». Vous pourrez aussi y suivre vos projets et vos demandes.\n\n' +
    'Je vous appellerai très vite pour faire connaissance et voir comment vous accompagner.\n\n' +
    'Code PIN oublié ? Cliquez simplement sur « J\'ai oublié mon code PIN » sur la page de connexion.\n\n' +
    'À la bien, toujours ✨\nJocelyne Rimlinger\nFondatrice · ALB Sud Immobilier\n07 45 60 28 05';
  return '<div class="decision"><div class="decision-titre">💜 Son message de bienvenue</div>' +
    '<p class="aide">Envoie-le toi-même, par SMS ou par mail (ou les deux), puis clique « C\'est fait ».</p>' +
    '<p class="ligne-info"><strong>📱 SMS</strong></p><textarea class="texte-pret" id="sms-bienvenue-' + c.id + '" readonly>' + albEchapper(sms) + '</textarea>' +
    '<div class="actions">' +
      (num ? '<a class="bouton" href="sms:' + albEchapper(num) + '?&body=' + encodeURIComponent(sms) + '">📱 Ouvrir le SMS</a>' : '') +
      '<button type="button" class="bouton discret" onclick="copierActivation(\'sms-bienvenue-' + c.id + '\', this)">📋 Copier</button></div>' +
    '<p class="ligne-info" style="margin-top:8px;"><strong>📧 Mail à ' + albEchapper(c.email || '') + '</strong></p><textarea class="texte-pret" id="mail-bienvenue-' + c.id + '" readonly style="min-height:180px;">' + albEchapper(mail) + '</textarea>' +
    '<div class="actions">' +
      '<a class="bouton" href="mailto:' + albEchapper(c.email || '') + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(mail) + '">📧 Ouvrir le mail</a>' +
      '<button type="button" class="bouton discret" onclick="copierActivation(\'mail-bienvenue-' + c.id + '\', this)">📋 Copier</button>' +
      '<button type="button" class="bouton vert" onclick="contactVitrineMaj(\'' + c.id + '\', \'bienvenue\', true, this)">✓ C\'est fait, bienvenue envoyée</button></div></div>';
}

async function contactVitrineMaj(id, quoi, fait, bouton) {
  const champ = document.getElementById('note-contact-' + id);
  bouton.disabled = true;
  const { error } = await albSupabase.rpc('alb_gestion_contact_vitrine_maj', { p_id: id, p_quoi: quoi, p_fait: fait, p_note: champ ? champ.value : null });
  bouton.disabled = false;
  if (error) { afficherMessage('message-general', 'erreur', messageErreur(error)); return; }
  await chargerContactsVitrine();
  afficherAFaire();
  afficherMessage('message-general', 'succes', !fait ? 'C\'est noté.' : quoi === 'bienvenue' ? 'Bienvenue notée ✓' : 'Suivi noté ✓');
}

// « À faire aujourd'hui » : en tête, car la personne attend un appel
LIGNES_A_FAIRE.unshift({
  calcul: function () { return demandesRappelEnAttente().length; },
  un: 'personne à rappeler (demande faite sur Projets ALB)', plusieurs: 'personnes à rappeler (demandes faites sur Projets ALB)', emoji: '📞', onglet: 'projets', ancre: 'zone-demandes-rappel'
});
// Juste après : les nouveaux venus via Nos pros ALB
LIGNES_A_FAIRE.splice(1, 0, {
  calcul: function () { return contactsVitrineASuivre().length; },
  un: 'nouveau venu via « Nos pros ALB » à contacter (message de bienvenue + suivi)', plusieurs: 'nouveaux venus via « Nos pros ALB » à contacter (message de bienvenue + suivi)', emoji: '💬', onglet: 'projets', ancre: 'zone-contacts-vitrine'
});

(function () {
  const toutRechargerAvantRappelsDemandes = toutRecharger;
  toutRecharger = async function () {
    await Promise.all([toutRechargerAvantRappelsDemandes(), chargerDemandesRappel(), chargerEspacesNonActives(), chargerContactsVitrine()]);
    afficherAjoutMembre();
    afficherAFaire();
  };
})();

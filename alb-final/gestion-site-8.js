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

// « À faire aujourd'hui » : en tête, car la personne attend un appel
LIGNES_A_FAIRE.unshift({
  calcul: function () { return demandesRappelEnAttente().length; },
  un: 'personne à rappeler (demande faite sur Projets ALB)', plusieurs: 'personnes à rappeler (demandes faites sur Projets ALB)', emoji: '📞', onglet: 'projets', ancre: 'zone-demandes-rappel'
});

(function () {
  const toutRechargerAvantRappelsDemandes = toutRecharger;
  toutRecharger = async function () {
    await Promise.all([toutRechargerAvantRappelsDemandes(), chargerDemandesRappel(), chargerEspacesNonActives()]);
    afficherAjoutMembre();
    afficherAFaire();
  };
})();

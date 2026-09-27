// ============================================================
// mon-profil-pro.js — « Mon activité pro » dans Mon espace ALB
//  • Ma fiche sur « Nos pros ALB » : photo, présentation, zones,
//    types de rendez-vous, disponibilité (en ligne tout de suite,
//    Jocelyne est prévenue par e-mail)
//  • Mon remplaçant : demander à un confrère de prendre mes
//    nouvelles demandes quand je suis indisponible (il doit accepter)
//  • Les confrères qui me demandent de les remplacer
// Besoin de : alb-connexion.js (albSupabase, albEchapper)
// ============================================================
(function () {
  'use strict';

  const e = function (t) { return albEchapper(t); };
  function el(id) { return document.getElementById(id); }
  const ZONES_PAR_DEPARTEMENT = {
    'Var': ['Toulon et environs', 'Centre Var', 'Est Var/Golfe', 'Dracénie', 'Haut Var/Verdon'],
    'Bouches-du-Rhône': ['Marseille et environs', "Pays d'Aix", 'Aubagne/La Ciotat', 'Étang de Berre/Martigues', "Salon/Pays d'Arles"]
  };
  const ZONES_CONNUES = Object.keys(ZONES_PAR_DEPARTEMENT).reduce(function (t, d) { return t.concat(ZONES_PAR_DEPARTEMENT[d]); }, []);
  const DISPOS = { joignable: '🟢 Disponible', 'occupé': '🟡 Occupé en ce moment', non_disponible: '🔴 Indisponible (congés, trop de travail…)' };
  const ERREURS = {
    PHOTO_INVALIDE: 'La photo n’a pas pu être enregistrée. Réessayez.',
    CP_INVALIDE: 'Le code postal doit contenir 5 chiffres.',
    PRESENTATION_TROP_LONGUE: 'Votre présentation est un peu longue : 500 caractères au plus.',
    TROP_DE_ZONES: '15 zones au plus.',
    PAS_ENCORE_VALIDE: 'Cette option s’ouvre une fois votre profil validé par Jocelyne.',
    CONFRERE_INVALIDE: 'Ce confrère n’est pas disponible pour un remplacement.',
    DECISION_IMPOSSIBLE: 'Cette demande a déjà changé : rechargez la page.',
  };
  let fiche = null;
  let confreres = [];
  let photoEnAttente = null; // adresse de la nouvelle photo, avant enregistrement

  function message(id, type, texte) { const m = el(id); if (!m) return; m.className = 'message visible ' + type; m.textContent = texte; }
  function erreurDe(err) {
    const t = String((err && err.message) || '');
    const code = Object.keys(ERREURS).find(function (c) { return t.indexOf(c) !== -1; });
    return code ? ERREURS[code] : 'Un petit souci technique : réessayez dans un instant.';
  }
  function dateCourte(d) { return d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : ''; }

  // ---------- Photo : réduite dans le navigateur avant l'envoi ----------
  function reduirePhoto(fichier) {
    return new Promise(function (resoudre) {
      const lecteur = new FileReader();
      lecteur.onload = function () {
        const image = new Image();
        image.onload = function () {
          // Carré centré de 500 × 500
          const cote = Math.min(image.width, image.height);
          const toile = document.createElement('canvas');
          toile.width = 500; toile.height = 500;
          toile.getContext('2d').drawImage(image, (image.width - cote) / 2, (image.height - cote) / 2, cote, cote, 0, 0, 500, 500);
          toile.toBlob(function (blob) { resoudre(blob); }, 'image/jpeg', 0.85);
        };
        image.onerror = function () { resoudre(null); };
        image.src = lecteur.result;
      };
      lecteur.onerror = function () { resoudre(null); };
      lecteur.readAsDataURL(fichier);
    });
  }

  async function changerPhoto(fichier, profilId) {
    if (!fichier) return;
    if (!/^image\//.test(fichier.type)) { message('pp-msg-fiche', 'erreur', 'Choisissez une image (photo ou logo).'); return; }
    message('pp-msg-fiche', 'info', 'Envoi de la photo…');
    const blob = await reduirePhoto(fichier);
    if (!blob) { message('pp-msg-fiche', 'erreur', 'Cette image n’a pas pu être lue. Essayez une autre photo.'); return; }
    const chemin = profilId + '/' + Date.now() + '.jpg';
    const envoi = await albSupabase.storage.from('pro-photos').upload(chemin, blob, { contentType: 'image/jpeg', upsert: false });
    if (envoi.error) { console.error('[ALB DEBUG] photo pro :', envoi.error); message('pp-msg-fiche', 'erreur', 'La photo n’a pas pu être envoyée. Réessayez.'); return; }
    photoEnAttente = albSupabase.storage.from('pro-photos').getPublicUrl(chemin).data.publicUrl;
    el('pp-apercu').innerHTML = '<img src="' + e(photoEnAttente) + '" alt="">';
    message('pp-msg-fiche', 'info', 'Photo prête : cliquez sur « Enregistrer ma fiche » pour la mettre en ligne.');
  }

  // ---------- Affichage ----------
  function blocFiche() {
    const f = fiche;
    const zones = f.zones || [];
    const photo = photoEnAttente || f.photo_url;
    const modes = f.modes || {};
    const etat = f.statut_verifie
      ? (f.en_ligne ? '✅ Votre fiche est en ligne sur « Nos pros ALB ». Vos changements y apparaissent tout de suite.' : '✅ Profil validé : Jocelyne va mettre votre fiche en ligne très bientôt.')
      : '⏳ Préparez votre fiche dès maintenant : elle sera visible une fois votre profil validé par Jocelyne.';
    return '<div class="pp-bloc">' +
      '<p class="pp-titre">🪪 Ma fiche sur « Nos pros ALB »</p>' +
      '<p class="pp-etat">' + etat + (f.en_ligne ? ' <a href="vitrine-pros.html" target="_blank">Voir « Nos pros ALB » →</a>' : '') + '</p>' +
      '<form id="pp-form" class="pp-form">' +
        '<div class="pp-photo"><span id="pp-apercu">' + (photo ? '<img src="' + e(photo) + '" alt="">' : '<span class="pp-sans-photo">👤</span>') + '</span>' +
          '<label class="pp-btn">📷 ' + (photo ? 'Changer la photo' : 'Ajouter une photo ou un logo') + '<input type="file" accept="image/*" id="pp-fichier" hidden></label>' +
          (photo ? '<button type="button" class="pp-btn pp-lien" id="pp-sans-photo">Retirer</button>' : '') + '</div>' +
        '<div class="pp-champ"><label for="pp-dispo">Ma disponibilité</label><select id="pp-dispo">' +
          Object.keys(DISPOS).map(function (k) { return '<option value="' + e(k) + '"' + (f.disponibilite === k ? ' selected' : '') + '>' + e(DISPOS[k]) + '</option>'; }).join('') +
        '</select><div class="pp-aide">« Indisponible » : vous ne recevez plus de nouvelles demandes (ou votre remplaçant les reçoit, voir plus bas).</div></div>' +
        '<div class="pp-champ"><span class="pp-label">Les rendez-vous que je propose</span><div class="pp-cases">' +
          '<label><input type="checkbox" id="pp-tel"' + (modes.telephone ? ' checked' : '') + '> 📞 Par téléphone</label>' +
          '<label><input type="checkbox" id="pp-visio"' + (modes.visio ? ' checked' : '') + '> 💻 En visio</label>' +
          '<label><input type="checkbox" id="pp-physique"' + (modes.physique ? ' checked' : '') + '> 🤝 En personne</label>' +
        '</div></div>' +
        '<div class="pp-champ"><label for="pp-presentation">Ma présentation <span class="pp-leger" id="pp-compteur"></span></label>' +
          '<textarea id="pp-presentation" maxlength="500" rows="4" placeholder="Votre parcours, votre façon de travailler, ce qui vous distingue…">' + e(f.presentation || '') + '</textarea></div>' +
        '<div class="pp-deux"><div class="pp-champ"><label for="pp-ville">Ville</label><input id="pp-ville" maxlength="80" value="' + e(f.ville || '') + '"></div>' +
          '<div class="pp-champ"><label for="pp-cp">Code postal</label><input id="pp-cp" inputmode="numeric" maxlength="5" value="' + e(f.code_postal || '') + '"></div></div>' +
        Object.keys(ZONES_PAR_DEPARTEMENT).map(function (dep) {
          return '<div class="pp-champ"><span class="pp-label">Mes zones d’intervention — ' + e(dep) + '</span><div class="pp-cases">' +
            ZONES_PAR_DEPARTEMENT[dep].map(function (z) {
              return '<label><input type="checkbox" class="pp-zone" value="' + e(z) + '"' + (zones.indexOf(z) !== -1 ? ' checked' : '') + '> ' + e(z) + '</label>';
            }).join('') + '</div></div>';
        }).join('') +
        '<div class="pp-champ"><label for="pp-autres">Autres zones <span class="pp-leger">— séparées par une virgule</span></label>' +
          '<input id="pp-autres" maxlength="200" value="' + e(zones.filter(function (z) { return ZONES_CONNUES.indexOf(z) === -1; }).join(', ')) + '"></div>' +
        '<p class="pp-aide">Nom de l’entreprise, SIRET, ORIAS, carte T ou label RGE : à changer avec Jocelyne (07 45 60 28 05), pour qu’elle puisse les vérifier.</p>' +
        '<div class="message" id="pp-msg-fiche"></div>' +
        '<button type="submit" class="bouton pp-enregistrer">💾 Enregistrer ma fiche</button>' +
      '</form></div>';
  }

  function blocRenvoi() {
    const r = fiche.mon_renvoi;
    let corps;
    if (!fiche.statut_verifie) {
      corps = '<p class="pp-aide">Disponible une fois votre profil validé par Jocelyne.</p>';
    } else if (r && r.statut === 'en_attente') {
      corps = '<p>⏳ Vous avez demandé à <strong>' + e(r.remplacant) + '</strong> de vous remplacer. En attente de sa réponse.</p>' +
        '<button type="button" class="pp-btn" data-action="annuler-renvoi">Annuler ma demande</button>';
    } else if (r && r.statut === 'accepte') {
      corps = '<p>✅ <strong>' + e(r.remplacant) + '</strong> a accepté de vous remplacer. ' +
        (fiche.disponibilite === 'non_disponible'
          ? 'Vous êtes « Indisponible » : <strong>vos nouvelles demandes lui sont envoyées</strong>.'
          : 'Dès que vous passez en « Indisponible », vos nouvelles demandes lui seront envoyées.') + '</p>' +
        '<button type="button" class="pp-btn" data-action="annuler-renvoi">Arrêter ce remplacement</button>';
    } else if (!confreres.length) {
      corps = '<p class="pp-aide">Pas encore de confrère du même métier sur ALB Immobilier. Ça viendra !</p>';
    } else {
      corps = '<p class="pp-aide">Pour vos congés ou une période chargée : un confrère de confiance prend vos nouvelles demandes pendant que vous êtes « Indisponible ». Il doit d’abord accepter.</p>' +
        '<div class="pp-champ"><label for="pp-confrere">Confrère</label><select id="pp-confrere"><option value="">— Choisissez —</option>' +
          confreres.map(function (c) {
            return '<option value="' + e(c.id) + '"' + (c.disponible ? '' : ' disabled') + '>' + e(c.nom) + (c.ville ? ' · ' + e(c.ville) : '') + (c.disponible ? '' : ' (indisponible)') + '</option>';
          }).join('') + '</select></div>' +
        '<div class="pp-champ"><label for="pp-mot">Un petit mot pour lui <span class="pp-leger">— facultatif</span></label><textarea id="pp-mot" maxlength="300" rows="2" placeholder="Ex. : je suis en congés du 1er au 15 août, merci !"></textarea></div>' +
        '<button type="button" class="pp-btn pp-oui" data-action="demander-renvoi">🔁 Lui demander de me remplacer</button>';
    }
    return '<div class="pp-bloc"><p class="pp-titre">🔁 Mon remplaçant</p>' + corps + '<div class="message" id="pp-msg-renvoi"></div></div>';
  }

  function blocDemandesRecues() {
    const liste = fiche.demandes_recues || [];
    if (!liste.length) return '';
    return '<div class="pp-bloc"><p class="pp-titre">🤝 Les confrères qui comptent sur vous</p>' +
      liste.map(function (d) {
        return '<div class="pp-demande">' +
          (d.statut === 'en_attente'
            ? '<p><strong>' + e(d.confrere) + '</strong> vous demande de le remplacer pendant qu’il est indisponible (demande du ' + e(dateCourte(d.cree_le)) + ').</p>' +
              (d.message ? '<p class="pp-mot">💬 ' + e(d.message) + '</p>' : '') +
              '<p class="pp-aide">Si vous acceptez, ses nouvelles demandes vous seront envoyées tant qu’il est « Indisponible ». Vous restez libre d’accepter ou non chaque demande.</p>' +
              '<div class="pp-boutons"><button type="button" class="pp-btn pp-oui" data-action="accepter-renvoi" data-renvoi="' + e(d.id) + '">✅ J’accepte</button>' +
              '<button type="button" class="pp-btn" data-action="refuser-renvoi" data-renvoi="' + e(d.id) + '">Je ne peux pas</button></div>'
            : '<p>✅ Vous remplacez <strong>' + e(d.confrere) + '</strong>' + (d.confrere_indisponible ? ' : il est indisponible, ses nouvelles demandes vous arrivent.' : ' quand il sera indisponible.') + '</p>' +
              '<div class="pp-boutons"><button type="button" class="pp-btn" data-action="refuser-renvoi" data-renvoi="' + e(d.id) + '">Arrêter de le remplacer</button></div>') +
          '<div class="message" id="pp-msg-' + e(d.id) + '"></div></div>';
      }).join('') + '</div>';
  }

  function dessiner(profilId) {
    const zone = el('profil-pro');
    if (!zone || !fiche) return;
    zone.innerHTML = blocFiche() + blocRenvoi() + blocDemandesRecues();
    const compteur = function () { el('pp-compteur').textContent = '— ' + el('pp-presentation').value.length + ' / 500'; };
    el('pp-presentation').addEventListener('input', compteur); compteur();
    el('pp-fichier').addEventListener('change', function () { changerPhoto(this.files[0], profilId); });
    if (el('pp-sans-photo')) el('pp-sans-photo').addEventListener('click', function () {
      photoEnAttente = ''; el('pp-apercu').innerHTML = '<span class="pp-sans-photo">👤</span>';
      message('pp-msg-fiche', 'info', 'Photo retirée : cliquez sur « Enregistrer ma fiche » pour confirmer.');
    });
    el('pp-form').addEventListener('submit', function (ev) { ev.preventDefault(); enregistrer(profilId); });
  }

  // ---------- Actions ----------
  async function enregistrer(profilId) {
    const cp = el('pp-cp').value.trim();
    if (cp && !/^[0-9]{5}$/.test(cp)) { message('pp-msg-fiche', 'erreur', ERREURS.CP_INVALIDE); return; }
    const zones = Array.from(document.querySelectorAll('.pp-zone:checked')).map(function (c) { return c.value; })
      .concat(el('pp-autres').value.split(',').map(function (z) { return z.trim(); }).filter(Boolean));
    const bouton = document.querySelector('.pp-enregistrer');
    bouton.disabled = true;
    const { error } = await albSupabase.rpc('alb_pro_modifier_fiche', { p_fiche: {
      presentation: el('pp-presentation').value.trim(), ville: el('pp-ville').value.trim(), code_postal: cp, zones: zones,
      photo_url: photoEnAttente !== null ? photoEnAttente : (fiche.photo_url || ''),
      modes: { telephone: el('pp-tel').checked, visio: el('pp-visio').checked, physique: el('pp-physique').checked },
      disponibilite: el('pp-dispo').value
    } });
    bouton.disabled = false;
    if (error) { console.error('[ALB DEBUG] fiche pro :', error); message('pp-msg-fiche', 'erreur', erreurDe(error)); return; }
    photoEnAttente = null;
    await charger();
    dessiner(profilId);
    message('pp-msg-fiche', 'succes', fiche.en_ligne ? 'C’est enregistré ✅ Votre fiche est déjà à jour sur « Nos pros ALB ».' : 'C’est enregistré ✅');
  }

  async function agirRenvoi(bouton, profilId) {
    const action = bouton.dataset.action;
    let r;
    if (action === 'demander-renvoi') {
      const id = el('pp-confrere').value;
      if (!id) { message('pp-msg-renvoi', 'erreur', 'Choisissez un confrère.'); return; }
      bouton.disabled = true;
      r = await albSupabase.rpc('alb_renvoi_demander', { p_remplacant: id, p_message: el('pp-mot').value.trim() || null });
    } else if (action === 'annuler-renvoi') {
      if (!window.confirm('Vous arrêtez ce remplacement ?')) return;
      bouton.disabled = true;
      r = await albSupabase.rpc('alb_renvoi_annuler');
    } else {
      if (action === 'refuser-renvoi' && !window.confirm('Vous confirmez ? Votre confrère sera prévenu.')) return;
      bouton.disabled = true;
      r = await albSupabase.rpc('alb_renvoi_repondre', { p_renvoi: bouton.dataset.renvoi, p_decision: action === 'accepter-renvoi' ? 'accepter' : 'refuser' });
    }
    const idMsg = bouton.dataset.renvoi ? 'pp-msg-' + bouton.dataset.renvoi : 'pp-msg-renvoi';
    if (r.error) { bouton.disabled = false; message(idMsg, 'erreur', erreurDe(r.error)); return; }
    await charger();
    dessiner(profilId);
    const textes = {
      'demander-renvoi': 'C’est envoyé ✅ Votre confrère reçoit un e-mail pour accepter.',
      'annuler-renvoi': 'C’est noté.',
      'accepter-renvoi': 'Merci ✅ Votre confrère est prévenu.',
      'refuser-renvoi': 'C’est noté, votre confrère est prévenu.'
    };
    message(action === 'accepter-renvoi' || action === 'refuser-renvoi' ? 'pp-msg-renvoi' : 'pp-msg-renvoi', 'succes', textes[action]);
  }

  async function charger() {
    const [a, b] = await Promise.all([albSupabase.rpc('alb_pro_ma_fiche'), albSupabase.rpc('alb_pro_confreres')]);
    if (a.error) throw a.error;
    fiche = a.data;
    confreres = b.data || [];
  }

  function styles() {
    if (el('pp-styles')) return;
    const s = document.createElement('style');
    s.id = 'pp-styles';
    s.textContent = [
      '.pp-bloc{border:1px solid #E8E6E1;border-radius:10px;padding:14px;margin-top:14px;font-size:.92rem;}',
      '.pp-bloc p{margin-top:6px;}',
      '.pp-titre{font-weight:700;color:#5A3A6A;margin-top:0 !important;}',
      '.pp-etat{font-size:.88rem;}',
      '.pp-etat a{color:#5A3A6A;font-weight:600;}',
      '.pp-form{margin-top:10px;}',
      '.pp-photo{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;}',
      '#pp-apercu img,.pp-sans-photo{width:84px;height:84px;border-radius:50%;object-fit:cover;background:#EFEAE3;display:flex;align-items:center;justify-content:center;font-size:2rem;}',
      '.pp-champ{margin-bottom:12px;}',
      '.pp-champ label,.pp-label{display:block;font-weight:600;font-size:.88rem;margin-bottom:6px;}',
      '.pp-champ input:not([type=checkbox]),.pp-champ select,.pp-champ textarea{width:100%;padding:10px;border:1px solid #D8D5CE;border-radius:6px;font-family:inherit;font-size:.95rem;background:#fff;color:#4A4A47;}',
      '.pp-champ textarea{resize:vertical;}',
      '.pp-cases{display:flex;flex-wrap:wrap;gap:8px;}',
      '.pp-cases label{display:flex;align-items:center;gap:6px;font-weight:500;font-size:.88rem;background:#FBF8F3;border:1px solid #E8E6E1;border-radius:6px;padding:7px 10px;margin:0;cursor:pointer;}',
      '.pp-cases input{accent-color:#5A3A6A;width:16px;height:16px;}',
      '.pp-deux{display:grid;grid-template-columns:1fr;gap:0 12px;}',
      '@media (min-width:600px){.pp-deux{grid-template-columns:2fr 1fr;}}',
      '.pp-leger{font-weight:400;color:#7a7a75;}',
      '.pp-aide{font-size:.8rem;color:#7a7a75;margin-top:4px;}',
      '.pp-btn{display:inline-block;border:1px solid #D8D5CE;background:#FBF8F3;color:#4A4A47;border-radius:6px;padding:9px 12px;font-family:inherit;font-size:.9rem;font-weight:600;cursor:pointer;}',
      '.pp-btn:hover{border-color:#5A3A6A;color:#5A3A6A;}',
      '.pp-oui{background:#EEF6EE;border-color:#CBE3CD;color:#2E6B34;}',
      '.pp-lien{background:none;border:none;text-decoration:underline;padding:4px;}',
      '.pp-boutons{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}',
      '.pp-demande{border-top:1px dashed #E8E6E1;padding-top:10px;margin-top:10px;}',
      '.pp-mot{font-style:italic;overflow-wrap:anywhere;}',
      '.pp-bloc .message{margin:10px 0 0;}',
      '.pp-enregistrer{margin-top:8px;}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------- Point d'entrée, appelé par espace-alb.html (pros seulement) ----------
  window.albMonProfilPro = async function (profil) {
    const zone = el('profil-pro');
    if (!zone || !profil || !profil.id || profil.role === 'particulier') return;
    styles();
    if (!zone.dataset.branche) {
      zone.dataset.branche = '1';
      zone.addEventListener('click', function (ev) {
        const b = ev.target.closest('[data-action]');
        if (!b || b.disabled) return;
        agirRenvoi(b, profil.id);
      });
    }
    try { await charger(); } catch (ex) {
      console.error('[ALB DEBUG] ma fiche pro :', ex);
      zone.innerHTML = '<div class="message visible erreur">Votre fiche n’a pas pu être chargée. Rechargez la page dans un instant.</div>';
      return;
    }
    dessiner(profil.id);
  };
})();

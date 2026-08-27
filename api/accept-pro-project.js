/**
 * API: accept-pro-project.js
 * 
 * Gère l'acceptation d'un lead
 * - Ajoute le pro à pros_acceptes
 * - Si nombre_pros_max atteint : envoie template #9 aux autres
 * - Sinon : continue à accepter d'autres pros
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function htmlResponse(title, body, status = 200) {
  return new Response(
    `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin:0; padding:0; background: linear-gradient(135deg, #4B1A3E 0%, #6b2d5f 100%); color:#fff; }
    .wrap { max-width: 700px; margin: 0 auto; padding: 3rem 1rem; }
    .card { background:#fff; color:#333; border-radius:14px; padding:2rem; box-shadow:0 10px 30px rgba(0,0,0,.18); }
    h1 { color:#4B1A3E; margin-top:0; }
    p { color:#555; line-height:1.6; }
    .ok { font-size:54px; margin-bottom:1rem; }
    .info { background:#fff3e0; border-left:5px solid #B28E3D; padding:1rem; border-radius:8px; }
    .muted { font-size:12px; color:#777; margin-top:1rem; }
  </style>
</head>
<body>
  <div class="wrap"><div class="card">${body}</div></div>
</body>
</html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

function toCurrency(v) {
  return Number(v || 0).toLocaleString('fr-FR');
}

/**
 * Envoyer template #10 : Notification au particulier avec le(s) pro(s) gagnant(s)
 */
async function sendNotificationParticulier(particulier, prosGagnants, proProject) {
  try {
    const proNames = prosGagnants
      .map(p => `${p.prenom || ''} ${p.nom || ''}`.trim())
      .filter(Boolean)
      .join(' et ');

    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: [{ email: particulier.email, name: `${particulier.prenom || ''} ${particulier.nom || ''}`.trim() }],
        templateId: 10,
        params: {
          CLIENT_PRENOM: particulier.prenom || '',
          PRO_NOM: prosGagnants[0]?.nom || '',
          PRO_PRENOM: prosGagnants[0]?.prenom || '',
          PRO_EMAIL: prosGagnants[0]?.email || '',
          PRO_TEL: prosGagnants[0]?.telephone || '',
          PRO_ROLE: prosGagnants[0]?.role || 'pro',
          SENDER: 'ALB Sud Immobilier'
        }
      })
    });
    console.log(`[ALB DEBUG] Template #10 sent to particulier ${particulier.email}`);
  } catch (error) {
    console.error(`[ALB ERROR] Failed to send template #10: ${error.message}`);
  }
}

/**
 * Envoyer template #22 : Coordonnées particulier au pro gagnant
 */
async function sendParticulierCoordonnees(pro, particulier, proProject) {
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: [{ email: pro.email, name: `${pro.prenom || ''} ${pro.nom || ''}`.trim() }],
        templateId: 22, // Coordonnées particulier au pro gagnant
        params: {
          PRO_PRENOM: pro.prenom || '',
          CLIENT_NOM: particulier.nom || '',
          CLIENT_PRENOM: particulier.prenom || '',
          CLIENT_EMAIL: particulier.email || '',
          CLIENT_TEL: particulier.telephone || '',
          CLIENT_CP: particulier.code_postal || '',
          PROJET_TITRE: proProject.titre || '',
          SENDER: 'ALB Sud Immobilier'
        }
      })
    });
    console.log(`[ALB DEBUG] Template #22 sent to ${pro.email}`);
  } catch (error) {
    console.error(`[ALB ERROR] Failed to send template #22: ${error.message}`);
  }
}

/**
 * Envoyer template #9 : Lead remporté aux autres pros
 */
async function notifyOtherPros(proProject, prosGagnants, allPros) {
  try {
    const gagnantIds = prosGagnants.map(p => p.id);
    const othersToNotify = allPros.filter(p => !gagnantIds.includes(p.id) && p.email);

    for (const pro of othersToNotify) {
      try {
        const gagnantNames = prosGagnants
          .map(p => `${p.prenom || ''} ${p.nom || ''}`.trim())
          .filter(Boolean)
          .join(' et ');

        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: [{ email: pro.email, name: `${pro.prenom || ''} ${pro.nom || ''}`.trim() }],
            templateId: 9,
            params: {
              PRO_PRENOM: pro.prenom || '',
              PROJET_TITRE: proProject.titre || '',
              PROJET_TYPE: proProject.type || '',
              BUDGET_MAX: toCurrency(proProject.budget || 0),
              PROJET_LOCALISATION: proProject.localisation || '',
              PRO_GAGNANT_NOM: prosGagnants[0]?.nom || '',
              PRO_GAGNANT_PRENOM: prosGagnants[0]?.prenom || '',
              SENDER: 'ALB Sud Immobilier'
            }
          })
        });
      } catch (error) {
        console.error(`[ALB ERROR] Failed to send template #9 to ${pro.email}: ${error.message}`);
      }
    }

    console.log(`[ALB DEBUG] Template #9 sent to ${othersToNotify.length} other pros`);
  } catch (error) {
    console.error(`[ALB ERROR] Failed to notify other pros: ${error.message}`);
  }
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const proProjectId = url.searchParams.get('pro_project_id');

    if (!proProjectId) {
      return htmlResponse(
        'Erreur',
        `<div class="ok">⛔</div><h1>Paramètre manquant</h1><p>L'ID du projet est requis.</p>`
      );
    }

    // Récupérer le pro_project
    const { data: proProject, error: projectError } = await supabase
      .from('pro_projects')
      .select('*')
      .eq('id', proProjectId)
      .single();

    if (projectError || !proProject) {
      return htmlResponse(
        'Projet introuvable',
        `<div class="ok">⛔</div><h1>Projet introuvable</h1><p>Ce projet n'existe pas.</p>`
      );
    }

    // Récupérer le pro qui accepte
    const { data: pro } = await supabase
      .from('profiles')
      .select('id, email, prenom, nom, telephone, role')
      .eq('id', proProject.pro_id)
      .single();

    // Récupérer le particulier
    const { data: particulier } = await supabase
      .from('profiles')
      .select('id, email, prenom, nom, telephone, code_postal')
      .eq('id', proProject.particulier_id)
      .single();

    if (!pro || !particulier) {
      return htmlResponse(
        'Erreur',
        `<div class="ok">⛔</div><h1>Données manquantes</h1><p>Impossible de traiter la demande.</p>`
      );
    }

    // Vérifier si ce pro a déjà accepté
    if (proProject.pros_acceptes?.includes(pro.id)) {
      return htmlResponse(
        'Déjà accepté',
        `<div class="ok">✅</div><h1>Vous avez déjà accepté</h1><p>Votre acceptation a déjà été enregistrée.</p>`
      );
    }

    // Ajouter le pro à pros_acceptes
    const updatedProsAcceptes = [...(proProject.pros_acceptes || []), pro.id];
    const isMaxReached = updatedProsAcceptes.length >= proProject.nombre_pros_max;

    // Déterminer le nouveau statut
    const newStatus = isMaxReached ? 'en_cours' : 'en_cours'; // Reste en_cours tant que pas tout accepté

    // Mettre à jour le pro_project
    const { error: updateError } = await supabase
      .from('pro_projects')
      .update({
        pros_acceptes: updatedProsAcceptes,
        statut: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', proProjectId);

    if (updateError) {
      return htmlResponse(
        'Erreur',
        `<div class="ok">⛔</div><h1>Erreur de mise à jour</h1><p>${updateError.message}</p>`
      );
    }

    // Envoyer les emails
    await sendNotificationParticulier(particulier, [pro], proProject);
    await sendParticulierCoordonnees(pro, particulier, proProject);

    // Si nombre max atteint, notifier les autres pros
    if (isMaxReached) {
      // Récupérer tous les pros alertés pour envoyer le template #9
      let allProsAlerted = [];
      if (proProject.mode_selection === 'manuel' && proProject.pros_selectionnes?.length > 0) {
        const { data: selectedPros } = await supabase
          .from('profiles')
          .select('id, email, prenom, nom, role')
          .in('id', proProject.pros_selectionnes);
        allProsAlerted = selectedPros || [];
      } else {
        const dept = String(proProject.code_postal || '').substring(0, 2);
        let query = supabase
          .from('profiles')
          .select('id, email, prenom, nom, role')
          .eq('actif', true);
        if (dept) {
          query = query.ilike('code_postal', `${dept}%`);
        }
        const { data: allPros } = await query;
        allProsAlerted = (allPros || []).filter(p => p.email);
      }

      await notifyOtherPros(proProject, updatedProsAcceptes.length === 1 ? [pro] : [pro], allProsAlerted);
    }

    return htmlResponse(
      'Acceptation enregistrée',
      `
        <div class="ok">✅</div>
        <h1>Acceptation enregistrée</h1>
        <p>Merci ! Vous allez pouvoir contacter le client.</p>
        <div class="info">
          <strong>Projet :</strong> ${proProject.titre || ''}<br>
          <strong>Client :</strong> ${particulier.prenom || ''} ${particulier.nom || ''}<br>
          <strong>Email :</strong> ${particulier.email || ''}<br>
          <strong>Téléphone :</strong> ${particulier.telephone || ''}
        </div>
        <p class="muted">Les coordonnées complètes du client vous ont été envoyées par mail.</p>
      `
    );

  } catch (err) {
    console.error('[ALB ERROR] accept-pro-project error:', err);
    return htmlResponse(
      'Erreur serveur',
      `<div class="ok">⛔</div><h1>Erreur serveur</h1><p>${err.message}</p>`,
      500
    );
  }
};

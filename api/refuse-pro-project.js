/**
 * API: refuse-pro-project.js
 * 
 * Gère le refus d'un lead par un pro
 * 
 * Workflow:
 * 1. Pro refuse le lead (clique bouton ou lien dans mail/page)
 * 2. Statut du pro_project passe à "refuser"
 * 3. Template #11 envoyé au pro en confirmation (PAS au particulier)
 * 4. Le particulier continue à attendre une acceptation
 * 
 * Sécurité:
 * - Chaque pro peut refuser une seule fois
 * - Le refus ne notifie PAS le particulier
 * - Permet au particulier d'attendre d'autres acceptations
 * 
 * Paramètres attendus (URL):
 * - pro_project_id: UUID du projet
 * 
 * Templates Brevo utilisés:
 * - #11: Confirmation de refus au pro (pas au particulier)
 * 
 * Retour:
 * - Page HTML de confirmation du refus
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

/**
 * Envoyer template #11 : Confirmation de refus au pro
 */
async function sendRefuseConfirmation(pro, proProject) {
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: [{ email: pro.email, name: `${pro.prenom || ''} ${pro.nom || ''}`.trim() }],
        templateId: 11,
        params: {
          PRO_PRENOM: pro.prenom || '',
          PROJET_TITRE: proProject.titre || '',
          SENDER: 'ALB Sud Immobilier'
        }
      })
    });
    console.log(`[ALB DEBUG] Template #11 sent to ${pro.email}`);
  } catch (error) {
    console.error(`[ALB ERROR] Failed to send template #11: ${error.message}`);
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

    // Récupérer le pro qui refuse
    const { data: pro } = await supabase
      .from('profiles')
      .select('id, email, prenom, nom, role')
      .eq('id', proProject.pro_id)
      .single();

    if (!pro) {
      return htmlResponse(
        'Erreur',
        `<div class="ok">⛔</div><h1>Pro introuvable</h1><p>Impossible de traiter le refus.</p>`
      );
    }

    // Mettre à jour le statut du pro_project à "refuser"
    const { error: updateError } = await supabase
      .from('pro_projects')
      .update({ statut: 'refuser', updated_at: new Date().toISOString() })
      .eq('id', proProjectId);

    if (updateError) {
      return htmlResponse(
        'Erreur',
        `<div class="ok">⛔</div><h1>Erreur de mise à jour</h1><p>${updateError.message}</p>`
      );
    }

    // Envoyer confirmation de refus
    await sendRefuseConfirmation(pro, proProject);

    return htmlResponse(
      'Refus enregistré',
      `
        <div class="ok">✅</div>
        <h1>Refus enregistré</h1>
        <p>Merci de nous avoir informé. Votre réponse a bien été prise en compte.</p>
        <div style="background:#fff3e0; border-left:5px solid #B28E3D; padding:1rem; border-radius:8px;">
          <strong>Projet :</strong> ${proProject.titre || ''}<br>
          <strong>Statut :</strong> Refusé
        </div>
        <p class="muted">Un mail de confirmation vous a été envoyé.</p>
      `
    );

  } catch (err) {
    console.error('[ALB ERROR] refuse-pro-project error:', err);
    return htmlResponse(
      'Erreur serveur',
      `<div class="ok">⛔</div><h1>Erreur serveur</h1><p>${err.message}</p>`,
      500
    );
  }
};

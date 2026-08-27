/**
 * API: consult-pro-project.js
 * 
 * Affiche les détails d'un pro_project
 * Permet au pro de voir complètement avant d'accepter/refuser
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    .info { background:#fff3e0; border-left:5px solid #B28E3D; padding:1rem; border-radius:8px; margin:1rem 0; }
    .buttons { display:flex; gap:12px; margin-top:2rem; flex-wrap:wrap; }
    .btn { padding:12px 24px; text-decoration:none; border-radius:8px; font-weight:bold; display:inline-block; border:none; cursor:pointer; }
    .btn-accept { background:#2f7d57; color:white; }
    .btn-refuse { background:#a44646; color:white; }
    .btn:hover { opacity:0.9; }
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

export default async (req) => {
  try {
    const url = new URL(req.url);
    const proProjectId = url.searchParams.get('pro_project_id');

    if (!proProjectId) {
      return htmlResponse(
        'Erreur',
        `<div style="text-align:center;"><h1>⛔ Paramètre manquant</h1><p>L'ID du projet est requis.</p></div>`
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
        `<div style="text-align:center;"><h1>⛔ Projet introuvable</h1><p>Ce projet n'existe pas.</p></div>`
      );
    }

    // Récupérer le particulier
    const { data: particulier } = await supabase
      .from('profiles')
      .select('prenom, nom, telephone, code_postal')
      .eq('id', proProject.particulier_id)
      .single();

    const PUBLIC_URL = process.env.PUBLIC_URL || 'https://alb-sud-immobilier.netlify.app';
    const acceptLink = `${PUBLIC_URL}/.netlify/functions/accept-pro-project?pro_project_id=${proProjectId}`;
    const refuseLink = `${PUBLIC_URL}/.netlify/functions/refuse-pro-project?pro_project_id=${proProjectId}`;

    return htmlResponse(
      'Détails du projet',
      `
        <h1>${proProject.titre}</h1>
        
        <div class="info">
          <strong>Type :</strong> ${proProject.type || ''}<br>
          <strong>Localisation :</strong> ${proProject.localisation || ''} (${proProject.code_postal || ''})<br>
          <strong>Budget :</strong> ${toCurrency(proProject.budget || 0)} €
        </div>

        <h3>Description</h3>
        <p>${proProject.description || 'Aucune description fournie.'}</p>

        <h3>Particulier</h3>
        <div class="info">
          <strong>Nom :</strong> ${particulier?.prenom || ''} ${particulier?.nom || ''}<br>
          <strong>Téléphone :</strong> ${particulier?.telephone || 'Non fourni'}<br>
          <strong>Code postal :</strong> ${particulier?.code_postal || 'Non fourni'}
        </div>

        <div class="buttons">
          <a href="${acceptLink}" class="btn btn-accept">✓ Accepter</a>
          <a href="${refuseLink}" class="btn btn-refuse">✗ Refuser</a>
        </div>

        <p class="muted">Après acceptation, vous recevrez les coordonnées complètes du client.</p>
      `
    );

  } catch (err) {
    console.error('[ALB ERROR] consult-pro-project error:', err);
    return htmlResponse(
      'Erreur serveur',
      `<div style="text-align:center;"><h1>⛔ Erreur serveur</h1><p>${err.message}</p></div>`,
      500
    );
  }
};

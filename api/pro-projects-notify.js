/**
 * API: pro-projects-notify.js
 * 
 * Envoie les alertes initiales (template #8) à TOUS les pros concernés
 * Mode auto: tous les pros de la zone
 * Mode manuel: uniquement les pros sélectionnés
 * 
 * Les N premiers qui acceptent remportent le lead (N = nombre_pros_max)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://alb-sud-immobilier.netlify.app';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function toCurrency(v) {
  return Number(v || 0).toLocaleString('fr-FR');
}

/**
 * Envoyer template #8 : Alerte demande au pro avec boutons
 */
async function sendAlertToPro(pro, proProject) {
  try {
    const consultLink = `${PUBLIC_URL}/.netlify/functions/consult-pro-project?pro_project_id=${proProject.id}`;
    const acceptLink = `${PUBLIC_URL}/.netlify/functions/accept-pro-project?pro_project_id=${proProject.id}`;
    const refuseLink = `${PUBLIC_URL}/.netlify/functions/refuse-pro-project?pro_project_id=${proProject.id}`;

    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: [{ email: pro.email, name: `${pro.prenom || ''} ${pro.nom || ''}`.trim() }],
        templateId: 8,
        params: {
          PRO_PRENOM: pro.prenom || '',
          PRO_NOM: pro.nom || '',
          PROJET_TITRE: proProject.titre || '',
          PROJET_TYPE: proProject.type || '',
          BUDGET_MAX: toCurrency(proProject.budget || 0),
          PROJET_LOCALISATION: proProject.localisation || '',
          PROJET_CODE_POSTAL: proProject.code_postal || '',
          PROJET_DESCRIPTION: proProject.description || '',
          CONSULT_LINK: consultLink,
          ACCEPT_LINK: acceptLink,
          REFUSE_LINK: refuseLink,
          SENDER: 'ALB Sud Immobilier'
        }
      })
    });

    console.log(`[ALB DEBUG] Template #8 sent to ${pro.email}`);
  } catch (error) {
    console.error(`[ALB ERROR] Failed to send alert to ${pro.email}: ${error.message}`);
  }
}

export default async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const { pro_project_id } = await req.json();

    if (!pro_project_id) {
      return json({ error: 'Missing pro_project_id' }, 400);
    }

    // Récupérer le pro_project
    const { data: proProject, error: projectError } = await supabase
      .from('pro_projects')
      .select('*')
      .eq('id', pro_project_id)
      .single();

    if (projectError || !proProject) {
      return json({ error: 'Pro project not found' }, 404);
    }

    // Déterminer les pros à alerter
    let prosToAlert = [];

    if (proProject.mode_selection === 'manuel' && proProject.pros_selectionnes?.length > 0) {
      // Mode manuel: récupérer uniquement les pros sélectionnés
      const { data: selectedPros } = await supabase
        .from('profiles')
        .select('id, email, prenom, nom, role')
        .in('id', proProject.pros_selectionnes);
      
      prosToAlert = selectedPros || [];
    } else {
      // Mode auto: récupérer tous les pros de la zone
      const dept = String(proProject.code_postal || '').substring(0, 2);
      
      let query = supabase
        .from('profiles')
        .select('id, email, prenom, nom, role')
        .eq('actif', true);
      
      if (dept) {
        query = query.ilike('code_postal', `${dept}%`);
      }

      const { data: allPros } = await query;
      prosToAlert = (allPros || []).filter(p => p.email);
    }

    if (prosToAlert.length === 0) {
      return json({ success: false, message: 'Aucun pro trouvé pour cette zone' }, 400);
    }

    // Envoyer alerte à tous les pros
    for (const pro of prosToAlert) {
      await sendAlertToPro(pro, proProject);
    }

    console.log(`[ALB DEBUG] Alerted ${prosToAlert.length} pros for project ${pro_project_id}`);
    return json({ success: true, pros_alerted: prosToAlert.length }, 200);

  } catch (err) {
    console.error('[ALB ERROR] pro-projects-notify error:', err);
    return json({ error: err.message || 'Internal server error' }, 500);
  }
};

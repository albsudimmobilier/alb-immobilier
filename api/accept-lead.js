import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function htmlPage(title, body) {
  return new Response(
    `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #4B1A3E 0%, #6b2d5f 100%); color: #fff; }
    .container { max-width: 700px; margin: 0 auto; padding: 3rem 1rem; }
    .card { background: #fff; color: #333; border-radius: 14px; padding: 2rem; box-shadow: 0 8px 28px rgba(0,0,0,.18); }
    h1 { color: #4B1A3E; margin-top: 0; }
    p { line-height: 1.6; color: #555; }
    .success { font-size: 54px; margin-bottom: 1rem; }
    .alert { background: #e8f5e9; border-left: 5px solid #2E7D32; padding: 1rem; margin-top: 1rem; border-radius: 8px; }
    .alert strong { color: #2E7D32; }
    .muted { font-size: 12px; color: #777; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${body}
    </div>
  </div>
</body>
</html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function normalizeDept(codePostal) {
  if (!codePostal) return null;
  const cp = String(codePostal).trim();
  if (cp.length < 2) return null;
  return parseInt(cp.substring(0, 2), 10);
}

function toCurrency(value) {
  return Number(value || 0).toLocaleString('fr-FR');
}

export default async (req) => {
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const url = new URL(req.url);
    const demandeId = url.searchParams.get('demande_id');
    const courtierId = url.searchParams.get('courtier_id');

    if (!demandeId || !courtierId) {
      return json({ error: 'Missing parameters' }, 400);
    }

    const { data: demande, error: demandeError } = await supabase
      .from('demandes_financement')
      .select('*')
      .eq('id', demandeId)
      .single();

    if (demandeError || !demande) {
      return htmlPage(
        'Demande introuvable',
        `
          <div class="success">⛔</div>
          <h1>Demande introuvable</h1>
          <p>La demande de financement demandée n’existe pas ou n’est plus accessible.</p>
          <div class="muted">Veuillez vérifier le lien utilisé.</div>
        `
      );
    }

    const acceptedIds = Array.isArray(demande.courtier_ids_acceptes) ? [...demande.courtier_ids_acceptes] : [];
    const rejectedIds = Array.isArray(demande.courtier_ids_rejetes) ? [...demande.courtier_ids_rejetes] : [];

    if (acceptedIds.includes(courtierId)) {
      return htmlPage(
        'Lead déjà accepté',
        `
          <div class="success">✅</div>
          <h1>Lead déjà accepté</h1>
          <p>Vous avez déjà accepté ce lead.</p>
        `
      );
    }

    if (acceptedIds.length >= 2) {
      return htmlPage(
        'Lead remporté',
        `
          <div class="success">⏰</div>
          <h1>Lead déjà remporté</h1>
          <p>Ce lead a déjà été remporté par deux courtiers.</p>
        `
      );
    }

    acceptedIds.push(courtierId);

    const newStatus = acceptedIds.length >= 2 ? 'remportee' : 'acceptee_courtier';

    const { error: updateError } = await supabase
      .from('demandes_financement')
      .update({
        courtier_ids_acceptes: acceptedIds,
        statut: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', demandeId);

    if (updateError) {
      console.error('Update error:', updateError);
      return json({ error: 'Update failed' }, 500);
    }

    const { data: courtierAcceptes, error: courtierAcceptesError } = await supabase
      .from('profiles')
      .select('id, prenom, nom, email, telephone')
      .in('id', acceptedIds);

    if (courtierAcceptesError) {
      console.error('Courtiers acceptés error:', courtierAcceptesError);
    }

    const { data: courtierCourant } = await supabase
      .from('profiles')
      .select('id, prenom, nom, email, telephone')
      .eq('id', courtierId)
      .single();

    const department = normalizeDept(demande.code_postal);

    let courtiersZone = [];
    if (department) {
      const { data: allCourtiers } = await supabase
        .from('profiles')
        .select('id, email, prenom, nom, departement, code_poste, role, actif, statut_verifie')
        .eq('role', 'courtier')
        .eq('actif', true);

      courtiersZone = (allCourtiers || []).filter(c => {
        if (!c) return false;
        if (c.statut_verifie === false) return false;
        const deptOk = c.departement ? String(c.departement).trim() === String(department).trim() : false;
        const cpOk = c.code_poste ? String(c.code_poste).startsWith(String(department).padStart(2, '0')) : false;
        return deptOk || cpOk;
      });
    }

    const winnerNames = (courtierAcceptes || [])
      .map(c => `${c.prenom || ''} ${c.nom || ''}`.trim())
      .filter(Boolean)
      .join(' et ');

    const winnerCurrentName = courtierCourant
      ? `${courtierCourant.prenom || ''} ${courtierCourant.nom || ''}`.trim()
      : '';

    const templateNotifyCourtiers = 9;
    const templateNotifyParticulier = 10;

    const notifyCourtiersPromises = courtiersZone
      .filter(c => c.email)
      .map(courtier =>
        fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: [{ email: courtier.email, name: `${courtier.prenom || ''} ${courtier.nom || ''}`.trim() }],
            templateId: templateNotifyCourtiers,
            params: {
              COURTIER_PRENOM: courtier.prenom || '',
              COURTIER_GAGNANT: winnerNames || winnerCurrentName,
              CLIENT_NOM: demande.nom || '',
              CLIENT_PRENOM: demande.prenom || '',
              CLIENT_CP: demande.code_postal || '',
              BUDGET_MAX: toCurrency(demande.budget_max_declare),
              SENDER: 'ALB Sud Immobilier'
            }
          })
        })
      );

    const notifyParticulierPromise = fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: [{ email: demande.email, name: `${demande.prenom || ''} ${demande.nom || ''}`.trim() }],
        templateId: templateNotifyParticulier,
        params: {
          CLIENT_PRENOM: demande.prenom || '',
          COURTIER_GAGNANTS: winnerNames || winnerCurrentName,
          COURTIER_DETAILS: (courtierAcceptes || [])
            .map(c => `<p><strong>${c.prenom || ''} ${c.nom || ''}</strong><br>📞 ${c.telephone || ''}</p>`)
            .join(''),
          BUDGET_MAX: toCurrency(demande.budget_max_declare),
          SENDER: 'ALB Sud Immobilier'
        }
      })
    });

    await Promise.all([...notifyCourtiersPromises, notifyParticulierPromise]);

    return htmlPage(
      'Lead accepté',
      `
        <div class="success">✅</div>
        <h1>Lead accepté</h1>
        <p>Le lead a bien été pris en charge.</p>
        <div class="alert">
          <strong>Client :</strong> ${demande.prenom || ''} ${demande.nom || ''}<br>
          <strong>Email :</strong> ${demande.email || ''}<br>
          <strong>Téléphone :</strong> ${demande.telephone || ''}<br>
          <strong>Code postal :</strong> ${demande.code_postal || ''}<br>
          <strong>Budget :</strong> ${toCurrency(demande.budget_max_declare)} €
        </div>
        <p>Les notifications ont été envoyées aux courtiers concernés.</p>
        <div class="muted">Statut actuel : <strong>${newStatus}</strong></div>
      `
    );
  } catch (err) {
    console.error('Error:', err);
    return json({ error: err.message || 'Internal server error' }, 500);
  }
};

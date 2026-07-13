import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async (req, context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const demande_id = url.searchParams.get('demande_id');
    const courtier_id = url.searchParams.get('courtier_id');

    if (!demande_id || !courtier_id) {
      return new Response('Missing parameters', { status: 400 });
    }

    // Récupérer la demande
    const { data: demande, error: demandeError } = await supabase
      .from('demandes_financement')
      .select('*')
      .eq('id', demande_id)
      .single();

    if (demandeError || !demande) {
      return new Response('Demande not found', { status: 404 });
    }

    const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    const piecesHtml = (demande.pieces_fournies || []).length > 0 
      ? demande.pieces_fournies.map(p => {
          const labels = {
            'avis_imposition': 'Avis d\'imposition',
            'contrat_travail': 'Contrat de travail',
            'fiches_paie': '3 dernières fiches de paie',
            'cni': 'Pièce d\'identité',
            'charges': 'Relevé des charges',
            'credits': 'Crédits en cours'
          };
          return `<li>${labels[p] || p}</li>`;
        }).join('')
      : '<li style="color: #999;">Aucune pièce fournie</li>';

    const domain = new URL(req.url).origin;
    const acceptLink = `${domain}/.netlify/functions/accept-lead?demande_id=${demande_id}&courtier_id=${courtier_id}`;
    const refuseLink = `${domain}/.netlify/functions/refuse-lead-email?demande_id=${demande_id}&courtier_id=${courtier_id}`;

    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Détails du lead - ALB Immobilier</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
            padding: 2rem;
            color: #2b2b2b;
          }
          .container {
            max-width: 700px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.12);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #4B1A3E 0%, #6b2d5f 100%);
            color: white;
            padding: 2rem;
            text-align: center;
          }
          .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 0.5rem;
          }
          .header p {
            opacity: 0.95;
            font-size: 14px;
          }
          .content {
            padding: 2rem;
          }
          .section {
            margin-bottom: 2rem;
          }
          .section-title {
            color: #4B1A3E;
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 1rem;
            padding-bottom: 0.75rem;
            border-bottom: 2px solid #f5f5f5;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin-bottom: 1rem;
          }
          .info-item {
            background: #f5f5f5;
            padding: 1rem;
            border-radius: 8px;
          }
          .info-label {
            font-size: 12px;
            color: #999;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 0.5rem;
          }
          .info-value {
            font-size: 16px;
            color: #4B1A3E;
            font-weight: 600;
          }
          .info-item.full {
            grid-column: 1 / -1;
          }
          .pieces-list {
            background: #f5f5f5;
            padding: 1rem;
            border-radius: 8px;
            list-style: none;
          }
          .pieces-list li {
            padding: 0.5rem 0;
            color: #666;
            font-size: 14px;
          }
          .pieces-list li:before {
            content: "✓ ";
            color: #2E7D32;
            font-weight: 700;
            margin-right: 0.5rem;
          }
          .actions {
            display: flex;
            gap: 1rem;
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 2px solid #f5f5f5;
          }
          .btn {
            flex: 1;
            padding: 14px 20px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            text-decoration: none;
            text-align: center;
            cursor: pointer;
            border: none;
            transition: all 0.3s;
          }
          .btn-accept {
            background: linear-gradient(135deg, #2E7D32, #1b5e20);
            color: white;
          }
          .btn-accept:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3);
          }
          .btn-refuse {
            background: white;
            border: 2px solid #D32F2F;
            color: #D32F2F;
          }
          .btn-refuse:hover {
            background: #ffebee;
            transform: translateY(-2px);
          }
          .alert {
            background: #fff3e0;
            border: 1px solid #B28E3D;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1.5rem;
            color: #E65100;
            font-size: 13px;
            line-height: 1.6;
          }
          .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 1rem;
          }
          .badge-alerte {
            background: #fff3e0;
            color: #F57C00;
          }
          @media (max-width: 640px) {
            .container { margin: 0; border-radius: 0; }
            .content { padding: 1.5rem; }
            .info-grid { grid-template-columns: 1fr; }
            .actions { flex-direction: column; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Détails du Lead</h1>
            <p>Demande de financement - ALB Immobilier</p>
          </div>

          <div class="content">
            <div class="badge badge-alerte">🚨 ALERTE EN ATTENTE</div>

            <div class="alert">
              ⏱️ <strong>Attention:</strong> Les 1-2 premiers courtiers à accepter remportent ce lead.
              Si vous n'êtes pas intéressé, refusez rapidement pour que les autres puissent agir.
            </div>

            <!-- CLIENT -->
            <div class="section">
              <div class="section-title">👤 CLIENT</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Nom</div>
                  <div class="info-value">${demande.nom}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Prénom</div>
                  <div class="info-value">${demande.prenom}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Email</div>
                  <div class="info-value" style="word-break: break-all; font-size: 14px;">${demande.email}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Téléphone</div>
                  <div class="info-value">${demande.telephone}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Code postal</div>
                  <div class="info-value">${demande.code_postal}</div>
                </div>
              </div>
            </div>

            <!-- CAPACITÉ FINANCIÈRE -->
            <div class="section">
              <div class="section-title">💰 CAPACITÉ FINANCIÈRE</div>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Budget Max</div>
                  <div class="info-value">${euro.format(demande.budget_max)}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Montant Emprunt</div>
                  <div class="info-value">${euro.format(demande.montant_emprunt)}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Mensualité</div>
                  <div class="info-value">${euro.format(demande.mensualite)}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Endettement</div>
                  <div class="info-value">${demande.endettement_ratio}%</div>
                </div>
              </div>
            </div>

            <!-- PIÈCES FOURNIES -->
            <div class="section">
              <div class="section-title">📄 PIÈCES FOURNIES</div>
              <ul class="pieces-list">
                ${piecesHtml}
              </ul>
            </div>

            <!-- ACTIONS -->
            <div class="actions">
              <a href="${refuseLink}" class="btn btn-refuse">❌ Refuser ce lead</a>
              <a href="${acceptLink}" class="btn btn-accept">✅ Accepter ce lead</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  } catch (err) {
    console.error('Error:', err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
};

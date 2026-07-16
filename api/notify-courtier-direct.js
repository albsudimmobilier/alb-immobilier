import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function normalizePieces(pieces) {
  return Array.isArray(pieces) ? pieces.filter(Boolean) : [];
}

export default async (req, context) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const { courtier_ids = [], demande = {}, pieces = [], mode = 'direct' } = await req.json();

    const nom = demande.nom?.trim() || '';
    const prenom = demande.prenom?.trim() || '';
    const email = demande.email?.trim() || '';
    const telephone = demande.tel?.trim() || demande.telephone?.trim() || '';
    const codePostal = demande.cp?.trim() || demande.codePostal?.trim() || '';

    const revenues = Number(demande.revenus_mensuels ?? demande.revenus ?? 0);
    const charges = Number(demande.charges_mensuelles ?? demande.charges ?? 0);
    const apport = Number(demande.apport ?? 0);
    const duree = Number(demande.duree_emprunt ?? demande.duree ?? 25);
    const taux = Number(demande.taux_interet ?? demande.taux ?? 0);
    const assurance = Number(demande.assurance_mensuelle ?? demande.assurance ?? 0);
    const travaux = Number(demande.budget_travaux ?? demande.travaux ?? 0);
    const epargneRestante = Number(demande.epargne_restante ?? 0);
    const objectif = demande.objectif || 'achat';
    const budgetMaxDeclare = Number(demande.budget_max_declare ?? demande.budget_max ?? 0);
    const endettementRatio = Number(demande.endettement_ratio ?? demande.endettement ?? 0);
    const mensualiteTotale = Number(demande.mensualite_totale ?? demande.mensualite ?? 0);
    const montantEmprunt = Number(demande.montant_emprunt ?? demande.emprunt ?? 0);
    const consentementRecontact = Boolean(demande.consentement_recontact ?? true);
    const acheteurAcceptePartagerResultats = Boolean(demande.acheteur_accepte_partager_resultats ?? true);

    const piecesNettoyees = normalizePieces(pieces);
    const courtiersSelectionnes = Array.isArray(courtier_ids) ? courtier_ids.filter(Boolean) : [];
    const dateLimiteReponse = demande.date_limite_reponse || null;

    const insertPayload = {
      user_id: demande.user_id || null,
      revenus_mensuels: revenues,
      charges_mensuelles: charges,
      apport,
      duree_emprunt: duree,
      taux_interet: taux,
      assurance_mensuelle: assurance,
      budget_travaux: travaux,
      epargne_restante: epargneRestante,
      objectif,
      budget_max_declare: budgetMaxDeclare,
      endettement_ratio: endettementRatio,
      mensualite_totale: mensualiteTotale,
      montant_emprunt: montantEmprunt,
      pieces_cochees: piecesNettoyees,
      courtiers_selectionnes: courtiersSelectionnes,
      telephone_contact: telephone,
      acheteur_accepte_partager_resultats: acheteurAcceptePartagerResultats,
      statut: 'en_attente',
      date_limite_reponse: dateLimiteReponse,
      courtier_ids_acceptes: [],
      courtier_ids_rejetes: [],
      mode,
      consentement_recontact: consentementRecontact,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: insertedRows, error: insertError } = await supabase
      .from('demandes_financement')
      .insert([insertPayload])
      .select('*');

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return json({ error: insertError.message }, 500);
    }

    const demandeCreated = insertedRows?.[0];
    if (!demandeCreated) {
      return json({ error: 'Insert succeeded but no row returned' }, 500);
    }

    if (courtier_ids.length > 0) {
      const { data: courtiers } = await supabase
        .from('profiles')
        .select('id, email, prenom, nom')
        .in('id', courtier_ids);

      const templateId = 8;

      for (const courtier of courtiers || []) {
        if (!courtier?.email) continue;

        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: [{ email: courtier.email, name: `${courtier.prenom || ''} ${courtier.nom || ''}`.trim() }],
            templateId,
            params: {
              COURTIER_PRENOM: courtier.prenom || '',
              CLIENT_NOM: nom,
              CLIENT_PRENOM: prenom,
              CLIENT_EMAIL: email,
              CLIENT_TEL: telephone,
              CLIENT_CP: codePostal,
              BUDGET_MAX: Number(budgetMaxDeclare).toLocaleString('fr-FR'),
              ENDDETTEMENT: Number(endettementRatio).toFixed(1),
              MENSUALITE: Number(mensualiteTotale).toLocaleString('fr-FR'),
              MODE: mode,
              SENDER: 'ALB Sud Immobilier'
            }
          })
        });
      }
    }

    return json({
      success: true,
      demand: demandeCreated
    }, 200);
  } catch (err) {
    console.error('notify-courtier-direct error:', err);
    return json({ error: err.message || 'Internal server error' }, 500);
  }
};

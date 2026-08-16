import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function normalizeDept(department) {
  if (department === null || department === undefined) return null;
  const d = String(department).trim();
  if (!d) return null;
  return d.length === 1 ? `0${d}` : d;
}

function toCurrency(v) {
  return Number(v || 0).toLocaleString('fr-FR');
}

async function findOrCreateParticulier({ nom, prenom, email, telephone, codePostal, objectif }) {
  const { data: existing, error: findError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (findError) throw new Error(findError.message);
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from('profiles')
    .insert([{
      prenom,
      nom,
      email,
      telephone,
      code_postal: codePostal,
      role: 'particulier',
      est_acquereur: objectif !== 'renovation',
      pin: generatePin(),
    }])
    .select('id')
    .single();

  if (createError) throw new Error(createError.message);
  return created.id;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const { department, demande = {}, mode = 'aide' } = await req.json();

    const nom = demande.nom?.trim() || '';
    const prenom = demande.prenom?.trim() || '';
    const email = demande.email?.trim() || '';
    const telephone = demande.tel?.trim() || demande.telephone?.trim() || '';
    const codePostal = demande.cp?.trim() || demande.codePostal?.trim() || '';

    if (!email) {
      return json({ error: 'Email requis' }, 400);
    }

    const objectif = demande.objectif || 'achat';
    const particulierId = await findOrCreateParticulier({ nom, prenom, email, telephone, codePostal, objectif });

    const infos = {
      nom, prenom, email, telephone, code_postal: codePostal,
      revenus_mensuels: Number(demande.revenus_mensuels ?? demande.revenus ?? 0),
      charges_mensuelles: Number(demande.charges_mensuelles ?? demande.charges ?? 0),
      apport: Number(demande.apport ?? 0),
      duree_emprunt: Number(demande.duree_emprunt ?? demande.duree ?? 25),
      objectif,
      budget_max_declare: Number(demande.budget_max_declare ?? demande.budget_max ?? 0),
      endettement_ratio: Number(demande.endettement_ratio ?? demande.endettement ?? 0),
      mensualite_totale: Number(demande.mensualite_totale ?? demande.mensualite ?? 0),
      montant_emprunt: Number(demande.montant_emprunt ?? demande.emprunt ?? 0),
      pieces_cochees: Array.isArray(demande.pieces_cochees) ? demande.pieces_cochees : [],
      mode,
      consentement_recontact: Boolean(demande.consentement_recontact ?? false),
    };

    const { data: insertedRows, error: insertError } = await supabase
      .from('demandes_financement')
      .insert([{
        particulier_id: particulierId,
        origine: 'projet_financier',
        infos,
        courtier_assigne_id: null,
        statut: 'nouvelle',
      }])
      .select('*');

    if (insertError) {
      return json({ error: insertError.message }, 500);
    }

    const demandeCreated = insertedRows?.[0];
    const dept = normalizeDept(department);

    let courtiersQuery = supabase
      .from('profiles')
      .select('id, email, prenom, nom, code_postal')
      .eq('role', 'courtier')
      .eq('statut_verifie', true);

    if (dept) {
      courtiersQuery = courtiersQuery.ilike('code_postal', `${dept}%`);
    }

    const { data: courtiers, error: courtiersError } = await courtiersQuery.order('date_creation', { ascending: false });

    if (courtiersError) {
      return json({ error: courtiersError.message }, 500);
    }

    const eligibleCourtiers = (courtiers || []).filter(c => c.email);

    if (eligibleCourtiers.length === 0) {
      return json({ success: true, demand: demandeCreated, courtiers_notifies: 0, message: 'Aucun courtier trouvé pour cette zone' }, 200);
    }

    const templateId = 8;
    const notifyPromises = eligibleCourtiers.map(courtier => fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: [{ email: courtier.email, name: `${courtier.prenom || ''} ${courtier.nom || ''}`.trim() }],
        templateId,
        params: {
          COURTIER_PRENOM: courtier.prenom || '',
          COURTIER_NOM: courtier.nom || '',
          CLIENT_NOM: nom,
          CLIENT_PRENOM: prenom,
          CLIENT_EMAIL: email,
          CLIENT_TEL: telephone,
          CLIENT_CP: codePostal,
          BUDGET_MAX: toCurrency(infos.budget_max_declare),
          ENDDETTEMENT: Number(infos.endettement_ratio).toFixed(1),
          MENSUALITE: toCurrency(infos.mensualite_totale),
          MODE: mode,
          SENDER: 'ALB Sud Immobilier'
        }
      })
    }));

    await Promise.allSettled(notifyPromises);

    return json({ success: true, demand: demandeCreated, courtiers_notifies: eligibleCourtiers.length }, 200);
  } catch (err) {
    return json({ error: err.message || 'Internal server error' }, 500);
  }
};

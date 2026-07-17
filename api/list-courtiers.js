import { createClient } from '@supabase/supabase-js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default async (req) => {
  try {
    if (req.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data, error } = await supabase
      .from('profiles')
      .select('id, nom, prenom, email, telephone, departement, code_poste, role, actif, statut_verifie, dispo_rdv, temps_reponse_moyen')
      .eq('role', 'courtier')
      .eq('actif', true);

    if (error) {
      return json({ error: error.message }, 500);
    }

    const courtiers = (data || [])
      .filter(c => c.email)
      .map(c => ({
        id: c.id,
        nom: c.nom || '',
        prenom: c.prenom || '',
        email: c.email || '',
        telephone: c.telephone || '',
        departement: c.departement || '',
        code_poste: c.code_poste || '',
        actif: !!c.actif,
        statut_verifie: !!c.statut_verifie,
        dispo_rdv: !!c.dispo_rdv,
        temps_reponse_moyen: c.temps_reponse_moyen || null
      }));

    return json({ success: true, courtiers }, 200);
  } catch (err) {
    return json({ error: err?.message || 'Internal server error' }, 500);
  }
};

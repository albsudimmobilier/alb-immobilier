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

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return json({ error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data, error } = await supabase
      .from('profiles')
      .select('id, nom, prenom, email, telephone, ville, code_postal, zone_intervention, role, statut_verifie, temps_reponse_moyen, disponibilites_rdv')
      .eq('role', 'courtier')
      .eq('statut_verifie', true);

    if (error) {
      return json({ error: error.message }, 500);
    }

    const courtiers = (data || [])
      .filter(c => c.email)
      .map(c => ({
        id: c.id,
        nom: `${c.prenom || ''} ${c.nom || ''}`.trim(),
        localisation: [c.ville, c.code_postal].filter(Boolean).join(' ') || (Array.isArray(c.zone_intervention) ? c.zone_intervention.join(', ') : ''),
        avis: '—',
        reponse: c.temps_reponse_moyen ? `${c.temps_reponse_moyen} min` : '—',
        disponibilite_rdv: !!(c.disponibilites_rdv && Object.keys(c.disponibilites_rdv).length),
      }));

    return json({ success: true, courtiers }, 200);
  } catch (err) {
    return json({ error: err?.message || 'Internal server error' }, 500);
  }
};

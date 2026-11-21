// Compteur de visites sans cookie et sans donnée personnelle.
// On calcule un code qui change chaque jour à partir de l'adresse de connexion
// et du navigateur, puis on les oublie : seul le code est gardé.
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ROBOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|uptime|monitor|facebookexternalhit|whatsapp|curl|wget|python|node-fetch|axios|go-http/i;

const reponse = () => new Response(null, { status: 204 });

function pageValide(valeur) {
  if (typeof valeur !== 'string') return '';
  if (!valeur.startsWith('/') || valeur.length > 120) return '';
  return valeur.split('?')[0].split('#')[0];
}

function sourceValide(valeur, monSite) {
  if (typeof valeur !== 'string' || !valeur) return '';
  try {
    const hote = new URL(valeur).hostname.replace(/^www\./, '').toLowerCase();
    if (!hote || hote.length > 80) return '';
    if (monSite && hote === monSite.replace(/^www\./, '').toLowerCase()) return '';
    return hote;
  } catch (e) {
    return '';
  }
}

export default async (req, context) => {
  try {
    if (req.method !== 'POST') return reponse();
    if (!SUPABASE_URL || !SUPABASE_KEY) return reponse();

    const ua = req.headers.get('user-agent') || '';
    if (!ua || ROBOTS.test(ua)) return reponse();

    let corps = {};
    try { corps = JSON.parse(await req.text()); } catch (e) { return reponse(); }

    const page = pageValide(corps.page);
    if (!page) return reponse();
    const monSite = req.headers.get('host') || '';
    const source = sourceValide(corps.source, monSite);

    const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') ||
      (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '';
    const jour = new Date().toISOString().slice(0, 10);

    // Clé du jour : elle change chaque jour, donc le code d'hier ne peut pas être relié à celui d'aujourd'hui.
    const cleDuJour = createHmac('sha256', SUPABASE_KEY).update(jour).digest();
    const code = createHmac('sha256', cleDuJour).update(ip + '|' + ua).digest('hex').slice(0, 20);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    await supabase.from('alb_visites_site').insert({ jour, code, page, source });

    // De temps en temps, on supprime ce qui a plus de 25 mois.
    if (Math.random() < 0.02) await supabase.rpc('alb_purger_visites');
  } catch (e) {
    console.log('[ALB DEBUG] compter-visite : ' + (e && e.message));
  }
  return reponse();
};

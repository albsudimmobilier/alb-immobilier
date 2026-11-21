// Note le passage des robots des moteurs de recherche et des assistants IA.
// Il ne change rien pour les visiteurs : la page est toujours servie telle quelle,
// même si ce relais tombe en panne. On ne garde ni adresse de connexion ni quoi que ce soit de personnel.

// [motif du nom du robot, nom affiché, famille, genre]
// genre « lecture_demande » = une personne vient de poser une question et l'IA lit la page pour répondre.
const ROBOTS = [
  [/ChatGPT-User/i, 'ChatGPT-User', 'OpenAI (ChatGPT)', 'lecture_demande'],
  [/OAI-SearchBot/i, 'OAI-SearchBot', 'OpenAI (ChatGPT)', 'exploration'],
  [/GPTBot/i, 'GPTBot', 'OpenAI (ChatGPT)', 'exploration'],
  [/Claude-User/i, 'Claude-User', 'Claude', 'lecture_demande'],
  [/Claude-SearchBot/i, 'Claude-SearchBot', 'Claude', 'exploration'],
  [/ClaudeBot|anthropic-ai/i, 'ClaudeBot', 'Claude', 'exploration'],
  [/Perplexity-User/i, 'Perplexity-User', 'Perplexity', 'lecture_demande'],
  [/PerplexityBot/i, 'PerplexityBot', 'Perplexity', 'exploration'],
  [/Google-InspectionTool|GoogleOther/i, 'Google-InspectionTool', 'Google', 'exploration'],
  [/Googlebot/i, 'Googlebot', 'Google', 'exploration'],
  [/bingbot|BingPreview/i, 'Bingbot', 'Bing', 'exploration'],
  [/Applebot/i, 'Applebot', 'Apple', 'exploration'],
  [/DuckDuckBot/i, 'DuckDuckBot', 'DuckDuckGo', 'exploration'],
  [/Qwantify/i, 'Qwantbot', 'Qwant', 'exploration'],
  [/YandexBot/i, 'YandexBot', 'Autres robots', 'exploration'],
  [/Amazonbot/i, 'Amazonbot', 'Autres robots', 'exploration'],
  [/meta-externalagent/i, 'Meta-ExternalAgent', 'Autres robots', 'exploration'],
  [/Bytespider/i, 'Bytespider', 'Autres robots', 'exploration'],
  [/CCBot/i, 'CCBot', 'Autres robots', 'exploration'],
];

export default async (request, context) => {
  const reponse = await context.next();
  try {
    if (request.method !== 'GET') return reponse;
    const ua = request.headers.get('user-agent') || '';
    if (!ua) return reponse;
    const trouve = ROBOTS.find((r) => r[0].test(ua));
    if (!trouve) return reponse;

    const url = (typeof Netlify !== 'undefined' && Netlify.env.get('SUPABASE_URL')) || (typeof Netlify !== 'undefined' && Netlify.env.get('NEXT_PUBLIC_SUPABASE_URL'));
    const cle = typeof Netlify !== 'undefined' ? Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY') : '';
    if (!url || !cle) return reponse;

    const page = new URL(request.url).pathname.slice(0, 120);
    const envoi = fetch(url + '/rest/v1/rpc/alb_noter_robot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cle, Authorization: 'Bearer ' + cle },
      body: JSON.stringify({ p_robot: trouve[1], p_famille: trouve[2], p_genre: trouve[3], p_page: page }),
    }).catch(() => {});
    if (context.waitUntil) context.waitUntil(envoi);
  } catch (e) {
    console.log('[ALB DEBUG] noter-robot : ' + (e && e.message));
  }
  return reponse;
};

// Toutes les pages, sauf les images, styles et scripts (on garde robots.txt, sitemap.xml et llms.txt).
export const config = {
  path: '/*',
  excludedPath: ['/*.css', '/*.js', '/*.png', '/*.jpg', '/*.jpeg', '/*.webp', '/*.svg', '/*.ico', '/*.woff', '/*.woff2', '/*.gif', '/*.mp4', '/*.pdf', '/.netlify/*'],
};

/**
 * pebble(a) admin — ThingsBoard relay (Cloudflare Worker).
 *
 * demo.thingsboard.io doesn't let other websites call its API from the browser (no CORS),
 * so the admin page talks to this Worker, which forwards /api/* to ThingsBoard and adds
 * the CORS headers. It only answers the admin site's own origin, only forwards /api/*,
 * and keeps nothing: no logging of bodies, tokens or passwords.
 *
 * Deploy: Cloudflare dashboard → Workers & Pages → Create → Worker → paste this file → Deploy.
 * Then on the admin sign-in page, open "เซิร์ฟเวอร์" and enter the Worker's URL
 * (https://<name>.<your-subdomain>.workers.dev).
 */
const TARGET = 'https://demo.thingsboard.io';
const ALLOWED_ORIGINS = ['https://thanakron-spu.github.io', 'http://localhost:8091'];

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    if (!ALLOWED_ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403 });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (!['GET', 'POST'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: cors(origin) });

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404, headers: cors(origin) });

    const headers = new Headers();
    for (const h of ['Content-Type', 'X-Authorization', 'Accept']) {
      const v = request.headers.get(h);
      if (v) headers.set(h, v);
    }
    const upstream = await fetch(TARGET + url.pathname + url.search, {
      method: request.method,
      headers,
      body: request.method === 'POST' ? await request.text() : undefined,
      redirect: 'follow',
    });

    const out = new Headers(cors(origin));
    const type = upstream.headers.get('Content-Type');
    if (type) out.set('Content-Type', type);
    out.set('Cache-Control', 'no-store');
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};

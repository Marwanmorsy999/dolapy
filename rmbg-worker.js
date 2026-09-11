// Dolapy RMBG Cloudflare Worker
// Proxies image to HF Space running briaai/RMBG-2.0
// Deploy: wrangler deploy rmbg-worker.js --name dolapy-rmbg

const HF_SPACE = 'https://marwanmorsy999-dolapy-rmbg.hf.space';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    // Health / wake-up ping
    if (url.pathname === '/health' || url.pathname === '/ping') {
      try {
        const health = await fetch(`${HF_SPACE}/health`, {
          signal: AbortSignal.timeout(8000)
        });
        const data = await health.json();
        return Response.json({ ok: true, space: data }, {
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, {
          status: 503,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Background removal
    if (url.pathname === '/remove-bg' && request.method === 'POST') {
      try {
        // Forward the request body directly to HF Space
        const contentType = request.headers.get('content-type') || '';
        const body = await request.arrayBuffer();

        const upstream = await fetch(`${HF_SPACE}/remove-bg`, {
          method: 'POST',
          headers: { 'Content-Type': contentType },
          body,
          signal: AbortSignal.timeout(60000) // 60s max
        });

        if (!upstream.ok) {
          const err = await upstream.text();
          return Response.json(
            { error: 'upstream_error', detail: err, status: upstream.status },
            { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } }
          );
        }

        // Stream PNG back to client
        const png = await upstream.arrayBuffer();
        return new Response(png, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
          }
        });

      } catch (e) {
        // Return a specific error code so client knows to fall back to on-device
        return Response.json(
          { error: 'worker_error', detail: e.message, fallback: true },
          { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
      }
    }

    return new Response('Dolapy RMBG Worker', {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
};

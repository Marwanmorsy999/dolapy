// Dolapy RMBG Cloudflare Worker
// Proxies to HF Inference API for briaai/RMBG-2.0
// HF token injected by GitHub Actions (REPLACE_ME placeholder)

const INFERENCE_KEY = 'REPLACE_ME';
const HF_INFERENCE = 'https://api-inference.huggingface.co/models/briaai/RMBG-2.0';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {headers:{
        'Access-Control-Allow-Origin':'*',
        'Access-Control-Allow-Methods':'POST,GET,OPTIONS',
        'Access-Control-Allow-Headers':'Content-Type',
      }});
    }

    if (url.pathname === '/health') {
      return Response.json({status:'ok',model:'briaai/RMBG-2.0'},{
        headers:{'Access-Control-Allow-Origin':'*'}
      });
    }

    if (url.pathname === '/remove-bg' && request.method === 'POST') {
      try {
        const ct = request.headers.get('content-type') || '';
        let bytes;
        if (ct.includes('multipart')) {
          const form = await request.formData();
          const f = form.get('image');
          if (!f) return Response.json({error:'no image field'},{status:400,headers:{'Access-Control-Allow-Origin':'*'}});
          bytes = await f.arrayBuffer();
        } else {
          bytes = await request.arrayBuffer();
        }

        const upstream = await fetch(HF_INFERENCE, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${INFERENCE_KEY}`,
            'Content-Type': 'application/octet-stream',
            'Accept': 'image/png',
          },
          body: bytes,
          signal: AbortSignal.timeout(45000),
        });

        if (!upstream.ok) {
          const txt = await upstream.text().catch(() => '');
          return Response.json(
            {error:`upstream ${upstream.status}`,detail:txt.slice(0,200),fallback:true},
            {status:502,headers:{'Access-Control-Allow-Origin':'*'}}
          );
        }

        return new Response(await upstream.arrayBuffer(), {headers:{
          'Content-Type':'image/png',
          'Access-Control-Allow-Origin':'*',
          'Cache-Control':'no-store',
        }});
      } catch(e) {
        return Response.json(
          {error:e.message,fallback:true},
          {status:503,headers:{'Access-Control-Allow-Origin':'*'}}
        );
      }
    }

    return new Response('Dolapy RMBG Proxy v2',{headers:{'Access-Control-Allow-Origin':'*'}});
  }
};

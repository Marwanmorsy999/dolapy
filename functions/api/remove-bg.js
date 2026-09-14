// Server-side background removal using Cloudflare's native Images binding.
// Requires the IMAGES binding to be added to this Pages project
// (Dashboard -> Pages project -> Settings -> Functions -> Bindings -> Images -> variable name "IMAGES").
// Free tier: 5,000 unique transformations/month, no third-party API key needed.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.IMAGES) {
    return new Response(JSON.stringify({ error: 'Images binding not configured' }), {
      status: 501,
      headers: { 'content-type': 'application/json' }
    });
  }
  try {
    const form = await request.formData();
    const file = form.get('image');
    if (!file || typeof file.stream !== 'function') {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    const result = await env.IMAGES.input(file.stream())
      .transform({ segment: 'foreground' })
      .output({ format: 'image/png' });
    const response = result.response();
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}

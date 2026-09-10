const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

const ALLOWED_CATEGORIES = ['tops','bottoms','dresses','outerwear','shoes','accessories'];
const ALLOWED_STYLES = ['casual','streetwear','smart','athletic','utility','minimal','vintage','preppy'];
const ALLOWED_SILHOUETTES = ['slim','regular','relaxed','oversized'];
const ALLOWED_PATTERNS = ['solid','stripe','check','graphic','print','floral','camo','textured','other'];
const ALLOWED_SEASONS = ['all','summer','winter','spring','fall'];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim().slice(0, 80);
}

function oneOf(value, allowed, fallback) {
  const v = String(value ?? '').toLowerCase().trim();
  return allowed.includes(v) ? v : fallback;
}

function parseModelResult(raw) {
  const text = typeof raw === 'string' ? raw : raw?.response || raw?.result || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Vision model returned no JSON');
  const parsed = JSON.parse(match[0]);
  return {
    name: cleanText(parsed.name, 'Clothing piece'),
    category: oneOf(parsed.category, ALLOWED_CATEGORIES, 'tops'),
    color: cleanText(parsed.color, 'neutral'),
    colorFamily: cleanText(parsed.colorFamily, 'neutral').toLowerCase(),
    style: oneOf(parsed.style, ALLOWED_STYLES, 'casual'),
    silhouette: oneOf(parsed.silhouette, ALLOWED_SILHOUETTES, 'regular'),
    pattern: oneOf(parsed.pattern, ALLOWED_PATTERNS, 'solid'),
    season: oneOf(parsed.season, ALLOWED_SEASONS, 'all'),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    description: cleanText(parsed.description, ''),
  };
}

export async function onRequestOptions() {
  return json({ ok: true });
}

export async function onRequestGet({ env }) {
  return json({ enabled: Boolean(env?.AI), model: env?.AI ? MODEL : null });
}

export async function onRequestPost({ request, env }) {
  if (!env?.AI) return json({ ok: false, error: 'Workers AI binding is not configured.' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const image = typeof body?.image === 'string' ? body.image : '';
  if (!image.startsWith('data:image/')) return json({ ok: false, error: 'Expected a data:image/* URL.' }, 400);
  if (image.length > 3_000_000) return json({ ok: false, error: 'Image payload is too large.' }, 413);

  const messages = [
    {
      role: 'system',
      content: 'You are Dolapy, a precise fashion cataloger. Analyze only the visible clothing item. Do not invent details that cannot be inferred from the image. Return JSON only.',
    },
    {
      role: 'user',
      content: `Catalog this clothing item for a wardrobe styling app.
Return ONLY one JSON object with exactly these keys:
name, category, color, colorFamily, style, silhouette, pattern, season, confidence, description.
Allowed category: tops, bottoms, dresses, outerwear, shoes, accessories.
Allowed style: casual, streetwear, smart, athletic, utility, minimal, vintage, preppy.
Allowed silhouette: slim, regular, relaxed, oversized.
Allowed pattern: solid, stripe, check, graphic, print, floral, camo, textured, other.
Allowed season: all, summer, winter, spring, fall.
confidence must be a number from 0 to 1.
color should be a useful human-readable color such as black, washed navy, cream, olive green, burgundy.
colorFamily should be a broad family such as black, white, grey, neutral, brown, blue, green, red, orange, yellow, purple, pink.
Keep name under 50 characters.
Keep description under 120 characters.`
    }
  ];

  try {
    const result = await env.AI.run(MODEL, {
      messages,
      image,
      max_tokens: 260,
      temperature: 0.1,
      top_p: 0.85,
    });
    const item = parseModelResult(result);
    return json({ ok: true, model: MODEL, item });
  } catch (error) {
    console.error('Dolapy vision error', error);
    return json({ ok: false, error: 'Vision inference failed.' }, 502);
  }
}

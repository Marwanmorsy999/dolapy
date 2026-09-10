# Dolapy

Dolapy is a mobile-first wardrobe app: upload the clothes you own, get deterministic outfit recommendations, and style the wardrobe as a whole without requiring an AI model.

## Core engine

The styling engine in `src/lib/smart-styling-engine.ts` ranks combinations using explicit compatibility signals: color, style, formality, silhouette, pattern, layering, season/context, freshness, and wardrobe coverage. A second planning pass deliberately brings less-used pieces into later looks so the result is a wardrobe plan rather than one repeated outfit.

`src/lib/clothing-analysis.ts` provides local, no-AI upload metadata heuristics. The user can confirm or adjust the result before saving.

## Cloudflare Pages

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

Set the required production variables in Cloudflare Pages, especially `VITE_CLERK_PUBLISHABLE_KEY`. Set `VITE_API_BASE_URL` when the API is deployed separately from the Pages site.

The app is a standard Vite SPA and includes a Pages `_redirects` fallback.

## Local development

```bash
npm install
npm run dev
```

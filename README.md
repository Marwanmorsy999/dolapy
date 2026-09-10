# Dolapy

Dolapy is a mobile-first, local-first wardrobe stylist. The MVP is intentionally AI-free: photo upload, editable local classification, deterministic outfit ranking, and whole-wardrobe coverage all run in the browser.

## Core product

`upload clothes → quick classify → style me → show alternatives → style my whole wardrobe`

The engine uses hard constraints first, then scores color harmony, style compatibility, formality coherence, silhouette, pattern control, context fit, novelty, favorites, and piece coverage. It selects several high-quality looks while penalizing repeated pieces so the wardrobe is actually used.

## Cloudflare Pages

This repository is a static site. Deploy from the repository root with **no build command** and the output directory left as the root/current directory. Cloudflare Pages will serve `index.html` and `_redirects` directly.

No Replit runtime, Replit config, server, API, or AI provider is required for the core MVP.

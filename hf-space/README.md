---
title: Dolapy RMBG
emoji: 👕
colorFrom: yellow
colorTo: green
sdk: gradio
sdk_version: "4.44.0"
app_file: app.py
pinned: true
license: mit
---

# Dolapy Background Removal API

**Model:** briaai/RMBG-2.0 (state-of-the-art fashion segmentation)

## API

`POST /remove-bg` — multipart form with `image` field, or raw bytes, or JSON `{"image":"base64..."}`. Returns transparent PNG.

`GET /health` — status check.

## Usage
```js
const form = new FormData();
form.append('image', blob, 'photo.jpg');
const res = await fetch('https://marwanmorsy999-dolapy-rmbg.hf.space/remove-bg', {
  method: 'POST', body: form
});
const png = await res.blob();
```

(() => {
  'use strict';

  const STORE_KEY = 'dolapy.pages.v3';
  const BG_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
  const TF_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
  const FASHION_MODEL = 'ff13/fashion-clip';

  const $ = (selector) => document.querySelector(selector);
  let aiBg = null;
  let aiClassifier = null;
  let aiLoading = null;
  let aiQueue = [];
  let current = null;
  let cameraStream = null;

  const LABELS = [
    't-shirt', 'shirt', 'polo shirt', 'hoodie', 'sweater', 'cardigan', 'jacket', 'coat', 'blazer', 'overshirt',
    'jeans', 'trousers', 'cargo pants', 'chinos', 'shorts', 'skirt', 'dress', 'suit',
    'sneakers', 'boots', 'loafers', 'sandals', 'heels',
    'bag', 'backpack', 'cap', 'hat', 'belt', 'watch', 'scarf', 'glasses'
  ];

  const COLOR_WORDS = {
    black: ['black', 'charcoal', 'graphite', 'onyx'],
    white: ['white', 'cream', 'ivory'],
    grey: ['grey', 'gray', 'silver'],
    neutral: ['beige', 'tan', 'camel', 'khaki', 'sand', 'stone', 'oat'],
    brown: ['brown', 'chocolate', 'mocha', 'coffee'],
    blue: ['navy', 'blue', 'denim', 'cobalt', 'teal', 'sky', 'azure'],
    green: ['green', 'olive', 'sage', 'forest', 'mint'],
    red: ['red', 'burgundy', 'maroon', 'wine', 'crimson'],
    orange: ['orange', 'rust', 'terracotta', 'coral'],
    yellow: ['yellow', 'mustard', 'gold'],
    purple: ['purple', 'lavender', 'lilac', 'violet'],
    pink: ['pink', 'rose', 'blush']
  };

  const titleCase = (value) => String(value || '').replace(/(^|[\s-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, Number(n) || 0));

  function scanUI() {
    let el = $('#aiScanStatus');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'aiScanStatus';
    el.className = 'scan-status';
    el.hidden = true;
    el.innerHTML = '<div class="scan-card"><div class="scan-spinner"></div><div class="scan-copy"><strong id="aiScanLabel">Preparing AI…</strong><span id="aiScanSub">Getting your piece ready.</span></div><div class="scan-track"><span id="aiScanBar"></span></div></div>';
    document.body.appendChild(el);
    return el;
  }

  function scan(show, label = '', pct = 0, sub = '') {
    const el = scanUI();
    el.hidden = !show;
    if (!show) return;
    $('#aiScanLabel').textContent = label;
    $('#aiScanSub').textContent = sub || 'Running privately in your browser.';
    $('#aiScanBar').style.width = `${clamp(pct, 0, 100)}%`;
  }

  async function loadAI() {
    if (aiLoading) return aiLoading;
    aiLoading = (async () => {
      scan(true, 'Preparing Dolapy…', 8, 'Loading the visual tools in parallel.');
      const [bg, t] = await Promise.all([import(BG_URL), import(TF_URL)]);
      aiBg = bg.removeBackground;
      scan(true, 'Loading fashion recognition…', 28, 'The model is cached after the first scan.');
      aiClassifier = await t.pipeline('zero-shot-image-classification', FASHION_MODEL, { dtype: 'q8' });
      scan(false);
    })().catch((error) => {
      aiLoading = null;
      throw error;
    });
    return aiLoading;
  }

  async function compress(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          try {
            // 1024px is plenty for garment segmentation while keeping inference fast.
            const max = 1024;
            const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image encoding failed')), 'image/jpeg', 0.82);
          } catch (err) { reject(err); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  function hslFamily(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const mx = Math.max(rn, gn, bn), mn = Math.min(rn, gn, bn), d = mx - mn;
    const v = mx;
    const l = (mx + mn) / 2;
    if (v < 0.20) return 'black';
    if (l > 0.91 && d < 0.13) return 'white';
    if (d < 0.09 && l < 0.70) return 'grey';
    if (d < 0.13 && l >= 0.70) return 'neutral';
    let h = 0;
    if (d) {
      if (mx === rn) h = ((gn - bn) / d) % 6;
      else if (mx === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    if (l < 0.38 && d < 0.32 && rn > bn * 1.08 && gn > bn * 0.88) return 'brown';
    if (h < 15 || h >= 345) return 'red';
    if (h < 43) return 'orange';
    if (h < 72) return 'yellow';
    if (h < 165) return 'green';
    if (h < 255) return 'blue';
    if (h < 310) return 'purple';
    return 'pink';
  }

  function cleanCutout(blob) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        try {
          const source = document.createElement('canvas');
          source.width = img.naturalWidth;
          source.height = img.naturalHeight;
          const ctx = source.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          const image = ctx.getImageData(0, 0, source.width, source.height);
          const d = image.data;
          let minX = source.width, minY = source.height, maxX = -1, maxY = -1;
          for (let i = 0; i < d.length; i += 4) {
            let a = d[i + 3];
            if (a < 18) a = 0;
            else if (a < 80) a = Math.round(a * 0.68);
            d[i + 3] = a;
            if (a > 28) {
              const px = (i / 4) % source.width;
              const py = Math.floor((i / 4) / source.width);
              if (px < minX) minX = px;
              if (py < minY) minY = py;
              if (px > maxX) maxX = px;
              if (py > maxY) maxY = py;
            }
          }
          ctx.putImageData(image, 0, 0);
          const padX = Math.max(8, Math.round((maxX - minX + 1) * 0.06));
          const padY = Math.max(8, Math.round((maxY - minY + 1) * 0.06));
          const sx = Math.max(0, (maxX < 0 ? 0 : minX - padX));
          const sy = Math.max(0, (maxY < 0 ? 0 : minY - padY));
          const ex = Math.min(source.width, (maxX < 0 ? source.width : maxX + padX + 1));
          const ey = Math.min(source.height, (maxY < 0 ? source.height : maxY + padY + 1));
          const out = document.createElement('canvas');
          out.width = Math.max(1, ex - sx);
          out.height = Math.max(1, ey - sy);
          out.getContext('2d').drawImage(source, sx, sy, out.width, out.height, 0, 0, out.width, out.height);
          out.toBlob((clean) => { URL.revokeObjectURL(url); resolve(clean || blob); }, 'image/webp', 0.86);
        } catch {
          URL.revokeObjectURL(url);
          resolve(blob);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
      img.src = url;
    });
  }

  function detectColor(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onerror = () => resolve('');
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 64;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, 64, 64);
          const data = ctx.getImageData(0, 0, 64, 64).data;
          const counts = Object.create(null);
          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3] / 255;
            if (alpha < 0.18) continue;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            if (max > 247 && max - min < 12) continue;
            const family = hslFamily(r, g, b);
            const weight = alpha * (max > 235 ? 0.7 : 1);
            counts[family] = (counts[family] || 0) + weight;
          }
          const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
          resolve(best?.[0] || '');
        } catch { resolve(''); }
      };
      img.src = dataUrl;
    });
  }

  function colorFromName(name) {
    const s = String(name || '').toLowerCase();
    for (const [family, words] of Object.entries(COLOR_WORDS)) {
      const hit = words.find((word) => s.includes(word));
      if (hit) return hit;
    }
    return '';
  }

  function styleFromLabel(label, name) {
    const s = `${label || ''} ${name || ''}`.toLowerCase();
    if (/cargo|hoodie|jacket|overshirt/.test(s)) return 'streetwear';
    if (/blazer|loafer|oxford|suit|tailored/.test(s)) return 'smart';
    if (/sport|running|trainer|gym|athletic/.test(s)) return 'athletic';
    if (/cap|utility|workwear/.test(s)) return 'utility';
    if (/vintage|retro|heritage/.test(s)) return 'vintage';
    if (/polo|classic|varsity/.test(s)) return 'preppy';
    return 'casual';
  }

  function categoryFromLabel(label) {
    const s = String(label || '').toLowerCase();
    if (/dress/.test(s)) return 'dresses';
    if (/jeans|trouser|cargo|chino|shorts|skirt|pants/.test(s)) return 'bottoms';
    if (/sneaker|boot|loafer|sandal|heel/.test(s)) return 'shoes';
    if (/jacket|coat|blazer|overshirt|hoodie|sweater|cardigan|suit/.test(s)) return 'outerwear';
    if (/bag|backpack|cap|hat|belt|watch|scarf|glasses/.test(s)) return 'accessories';
    return 'tops';
  }

  function silhouetteFromName(name) {
    const s = String(name || '').toLowerCase();
    if (/oversized|boxy|baggy/.test(s)) return 'oversized';
    if (/wide|relaxed/.test(s)) return 'relaxed';
    if (/slim|skinny|tapered|fitted/.test(s)) return 'slim';
    return 'regular';
  }

  function filenameMeta(file) {
    const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled piece';
    const lower = name.toLowerCase();
    const style = styleFromLabel('', name);
    const category = categoryFromLabel(lower);
    const color = colorFromName(name);
    const season = /linen|tank|shorts|sandal|summer|tee|tshirt/.test(lower) ? 'summer' : /wool|coat|puffer|fleece|thermal|winter|knit/.test(lower) ? 'winter' : 'all';
    return { name, category, style, color, season, silhouette: silhouetteFromName(name) };
  }

  async function analyse(file) {
    await loadAI();
    const original = await compress(file);
    const meta = filenameMeta(file);

    scan(true, 'Removing the background…', 34, 'Keeping the garment, cleaning the edges.');
    let cutout = original;
    try {
      const segmented = await aiBg(original, {
        model: 'isnet_quint8',
        output: { format: 'image/webp', quality: 0.86 },
        progress: (key, currentValue, total) => {
          const ratio = total ? currentValue / total : 0;
          scan(true, 'Removing the background…', 34 + Math.round(ratio * 28), 'Cleaning the garment edges.');
        }
      });
      cutout = await cleanCutout(segmented);
    } catch (err) {
      console.warn('Dolapy background removal failed; using original image.', err);
    }

    const data = await blobToDataURL(cutout);
    let label = '';
    let visualConfidence = 0;
    try {
      scan(true, 'Identifying the piece…', 72, 'One fast fashion pass — type, then smart naming.');
      const imageURL = URL.createObjectURL(cutout);
      const result = await aiClassifier(imageURL, LABELS);
      URL.revokeObjectURL(imageURL);
      if (result?.[0]) {
        label = result[0].label;
        visualConfidence = result[0].score || 0;
      }
    } catch (err) {
      console.warn('Dolapy visual recognition failed; using safe metadata fallback.', err);
    }

    // Color sampling runs on the already-cleaned transparent cutout.
    const detectedColor = await detectColor(data);
    const category = visualConfidence > 0.10 ? categoryFromLabel(label) : meta.category;
    const color = detectedColor || meta.color || 'neutral';
    const style = styleFromLabel(label, meta.name);
    const cleanLabel = titleCase(label || (category === 'tops' ? 'top' : category === 'bottoms' ? 'bottom' : category));
    const finalName = titleCase([color !== 'neutral' ? color : '', style !== 'casual' ? style : '', cleanLabel].filter(Boolean).join(' '));
    const allText = `${meta.name} ${label}`.toLowerCase();
    const season = /linen|tank|shorts|sandal|summer|t-shirt|tee/.test(allText) ? 'summer' : /wool|coat|puffer|fleece|thermal|winter|knit/.test(allText) ? 'winter' : 'all';
    const warmth = category === 'outerwear' ? 4 : category === 'shoes' ? 2 : season === 'summer' ? 1 : season === 'winter' ? 4 : 3;
    const formality = style === 'smart' ? 4 : style === 'preppy' ? 3 : style === 'athletic' ? 1 : 2;

    scan(false);
    return {
      id: uid(), name: finalName, image: data, category, color, style, season,
      occasion: style === 'smart' ? 'smart' : style === 'athletic' ? 'sport' : 'everyday',
      silhouette: meta.silhouette,
      pattern: /stripe/.test(allText) ? 'stripe' : /check|plaid/.test(allText) ? 'check' : /graphic/.test(allText) ? 'graphic' : 'solid',
      warmth, formality, wearCount: 0, favorite: false,
      aiIdentified: Boolean(label), visualConfidence: clamp(visualConfidence),
      metadataConfidence: clamp((visualConfidence * 0.72) + (detectedColor ? 0.28 : 0.08), 0.2, 1),
      createdAt: Date.now()
    };
  }

  function openResult(item) {
    current = item;
    $('#previewImg').src = item.image;
    $('#fName').value = item.name;
    $('#fCategory').value = item.category;
    $('#fColor').value = item.color;
    $('#fStyle').value = item.style;
    $('#queueInfo').textContent = aiQueue.length ? `${aiQueue.length} more piece${aiQueue.length === 1 ? '' : 's'} to review` : 'Ready to add to your wardrobe';
    $('#modal').hidden = false;
  }

  function closeResult() {
    current = null;
    aiQueue = [];
    $('#modal').hidden = true;
    scan(false);
  }

  function nextResult() {
    if (!aiQueue.length) {
      closeResult();
      return;
    }
    openResult(aiQueue.shift());
  }

  function saveResult() {
    if (!current) return;
    current.name = String($('#fName').value || '').trim() || current.name;
    current.category = $('#fCategory').value;
    current.color = String($('#fColor').value || '').trim() || current.color;
    current.style = $('#fStyle').value;
    current.formality = current.style === 'smart' ? 4 : current.style === 'preppy' ? 3 : current.style === 'athletic' ? 1 : 2;

    let items = [];
    try { items = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { items = []; }
    if (!Array.isArray(items)) items = [];
    items.unshift(current);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(items));
    } catch {
      alert('Wardrobe storage is full. Remove an older piece first.');
      return;
    }

    current = null;
    if (aiQueue.length) nextResult();
    else {
      scan(false);
      $('#modal').hidden = true;
      window.location.reload();
    }
  }

  async function startAIUpload(files) {
    const list = [...(files || [])].filter((file) => file.type?.startsWith('image/'));
    if (!list.length) return;
    try {
      aiQueue = [];
      // Keep a single inference at a time to avoid GPU/CPU contention on phones.
      for (let i = 0; i < list.length; i++) {
        const item = await analyse(list[i]);
        item.queuePosition = i + 1;
        item.queueTotal = list.length;
        aiQueue.push(item);
      }
      nextResult();
    } catch (err) {
      console.error('Dolapy AI scan failed', err);
      scan(false);
      alert('Dolapy could not analyze that photo. Try one clear clothing piece against a plain background.');
    }
  }

  async function startCamera() {
    const modal = $('#cameraModal');
    if (!modal) return;
    modal.hidden = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      $('#cameraNote').textContent = 'Camera access is unavailable here. Use Choose from device instead.';
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1024 }, height: { ideal: 1024 } },
        audio: false
      });
      $('#cameraVideo').srcObject = cameraStream;
      $('#cameraNote').textContent = 'Center one piece in frame, then capture it.';
    } catch (err) {
      console.error('Camera permission error', err);
      $('#cameraNote').textContent = 'Camera permission was blocked. Choose a photo from the device instead.';
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }
    if ($('#cameraVideo')) $('#cameraVideo').srcObject = null;
  }

  function closeCamera() {
    stopCamera();
    $('#cameraModal').hidden = true;
  }

  async function capturePhoto() {
    const video = $('#cameraVideo');
    if (!video?.videoWidth) {
      alert('The camera is not ready yet.');
      return;
    }
    const canvas = $('#cameraCanvas');
    const max = 1024;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84));
    if (!blob) return;
    closeCamera();
    await startAIUpload([new File([blob], `dolapy-${Date.now()}.jpg`, { type: 'image/jpeg' })]);
  }

  function bind() {
    document.addEventListener('click', (event) => {
      const takeButton = event.target.closest?.('#addHeroAI,#addWardrobeAI,#bottomAddAI,#emptyUpload,#wardrobeEmptyUpload');
      if (takeButton) {
        event.preventDefault();
        startCamera();
      }
    }, false);

    $('#cameraGallery')?.addEventListener('click', () => {
      closeCamera();
      $('#aiFileInput').click();
    });
    $('#closeCamera')?.addEventListener('click', closeCamera);
    $('#capturePhoto')?.addEventListener('click', capturePhoto);
    $('#closeModal')?.addEventListener('click', closeResult);
    $('#saveItem')?.addEventListener('click', saveResult);
    $('#modal')?.addEventListener('click', (event) => { if (event.target === event.currentTarget) closeResult(); });
    $('#cameraModal')?.addEventListener('click', (event) => { if (event.target === event.currentTarget) closeCamera(); });
    $('#aiFileInput')?.addEventListener('change', (event) => {
      const files = event.target.files;
      event.target.value = '';
      startAIUpload(files);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if ($('#cameraModal') && !$('#cameraModal').hidden) closeCamera();
      else if ($('#modal') && !$('#modal').hidden) closeResult();
    });
    window.addEventListener('beforeunload', stopCamera);
  }

  window.startCamera = startCamera;
  window.startAIUpload = startAIUpload;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
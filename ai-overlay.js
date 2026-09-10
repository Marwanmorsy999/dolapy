(() => {
  'use strict';

  const STORE_KEY = 'dolapy.pages.v3';
  const BG_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
  const TF_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
  const FASHION_MODEL = 'ff13/fashion-clip';

  const $ = (selector) => document.querySelector(selector);
  let aiBg = null;
  let aiClassifier = null;
  let aiStyleClassifier = null;
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
  const STYLE_LABELS = ['casual', 'streetwear', 'smart', 'athletic', 'utility', 'minimal', 'preppy', 'vintage'];

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

  const rgbFamily = (r, g, b) => {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (max < 55) return 'black';
    if (max > 232 && d < 25) return 'white';
    if (d < 18 && max < 165) return 'grey';
    const nr = r / 255, ng = g / 255, nb = b / 255;
    const h = (Math.atan2(Math.sqrt(3) * (ng - nb), 2 * nr - ng - nb) * 180 / Math.PI + 360) % 360;
    if ((h < 18 || h >= 345) && r > g * 1.18) return 'red';
    if (h >= 18 && h < 48) return 'orange';
    if (h >= 48 && h < 75) return 'yellow';
    if (h >= 75 && h < 165) return 'green';
    if (h >= 165 && h < 255) return 'blue';
    if (h >= 255 && h < 310) return 'purple';
    if (h >= 310 && h < 345) return 'pink';
    if (max < 205 && r > g * 1.08 && r > b * 1.08) return 'brown';
    if (max < 205) return 'neutral';
    return '';
  };

  const colorFromName = (name) => {
    const s = String(name || '').toLowerCase();
    for (const [family, words] of Object.entries(COLOR_WORDS)) {
      const hit = words.find((word) => s.includes(word));
      if (hit) return hit;
    }
    return '';
  };

  const styleFromName = (name) => {
    const s = String(name || '').toLowerCase();
    if (/street|oversized|graphic|skater|baggy|cargo/.test(s)) return 'streetwear';
    if (/formal|tailored|blazer|office|dressy|oxford|loafer/.test(s)) return 'smart';
    if (/sport|gym|active|running|trainer/.test(s)) return 'athletic';
    if (/utility|workwear|military/.test(s)) return 'utility';
    if (/vintage|retro|heritage|washed/.test(s)) return 'vintage';
    if (/minimal|clean|simple|plain/.test(s)) return 'minimal';
    if (/preppy|polo|varsity|classic/.test(s)) return 'preppy';
    return 'casual';
  };

  const categoryFromLabel = (label) => {
    const s = String(label || '').toLowerCase();
    if (/dress/.test(s)) return 'dresses';
    if (/jeans|trouser|cargo|chino|shorts|skirt|pants/.test(s)) return 'bottoms';
    if (/sneaker|boot|loafer|sandal|heel/.test(s)) return 'shoes';
    if (/jacket|coat|blazer|overshirt|hoodie|sweater|cardigan|suit/.test(s)) return 'outerwear';
    if (/bag|backpack|cap|hat|belt|watch|scarf|glasses/.test(s)) return 'accessories';
    return 'tops';
  };

  const silhouetteFromName = (name) => {
    const s = String(name || '').toLowerCase();
    if (/oversized|boxy|baggy/.test(s)) return 'oversized';
    if (/wide|relaxed/.test(s)) return 'relaxed';
    if (/slim|skinny|tapered|fitted/.test(s)) return 'slim';
    return 'regular';
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
    if (show) {
      $('#aiScanLabel').textContent = label;
      $('#aiScanSub').textContent = sub || 'Running privately in your browser.';
      $('#aiScanBar').style.width = `${clamp(pct, 0, 100)}%`;
    }
  }

  async function loadAI() {
    if (aiLoading) return aiLoading;
    aiLoading = (async () => {
      scan(true, 'Loading visual AI…', 8, 'The first scan downloads the vision models.');
      const bg = await import(BG_URL);
      aiBg = bg.removeBackground;
      scan(true, 'Loading fashion recognition…', 26, 'Preparing clothing recognition.');
      const t = await import(TF_URL);
      aiClassifier = await t.pipeline('zero-shot-image-classification', FASHION_MODEL, { dtype: 'q8' });
      aiStyleClassifier = aiClassifier;
      scan(true, 'AI ready', 100, 'Background removal and fashion recognition are ready.');
      await new Promise((resolve) => setTimeout(resolve, 250));
      scan(false);
    })();
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
            const max = 1400;
            const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image encoding failed')), 'image/jpeg', 0.88);
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

  function detectColor(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onerror = () => resolve('');
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 96;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, 96, 96);
          const data = ctx.getImageData(8, 8, 80, 80).data;
          let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 80) continue;
            const rr = data[i], gg = data[i + 1], bb = data[i + 2];
            const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb);
            if (mx - mn < 8 && mx > 190) continue;
            r += rr; g += gg; b += bb; n++;
          }
          resolve(n ? rgbFamily(r / n, g / n, b / n) : '');
        } catch { resolve(''); }
      };
      img.src = dataUrl;
    });
  }

  function filenameMeta(file) {
    const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled piece';
    const lower = name.toLowerCase();
    const category = categoryFromLabel(lower);
    const style = styleFromName(name);
    const color = colorFromName(name);
    const season = /linen|tank|shorts|sandal|summer|tee|tshirt/.test(lower) ? 'summer' : /wool|coat|puffer|fleece|thermal|winter|knit/.test(lower) ? 'winter' : 'all';
    const occasion = style === 'smart' ? 'smart' : style === 'athletic' ? 'sport' : 'everyday';
    return { name, category, style, color, season, occasion, silhouette: silhouetteFromName(name) };
  }

  async function analyse(file) {
    await loadAI();
    const original = await compress(file);
    scan(true, 'Removing background…', 34, 'Isolating only the garment.');
    let cutout = original;
    try {
      cutout = await aiBg(original, {
        model: 'isnet_quint8',
        output: { format: 'image/webp', quality: 0.9 },
        progress: (key, currentValue, total) => {
          const ratio = total ? currentValue / total : 0;
          scan(true, 'Removing background…', 34 + Math.round(ratio * 32), 'Cleaning the garment edges.');
        }
      });
    } catch (err) {
      console.warn('Dolapy background removal failed; using original image.', err);
    }

    const data = await blobToDataURL(cutout);
    const meta = filenameMeta(file);
    let label = '';
    let visualConfidence = 0;
    let style = meta.style;
    try {
      scan(true, 'Identifying the piece…', 72, 'Comparing the garment with fashion categories.');
      const imageURL = URL.createObjectURL(cutout);
      const result = await aiClassifier(imageURL, LABELS);
      URL.revokeObjectURL(imageURL);
      if (result?.[0]) {
        label = result[0].label;
        visualConfidence = result[0].score || 0;
      }
      scan(true, 'Reading the style…', 84, 'Checking the visual style family.');
      const styleResult = await aiStyleClassifier(data, STYLE_LABELS);
      if (styleResult?.[0] && styleResult[0].score > 0.22) style = styleResult[0].label;
    } catch (err) {
      console.warn('Dolapy visual recognition failed; using safe metadata fallback.', err);
    }

    scan(true, 'Naming the piece…', 94, 'Building a useful wardrobe name.');
    const detectedColor = await detectColor(data);
    const category = visualConfidence > 0.12 ? categoryFromLabel(label) : meta.category;
    const color = detectedColor || meta.color || 'neutral';
    const cleanLabel = titleCase(label || (category === 'tops' ? 'top' : category === 'bottoms' ? 'bottom' : category));
    const finalName = titleCase([color, style !== 'casual' ? style : '', cleanLabel].filter(Boolean).join(' '));
    const season = /linen|tank|shorts|sandal|summer|t-shirt|tee/.test(`${meta.name} ${label}`.toLowerCase()) ? 'summer' : /wool|coat|puffer|fleece|thermal|winter|knit/.test(`${meta.name} ${label}`.toLowerCase()) ? 'winter' : 'all';
    const warmth = category === 'outerwear' ? 4 : category === 'shoes' ? 2 : season === 'summer' ? 1 : season === 'winter' ? 4 : 3;
    const formality = style === 'smart' ? 4 : style === 'preppy' ? 3 : style === 'athletic' ? 1 : 2;

    return {
      id: uid(),
      name: finalName,
      image: data,
      category,
      color,
      style,
      season,
      occasion: style === 'smart' ? 'smart' : style === 'athletic' ? 'sport' : 'everyday',
      silhouette: meta.silhouette,
      pattern: /stripe/.test(meta.name.toLowerCase()) ? 'stripe' : /check|plaid/.test(meta.name.toLowerCase()) ? 'check' : /graphic/.test(meta.name.toLowerCase()) ? 'graphic' : 'solid',
      warmth,
      formality,
      wearCount: 0,
      favorite: false,
      aiIdentified: Boolean(label),
      visualConfidence: clamp(visualConfidence, 0, 1),
      metadataConfidence: clamp((visualConfidence + (detectedColor ? 1 : 0)) / 2, 0.2, 1),
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
    $('#queueInfo').textContent = aiQueue.length ? `${aiQueue.length} more piece${aiQueue.length === 1 ? '' : 's'} to review` : 'AI identified · background removed';
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
    if (aiQueue.length) {
      nextResult();
    } else {
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
      for (let i = 0; i < list.length; i++) {
        const item = await analyse(list[i]);
        item.queuePosition = i + 1;
        item.queueTotal = list.length;
        aiQueue.push(item);
      }
      scan(false);
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
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false
      });
      $('#cameraVideo').srcObject = cameraStream;
      $('#cameraNote').textContent = 'Center one clothing piece in frame, then capture it.';
    } catch (err) {
      console.error('Camera permission error', err);
      $('#cameraNote').textContent = 'Camera permission was blocked. You can choose a photo from the device instead.';
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
    const max = 1400;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return;
    closeCamera();
    await startAIUpload([new File([blob], `dolapy-${Date.now()}.jpg`, { type: 'image/jpeg' })]);
  }

  function bind() {
    // Take-photo actions.
    document.addEventListener('click', (event) => {
      const takeButton = event.target.closest?.('#addHeroAI,#addWardrobeAI,#bottomAddAI');
      if (takeButton) {
        event.preventDefault();
        startCamera();
        return;
      }

      const emptyButton = event.target.closest?.('#emptyUpload,#wardrobeEmptyUpload');
      if (emptyButton) {
        event.preventDefault();
        startCamera();
        return;
      }

      const occasion = event.target.closest?.('[data-occasion]');
      if (occasion) {
        // app.js owns the deterministic styling state; leave it intact.
        return;
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
    $('#modal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeResult();
    });
    $('#cameraModal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeCamera();
    });
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

  // Expose only the two entry points needed by the static app.
  window.startCamera = startCamera;
  window.startAIUpload = startAIUpload;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();

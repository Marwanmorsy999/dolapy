(() => {
  'use strict';

  const STORE = 'dolapy.pages.v3';
  const BG_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
  const TF_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
  const MODEL = 'ff13/fashion-clip';
  const $ = (s) => document.querySelector(s);

  let removeBackground = null;
  let classifier = null;
  let aiLoadPromise = null;
  let cameraStream = null;
  let current = null;
  let queue = [];

  const performanceConfig = () => window.DolapyPerformance || {
    mobile: /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent),
    lowPower: /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) && !navigator.gpu,
    imageSize: () => 768,
    segmentationModel: () => 'isnet_quint8',
    classifierOptions: () => navigator.gpu ? { device: 'webgpu', dtype: 'fp16' } : { device: 'wasm', dtype: 'q8' }
  };

  const LABELS = [
    't-shirt', 'graphic t-shirt', 'polo shirt', 'button-up shirt', 'shirt',
    'hoodie', 'sweater', 'cardigan', 'jacket', 'coat', 'blazer', 'overshirt',
    'jeans', 'wide-leg trousers', 'trousers', 'cargo pants', 'chinos', 'shorts',
    'skirt', 'dress', 'suit', 'sneakers', 'boots', 'loafers', 'sandals', 'heels',
    'slides', 'bag', 'backpack', 'cap', 'hat', 'belt', 'watch', 'scarf', 'glasses'
  ];

  const COLORS = {
    black: ['black', 'charcoal', 'graphite'], white: ['white', 'cream', 'ivory'],
    grey: ['grey', 'gray', 'silver'], neutral: ['beige', 'tan', 'camel', 'khaki', 'sand', 'stone', 'oat'],
    brown: ['brown', 'chocolate', 'mocha', 'coffee'], blue: ['navy', 'blue', 'denim', 'cobalt', 'teal', 'sky', 'azure'],
    green: ['green', 'olive', 'sage', 'forest', 'mint'], red: ['red', 'burgundy', 'maroon', 'wine', 'crimson'],
    orange: ['orange', 'rust', 'terracotta', 'coral'], yellow: ['yellow', 'mustard', 'gold'],
    purple: ['purple', 'lavender', 'lilac', 'violet'], pink: ['pink', 'rose', 'blush']
  };

  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, Number(n) || 0));
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const title = (s) => String(s || '').replace(/(^|[\s-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  function status(show, label = '', pct = 0, sub = '') {
    let el = $('#aiScanStatus');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aiScanStatus';
      el.className = 'scan-status';
      el.hidden = true;
      el.innerHTML = '<div class="scan-card"><div class="scan-spinner"></div><div class="scan-copy"><strong id="aiScanLabel"></strong><span id="aiScanSub"></span></div><div class="scan-track"><span id="aiScanBar"></span></div></div>';
      document.body.appendChild(el);
    }
    el.hidden = !show;
    if (show) {
      $('#aiScanLabel').textContent = label;
      $('#aiScanSub').textContent = sub;
      $('#aiScanBar').style.width = `${clamp(pct / 100, 0, 1) * 100}%`;
    }
  }

  function withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function loadAI() {
    if (classifier || removeBackground) return true;
    if (aiLoadPromise) return aiLoadPromise;

    aiLoadPromise = (async () => {
      status(true, 'Preparing vision…', 8, 'Loading the local vision engine.');

      let bgModule = null;
      let tfModule = null;
      const results = await Promise.allSettled([
        import(BG_URL),
        import(TF_URL)
      ]);

      if (results[0].status === 'fulfilled') bgModule = results[0].value;
      if (results[1].status === 'fulfilled') tfModule = results[1].value;

      removeBackground = bgModule?.removeBackground || null;

      if (tfModule) {
        try {
          status(true, 'Loading garment recognition…', 16, 'This can take longer the first time.');
          classifier = await withTimeout(
            tfModule.pipeline('zero-shot-image-classification', MODEL, performanceConfig().classifierOptions()),
            performanceConfig().lowPower ? 60000 : 90000,
            'Garment recognition timed out'
          );
        } catch (error) {
          console.warn('Dolapy classifier unavailable:', error);
          classifier = null;
        }
      }

      if (!classifier && !removeBackground) {
        throw new Error('Vision modules could not be loaded');
      }
      return true;
    })().catch((error) => {
      aiLoadPromise = null;
      throw error;
    });

    return aiLoadPromise;
  }

  window.warmDolapyAI = () => loadAI().catch((error) => console.warn('Dolapy AI warmup failed:', error));

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the image'));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  function imageFromSource(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not decode the image'));
      image.src = src;
    });
  }

  async function normalizeImage(input, maxSize) {
    const src = typeof input === 'string' ? input : await readFile(input);
    const image = await imageFromSource(src);
    const max = maxSize || performanceConfig().imageSize?.() || 768;
    const scale = Math.min(1, max / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas is unavailable');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Image encoding failed')), 'image/jpeg', 0.82);
    });
    return blob;
  }

  async function captureBlob() {
    const video = $('#cameraVideo');
    if (!video || !video.videoWidth || !video.videoHeight) throw new Error('Camera is not ready yet');
    const max = performanceConfig().lowPower ? 768 : 1024;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    const canvas = $('#cameraCanvas') || document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Camera canvas unavailable');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Camera capture failed')), 'image/jpeg', 0.9);
    });
  }

  async function startCamera() {
    const modal = $('#cameraModal');
    const video = $('#cameraVideo');
    if (!modal || !video) return;

    try {
      stopCamera();
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Live camera is not supported here');
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      });
      video.srcObject = cameraStream;
      video.muted = true;
      video.playsInline = true;
      modal.hidden = false;
      $('#cameraHint').textContent = 'Keep one piece fully visible. Plain background gives the best cutout.';
      await video.play().catch(() => {});
    } catch (error) {
      console.warn('Live camera unavailable:', error);
      stopCamera();
      modal.hidden = false;
      $('#cameraHint').textContent = 'Live camera is unavailable. Choose a photo from your device instead.';
      const input = $('#aiFileInput');
      if (input) input.click();
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }
    const video = $('#cameraVideo');
    if (video) video.srcObject = null;
  }

  function hsl(r, g, b) {
    const R = r / 255, G = g / 255, B = b / 255;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
    const l = (mx + mn) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d) {
      if (mx === R) h = ((G - B) / d) % 6;
      else if (mx === G) h = (B - R) / d + 2;
      else h = (R - G) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return { h, s, l, v: mx };
  }

  function colorName(r, g, b) {
    const { h, s, l, v } = hsl(r, g, b);
    if (v < 0.16) return 'black';
    if (v < 0.28 && s < 0.28) return 'charcoal';
    if (l > 0.92 && s < 0.13) return 'white';
    if (l > 0.82 && s < 0.24) return 'cream';
    if (s < 0.1 && l < 0.7) return 'grey';
    if (s < 0.2 && l >= 0.7) return 'beige';
    if (l < 0.42 && h >= 15 && h < 45 && s > 0.22) return 'brown';
    if (h >= 345 || h < 12) return l < 0.45 ? 'burgundy' : 'red';
    if (h < 42) return l < 0.42 ? 'rust' : 'orange';
    if (h < 72) return l < 0.45 ? 'mustard' : 'yellow';
    if (h < 160) return l < 0.45 ? 'olive' : 'green';
    if (h < 255) return l < 0.42 ? 'navy' : 'blue';
    if (h < 310) return l < 0.46 ? 'purple' : 'lavender';
    return l < 0.5 ? 'rose' : 'pink';
  }

  const family = (name) => {
    const s = String(name || '').toLowerCase();
    for (const [key, words] of Object.entries(COLORS)) if (words.some((word) => s.includes(word))) return key;
    return 'unknown';
  };

  async function cleanCutout(blob) {
    if (!removeBackground) return blob;
    try {
      const result = await withTimeout(
        removeBackground(blob, {
          device: 'cpu',
          model: performanceConfig().segmentationModel?.() || 'isnet_quint8',
          output: { format: 'image/webp', quality: 0.88 }
        }),
        performanceConfig().lowPower ? 45000 : 70000,
        'Background removal timed out'
      );
      return result || blob;
    } catch (error) {
      console.warn('Background removal failed; keeping original photo:', error);
      return blob;
    }
  }

  async function detectColor(blob) {
    try {
      const src = await readFile(blob);
      const image = await imageFromSource(src);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 72;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { name: '', family: '' };
      ctx.drawImage(image, 0, 0, 72, 72);
      const data = ctx.getImageData(6, 6, 60, 60).data;
      const bins = new Map();
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3] / 255;
        if (a < 0.5) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const v = hsl(r, g, b);
        if (v.v > 0.975 && v.s < 0.08) continue;
        const key = `${Math.round(r / 20) * 20},${Math.round(g / 20) * 20},${Math.round(b / 20) * 20}`;
        const weight = a * (0.7 + Math.min(1, v.s * 1.4));
        const entry = bins.get(key) || { w: 0, r: 0, g: 0, b: 0 };
        entry.w += weight; entry.r += r * weight; entry.g += g * weight; entry.b += b * weight;
        bins.set(key, entry);
      }
      const top = [...bins.values()].sort((a, b) => b.w - a.w)[0];
      if (!top) return { name: '', family: '' };
      const name = colorName(top.r / top.w, top.g / top.w, top.b / top.w);
      return { name, family: family(name) };
    } catch {
      return { name: '', family: '' };
    }
  }

  const categoryFromText = (text) => {
    const s = String(text || '').toLowerCase();
    if (/dress/.test(s)) return 'dresses';
    if (/jeans|trouser|cargo|chino|shorts|skirt|pants/.test(s)) return 'bottoms';
    if (/sneaker|boot|loafer|sandal|heel|slide/.test(s)) return 'shoes';
    if (/jacket|coat|blazer|overshirt|hoodie|sweater|cardigan|suit/.test(s)) return 'outerwear';
    if (/bag|backpack|cap|hat|belt|watch|scarf|glasses/.test(s)) return 'accessories';
    return 'tops';
  };

  const styleFromText = (text) => {
    const s = String(text || '').toLowerCase();
    if (/cargo|hoodie|jacket|overshirt|graphic|wide-leg/.test(s)) return 'streetwear';
    if (/blazer|loafer|oxford|suit|tailored|formal/.test(s)) return 'smart';
    if (/sport|running|trainer|gym|athletic/.test(s)) return 'athletic';
    if (/utility|workwear/.test(s)) return 'utility';
    if (/vintage|retro|heritage|washed/.test(s)) return 'vintage';
    if (/polo|classic|varsity/.test(s)) return 'preppy';
    if (/minimal|plain|clean/.test(s)) return 'minimal';
    return 'casual';
  };

  const silhouetteFromText = (text) => {
    const s = String(text || '').toLowerCase();
    if (/oversized|boxy|baggy/.test(s)) return 'oversized';
    if (/wide[- ]leg|wide|relaxed/.test(s)) return 'relaxed';
    if (/slim|skinny|tapered|fitted/.test(s)) return 'slim';
    return 'regular';
  };

  async function classify(blob) {
    if (!classifier) return [];
    const url = URL.createObjectURL(blob);
    try {
      return await withTimeout(classifier(url, LABELS), performanceConfig().lowPower ? 30000 : 45000, 'Garment recognition timed out') || [];
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function filenameMeta(file) {
    const text = file?.name?.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() || '';
    return { text, category: categoryFromText(text), style: styleFromText(text), silhouette: silhouetteFromText(text) };
  }

  async function analyse(file) {
    if (!file) throw new Error('No image supplied');
    status(true, 'Preparing your photo…', 22, 'Optimizing the camera image.');

    const normalized = await normalizeImage(file);
    const fallback = filenameMeta(file);

    let aiReady = false;
    try {
      await loadAI();
      aiReady = Boolean(classifier || removeBackground);
    } catch (error) {
      console.warn('Vision engine unavailable; using resilient local fallback:', error);
    }

    status(true, 'Isolating the garment…', 38, aiReady ? 'Cleaning the background locally.' : 'Using a safe photo fallback.');
    const cutout = await cleanCutout(normalized);

    let results = [];
    if (classifier) {
      status(true, 'Identifying the piece…', 58, 'Reading garment type and style.');
      try {
        results = await classify(normalized);
      } catch (error) {
        console.warn('Primary recognition failed:', error);
      }
      if ((!results[0] || Number(results[0].score || 0) < 0.28) && cutout !== normalized) {
        try {
          const second = await classify(cutout);
          if (second[0] && (!results[0] || second[0].score > results[0].score)) results = second;
        } catch (error) {
          console.warn('Cutout recognition retry failed:', error);
        }
      }
    }

    const best = results[0] || { label: '', score: 0 };
    const label = best.label || '';
    const text = `${label} ${fallback.text}`.trim();
    const category = label && Number(best.score || 0) >= 0.08 ? categoryFromText(label) : fallback.category;
    const style = styleFromText(text);
    const silhouette = silhouetteFromText(text);

    status(true, 'Reading color…', 78, 'Analyzing the isolated garment.');
    const color = await detectColor(cutout);
    const lower = text.toLowerCase();
    const season = /linen|tank|shorts|sandal|summer|tee/.test(lower) ? 'summer' : /wool|coat|puffer|fleece|thermal|winter|knit/.test(lower) ? 'winter' : 'all';
    const confidence = clamp(Number(best.score || 0));

    status(true, 'Finishing your wardrobe card…', 94, confidence ? `${Math.round(confidence * 100)}% recognition confidence.` : 'Ready for your review.');
    const data = await new Promise((resolve) => {
      if (cutout instanceof Blob) readFile(cutout).then(resolve).catch(() => readFile(normalized).then(resolve));
      else resolve(cutout);
    });

    return {
      id: uid(),
      name: title([color.name || '', style !== 'casual' ? style : '', title(label || (category === 'tops' ? 'T-Shirt' : category === 'bottoms' ? 'Bottoms' : category))].filter(Boolean).join(' ')),
      image: data,
      category,
      color: color.name || 'neutral',
      colorFamily: color.family,
      style,
      season,
      occasion: style === 'smart' ? 'smart' : style === 'athletic' ? 'sport' : 'everyday',
      silhouette,
      pattern: /stripe/.test(lower) ? 'stripe' : /check|plaid/.test(lower) ? 'check' : /graphic|print/.test(lower) ? 'graphic' : 'solid',
      warmth: category === 'outerwear' ? 4 : category === 'shoes' ? 2 : season === 'summer' ? 1 : season === 'winter' ? 4 : 3,
      formality: style === 'smart' ? 4 : style === 'preppy' ? 3 : style === 'athletic' ? 1 : 2,
      wearCount: 0,
      favorite: false,
      aiIdentified: Boolean(label),
      visualConfidence: confidence,
      recognitionMargin: results[1] ? clamp(confidence - Number(results[1].score || 0)) : confidence,
      aiAlternatives: results.slice(0, 4).map((item) => ({ label: item.label, score: Number(item.score || 0) })),
      metadataConfidence: clamp(confidence * 0.65 + (color.name ? 0.25 : 0.08) + 0.1),
      createdAt: Date.now()
    };
  }

  function openResult(item) {
    current = item;
    const preview = $('#previewImg');
    if (preview) preview.src = item.image;
    $('#fName').value = item.name;
    $('#fCategory').value = item.category;
    $('#fColor').value = item.color;
    $('#fStyle').value = item.style;
    $('#queueInfo').textContent = queue.length ? `${queue.length} more piece${queue.length === 1 ? '' : 's'} to review` : `AI confidence ${Math.round((item.metadataConfidence || 0) * 100)}%`;
    $('#modal').hidden = false;
  }

  function closeResult() {
    current = null;
    queue = [];
    $('#modal').hidden = true;
    status(false);
  }

  function next() {
    if (queue.length) openResult(queue.shift());
    else closeResult();
  }

  function save() {
    if (!current) return;
    current.name = String($('#fName').value || '').trim() || current.name;
    current.category = $('#fCategory').value;
    current.color = String($('#fColor').value || '').trim() || current.color;
    current.style = $('#fStyle').value;
    current.formality = current.style === 'smart' ? 4 : current.style === 'preppy' ? 3 : current.style === 'athletic' ? 1 : 2;

    let items = [];
    try { items = JSON.parse(localStorage.getItem(STORE) || '[]'); } catch {}
    if (!Array.isArray(items)) items = [];
    items.unshift(current);
    try {
      localStorage.setItem(STORE, JSON.stringify(items));
    } catch {
      alert('Wardrobe storage is full. Remove an older piece first.');
      return;
    }

    current = null;
    if (queue.length) next();
    else {
      status(false);
      $('#modal').hidden = true;
      window.renderAll?.();
      window.DolapyIntelligence?.refresh?.();
      window.DolapyContext?.render?.();
      window.DolapyEngineV3?.generate?.();
    }
  }

  async function startAIUpload(files) {
    const list = [...(files || [])].filter((file) => file?.type?.startsWith('image/'));
    if (!list.length) return;
    queue = [];
    current = null;
    try {
      for (let i = 0; i < list.length; i += 1) {
        status(true, `Processing piece ${i + 1} of ${list.length}…`, 5, 'Your original photo stays local.');
        try {
          queue.push(await analyse(list[i]));
        } catch (error) {
          console.error('Dolapy vision item failed:', error);
          // A failed model must never make the entire batch fail.
          try {
            const normalized = await normalizeImage(list[i]);
            const meta = filenameMeta(list[i]);
            queue.push({
              id: uid(), name: title(meta.text || 'Untitled item'), image: await readFile(normalized),
              category: meta.category, color: 'neutral', colorFamily: 'neutral', style: meta.style,
              season: 'all', occasion: meta.style === 'smart' ? 'smart' : 'everyday', silhouette: meta.silhouette,
              pattern: 'solid', warmth: meta.category === 'outerwear' ? 4 : 3,
              formality: meta.style === 'smart' ? 4 : 2, wearCount: 0, favorite: false,
              aiIdentified: false, visualConfidence: 0, recognitionMargin: 0, aiAlternatives: [], metadataConfidence: 0.15,
              createdAt: Date.now()
            });
          } catch (fallbackError) {
            console.error('Dolapy fallback also failed:', fallbackError);
          }
        }
      }
      status(false);
      if (queue.length) openResult(queue.shift());
      else throw new Error('No usable images were produced');
    } catch (error) {
      console.error('Dolapy upload failed:', error);
      status(false);
      alert('Dolapy could not process that photo. Please try another photo with the whole garment visible.');
      closeCamera();
      closeResult();
    }
  }

  function closeCamera() {
    stopCamera();
    const modal = $('#cameraModal');
    if (modal) modal.hidden = true;
  }

  function wire() {
    const openCameraButtons = ['#addHeroAI', '#addWardrobeAI', '#bottomAddAI'];
    openCameraButtons.forEach((selector) => $(selector)?.addEventListener('click', () => startCamera()));

    $('#closeCamera')?.addEventListener('click', closeCamera);
    $('#cameraGallery')?.addEventListener('click', () => $('#aiFileInput')?.click());

    $('#capturePhoto')?.addEventListener('click', async () => {
      const button = $('#capturePhoto');
      if (!cameraStream) {
        $('#aiFileInput')?.click();
        return;
      }
      button.disabled = true;
      try {
        const blob = await captureBlob();
        closeCamera();
        await startAIUpload([new File([blob], `dolapy-camera-${Date.now()}.jpg`, { type: 'image/jpeg' })]);
      } catch (error) {
        console.error('Camera capture failed:', error);
        alert('The camera photo could not be captured. Please try again or choose a photo from your device.');
      } finally {
        button.disabled = false;
      }
    });

    $('#aiFileInput')?.addEventListener('change', (event) => {
      const files = [...(event.target.files || [])];
      event.target.value = '';
      closeCamera();
      if (files.length) startAIUpload(files);
    });

    $('#closeModal')?.addEventListener('click', closeResult);
    $('#saveItem')?.addEventListener('click', save);

    window.addEventListener('beforeunload', stopCamera);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (!$('#cameraModal')?.hidden) closeCamera();
        else if (!$('#modal')?.hidden) closeResult();
      }
    });
  }

  window.startCamera = startCamera;
  window.stopCamera = stopCamera;
  window.startAIUpload = startAIUpload;
  window.DolapyVision = { analyse, startCamera, stopCamera, startAIUpload };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire, { once: true });
  else wire();
})();

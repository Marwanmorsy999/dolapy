(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  let stream = null;

  const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
    || Boolean(globalThis.matchMedia?.('(pointer: coarse)')?.matches);

  function getPhotoInput() {
    const input = $('#aiFileInput');
    if (!input) return null;
    input.accept = 'image/*';
    if (isMobile()) input.setAttribute('capture', 'environment');
    return input;
  }

  function sendToVision(files) {
    const list = [...(files || [])].filter(file => file?.type?.startsWith('image/'));
    if (!list.length) return;

    // vision-engine-v3.js owns the real AI workflow: background removal,
    // FashionCLIP identification, color extraction and result presentation.
    if (typeof globalThis.startAIUpload === 'function') {
      Promise.resolve(globalThis.startAIUpload(list)).catch(error => {
        console.error('Dolapy vision processing failed:', error);
        alert('Dolapy could not process that photo. Please try another photo.');
      });
      return;
    }

    alert('Dolapy vision is still loading. Please try the photo again.');
  }

  function nativePhoto() {
    const input = getPhotoInput();
    if (!input) {
      alert('Camera input is unavailable. Please reload Dolapy.');
      return;
    }
    input.value = '';
    input.click();
  }

  function stopCamera() {
    stream?.getTracks?.().forEach(track => track.stop());
    stream = null;
    const video = $('#cameraVideo');
    if (video) video.srcObject = null;
  }

  function closeCamera() {
    stopCamera();
    const modal = $('#cameraModal');
    if (modal) modal.hidden = true;
  }

  async function openCamera() {
    // Mobile: use the operating system's camera picker directly.
    // This avoids browser/PWA getUserMedia differences.
    if (isMobile()) {
      nativePhoto();
      return;
    }

    const modal = $('#cameraModal');
    const video = $('#cameraVideo');
    if (!modal || !video || !navigator.mediaDevices?.getUserMedia) {
      nativePhoto();
      return;
    }

    modal.hidden = false;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
          frameRate: { ideal: 24, max: 30 }
        },
        audio: false
      });
      video.srcObject = stream;
      await video.play();
    } catch (error) {
      console.warn('Dolapy camera failed; using native photo capture:', error);
      closeCamera();
      nativePhoto();
    }
  }

  async function captureDesktop() {
    const video = $('#cameraVideo');
    const canvas = $('#cameraCanvas');
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth) {
      nativePhoto();
      return;
    }

    const max = 1024;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      nativePhoto();
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) {
      nativePhoto();
      return;
    }

    const file = new File([blob], `dolapy-${Date.now()}.jpg`, { type: 'image/jpeg' });
    closeCamera();
    sendToVision([file]);
  }

  function bind() {
    const input = getPhotoInput();
    input?.addEventListener('change', event => {
      event.stopImmediatePropagation();
      const files = [...(event.target.files || [])];
      event.target.value = '';
      sendToVision(files);
    }, true);

    for (const id of ['#addHeroAI', '#addWardrobeAI', '#bottomAddAI']) {
      $(id)?.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openCamera();
      }, true);
    }

    $('#capturePhoto')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      captureDesktop();
    }, true);

    $('#closeCamera')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeCamera();
    }, true);

    $('#cameraGallery')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      nativePhoto();
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();

(() => {
  const $ = (selector) => document.querySelector(selector);
  let stream = null;

  async function openCamera() {
    if (window.__DOLAPY_REMOTE_VISION) return;

    const modal = $('#cameraModal');
    const video = $('#cameraVideo');
    const note = $('#cameraNote');
    if (!modal || !video) return;

    modal.hidden = false;
    if (note) note.textContent = 'Requesting camera access…';

    if (!navigator.mediaDevices?.getUserMedia) {
      if (note) note.textContent = 'Live camera is not available in this browser. Use “Choose from device” instead.';
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 896 }, height: { ideal: 896 }, frameRate: { ideal: 24, max: 30 } },
        audio: false
      });
      video.srcObject = stream;
      await video.play();
      if (note) note.textContent = 'Center one clothing piece in the frame, then capture it.';
    } catch (error) {
      console.error('Dolapy camera error:', error);
      modal.hidden = true;
      if (error?.name === 'NotAllowedError') {
        if (note) note.textContent = 'Camera permission was denied. Allow camera access, or choose a photo from the device.';
      }
      $('#aiFileInput')?.click();
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    const video = $('#cameraVideo');
    if (video) video.srcObject = null;
  }

  function closeCamera() {
    stopCamera();
    const modal = $('#cameraModal');
    if (modal) modal.hidden = true;
  }

  function capturePhoto() {
    if (window.__DOLAPY_REMOTE_VISION) return;

    const video = $('#cameraVideo');
    const canvas = $('#cameraCanvas');
    const note = $('#cameraNote');
    if (!video || !canvas) return;
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      if (note) note.textContent = 'Camera is still starting. Try Capture again in a moment.';
      return;
    }

    const max = 768;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `dolapy-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      closeCamera();
      if (typeof startUpload === 'function') startUpload([file]);
      else if (typeof window.startUpload === 'function') window.startUpload([file]);
      else $('#aiFileInput')?.click();
    }, 'image/jpeg', 0.76);
  }

  function useDevicePhoto() {
    if (window.__DOLAPY_REMOTE_VISION) return;
    closeCamera();
    $('#fileInput')?.click();
  }

  ['addHeroAI', 'addWardrobeAI', 'bottomAddAI'].forEach(id => {
    const button = document.getElementById(id);
    button?.addEventListener('click', event => {
      if (window.__DOLAPY_REMOTE_VISION) return;
      event.preventDefault();
      event.stopPropagation();
      openCamera();
    });
  });

  $('#capturePhoto')?.addEventListener('click', capturePhoto);
  $('#closeCamera')?.addEventListener('click', closeCamera);
  $('#cameraGallery')?.addEventListener('click', useDevicePhoto);
  $('#cameraModal')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeCamera();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('#cameraModal') && !$('#cameraModal').hidden) closeCamera();
  });
})();

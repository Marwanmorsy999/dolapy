(() => {
  const $ = (selector) => document.querySelector(selector);
  let stream = null;

  async function openCamera() {
    const modal = $('#cameraModal');
    const video = $('#cameraVideo');
    const note = $('#cameraNote');
    if (!modal || !video) return;

    modal.hidden = false;
    note.textContent = 'Requesting camera access…';

    if (!navigator.mediaDevices?.getUserMedia) {
      note.textContent = 'Live camera is not available in this browser. Use “Choose from device” instead.';
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false
      });
      video.srcObject = stream;
      await video.play();
      note.textContent = 'Center one clothing piece in the frame, then capture it.';
    } catch (error) {
      console.error('Dolapy camera error:', error);
      note.textContent = error?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in your browser, or choose a photo from the device.'
        : 'Could not start the camera. Use “Choose from device” instead.';
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
    const video = $('#cameraVideo');
    const canvas = $('#cameraCanvas');
    if (!video || !canvas || !video.videoWidth) return;

    const max = 1400;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `dolapy-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      closeCamera();
      if (typeof startUpload === 'function') startUpload([file]);
    }, 'image/jpeg', 0.88);
  }

  function useDevicePhoto() {
    closeCamera();
    $('#fileInput')?.click();
  }

  ['addHero', 'addWardrobe', 'bottomAdd'].forEach(id => {
    const button = document.getElementById(id);
    button?.addEventListener('click', event => {
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

(() => {
  'use strict';
  let deferredPrompt = null;
  const $ = (s) => document.querySelector(s);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = () => Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone);

  window.DolapyPWA = {
    canInstall: () => Boolean(deferredPrompt),
    isIOS: () => isIOS,
    isStandalone,
    install: async () => {
      if (!deferredPrompt) return false;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      document.dispatchEvent(new CustomEvent('dolapy:install-state'));
      return choice?.outcome === 'accepted';
    }
  };

  function installBanner() {
    if (isStandalone() || document.getElementById('pwaInstallBanner')) return;
    const banner = document.createElement('aside');
    banner.id = 'pwaInstallBanner';
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `<div class="pwa-install-icon"><img src="/icon.svg" alt=""></div><div class="pwa-install-copy"><strong>Get Dolapy on your phone</strong><span id="pwaInstallText">Install it like an app for faster access.</span></div><button type="button" class="pwa-install-action" id="pwaInstallAction">Install</button><button type="button" class="pwa-install-close" id="pwaInstallClose" aria-label="Dismiss">×</button>`;
    document.body.appendChild(banner);
    const action = $('#pwaInstallAction');
    const text = $('#pwaInstallText');
    if (deferredPrompt) { action.textContent = 'Install'; }
    else if (isIOS) { action.textContent = 'How'; text.textContent = 'Safari: Share → Add to Home Screen.'; }
    else { action.textContent = 'How'; text.textContent = 'Use your browser menu → Install app / Add to Home screen.'; }
    action.addEventListener('click', async () => {
      if (deferredPrompt) { await window.DolapyPWA.install(); banner.remove(); return; }
      alert(isIOS ? 'On iPhone/iPad, open Safari’s Share menu, then choose “Add to Home Screen”.' : 'Open your browser menu and choose “Install app” or “Add to Home screen”.');
    });
    $('#pwaInstallClose').addEventListener('click', () => banner.remove());
    setTimeout(() => banner.remove(), 14000);
  }

  function emitState() { document.dispatchEvent(new CustomEvent('dolapy:install-state')); }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    emitState();
    installBanner();
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; document.getElementById('pwaInstallBanner')?.remove(); emitState(); });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Dolapy service worker unavailable', err)));
  }

  window.addEventListener('load', () => {
    if (!isStandalone() && (isIOS || deferredPrompt)) setTimeout(installBanner, 900);
    emitState();
  });
})();

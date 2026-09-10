(() => {
  'use strict';
  let deferredPrompt = null;
  window.DolapyPWA = {
    canInstall: () => Boolean(deferredPrompt),
    install: async () => {
      if (!deferredPrompt) return false;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      document.dispatchEvent(new CustomEvent('dolapy:install-state'));
      return choice?.outcome === 'accepted';
    }
  };
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    document.dispatchEvent(new CustomEvent('dolapy:install-state'));
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.dispatchEvent(new CustomEvent('dolapy:install-state'));
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
})();

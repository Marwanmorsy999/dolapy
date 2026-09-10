(() => {
  'use strict';
  const warm = () => {
    const bg = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
    const tf = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
    Promise.allSettled([import(bg), import(tf)]).catch(() => {});
  };
  const loadScript = (src, marker) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute(marker, 'true');
    document.head.appendChild(script);
  };
  const loadContracts = () => {
    loadScript('/ai-provider.js', 'data-dolapy-ai-contract');
    loadScript('/context-engine.js', 'data-dolapy-context-engine');
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warm, { timeout: 2500 });
    window.requestIdleCallback(loadContracts, { timeout: 3500 });
  } else {
    window.setTimeout(warm, 1200);
    window.setTimeout(loadContracts, 1800);
  }
})();

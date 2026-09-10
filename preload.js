(() => {
  'use strict';
  const loadScript = (src, marker) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute(marker, 'true');
    document.head.appendChild(script);
  };
  const warmModules = () => {
    const bg = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
    const tf = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
    Promise.allSettled([import(bg), import(tf)]).catch(() => {});
  };
  const warmVision = () => {
    if (typeof window.warmDolapyAI === 'function') window.warmDolapyAI();
    else window.setTimeout(() => typeof window.warmDolapyAI === 'function' && window.warmDolapyAI(), 1800);
  };
  const loadEnhancers = () => {
    loadScript('/ai-provider.js', 'data-dolapy-ai-contract');
    loadScript('/context-engine.js', 'data-dolapy-context-engine');
    loadScript('/outfit-composer.js', 'data-dolapy-outfit-composer');
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warmModules, {timeout:1800});
    window.requestIdleCallback(warmVision, {timeout:5500});
    window.requestIdleCallback(loadEnhancers, {timeout:3500});
  } else {
    window.setTimeout(warmModules,700);
    window.setTimeout(warmVision,2200);
    window.setTimeout(loadEnhancers,1200);
  }
})();
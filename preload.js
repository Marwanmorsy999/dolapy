(() => {
  'use strict';
  const warm = () => {
    const bg = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
    const tf = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
    Promise.allSettled([import(bg), import(tf)]).catch(() => {});
  };
  const loadAIContract = () => {
    if (document.querySelector('script[data-dolapy-ai-contract]')) return;
    const script = document.createElement('script');
    script.src = '/ai-provider.js';
    script.async = true;
    script.dataset.dolapyAiContract = 'true';
    document.head.appendChild(script);
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warm, { timeout: 2500 });
    window.requestIdleCallback(loadAIContract, { timeout: 3500 });
  } else {
    window.setTimeout(warm, 1200);
    window.setTimeout(loadAIContract, 1800);
  }
})();

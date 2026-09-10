(() => {
  'use strict';
  const warm = () => {
    const bg = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
    const tf = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
    Promise.allSettled([import(bg), import(tf)]).catch(() => {});
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 2500 });
  else window.setTimeout(warm, 1200);
})();

(() => {
  'use strict';
  if (document.querySelector('script[data-dolapy-vision-v3]')) return;
  const script = document.createElement('script');
  script.src = '/vision-engine-v3.js';
  script.defer = true;
  script.setAttribute('data-dolapy-vision-v3', 'true');
  document.head.appendChild(script);
})();
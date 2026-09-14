(()=>{'use strict';
const loadScript=(src,marker)=>{if(document.querySelector(`script[${marker}]`))return;const s=document.createElement('script');s.src=src;s.async=true;s.setAttribute(marker,'true');document.head.appendChild(s)};
const loadStyle=(href,marker)=>{if(document.querySelector(`link[${marker}]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.setAttribute(marker,'true');document.head.appendChild(l)};
// Camera wiring lives solely in vision-engine-v3.js now. Do NOT load remote-vision.js here —
// it used to double-wire the same camera button/input and silently drop the captured photo.
const loadEnhancers=()=>{loadScript('/ai-provider.js','data-dolapy-ai-contract');loadScript('/outfit-composer.js','data-dolapy-outfit-composer');loadStyle('/outfit-composer.css','data-dolapy-outfit-composer-css')};
// Never download the heavy vision model during page idle time on phones.
// Vision is warmed only when the camera opens, so first paint and scrolling stay light.
if('requestIdleCallback'in window)window.requestIdleCallback(loadEnhancers,{timeout:1800});else window.setTimeout(loadEnhancers,1200);
})();

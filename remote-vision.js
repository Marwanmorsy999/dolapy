(()=>{
'use strict';
const $=s=>document.querySelector(s);let stream=null;
const isMobile=()=>/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'')||Boolean(globalThis.matchMedia?.('(pointer: coarse)')?.matches);
function getPhotoInput(){const i=$('#aiFileInput');if(!i)return null;i.accept='image/*';if(isMobile())i.setAttribute('capture','environment');else i.removeAttribute('capture');return i}
function sendToVision(files){const list=[...(files||[])].filter(f=>f?.type?.startsWith('image/'));if(!list.length)return;if(typeof globalThis.startAIUpload==='function'){Promise.resolve(globalThis.startAIUpload(list)).catch(e=>{console.error('Dolapy vision processing failed:',e);alert('Dolapy could not process that photo. Please try another photo.')});return}setTimeout(()=>{if(typeof globalThis.startAIUpload==='function')globalThis.startAIUpload(list);else alert('Dolapy vision is still loading. Please try again.');},250)}
function wire(){const input=getPhotoInput();if(!input)return;if(input.dataset.dolapyWired==='1')return;input.dataset.dolapyWired='1';input.addEventListener('change',()=>{const files=input.files;input.value='';sendToVision(files)});['addHeroAI','addWardrobeAI','bottomAddAI'].forEach(id=>{const b=$('#'+id);if(!b||b.dataset.dolapyWired==='1')return;b.dataset.dolapyWired='1';b.addEventListener('click',e=>{e.preventDefault();getPhotoInput()?.click()},{capture:true})});}
window.__DOLAPY_REMOTE_VISION=true;
window.startCamera=()=>{getPhotoInput()?.click()};window.stopCamera=()=>{if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
})();

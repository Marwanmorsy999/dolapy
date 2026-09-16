(()=>{
'use strict';
const $=s=>document.querySelector(s);

function ensureGalleryInput(){
  let input=$('#galleryMultiInput');
  if(input)return input;
  input=document.createElement('input');
  input.type='file';
  input.id='galleryMultiInput';
  input.accept='image/*';
  input.multiple=true;
  input.className='hide';
  document.body.appendChild(input);
  input.addEventListener('change',()=>{
    const files=[...(input.files||[])];
    input.value='';
    if(files.length&&window.startAIUpload)window.startAIUpload(files);
  });
  return input;
}

function wire(){
  const input=ensureGalleryInput();
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-import-photos]'))input.click();
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});
else wire();
})();

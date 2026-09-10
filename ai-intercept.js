document.addEventListener('click',(event)=>{
  const target=event.target.closest?.('#emptyUpload,#wardrobeEmptyUpload');
  if(!target)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(window.startCamera) window.startCamera();
},true);

document.addEventListener('change',(event)=>{
  if(event.target?.id!=='fileInput')return;
  event.stopImmediatePropagation();
  if(window.startAIUpload) window.startAIUpload(event.target.files);
},true);

window.addEventListener('load',()=>{
  window.startCamera=window.startCamera||undefined;
  window.startAIUpload=window.startAIUpload||undefined;
});

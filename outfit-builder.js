(()=>{
'use strict';
const STORE='dolapy.pages.v3';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

let pieces=[]; // {id, itemId, x, y, w, h, z, img}
let selectedId=null;
let zCounter=1;
let dragState=null;

function loadItems(){try{const v=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}

const CAT_ORDER=['outerwear','tops','dresses','bottoms','shoes','accessories'];
const CAT_LABEL={outerwear:'Outerwear',tops:'Tops',dresses:'Dresses',bottoms:'Bottoms',shoes:'Shoes',accessories:'Accessories'};

function renderPalette(){
  const host=$('#builderPalette');
  if(!host)return;
  const items=loadItems();
  if(!items.length){
    host.innerHTML='<div class="palette-empty">No pieces yet.<br>Add clothes to your wardrobe first.</div>';
    return;
  }
  const byCat={};
  for(const it of items){(byCat[it.category]=byCat[it.category]||[]).push(it)}
  const order=[...CAT_ORDER.filter(c=>byCat[c]),...Object.keys(byCat).filter(c=>!CAT_ORDER.includes(c))];
  host.innerHTML=order.map(cat=>`
    <div class="palette-cat">
      <div class="palette-cat-label"><span>${CAT_LABEL[cat]||cat}</span><span>${byCat[cat].length}</span></div>
      <div class="palette-grid">
        ${byCat[cat].map(it=>`<div class="palette-item" draggable="true" data-item-id="${it.id}" title="${escHtml(it.name||'')}"><img src="${it.image}" alt="${escHtml(it.name||'')}" loading="lazy"></div>`).join('')}
      </div>
    </div>
  `).join('');
}

function escHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

function canvasRect(){return $('#builderCanvas').getBoundingClientRect()}

function addPieceToCanvas(itemId,clientX,clientY){
  const items=loadItems();
  const item=items.find(i=>i.id===itemId);
  if(!item)return;
  const rect=canvasRect();
  const relX=clientX!=null?((clientX-rect.left)/rect.width)*100:40;
  const relY=clientY!=null?((clientY-rect.top)/rect.height)*100:40;
  const baseSize=item.category==='shoes'?22:item.category==='accessories'?16:38;
  const piece={
    id:`p${Date.now()}${Math.random().toString(36).slice(2,6)}`,
    itemId:item.id,
    img:item.image,
    name:item.name||'',
    category:item.category,
    x:clamp(relX-baseSize/2,0,100-baseSize),
    y:clamp(relY-baseSize/2,0,100-baseSize),
    w:baseSize,
    z:zCounter++
  };
  pieces.push(piece);
  selectedId=piece.id;
  renderCanvas();
}

function clamp(n,a,b){return Math.max(a,Math.min(b,n))}

function renderCanvas(){
  const host=$('#builderCanvas');
  if(!host)return;
  host.classList.toggle('empty',pieces.length===0);
  host.querySelectorAll('.canvas-piece').forEach(n=>n.remove());
  const sorted=[...pieces].sort((a,b)=>a.z-b.z);
  for(const p of sorted){
    const el=document.createElement('div');
    el.className='canvas-piece'+(p.id===selectedId?' selected':'');
    el.dataset.pieceId=p.id;
    el.style.left=p.x+'%';
    el.style.top=p.y+'%';
    el.style.width=p.w+'%';
    el.style.aspectRatio='1';
    el.style.zIndex=p.z;
    el.innerHTML=`<img src="${p.img}" alt="${escHtml(p.name)}" draggable="false"><button class="piece-remove" data-remove-piece="${p.id}" aria-label="Remove">×</button><div class="piece-handle" data-resize-piece="${p.id}" aria-label="Resize"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 4 4 20M14 4h6v6M10 20H4v-6"/></svg></div>`;
    host.appendChild(el);
  }
  renderTray();
  updatePieceControls();
}

function renderTray(){
  const host=$('#builderTray');
  if(!host)return;
  if(!pieces.length){host.innerHTML='<div class="tray-empty">Layers you add appear here — tap to select, drag on canvas to move.</div>';return}
  const sorted=[...pieces].sort((a,b)=>b.z-a.z);
  host.innerHTML=sorted.map(p=>`<div class="palette-item" style="flex:0 0 56px;height:56px" data-tray-piece="${p.id}"><img src="${p.img}" alt="${escHtml(p.name)}"></div>`).join('');
}

function updatePieceControls(){
  const bar=$('#builderPieceControls');
  if(!bar)return;
  bar.hidden=!selectedId;
}

function bringToFront(id){
  const p=pieces.find(x=>x.id===id);
  if(!p)return;
  p.z=zCounter++;
  renderCanvas();
}

function removePiece(id){
  pieces=pieces.filter(p=>p.id!==id);
  if(selectedId===id)selectedId=null;
  renderCanvas();
}

function selectPiece(id){
  selectedId=id;
  renderCanvas();
}

// Pointer-based drag (works for mouse + touch)
function wireCanvasDrag(){
  const host=$('#builderCanvas');
  if(!host)return;

  host.addEventListener('pointerdown',e=>{
    const pieceEl=e.target.closest('.canvas-piece');
    const removeBtn=e.target.closest('[data-remove-piece]');
    const resizeBtn=e.target.closest('[data-resize-piece]');

    if(removeBtn){removePiece(removeBtn.dataset.removePiece);return}

    if(resizeBtn){
      const id=resizeBtn.dataset.resizePiece;
      const piece=pieces.find(p=>p.id===id);
      if(!piece)return;
      selectPiece(id);
      const rect=canvasRect();
      dragState={mode:'resize',id,startX:e.clientX,startY:e.clientY,startW:piece.w,rectW:rect.width};
      e.preventDefault();
      return;
    }

    if(pieceEl){
      const id=pieceEl.dataset.pieceId;
      const piece=pieces.find(p=>p.id===id);
      if(!piece)return;
      selectPiece(id);
      bringToFront(id);
      const rect=canvasRect();
      dragState={mode:'move',id,startX:e.clientX,startY:e.clientY,startXPct:piece.x,startYPct:piece.y,rectW:rect.width,rectH:rect.height};
      pieceEl.classList.add('dragging');
      e.preventDefault();
      return;
    }

    // Clicked empty canvas — deselect
    selectedId=null;
    renderCanvas();
  });

  window.addEventListener('pointermove',e=>{
    if(!dragState)return;
    const piece=pieces.find(p=>p.id===dragState.id);
    if(!piece)return;
    if(dragState.mode==='move'){
      const dx=((e.clientX-dragState.startX)/dragState.rectW)*100;
      const dy=((e.clientY-dragState.startY)/dragState.rectH)*100;
      piece.x=clamp(dragState.startXPct+dx,-10,100-piece.w+10);
      piece.y=clamp(dragState.startYPct+dy,-10,100-piece.w+10);
      const el=document.querySelector(`[data-piece-id="${piece.id}"]`);
      if(el){el.style.left=piece.x+'%';el.style.top=piece.y+'%'}
    } else if(dragState.mode==='resize'){
      const dx=((e.clientX-dragState.startX)/dragState.rectW)*100;
      piece.w=clamp(dragState.startW+dx,8,90);
      const el=document.querySelector(`[data-piece-id="${piece.id}"]`);
      if(el)el.style.width=piece.w+'%';
    }
  });

  window.addEventListener('pointerup',()=>{
    if(dragState){
      document.querySelectorAll('.canvas-piece.dragging').forEach(n=>n.classList.remove('dragging'));
      dragState=null;
    }
  });
}

// Drag from palette to canvas (HTML5 drag events, desktop)
function wirePaletteDrag(){
  document.addEventListener('dragstart',e=>{
    const item=e.target.closest('[data-item-id]');
    if(item)e.dataTransfer.setData('text/plain',item.dataset.itemId);
  });
  const canvas=$('#builderCanvas');
  if(!canvas)return;
  canvas.addEventListener('dragover',e=>e.preventDefault());
  canvas.addEventListener('drop',e=>{
    e.preventDefault();
    const id=e.dataTransfer.getData('text/plain');
    if(id)addPieceToCanvas(id,e.clientX,e.clientY);
  });
}

// Tap-to-add for mobile (palette items don't drag well on touch)
function wirePaletteTap(){
  document.addEventListener('click',e=>{
    const item=e.target.closest('#builderPalette [data-item-id]');
    if(item)addPieceToCanvas(item.dataset.itemId);
  });
}

async function exportOutfit(){
  const canvas=$('#builderCanvas');
  if(!canvas||!pieces.length){alert('Add some pieces to your outfit first.');return}

  const rect=canvas.getBoundingClientRect();
  const scale=2; // export at 2x for crisp downloads
  const W=Math.round(rect.width*scale),H=Math.round(rect.height*scale);

  const out=document.createElement('canvas');
  out.width=W;out.height=H;
  const ctx=out.getContext('2d');
  ctx.fillStyle='#ffffff';
  ctx.fillRect(0,0,W,H);

  const sorted=[...pieces].sort((a,b)=>a.z-b.z);
  for(const p of sorted){
    const img=await loadImage(p.img);
    const px=(p.x/100)*W, py=(p.y/100)*H, pw=(p.w/100)*W;
    const ph=pw*(img.naturalHeight/img.naturalWidth);
    ctx.drawImage(img,px,py,pw,ph);
  }

  out.toBlob(blob=>{
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`dolapy-outfit-${Date.now()}.png`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  },'image/png',1);
}

function loadImage(src){
  return new Promise((res,rej)=>{
    const im=new Image();
    im.crossOrigin='anonymous';
    im.onload=()=>res(im);
    im.onerror=()=>rej(new Error('Image load failed'));
    im.src=src;
  });
}

async function shareOutfit(){
  const canvas=$('#builderCanvas');
  if(!canvas||!pieces.length){alert('Add some pieces to your outfit first.');return}
  if(!navigator.share){exportOutfit();return}

  const rect=canvas.getBoundingClientRect();
  const scale=2;
  const W=Math.round(rect.width*scale),H=Math.round(rect.height*scale);
  const out=document.createElement('canvas');
  out.width=W;out.height=H;
  const ctx=out.getContext('2d');
  ctx.fillStyle='#ffffff';
  ctx.fillRect(0,0,W,H);
  const sorted=[...pieces].sort((a,b)=>a.z-b.z);
  for(const p of sorted){
    const img=await loadImage(p.img);
    const px=(p.x/100)*W, py=(p.y/100)*H, pw=(p.w/100)*W;
    const ph=pw*(img.naturalHeight/img.naturalWidth);
    ctx.drawImage(img,px,py,pw,ph);
  }

  out.toBlob(async blob=>{
    try{
      const file=new File([blob],`dolapy-outfit.png`,{type:'image/png'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:'My outfit',text:'Built with Dolapy'});
      } else {
        exportOutfit();
      }
    }catch(e){
      if(e.name!=='AbortError')exportOutfit();
    }
  },'image/png',1);
}

function clearCanvas(){
  if(pieces.length&&!confirm('Clear this outfit?'))return;
  pieces=[];selectedId=null;zCounter=1;
  renderCanvas();
}

function showBuilder(){
  $('#stylePage')&&($('#stylePage').hidden=true);
  $('#wardrobePage')&&($('#wardrobePage').hidden=true);
  $('#builderPage')&&($('#builderPage').hidden=false);
  ['navStyle','navWardrobe','bottomStyle','bottomWardrobe'].forEach(id=>$('#'+id)?.classList.remove('active'));
  $('#navBuilder')?.classList.add('active');
  $('#bottomBuilder')?.classList.add('active');
  renderPalette();
  renderCanvas();
  window.scrollTo(0,0);
}

window.DolapyOutfitBuilder={show:showBuilder,clear:clearCanvas,export:exportOutfit,share:shareOutfit};

function wire(){
  $('#navBuilder')?.addEventListener('click',showBuilder);
  $('#bottomBuilder')?.addEventListener('click',showBuilder);
  $('#builderClear')?.addEventListener('click',clearCanvas);
  $('#builderExport')?.addEventListener('click',exportOutfit);
  $('#builderShare')?.addEventListener('click',shareOutfit);
  $('#builderBringFront')?.addEventListener('click',()=>selectedId&&bringToFront(selectedId));
  $('#builderRemoveSelected')?.addEventListener('click',()=>selectedId&&removePiece(selectedId));
  wireCanvasDrag();
  wirePaletteDrag();
  wirePaletteTap();
  document.addEventListener('dolapy:items-changed',()=>{if(!$('#builderPage')?.hidden)renderPalette()});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});
else wire();
})();

const STORE_KEY='dolapy.pages.v3';
const $=s=>document.querySelector(s);
let items=[];
let filter='all';
function loadItems(){try{const v=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function sync(){items=loadItems();renderShell();renderWardrobe()}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function showStyle(){
  $('#stylePage').hidden=false;$('#wardrobePage').hidden=true;$('#builderPage')&&($('#builderPage').hidden=true);$('#navStyle')?.classList.add('active');$('#navWardrobe')?.classList.remove('active');$('#navBuilder')?.classList.remove('active');$('#bottomStyle')?.classList.add('active');$('#bottomWardrobe')?.classList.remove('active');$('#bottomBuilder')?.classList.remove('active');renderShell();window.DolapyEngineV3?.refresh?.();
}
function showWardrobe(){
  $('#stylePage').hidden=true;$('#wardrobePage').hidden=false;$('#builderPage')&&($('#builderPage').hidden=true);$('#navStyle')?.classList.remove('active');$('#navWardrobe')?.classList.add('active');$('#navBuilder')?.classList.remove('active');$('#bottomStyle')?.classList.remove('active');$('#bottomWardrobe')?.classList.add('active');$('#bottomBuilder')?.classList.remove('active');renderWardrobe();
}
function renderShell(){
  $('#statItems')&&($('#statItems').textContent=items.length);
  $('#styleHero')&&($('#styleHero').disabled=items.length<1);
  $('#statCoverage')&&($('#statCoverage').textContent='—');$('#statScore')&&($('#statScore').textContent='—');
}
function renderFilters(){const cats=[['all','All'],['tops','Tops'],['bottoms','Bottoms'],['dresses','Dresses'],['outerwear','Outerwear'],['shoes','Shoes'],['accessories','Accessories']];const host=$('#filters');if(host)host.innerHTML=cats.map(([id,label])=>`<button class="pill ${filter===id?'active':''}" data-filter="${id}">${label}</button>`).join('')}
function renderWardrobe(){renderFilters();const host=$('#itemsGrid');if(!host)return;const shown=filter==='all'?items:items.filter(x=>x.category===filter);host.innerHTML=shown.length?shown.map(x=>`<article class="item"><div class="item-img"><img src="${escapeHtml(x.image)}" alt="${escapeHtml(x.name)}"></div><button class="fav ${x.favorite?'on':''}" data-fav="${escapeHtml(x.id)}" aria-label="Favorite">${x.favorite?'♥':'♡'}</button><div class="item-copy"><div class="eyebrow">${escapeHtml(x.category)}</div><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml(x.color||'Color not set')} · ${escapeHtml(x.style||'casual')}</small></div><button class="trash" data-remove="${escapeHtml(x.id)}" title="Remove">⌫</button></article>`).join(''):`<div class="empty" style="grid-column:1/-1"><h3>No pieces here yet.</h3><p>Add clothing photos and your wardrobe starts organizing itself.</p><button class="primary" id="wardrobeEmptyUpload">Add a photo</button></div>`}
window.renderAll=sync;
window.loadItems=loadItems;
document.addEventListener('dolapy:items-changed',sync);
document.addEventListener('click',e=>{
  const filterButton=e.target.closest('[data-filter]');if(filterButton){filter=filterButton.dataset.filter;renderWardrobe();return}
  const favButton=e.target.closest('[data-fav]');if(favButton){const id=favButton.dataset.fav;items=items.map(x=>x.id===id?{...x,favorite:!x.favorite}:x);localStorage.setItem(STORE_KEY,JSON.stringify(items));renderWardrobe();document.dispatchEvent(new CustomEvent('dolapy:items-changed'));return}
  const removeButton=e.target.closest('[data-remove]');if(removeButton){
    let confirmDelete=true;
    try{const s=JSON.parse(localStorage.getItem('dolapy.settings.v1')||'{}');if(s.confirmBeforeDelete===false)confirmDelete=false}catch{}
    if(confirmDelete){
      const target=items.find(x=>x.id===removeButton.dataset.remove);
      if(!confirm(`Remove "${target?.name||'this piece'}" from your wardrobe? This can't be undone.`))return;
    }
    items=items.filter(x=>x.id!==removeButton.dataset.remove);localStorage.setItem(STORE_KEY,JSON.stringify(items));document.dispatchEvent(new CustomEvent('dolapy:items-changed'));showWardrobe();return
  }
  if(e.target.id==='emptyUpload'||e.target.id==='wardrobeEmptyUpload')$('#addHeroAI')?.click();
  if(e.target.id==='styleHero')showStyle();
});
$('#navStyle')?.addEventListener('click',showStyle);$('#navWardrobe')?.addEventListener('click',showWardrobe);$('#bottomStyle')?.addEventListener('click',showStyle);$('#bottomWardrobe')?.addEventListener('click',showWardrobe);
sync();

const STORE_KEY = 'dolapy.pages.v2';
const $ = (s) => document.querySelector(s);

let items = loadItems();
let outfits = [];
let occasion = 'everyday';
let filter = 'all';
let pendingQueue = [];
let currentPending = null;
let activeOutfitIndex = 0;

const COLOR_WORDS = {
  black: ['black', 'charcoal', 'graphite'], white: ['white', 'cream', 'ivory'], grey: ['grey', 'gray'],
  neutral: ['beige', 'tan', 'camel', 'khaki'], brown: ['brown', 'chocolate'], blue: ['navy', 'blue', 'denim', 'cobalt', 'teal'],
  green: ['green', 'olive', 'sage'], red: ['red', 'burgundy', 'maroon', 'wine'], orange: ['orange', 'rust', 'terracotta'],
  yellow: ['yellow', 'mustard', 'gold'], purple: ['purple', 'lavender', 'lilac'], pink: ['pink', 'rose']
};
const COLOR_SCORE = {
  black:{black:1,white:1,grey:.98,neutral:.96,blue:.94,brown:.9,green:.86,red:.92,orange:.84,yellow:.86,purple:.9,pink:.9},
  white:{black:1,white:.94,grey:.97,neutral:.95,blue:.96,brown:.93,green:.9,red:.94,orange:.9,yellow:.89,purple:.92,pink:.92},
  grey:{black:.98,white:.97,grey:.94,neutral:.92,blue:.93,brown:.91,green:.89,red:.87,orange:.82,yellow:.84,purple:.9,pink:.9},
  neutral:{black:.96,white:.95,grey:.92,neutral:.92,blue:.96,brown:.97,green:.92,red:.9,orange:.89,yellow:.85,purple:.88,pink:.9},
  blue:{black:.94,white:.96,grey:.93,neutral:.96,blue:.86,brown:.96,green:.82,red:.76,orange:.74,yellow:.78,purple:.8,pink:.85},
  brown:{black:.9,white:.93,grey:.91,neutral:.97,blue:.96,brown:.9,green:.9,red:.82,orange:.87,yellow:.82,purple:.78,pink:.8},
  green:{black:.86,white:.9,grey:.89,neutral:.92,blue:.82,brown:.9,green:.84,red:.7,orange:.88,yellow:.86,purple:.73,pink:.8},
  red:{black:.92,white:.94,grey:.87,neutral:.9,blue:.76,brown:.82,green:.7,red:.72,orange:.64,yellow:.66,purple:.7,pink:.82},
  orange:{black:.84,white:.9,grey:.82,neutral:.89,blue:.74,brown:.86,green:.88,red:.65,orange:.7,yellow:.73,purple:.74,pink:.76},
  yellow:{black:.86,white:.89,grey:.84,neutral:.85,blue:.78,brown:.83,green:.86,red:.67,orange:.73,yellow:.72,purple:.82,pink:.77},
  purple:{black:.9,white:.92,grey:.9,neutral:.89,blue:.8,brown:.78,green:.73,red:.71,orange:.75,yellow:.82,purple:.78,pink:.84},
  pink:{black:.9,white:.92,grey:.9,neutral:.91,blue:.84,brown:.81,green:.79,red:.82,orange:.75,yellow:.77,purple:.84,pink:.82}
};
const STYLE_WORDS = {
  casual:['casual','everyday','basic'], street:['street','streetwear','oversized','graphic','skater'], smart:['smart','formal','tailored','office','dressy'],
  athletic:['sport','athletic','gym','active','running'], utility:['utility','workwear','cargo','military'], minimal:['minimal','clean','modern','simple'],
  preppy:['preppy','classic','oxford'], vintage:['vintage','retro','heritage']
};

function loadItems(){
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; }
}
function persist(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify(items)); } catch { alert('Your browser storage is full. Remove an older photo and try again.'); }
  renderAll();
}
function uid(){ return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function escapeHtml(v){ return String(v ?? '').replace(/[&<>"']/g, (m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function firstNonBlank(v){ return String(v || '').trim(); }
function colorFamily(v){
  const s = String(v || '').toLowerCase();
  for(const [name, words] of Object.entries(COLOR_WORDS)) if(words.some(w => s.includes(w))) return name;
  return 'unknown';
}
function styleFamily(v){
  const s = String(v || '').toLowerCase();
  for(const [name, words] of Object.entries(STYLE_WORDS)) if(words.some(w => s.includes(w))) return name;
  return 'casual';
}
function inferCategory(name){
  const s = name.toLowerCase();
  if(/dress|gown|maxi|midi/.test(s)) return 'dresses';
  if(/shoe|sneaker|trainer|boot|loafer|sandal|heel|slide/.test(s)) return 'shoes';
  if(/jacket|coat|blazer|bomber|parka|overshirt|cardigan|puffer|hoodie/.test(s)) return 'outerwear';
  if(/pants|trouser|jeans|denim|shorts|skirt|cargo|jogger|chino/.test(s)) return 'bottoms';
  return 'tops';
}
function inferStyle(name){
  const s = name.toLowerCase();
  if(/street|oversized|graphic|skater/.test(s)) return 'streetwear';
  if(/formal|tailored|blazer|office|dressy|oxford/.test(s)) return 'smart';
  if(/sport|gym|active|running/.test(s)) return 'athletic';
  if(/utility|workwear|military|cargo/.test(s)) return 'utility';
  if(/vintage|retro/.test(s)) return 'vintage';
  if(/minimal|clean|simple/.test(s)) return 'minimal';
  return 'casual';
}
function inferMeta(file){
  const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled item';
  const lower = name.toLowerCase();
  const category = inferCategory(name);
  const style = inferStyle(name);
  const color = Object.values(COLOR_WORDS).flat().find(x => lower.includes(x)) || '';
  const season = /linen|tank|shorts|sandal|summer/.test(lower) ? 'summer' : /wool|coat|puffer|fleece|thermal|winter/.test(lower) ? 'winter' : 'all';
  const occasionValue = /formal|blazer|office|tailored|dressy/.test(lower) ? 'smart' : /sport|gym|running|athletic/.test(lower) ? 'sport' : 'everyday';
  const silhouette = /oversized|boxy/.test(lower) ? 'oversized' : /wide|baggy|relaxed/.test(lower) ? 'relaxed' : /slim|skinny|tapered/.test(lower) ? 'slim' : 'regular';
  const patternValue = /stripe/.test(lower) ? 'stripe' : /check|plaid/.test(lower) ? 'check' : /graphic/.test(lower) ? 'graphic' : /print|floral/.test(lower) ? 'print' : 'solid';
  return {id:uid(),name,image:'',category,color,style,season,occasion:occasionValue,silhouette,pattern:patternValue,warmth:category==='outerwear'?4:category==='shoes'?2:3,formality:style==='smart'?4:style==='athletic'?1:2,wearCount:0,favorite:false,createdAt:Date.now()};
}
function compressImage(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1200;
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',0.82));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function startUpload(fileList){
  const files = [...(fileList || [])].filter(f => f.type && f.type.startsWith('image/'));
  if(!files.length) return;
  try {
    pendingQueue = [];
    for(const file of files){
      const meta = inferMeta(file);
      meta.image = await compressImage(file);
      pendingQueue.push(meta);
    }
    nextPending();
  } catch(err) {
    console.error(err);
    alert('Could not read that image. Try a JPG or PNG.');
    closeModal();
  }
}
function nextPending(){
  currentPending = pendingQueue.shift() || null;
  if(!currentPending){ closeModal(); return; }
  $('#previewImg').src = currentPending.image;
  $('#fName').value = currentPending.name;
  $('#fCategory').value = currentPending.category;
  $('#fColor').value = currentPending.color;
  $('#fStyle').value = currentPending.style;
  $('#queueInfo').textContent = pendingQueue.length ? `${pendingQueue.length} more image${pendingQueue.length===1?'':'s'} queued` : 'Last item in this upload';
  $('#modal').hidden = false;
  setTimeout(()=>$('#fName').focus(),40);
}
function closeModal(){ pendingQueue=[]; currentPending=null; $('#modal').hidden=true; }
function saveCurrent(){
  if(!currentPending) return;
  currentPending.name = firstNonBlank($('#fName').value) || 'Untitled item';
  currentPending.category = $('#fCategory').value;
  currentPending.color = firstNonBlank($('#fColor').value);
  currentPending.style = $('#fStyle').value;
  items.unshift(currentPending);
  currentPending = null;
  if(pendingQueue.length){ nextPending(); } else { closeModal(); showWardrobe(); }
  persist();
}
function navStyle(){ showStyle(); }
function showStyle(){
  $('#stylePage').hidden=false; $('#wardrobePage').hidden=true;
  $('#navStyle').classList.add('active'); $('#navWardrobe').classList.remove('active');
  $('#bottomStyle').classList.add('active'); $('#bottomWardrobe').classList.remove('active');
  renderStyle();
}
function showWardrobe(){
  $('#stylePage').hidden=true; $('#wardrobePage').hidden=false;
  $('#navStyle').classList.remove('active'); $('#navWardrobe').classList.add('active');
  $('#bottomStyle').classList.remove('active'); $('#bottomWardrobe').classList.add('active');
  renderWardrobe();
}

function pairColor(a,b){
  const x=colorFamily(a.color), y=colorFamily(b.color);
  if(x==='unknown'||y==='unknown') return .76;
  return COLOR_SCORE[x]?.[y] ?? COLOR_SCORE[y]?.[x] ?? .72;
}
function styleCompatibility(list){
  if(list.length<2) return .72;
  const fams = list.map(x => styleFamily(`${x.style} ${x.name}`));
  let total=0,pairs=0;
  for(let i=0;i<fams.length;i++) for(let j=i+1;j<fams.length;j++){
    pairs++;
    if(fams[i]===fams[j]) total+=1;
    else if(new Set([fams[i],fams[j]]).has('casual')&&new Set([fams[i],fams[j]]).has('minimal')) total+=.96;
    else if(new Set([fams[i],fams[j]]).has('street')&&new Set([fams[i],fams[j]]).has('utility')) total+=.94;
    else if(new Set([fams[i],fams[j]]).has('smart')&&new Set([fams[i],fams[j]]).has('preppy')) total+=.96;
    else if(new Set([fams[i],fams[j]]).has('casual')&&new Set([fams[i],fams[j]]).has('street')) total+=.9;
    else if(new Set([fams[i],fams[j]]).has('casual')&&new Set([fams[i],fams[j]]).has('athletic')) total+=.84;
    else total+=.52;
  }
  return total/pairs;
}
function silhouetteScore(top,bottom){
  if(!top||!bottom) return .92;
  const p = `${top.silhouette}:${bottom.silhouette}`;
  if(['oversized:slim','relaxed:regular','regular:relaxed'].includes(p)) return 1;
  if(['oversized:relaxed','relaxed:relaxed','regular:regular'].includes(p)) return .95;
  if(p==='oversized:oversized') return (styleFamily(top.style)==='street'||styleFamily(bottom.style)==='street')?.9:.78;
  return .86;
}
function patternScore(list){ const nonSolid=list.filter(x=>x.pattern!=='solid').length; return nonSolid<=1?1:nonSolid===2?.84:.62; }
function contextScore(list){
  const occasionFit=list.reduce((s,x)=>s+(x.occasion===occasion?1:x.occasion==='everyday'?.82:.55),0)/list.length;
  const desired = occasion==='sport'?1:occasion==='smart'?2.5:occasion==='travel'?2:occasion==='date'?2:2;
  const warmth = list.reduce((s,x)=>s+Math.max(.2,1-Math.abs(x.warmth-desired)*.26),0)/list.length;
  return .62*warmth+.38*occasionFit;
}
function compatibility(list){
  let colors=0,pairs=0;
  for(let i=0;i<list.length;i++) for(let j=i+1;j<list.length;j++){colors+=pairColor(list[i],list[j]);pairs++;}
  const color= pairs ? colors/pairs : .72;
  const formality=list.map(x=>x.formality); const avg=formality.reduce((a,b)=>a+b,0)/formality.length;
  const variance=formality.reduce((s,x)=>s+(x-avg)**2,0)/formality.length;
  const formalFit=Math.max(.35,1-Math.sqrt(variance)/2.2);
  const top=list.find(x=>x.category==='tops'), bottom=list.find(x=>x.category==='bottoms');
  return .35*color+.25*styleCompatibility(list)+.15*formalFit+.15*silhouetteScore(top,bottom)+.10*patternScore(list);
}
function validOutfit(list){
  const cats=list.map(x=>x.category);
  if(cats.includes('dresses')) return cats.every(x=>['dresses','shoes','outerwear','accessories'].includes(x)) && cats.filter(x=>x==='dresses').length===1;
  const tops=cats.filter(x=>x==='tops').length, bottoms=cats.filter(x=>x==='bottoms').length, shoes=cats.filter(x=>x==='shoes').length;
  return tops===1 && bottoms===1 && shoes<=1;
}
function candidateSets(){
  const tops=items.filter(x=>x.category==='tops').slice(0,16), bottoms=items.filter(x=>x.category==='bottoms').slice(0,16), dresses=items.filter(x=>x.category==='dresses').slice(0,10);
  const shoes=items.filter(x=>x.category==='shoes').slice(0,10), outer=items.filter(x=>x.category==='outerwear').slice(0,8), acc=items.filter(x=>x.category==='accessories').slice(0,8);
  const out=[];
  for(const d of dresses){
    out.push([d]);
    for(const s of shoes) out.push([d,s]);
    for(const o of outer.slice(0,2)) out.push([d,o]);
    for(const s of shoes.slice(0,2)) for(const o of outer.slice(0,2)) out.push([d,s,o]);
  }
  for(const t of tops) for(const b of bottoms){
    out.push([t,b]);
    for(const s of shoes) out.push([t,b,s]);
    for(const o of outer.slice(0,2)) out.push([t,b,o]);
    for(const s of shoes.slice(0,2)) for(const o of outer.slice(0,2)) out.push([t,b,s,o]);
    for(const a of acc.slice(0,2)) out.push([t,b,a]);
  }
  return out.filter(validOutfit);
}
function outfitScore(set,used){
  const freshness=set.reduce((s,x)=>s+(1/(1+(x.wearCount||0))),0)/set.length;
  const novel=set.reduce((s,x)=>s+(used.has(x.id)?0:1),0)/set.length;
  const favorite=set.reduce((s,x)=>s+(x.favorite?.08:0),0)/set.length;
  return 100*(.70*compatibility(set)+.15*contextScore(set)+.08*freshness+.05*noveltyBoost(novel)+favorite);
}
function noveltyBoost(n){ return Math.min(1,n); }
function outfitName(set){
  if(set.some(x=>x.category==='dresses')) return 'The clean dress edit';
  const fams=set.map(x=>styleFamily(`${x.style} ${x.name}`));
  if(fams.includes('street')) return 'The everyday street edit';
  if(fams.includes('smart')) return 'The sharp everyday edit';
  if(fams.includes('utility')) return 'The utility mix';
  return 'The easy everyday edit';
}
function buildOutfits(){
  const pool=candidateSets();
  const selected=[]; const used=new Set();
  for(let round=0; round<Math.min(8, Math.max(1,Math.ceil(items.length/2))) && pool.length; round++){
    pool.sort((a,b)=>outfitScore(b,used)-outfitScore(a,used));
    const best=pool.shift();
    const raw=outfitScore(best,used);
    const score=Math.max(55,Math.min(99,Math.round(raw)));
    selected.push({id:best.map(x=>x.id).sort().join('-'),items:best,score,name:outfitName(best),usedItemIds:best.map(x=>x.id),explanation:explainOutfit(best)});
    best.forEach(x=>used.add(x.id));
    for(let i=pool.length-1;i>=0;i--){
      const overlap=pool[i].filter(x=>best.some(y=>y.id===x.id)).length;
      if(overlap>=Math.min(best.length,2)) pool.splice(i,1);
    }
  }
  outfits=selected;
  activeOutfitIndex=0;
  items.forEach(item=>{ if(outfits.flatMap(o=>o.usedItemIds).includes(item.id)) item.wearCount=(item.wearCount||0)+1; });
  try{localStorage.setItem(STORE_KEY,JSON.stringify(items));}catch{}
  renderStyle();
}
function explainOutfit(set){
  const colors=set.map(x=>x.color).filter(Boolean);
  const tone=colors.length>=2?'a balanced color mix':'a simple neutral base';
  const styles=[...new Set(set.map(x=>styleFamily(`${x.style} ${x.name}`)))];
  return `Built around ${set[0].name} with ${tone}, ${styles.join(' + ')} styling, and a ${occasion} context.`;
}

function pieceHtml(x){return `<div class="piece"><img src="${x.image}" alt="${escapeHtml(x.name)}"><span>${escapeHtml(x.category)}</span></div>`;}
function cardHtml(o, index){
  return `<article class="card"><div class="pieces">${o.items.map(pieceHtml).join('')}</div><div class="body"><div class="topline"><div><div class="eyebrow">${o.score}% match</div><h3>${escapeHtml(o.name)}</h3></div><span class="match">${o.items.length} pcs</span></div><p>${escapeHtml(o.explanation)}</p><button class="secondary" data-outfit="${index}">↻ Show this one</button></div></article>`;
}
function renderPills(){
  const values=['everyday','smart','date','travel','sport'];
  $('#occasionPills').innerHTML=values.map(v=>`<button class="pill ${occasion===v?'active':''}" data-occasion="${v}">${v}</button>`).join('');
}
function renderStyle(){
  const used=new Set(outfits.flatMap(o=>o.usedItemIds));
  $('#statItems').textContent=items.length;
  $('#statCoverage').textContent=outfits.length&&items.length?`${Math.round(used.size/items.length*100)}%`:'—';
  $('#statScore').textContent=outfits[0]?`${outfits[0].score}%`:'—';
  $('#styleHero').disabled=items.length<2;
  const body=$('#engineBody');
  if(!items.length){
    body.innerHTML=`<div class="empty"><div>＋</div><h3>Start with your real wardrobe</h3><p>Upload a few clothing photos. Dolapy stores them locally in this browser and uses a deterministic styling engine to build looks.</p><button class="primary" id="emptyUpload">Upload a piece</button></div>`;
    $('#alts').hidden=true;
  } else if(!outfits.length){
    const hasTop=items.some(x=>x.category==='tops'), hasBottom=items.some(x=>x.category==='bottoms'), hasDress=items.some(x=>x.category==='dresses');
    const enough=items.length>=2 && ((hasTop&&hasBottom)||hasDress);
    body.innerHTML=`<div class="empty"><div>✦</div><h3>${enough?'Ready to style your wardrobe':'Add the pieces needed for a full look'}</h3><p>${enough?'Press Style my wardrobe to rank the strongest combinations.':'For the strongest first look, add a top + bottom, or a dress. Shoes and outerwear are optional.'}</p><button class="primary" id="engineStyle" ${enough?'':'disabled'}>✦ Style my wardrobe</button></div>`;
    $('#alts').hidden=true;
  } else {
    const active=outfits[Math.min(activeOutfitIndex,outfits.length-1)];
    body.innerHTML=`<div class="result">${cardHtml(active,activeOutfitIndex)}<div class="coverage"><div class="eyebrow green">Whole wardrobe</div><strong>${items.length?Math.round(used.size/items.length*100):0}%</strong><p>${used.size} of ${items.length} pieces appear across the current edit.</p><button class="secondary" id="rebuildStyle">↻ Rebuild the edit</button></div></div>`;
    const alts=outfits.filter((_,i)=>i!==activeOutfitIndex).slice(0,3);
    $('#alts').hidden=!alts.length;
    $('#altGrid').innerHTML=alts.map(o=>cardHtml(o,outfits.indexOf(o))).join('');
  }
}
function renderFilters(){
  const cats=[['all','All'],['tops','Tops'],['bottoms','Bottoms'],['dresses','Dresses'],['outerwear','Outerwear'],['shoes','Shoes'],['accessories','Accessories']];
  $('#filters').innerHTML=cats.map(([id,label])=>`<button class="pill ${filter===id?'active':''}" data-filter="${id}">${label}</button>`).join('');
}
function renderWardrobe(){
  renderFilters();
  const shown=filter==='all'?items:items.filter(x=>x.category===filter);
  $('#itemsGrid').innerHTML=shown.length ? shown.map(x=>`<article class="item"><div class="item-img"><img src="${x.image}" alt="${escapeHtml(x.name)}"></div><button class="fav ${x.favorite?'on':''}" data-fav="${x.id}">${x.favorite?'♥':'♡'}</button><div class="item-copy"><div class="eyebrow">${escapeHtml(x.category)}</div><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml(x.color||'Color not set')} · ${escapeHtml(x.style)}</small></div><button class="trash" data-remove="${x.id}" title="Remove">⌫</button></article>`).join('') : `<div class="empty" style="grid-column:1/-1"><h3>No pieces here yet.</h3><p>Add clothing photos and your wardrobe starts organizing itself.</p><button class="primary" id="wardrobeEmptyUpload">Add a photo</button></div>`;
}
function renderAll(){ renderPills(); renderStyle(); renderWardrobe(); }

$('#fileInput').addEventListener('change', e=>{ const fs=e.target.files; e.target.value=''; startUpload(fs); });
['addHero','addWardrobe','bottomAdd','emptyUpload','wardrobeEmptyUpload'].forEach(id=>document.addEventListener('click',e=>{ if(e.target && e.target.id===id) $('#fileInput').click(); }));
$('#styleHero').addEventListener('click',()=>{ if(items.length>=2) buildOutfits(); });
$('#closeModal').addEventListener('click',closeModal);
$('#saveItem').addEventListener('click',saveCurrent);
$('#modal').addEventListener('click',e=>{ if(e.target===e.currentTarget) closeModal(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('#modal').hidden) closeModal(); });
$('#navStyle').addEventListener('click',navStyle); $('#navWardrobe').addEventListener('click',showWardrobe); $('#bottomStyle').addEventListener('click',showStyle); $('#bottomWardrobe').addEventListener('click',showWardrobe);

document.addEventListener('click',e=>{
  const occ=e.target.closest('[data-occasion]'); if(occ){ occasion=occ.dataset.occasion; outfits=[]; renderAll(); return; }
  const fil=e.target.closest('[data-filter]'); if(fil){ filter=fil.dataset.filter; renderWardrobe(); return; }
  const fav=e.target.closest('[data-fav]'); if(fav){ const id=fav.dataset.fav; items=items.map(x=>x.id===id?{...x,favorite:!x.favorite}:x); persist(); return; }
  const rem=e.target.closest('[data-remove]'); if(rem){ const id=rem.dataset.remove; items=items.filter(x=>x.id!==id); outfits=[]; persist(); return; }
  const outfit=e.target.closest('[data-outfit]'); if(outfit){ activeOutfitIndex=Number(outfit.dataset.outfit); renderStyle(); return; }
  if(e.target.id==='engineStyle'||e.target.id==='rebuildStyle') buildOutfits();
  if(e.target.id==='emptyUpload'||e.target.id==='wardrobeEmptyUpload') $('#fileInput').click();
});

renderAll();
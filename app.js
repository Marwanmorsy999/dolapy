const STORE_KEY = 'dolapy.pages.v3';
const $ = (selector) => document.querySelector(selector);

let items = loadItems();
let outfits = [];
let occasion = 'everyday';
let filter = 'all';
let pendingQueue = [];
let currentPending = null;
let activeOutfitIndex = 0;

const COLOR_WORDS = {
  black:['black','charcoal','graphite','onyx'], white:['white','cream','ivory'], grey:['grey','gray','silver'],
  neutral:['beige','tan','camel','khaki','sand','stone','oat'], brown:['brown','chocolate','mocha','coffee'],
  blue:['navy','blue','denim','cobalt','teal','sky','azure'], green:['green','olive','sage','forest','mint'],
  red:['red','burgundy','maroon','wine','crimson'], orange:['orange','rust','terracotta','coral'],
  yellow:['yellow','mustard','gold'], purple:['purple','lavender','lilac','violet'], pink:['pink','rose','blush']
};
const COLOR_SCORE = {
  black:{black:1,white:1,grey:.99,neutral:.97,blue:.96,brown:.91,green:.88,red:.94,orange:.86,yellow:.88,purple:.93,pink:.92},
  white:{black:1,white:.94,grey:.98,neutral:.97,blue:.98,brown:.94,green:.92,red:.96,orange:.93,yellow:.91,purple:.95,pink:.94},
  grey:{black:.99,white:.98,grey:.95,neutral:.95,blue:.95,brown:.93,green:.91,red:.89,orange:.84,yellow:.87,purple:.93,pink:.92},
  neutral:{black:.97,white:.97,grey:.95,neutral:.93,blue:.98,brown:.98,green:.94,red:.91,orange:.9,yellow:.87,purple:.9,pink:.92},
  blue:{black:.96,white:.98,grey:.95,neutral:.98,blue:.86,brown:.97,green:.83,red:.78,orange:.76,yellow:.8,purple:.82,pink:.87},
  brown:{black:.91,white:.94,grey:.93,neutral:.98,blue:.97,brown:.91,green:.93,red:.82,orange:.88,yellow:.84,purple:.8,pink:.83},
  green:{black:.88,white:.92,grey:.91,neutral:.94,blue:.83,brown:.93,green:.86,red:.72,orange:.9,yellow:.88,purple:.76,pink:.82},
  red:{black:.94,white:.96,grey:.89,neutral:.91,blue:.78,brown:.82,green:.72,red:.74,orange:.67,yellow:.68,purple:.74,pink:.86},
  orange:{black:.86,white:.93,grey:.84,neutral:.9,blue:.76,brown:.88,green:.9,red:.67,orange:.72,yellow:.75,purple:.77,pink:.78},
  yellow:{black:.88,white:.91,grey:.87,neutral:.87,blue:.8,brown:.84,green:.88,red:.68,orange:.75,yellow:.74,purple:.84,pink:.8},
  purple:{black:.93,white:.95,grey:.93,neutral:.9,blue:.82,brown:.8,green:.76,red:.74,orange:.77,yellow:.84,purple:.8,pink:.86},
  pink:{black:.92,white:.94,grey:.92,neutral:.92,blue:.87,brown:.83,green:.82,red:.86,orange:.78,yellow:.8,purple:.86,pink:.84}
};

const STYLE_WORDS = {
  casual:['casual','everyday','basic','tee','tshirt','jeans','chino'],
  street:['street','streetwear','oversized','graphic','skater','baggy','cargo'],
  smart:['smart','formal','tailored','office','dressy','blazer','oxford','loafer'],
  athletic:['sport','athletic','gym','active','running','trainer'],
  utility:['utility','workwear','military','field'],
  minimal:['minimal','clean','modern','simple','plain'],
  preppy:['preppy','classic','oxford','polo','varsity'],
  vintage:['vintage','retro','heritage','washed']
};
const STYLE_COMPAT = {
  casual:{casual:1,street:.93,smart:.72,athletic:.82,utility:.88,minimal:.98,preppy:.9,vintage:.92},
  street:{casual:.93,street:1,smart:.6,athletic:.88,utility:.96,minimal:.9,preppy:.72,vintage:.95},
  smart:{casual:.72,street:.6,smart:1,athletic:.5,utility:.55,minimal:.95,preppy:.98,vintage:.82},
  athletic:{casual:.82,street:.88,smart:.5,athletic:1,utility:.8,minimal:.76,preppy:.55,vintage:.7},
  utility:{casual:.88,street:.96,smart:.55,athletic:.8,utility:1,minimal:.82,preppy:.66,vintage:.9},
  minimal:{casual:.98,street:.9,smart:.95,athletic:.76,utility:.82,minimal:1,preppy:.9,vintage:.84},
  preppy:{casual:.9,street:.72,smart:.98,athletic:.55,utility:.66,minimal:.9,preppy:1,vintage:.88},
  vintage:{casual:.92,street:.95,smart:.82,athletic:.7,utility:.9,minimal:.84,preppy:.88,vintage:1}
};
const OCCASION_TARGETS = {
  everyday:{formality:2.1,warmth:2.3,styles:['casual','street','minimal','vintage','utility','preppy']},
  smart:{formality:3.6,warmth:2.0,styles:['smart','minimal','preppy','vintage']},
  date:{formality:2.8,warmth:2.2,styles:['smart','minimal','preppy','street','vintage']},
  travel:{formality:1.8,warmth:2.4,styles:['casual','street','utility','minimal']},
  sport:{formality:1.1,warmth:2.4,styles:['athletic','casual','street']}
};

function loadItems(){
  try{const raw=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');return Array.isArray(raw)?raw:[];}catch{return[];}
}
function persist(){
  try{localStorage.setItem(STORE_KEY,JSON.stringify(items));}catch{alert('Your browser storage is full. Remove an older photo and try again.');}
  renderAll();
}
function uid(){return globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function firstNonBlank(v){return String(v||'').trim();}
function clamp(n,min,max){return Math.min(max,Math.max(min,n));}
function colorFamily(v){const s=String(v||'').toLowerCase();for(const[n,w]of Object.entries(COLOR_WORDS))if(w.some(x=>s.includes(x)))return n;return'unknown';}
function styleFamily(v){const s=String(v||'').toLowerCase();for(const[n,w]of Object.entries(STYLE_WORDS))if(w.some(x=>s.includes(x)))return n;return'casual';}
function inferCategory(name){const s=name.toLowerCase();if(/dress|gown|maxi|midi/.test(s))return'dresses';if(/shoe|sneaker|trainer|boot|loafer|sandal|heel|slide/.test(s))return'shoes';if(/jacket|coat|blazer|bomber|parka|overshirt|cardigan|puffer|hoodie/.test(s))return'outerwear';if(/pants|trouser|jeans|denim|shorts|skirt|cargo|jogger|chino|slack/.test(s))return'bottoms';if(/bag|belt|watch|hat|cap|scarf|glasses|jewelry|chain/.test(s))return'accessories';return'tops';}
function inferStyle(name){const s=name.toLowerCase();if(/street|oversized|graphic|skater|baggy|cargo/.test(s))return'streetwear';if(/formal|tailored|blazer|office|dressy|oxford|loafer/.test(s))return'smart';if(/sport|gym|active|running|trainer/.test(s))return'athletic';if(/utility|workwear|military/.test(s))return'utility';if(/vintage|retro|heritage|washed/.test(s))return'vintage';if(/minimal|clean|simple|plain/.test(s))return'minimal';if(/preppy|polo|varsity|classic/.test(s))return'preppy';return'casual';}
function basicMeta(file){
  const name=file.name.replace(/\.[^/.]+$/,'').replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim()||'Untitled item';
  const lower=name.toLowerCase(),category=inferCategory(name),style=inferStyle(name);
  const color=Object.values(COLOR_WORDS).flat().find(x=>lower.includes(x))||'';
  const season=/linen|tank|shorts|sandal|summer|tee|tshirt/.test(lower)?'summer':/wool|coat|puffer|fleece|thermal|winter|knit/.test(lower)?'winter':'all';
  const occasionValue=/formal|blazer|office|tailored|dressy|oxford/.test(lower)?'smart':/sport|gym|running|athletic/.test(lower)?'sport':'everyday';
  const silhouette=/oversized|boxy|baggy/.test(lower)?'oversized':/wide|relaxed/.test(lower)?'relaxed':/slim|skinny|tapered/.test(lower)?'slim':'regular';
  const pattern=/stripe/.test(lower)?'stripe':/check|plaid/.test(lower)?'check':/graphic/.test(lower)?'graphic':/print|floral/.test(lower)?'print':'solid';
  const warmth=category==='outerwear'?4:category==='shoes'?2:season==='summer'?1:season==='winter'?4:3;
  const formality=style==='smart'?4:style==='preppy'?3:style==='athletic'?1:2;
  return{id:uid(),name,image:'',category,color,style,season,occasion:occasionValue,silhouette,pattern,warmth,formality,wearCount:0,favorite:false,createdAt:Date.now()};
}
function rgbToFamily(r,g,b){
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
  if(mx<55)return'black'; if(mx>232&&d<25)return'white'; if(d<18&&mx<165)return'grey';
  const nr=r/255,ng=g/255,nb=b/255,hue=(Math.atan2(Math.sqrt(3)*(ng-nb),2*nr-ng-nb)*180/Math.PI+360)%360;
  if((hue<18||hue>=345)&&r>g*1.18)return'red'; if(hue>=18&&hue<48)return'orange'; if(hue>=48&&hue<75)return'yellow'; if(hue>=75&&hue<165)return'green'; if(hue>=165&&hue<255)return'blue'; if(hue>=255&&hue<310)return'purple'; if(hue>=310&&hue<345)return'pink'; if(mx<205&&r>g*1.08&&r>b*1.08)return'brown'; if(mx<205)return'neutral'; return'unknown';
}
async function detectImageColor(dataUrl){
  return new Promise(resolve=>{const img=new Image();img.onload=()=>{try{const c=document.createElement('canvas');c.width=96;c.height=96;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,96,96);const data=ctx.getImageData(12,12,72,72).data;let r=0,g=0,b=0,n=0;for(let i=0;i<data.length;i+=4){const a=data[i+3],rr=data[i],gg=data[i+1],bb=data[i+2],mx=Math.max(rr,gg,bb),mn=Math.min(rr,gg,bb);if(a<120||mx-mn<8&&mx>190)continue;r+=rr;g+=gg;b+=bb;n++;}resolve(n?((f)=>f==='unknown'?'':f)(rgbToFamily(r/n,g/n,b/n)):'');}catch{resolve('');}};img.onerror=()=>resolve('');img.src=dataUrl;});
}
async function compressImage(file){
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onload=()=>{try{const max=1200,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.82));}catch(err){reject(err);}};img.onerror=reject;img.src=reader.result;};reader.readAsDataURL(file);});
}
async function startUpload(fileList){
  const files=[...(fileList||[])].filter(f=>f.type&&f.type.startsWith('image/'));if(!files.length)return;
  try{pendingQueue=[];for(const file of files){const meta=basicMeta(file);meta.image=await compressImage(file);const detected=await detectImageColor(meta.image);if(!meta.color&&detected)meta.color=detected;meta.colorSource=meta.color?(detected&&colorFamily(meta.color)===detected?'filename+image':'filename'):(detected?'image':'unknown');meta.metadataConfidence=[meta.category,meta.style,meta.color].filter(Boolean).length/3;pendingQueue.push(meta);}nextPending();}
  catch(err){console.error(err);alert('Could not read that image. Try a JPG or PNG.');closeModal();}
}
function nextPending(){
  currentPending=pendingQueue.shift()||null;if(!currentPending){closeModal();return;}
  $('#previewImg').src=currentPending.image;$('#fName').value=currentPending.name;$('#fCategory').value=currentPending.category;$('#fColor').value=currentPending.color;$('#fStyle').value=currentPending.style;$('#queueInfo').textContent=pendingQueue.length?`${pendingQueue.length} more image${pendingQueue.length===1?'':'s'} queued`:'Last item in this upload';$('#modal').hidden=false;setTimeout(()=>$('#fName').focus(),40);
}
function closeModal(){pendingQueue=[];currentPending=null;$('#modal').hidden=true;}
function saveCurrent(){
  if(!currentPending)return;
  currentPending.name=firstNonBlank($('#fName').value)||'Untitled item';currentPending.category=$('#fCategory').value;currentPending.color=firstNonBlank($('#fColor').value);currentPending.style=$('#fStyle').value;currentPending.formality=currentPending.style==='smart'?4:currentPending.style==='preppy'?3:currentPending.style==='athletic'?1:2;items.unshift(currentPending);currentPending=null;if(pendingQueue.length)nextPending();else{closeModal();showWardrobe();}persist();
}
function showStyle(){
  $('#stylePage').hidden=false;$('#wardrobePage').hidden=true;$('#navStyle').classList.add('active');$('#navWardrobe').classList.remove('active');$('#bottomStyle').classList.add('active');$('#bottomWardrobe').classList.remove('active');renderStyle();
}
function showWardrobe(){
  $('#stylePage').hidden=true;$('#wardrobePage').hidden=false;$('#navStyle').classList.remove('active');$('#navWardrobe').classList.add('active');$('#bottomStyle').classList.remove('active');$('#bottomWardrobe').classList.add('active');renderWardrobe();
}
function pairColor(a,b){const x=colorFamily(a.color),y=colorFamily(b.color);if(x==='unknown'||y==='unknown')return.7;return COLOR_SCORE[x]?.[y]??COLOR_SCORE[y]?.[x]??.72;}
function styleCompatibility(list){if(list.length<2)return.75;let total=0,pairs=0;const fams=list.map(x=>styleFamily(`${x.style} ${x.name}`));for(let i=0;i<fams.length;i++)for(let j=i+1;j<fams.length;j++){pairs++;total+=STYLE_COMPAT[fams[i]]?.[fams[j]]??STYLE_COMPAT[fams[j]]?.[fams[i]]??.55;}return total/pairs;}
function silhouetteScore(top,bottom){if(!top||!bottom)return.9;const a=top.silhouette,b=bottom.silhouette;if((a==='oversized'&&b==='slim')||(a==='slim'&&b==='oversized'))return 1;if((a==='relaxed'&&b==='regular')||(a==='regular'&&b==='relaxed'))return.98;if(a==='oversized'&&b==='relaxed')return.95;if(a==='regular'&&b==='regular')return.92;if(a==='oversized'&&b==='oversized')return styleFamily(top.style)==='street'||styleFamily(bottom.style)==='street'?.88:.74;if(a==='slim'&&b==='slim')return.86;return.88;}
function patternScore(list){const patterned=list.filter(x=>x.pattern&&x.pattern!=='solid');if(patterned.length<=1)return 1;if(patterned.length===2)return patterned[0].pattern===patterned[1].pattern?.72:.84;return.56;}
function formalityScore(list){const vals=list.map(x=>Number(x.formality)||2),avg=vals.reduce((a,b)=>a+b,0)/vals.length,spread=Math.sqrt(vals.reduce((s,x)=>s+(x-avg)**2,0)/vals.length),target=OCCASION_TARGETS[occasion]?.formality||2;return clamp(1-Math.abs(avg-target)/3.6,.25,1)*.7+clamp(1-spread/2.2,.25,1)*.3;}
function seasonScore(list){const summer=list.filter(x=>x.season==='summer').length,winter=list.filter(x=>x.season==='winter').length;if(summer&&winter)return.55;const target=OCCASION_TARGETS[occasion]?.warmth||2.3,avg=list.reduce((s,x)=>s+(Number(x.warmth)||2.5),0)/list.length;return clamp(1-Math.abs(avg-target)/3.2,.25,1);}
function occasionScore(list){const profile=OCCASION_TARGETS[occasion]||OCCASION_TARGETS.everyday;return list.map(x=>profile.styles.includes(styleFamily(`${x.style} ${x.name}`))?1:.58).reduce((a,b)=>a+b,0)/list.length;}
function colorHarmonyScore(list){if(list.length<2)return.74;let total=0,pairs=0;for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){total+=pairColor(list[i],list[j]);pairs++;}return total/pairs;}
function statementBalanceScore(list){const statements=list.filter(x=>x.pattern!=='solid'||styleFamily(`${x.style} ${x.name}`)==='street').length;return statements<=1?1:statements===2?.9:.72;}
function roleCompletenessScore(list){const cats=list.map(x=>x.category);if(cats.includes('dresses'))return 1;if(!cats.includes('tops')||!cats.includes('bottoms'))return.35;return clamp(.86+(cats.includes('shoes')?.08:0)+(cats.includes('outerwear')?.04:0)+(cats.includes('accessories')?.02:0),0,1);}
function userFitScore(list){const wear=list.reduce((s,x)=>s+1/(1+(x.wearCount||0)),0)/list.length,fav=list.reduce((s,x)=>s+(x.favorite?.15:0),0)/list.length,meta=list.reduce((s,x)=>s+(x.metadataConfidence||.9),0)/list.length;return clamp(.55*wear+.25*Math.min(1,fav)+.2*meta,.25,1);}
function hardInvalid(list){
  const cats=list.map(x=>x.category);
  if(cats.includes('dresses')){if(cats.filter(x=>x==='dresses').length!==1||cats.includes('tops')||cats.includes('bottoms'))return true;}
  else if(cats.filter(x=>x==='tops').length!==1||cats.filter(x=>x==='bottoms').length!==1)return true;
  if(cats.filter(x=>x==='shoes').length>1||cats.filter(x=>x==='outerwear').length>1||cats.filter(x=>x==='accessories').length>2)return true;
  const fams=list.map(x=>styleFamily(`${x.style} ${x.name}`));
  if(fams.includes('smart')&&fams.includes('athletic')&&occasion!=='sport')return true;
  if(list.filter(x=>x.pattern!=='solid').length>=3)return true;
  return false;
}
function candidateSets(){
  const tops=items.filter(x=>x.category==='tops').slice(0,24),bottoms=items.filter(x=>x.category==='bottoms').slice(0,24),dresses=items.filter(x=>x.category==='dresses').slice(0,12),shoes=items.filter(x=>x.category==='shoes').slice(0,14),outer=items.filter(x=>x.category==='outerwear').slice(0,10),acc=items.filter(x=>x.category==='accessories').slice(0,8),out=[];
  for(const d of dresses){out.push([d]);for(const s of shoes)out.push([d,s]);for(const o of outer.slice(0,4))out.push([d,o]);for(const s of shoes.slice(0,4))for(const o of outer.slice(0,3))out.push([d,s,o]);for(const s of shoes.slice(0,4))for(const a of acc.slice(0,3))out.push([d,s,a]);}
  for(const t of tops)for(const b of bottoms){out.push([t,b]);for(const s of shoes)out.push([t,b,s]);for(const o of outer.slice(0,4))out.push([t,b,o]);for(const s of shoes.slice(0,5))for(const o of outer.slice(0,3))out.push([t,b,s,o]);for(const a of acc.slice(0,3))out.push([t,b,a]);for(const s of shoes.slice(0,3))for(const a of acc.slice(0,2))out.push([t,b,s,a]);}
  return out.filter(set=>!hardInvalid(set));
}
function outfitScore(set,used){
  const parts={role:roleCompletenessScore(set),color:colorHarmonyScore(set),style:styleCompatibility(set),silhouette:silhouetteScore(set.find(x=>x.category==='tops'),set.find(x=>x.category==='bottoms')),formality:formalityScore(set),pattern:patternScore(set),statement:statementBalanceScore(set),season:seasonScore(set),occasion:occasionScore(set),user:userFitScore(set)};
  const novel=set.reduce((s,x)=>s+(used.has(x.id)?0:1),0)/set.length,coverage=.6*novel+.4*(set.reduce((s,x)=>s+1/(1+(x.wearCount||0)),0)/set.length);
  const w={role:.1,color:.19,style:.18,silhouette:.1,formality:.1,pattern:.06,statement:.05,season:.08,occasion:.07,user:.05,coverage:.02};
  let total=Object.entries(w).reduce((s,[k,v])=>s+parts[k]*v,0);const fams=new Set(set.map(x=>styleFamily(`${x.style} ${x.name}`)));if(fams.has('street')&&fams.has('smart'))total-=.04;if(set.length===1)total-=.11;return clamp(total*100,0,100);
}
function setSimilarity(a,b){
  const idsA=new Set(a.items.map(x=>x.id)),idsB=new Set(b.items.map(x=>x.id));let shared=0;for(const id of idsA)if(idsB.has(id))shared++;const j=shared/(idsA.size+idsB.size-shared||1);const stA=new Set(a.items.map(x=>styleFamily(`${x.style} ${x.name}`))),stB=new Set(b.items.map(x=>styleFamily(`${x.style} ${x.name}`)));let ss=0;for(const s of stA)if(stB.has(s))ss++;const su=new Set([...stA,...stB]).size||1;return .75*j+.25*(ss/su);
}
function outfitName(set){if(set.some(x=>x.category==='dresses'))return'The clean dress edit';const fams=set.map(x=>styleFamily(`${x.style} ${x.name}`));if(fams.includes('street'))return'The everyday street edit';if(fams.includes('smart'))return occasion==='date'?'The date-night edit':'The sharp everyday edit';if(fams.includes('utility'))return'The utility mix';if(fams.includes('vintage'))return'The vintage balance';return occasion==='travel'?'The easy travel edit':'The easy everyday edit';}
function explainOutfit(set){const colors=[...new Set(set.map(x=>colorFamily(x.color)).filter(x=>x!=='unknown'))],fams=[...new Set(set.map(x=>styleFamily(`${x.style} ${x.name}`)))],colorText=colors.length>=2?`${colors.join(' + ')} harmony`:'a clean tonal base',extras=[];if(set.some(x=>x.category==='outerwear'))extras.push('layering');if(set.some(x=>x.category==='shoes'))extras.push('complete footwear');if(set.some(x=>x.category==='accessories'))extras.push('a finishing accent');return`Strong ${occasion} fit: ${colorText}, ${fams.join(' + ')} styling${extras.length?' with '+extras.join(', '):''}.`;}
function buildOutfits(){
  const pool=candidateSets();if(!pool.length){outfits=[];renderStyle();return;}const selected=[],used=new Set();const targetCount=Math.min(10,Math.max(3,Math.ceil(items.length/2)));
  while(selected.length<targetCount&&pool.length){let bestIndex=0,bestValue=-Infinity;for(let i=0;i<pool.length;i++){const raw=outfitScore(pool[i],used);const sim=selected.length?Math.max(...selected.map(o=>setSimilarity({items:pool[i]},o))):0;const mmr=raw-sim*17;if(mmr>bestValue){bestValue=mmr;bestIndex=i;}}const best=pool.splice(bestIndex,1)[0],finalScore=Math.round(clamp(outfitScore(best,used),55,99));const outfit={id:best.map(x=>x.id).sort().join('-'),items:best,score:finalScore,name:outfitName(best),usedItemIds:best.map(x=>x.id),explanation:explainOutfit(best)};selected.push(outfit);best.forEach(x=>used.add(x.id));for(let i=pool.length-1;i>=0;i--)if(setSimilarity({items:pool[i]},outfit)>.88)pool.splice(i,1);}
  outfits=selected;activeOutfitIndex=0;items.forEach(item=>{if(used.has(item.id))item.wearCount=(item.wearCount||0)+1;});try{localStorage.setItem(STORE_KEY,JSON.stringify(items));}catch{}renderStyle();
}
function pieceHtml(x){return`<div class="piece"><img src="${x.image}" alt="${escapeHtml(x.name)}"><span>${escapeHtml(x.category)}</span></div>`;}
function cardHtml(o,index){return`<article class="card"><div class="pieces">${o.items.map(pieceHtml).join('')}</div><div class="body"><div class="topline"><div><div class="eyebrow">${o.score}% match</div><h3>${escapeHtml(o.name)}</h3></div><span class="match">${o.items.length} pcs</span></div><p>${escapeHtml(o.explanation)}</p><button class="secondary" data-outfit="${index}">↻ Show this one</button></div></article>`;}
function renderPills(){const values=['everyday','smart','date','travel','sport'];$('#occasionPills').innerHTML=values.map(v=>`<button class="pill ${occasion===v?'active':''}" data-occasion="${v}">${v}</button>`).join('');}
function renderStyle(){
  const used=new Set(outfits.flatMap(o=>o.usedItemIds));$('#statItems').textContent=items.length;$('#statCoverage').textContent=outfits.length&&items.length?`${Math.round(used.size/items.length*100)}%`:'—';$('#statScore').textContent=outfits[0]?`${outfits[0].score}%`:'—';$('#styleHero').disabled=items.length<2;const body=$('#engineBody');
  if(!items.length){body.innerHTML=`<div class="empty"><div>＋</div><h3>Start with your real wardrobe</h3><p>Upload a few clothing photos. Dolapy reads the filename and image color, then ranks combinations locally.</p><button class="primary" id="emptyUpload">Upload a piece</button></div>`;$('#alts').hidden=true;return;}
  const hasTop=items.some(x=>x.category==='tops'),hasBottom=items.some(x=>x.category==='bottoms'),hasDress=items.some(x=>x.category==='dresses'),enough=items.length>=2&&((hasTop&&hasBottom)||hasDress);
  if(!outfits.length){body.innerHTML=`<div class="empty"><div>✦</div><h3>${enough?'Ready to style your wardrobe':'Add the pieces needed for a full look'}</h3><p>${enough?'Dolapy will score valid combinations across color, style, proportions, occasion, season, novelty and wear history.':'For the strongest first look, add a top + bottom, or a dress. Shoes, layers and accessories are optional.'}</p><button class="primary" id="engineStyle" ${enough?'':'disabled'}>✦ Style my wardrobe</button></div>`;$('#alts').hidden=true;return;}
  const active=outfits[Math.min(activeOutfitIndex,outfits.length-1)];body.innerHTML=`<div class="result">${cardHtml(active,activeOutfitIndex)}<div class="coverage"><div class="eyebrow green">Whole wardrobe</div><strong>${items.length?Math.round(used.size/items.length*100):0}%</strong><p>${used.size} of ${items.length} pieces appear across the current edit. The planner favors strong combinations while spreading wear.</p><button class="secondary" id="rebuildStyle">↻ Rebuild the edit</button></div></div>`;const alts=outfits.filter((_,i)=>i!==activeOutfitIndex).slice(0,3);$('#alts').hidden=!alts.length;$('#altGrid').innerHTML=alts.map(o=>cardHtml(o,outfits.indexOf(o))).join('');
}
function renderFilters(){const cats=[['all','All'],['tops','Tops'],['bottoms','Bottoms'],['dresses','Dresses'],['outerwear','Outerwear'],['shoes','Shoes'],['accessories','Accessories']];$('#filters').innerHTML=cats.map(([id,label])=>`<button class="pill ${filter===id?'active':''}" data-filter="${id}">${label}</button>`).join('');}
function renderWardrobe(){renderFilters();const shown=filter==='all'?items:items.filter(x=>x.category===filter);$('#itemsGrid').innerHTML=shown.length?shown.map(x=>`<article class="item"><div class="item-img"><img src="${x.image}" alt="${escapeHtml(x.name)}"></div><button class="fav ${x.favorite?'on':''}" data-fav="${x.id}" aria-label="Favorite">${x.favorite?'♥':'♡'}</button><div class="item-copy"><div class="eyebrow">${escapeHtml(x.category)}</div><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml(x.color||'Color not set')} · ${escapeHtml(x.style)}</small></div><button class="trash" data-remove="${x.id}" title="Remove">⌫</button></article>`).join(''):`<div class="empty" style="grid-column:1/-1"><h3>No pieces here yet.</h3><p>Add clothing photos and your wardrobe starts organizing itself.</p><button class="primary" id="wardrobeEmptyUpload">Add a photo</button></div>`;}
function renderAll(){renderPills();renderStyle();renderWardrobe();}

$('#fileInput').addEventListener('change',e=>{const fs=e.target.files;e.target.value='';startUpload(fs);});
['addHero','addWardrobe','bottomAdd'].forEach(id=>document.addEventListener('click',e=>{if(e.target?.id===id)$('#fileInput').click();}));
$('#styleHero').addEventListener('click',()=>{if(items.length>=2)buildOutfits();});
$('#closeModal').addEventListener('click',closeModal);$('#saveItem').addEventListener('click',saveCurrent);$('#modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modal').hidden)closeModal();});
document.addEventListener('click',e=>{
  const occasionButton=e.target.closest('[data-occasion]');if(occasionButton){occasion=occasionButton.dataset.occasion;outfits=[];renderPills();renderStyle();return;}
  const filterButton=e.target.closest('[data-filter]');if(filterButton){filter=filterButton.dataset.filter;renderWardrobe();return;}
  const favButton=e.target.closest('[data-fav]');if(favButton){const id=favButton.dataset.fav;items=items.map(x=>x.id===id?{...x,favorite:!x.favorite}:x);persist();return;}
  const removeButton=e.target.closest('[data-remove]');if(removeButton){const id=removeButton.dataset.remove;items=items.filter(x=>x.id!==id);outfits=[];persist();showWardrobe();renderStyle();return;}
  const outfitButton=e.target.closest('[data-outfit]');if(outfitButton){activeOutfitIndex=Number(outfitButton.dataset.outfit)||0;renderStyle();return;}
  if(e.target.id==='engineStyle'||e.target.id==='rebuildStyle'){buildOutfits();return;}
  if(e.target.id==='emptyUpload'||e.target.id==='wardrobeEmptyUpload')$('#fileInput').click();
});
$('#navStyle').addEventListener('click',showStyle);$('#navWardrobe').addEventListener('click',showWardrobe);$('#bottomStyle').addEventListener('click',showStyle);$('#bottomWardrobe').addEventListener('click',showWardrobe);
renderAll();

(()=>{
'use strict';
const STORE='dolapy.pages.v3';
const TF_URL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
const MODEL='Xenova/clip-vit-base-patch32';
const $=s=>document.querySelector(s);
let tfModule=null,classifier=null;
let classifierPromise=null,current=null,queue=[];
const perf=()=>window.DolapyPerformance||{mobile:/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent),lowPower:/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)&&!navigator.gpu,imageSize:()=>768,classifierOptions:()=>({device:'wasm',dtype:'q8'})};
const LABELS=['t-shirt','graphic t-shirt','polo shirt','button-up shirt','shirt','hoodie','sweater','cardigan','jacket','coat','blazer','overshirt','jeans','wide-leg trousers','trousers','cargo pants','chinos','shorts','skirt','dress','suit','sneakers','boots','loafers','sandals','heels','slides','bag','backpack','cap','hat','belt','watch','scarf','glasses'];
const COLORS={black:['black','charcoal','graphite'],white:['white','cream','ivory'],grey:['grey','gray','silver'],neutral:['beige','tan','camel','khaki','sand','stone','oat'],brown:['brown','chocolate','mocha','coffee'],blue:['navy','blue','denim','cobalt','teal','sky','azure'],green:['green','olive','sage','forest','mint'],red:['red','burgundy','maroon','wine','crimson'],orange:['orange','rust','terracotta','coral'],yellow:['yellow','mustard','gold'],purple:['purple','lavender','lilac','violet'],pink:['pink','rose','blush']};
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const title=s=>String(s||'').replace(/(^|[\s-])([a-z])/g,(m,p,c)=>p+c.toUpperCase());
function timeout(p,ms,msg){let t;return Promise.race([p,new Promise((_,r)=>t=setTimeout(()=>r(new Error(msg)),ms))]).finally(()=>clearTimeout(t))}
async function ensureClassifier(){if(classifier)return classifier;if(classifierPromise)return classifierPromise;classifierPromise=(async()=>{try{if(!tfModule)tfModule=await timeout(import(TF_URL),20000,'Classifier module download timed out');classifier=await timeout(tfModule.pipeline('zero-shot-image-classification',MODEL,perf().classifierOptions()),120000,'Classifier load timed out');console.log('[Dolapy] Classifier ready')}catch(e){console.warn('[Dolapy] Classifier unavailable:',e?.message||e);classifier=null}finally{classifierPromise=null}return classifier})();return classifierPromise}
window.warmDolapyAI=()=>{ensureClassifier().catch(()=>{})};
function readFile(file){return new Promise((res,rej)=>{const r=new FileReader();r.onerror=()=>rej(new Error('Read failed'));r.onload=()=>res(r.result);r.readAsDataURL(file)})}
function imageFromSource(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Decode failed'));i.src=src})}
async function normalizeImage(input,maxSize){
  const max=maxSize||768;
  let bitmap=null,bitmapError=null;
  if(typeof createImageBitmap==='function'&&(input instanceof Blob||input instanceof File)){
    try{bitmap=await createImageBitmap(input,{imageOrientation:'from-image'})}
    catch(e){bitmapError=e}
  }
  let src=bitmap;
  if(!src){
    try{
      src=await imageFromSource(typeof input==='string'?input:await readFile(input));
    }catch(e){
      // Both decode paths failed — this is a real, specific failure (unsupported format
      // like HEIC on a browser that can't decode it, or a corrupted file), not a generic
      // error. Say so clearly instead of letting a vague rejection bubble up.
      const type=input?.type||'unknown type';
      throw new Error(`This photo's format (${type}) couldn't be opened by your browser. Try taking the photo again, or check your phone's camera format settings (avoid HEIC if possible).`);
    }
  }
  const w=bitmap?bitmap.width:src.naturalWidth,h=bitmap?bitmap.height:src.naturalHeight;
  if(!w||!h){bitmap?.close?.();throw new Error('This photo has no readable image data (0×0 dimensions) — it may be corrupted.')}
  const scale=Math.min(1,max/Math.max(w,h));
  const c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));
  const x=c.getContext('2d',{alpha:false});
  if(!x){bitmap?.close?.();throw new Error('Canvas unavailable')}
  x.drawImage(src,0,0,c.width,c.height);
  bitmap?.close?.();
  return new Promise((res,rej)=>c.toBlob(v=>v?res(v):rej(new Error('Could not encode this photo — it may be corrupted or in an unsupported format.')),'image/jpeg',.9));
}
async function restoreOriginalColors(originalBlob,bgRemovedBlob){try{const [orig,removed]=await Promise.all([imageFromSource(await readFile(originalBlob)),imageFromSource(await readFile(bgRemovedBlob))]);const w=removed.naturalWidth,h=removed.naturalHeight,oc=document.createElement('canvas'),rc=document.createElement('canvas');oc.width=rc.width=w;oc.height=rc.height=h;const ox=oc.getContext('2d',{willReadFrequently:true,alpha:false}),rx=rc.getContext('2d',{willReadFrequently:true,alpha:true});if(!ox||!rx)return bgRemovedBlob;ox.drawImage(orig,0,0,w,h);rx.drawImage(removed,0,0,w,h);const od=ox.getImageData(0,0,w,h).data,rd=rx.getImageData(0,0,w,h),px=rd.data;for(let i=0;i<px.length;i+=4){if(px[i+3]>0){px[i]=od[i];px[i+1]=od[i+1];px[i+2]=od[i+2]}}const out=document.createElement('canvas');out.width=w;out.height=h;out.getContext('2d',{alpha:true}).putImageData(rd,0,0);return await new Promise((res,rej)=>out.toBlob(v=>v?res(v):rej(new Error('Output encode failed')),'image/png',1))}catch(e){console.warn('[Dolapy] Color restore failed:',e?.message||e);return bgRemovedBlob}}
async function validateCutout(blob){try{const im=await imageFromSource(await readFile(blob)),s=64,c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d',{willReadFrequently:true});if(!x)return true;x.drawImage(im,0,0,s,s);const d=x.getImageData(0,0,s,s).data;let transparent=0;for(let i=3;i<d.length;i+=4)if(d[i]<64)transparent++;const ratio=transparent/(s*s),corners=[[0,0],[56,0],[0,56],[56,56]];let clear=0;for(const [cx,cy]of corners){let t=0;for(let yy=cy;yy<cy+8;yy++)for(let xx=cx;xx<cx+8;xx++)if(d[(yy*s+xx)*4+3]<64)t++;if(t/64>.5)clear++}console.log(`[Dolapy] Cutout check: ${Math.round(ratio*100)}% transparent, ${clear}/4 clear corners`);return ratio>=.15&&clear>=3}catch(e){console.warn('[Dolapy] Cutout validation skipped:',e?.message||e);return true}}
async function cleanCutout(originalBlob){
  setStage('Isolating the garment…');
  const form=new FormData();
  form.append('image',originalBlob,'photo.jpg');
  let res;
  try{
    res=await timeout(fetch('/api/remove-bg',{method:'POST',body:form}),25000,'Background removal server did not respond in time');
  }catch(e){
    throw new Error(`Could not reach the background removal service: ${e?.message||e}`);
  }
  if(!res.ok){
    let msg=`Background removal failed (${res.status})`;
    try{const j=await res.json();if(j?.error)msg=j.error}catch{}
    if(res.status===501)msg='Background removal is not enabled on this deployment yet.';
    throw new Error(msg);
  }
  const result=await res.blob();
  if(!result||result.size<200)throw new Error('Background removal returned an empty result');
  setStage('Cleaning up the cutout…');
  if(!(await validateCutout(result)))throw new Error('Background removal produced an opaque result — the photo may not have enough contrast between the garment and its background');
  return restoreOriginalColors(originalBlob,result);
}
function hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,l=(mx+mn)/2,s=d?d/(1-Math.abs(2*l-1)):0;let h=0;if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=(h*60+360)%360}return{h,s,l,v:mx}}
function colorName(r,g,b){const{h,s,l,v}=hsl(r,g,b);if(v<.16)return'black';if(v<.28&&s<.28)return'charcoal';if(l>.92&&s<.13)return'white';if(l>.82&&s<.24)return'cream';if(s<.1&&l<.7)return'grey';if(s<.2&&l>=.7)return'beige';if(l<.42&&h>=15&&h<45&&s>.22)return'brown';if(h>=345||h<12)return l<.45?'burgundy':'red';if(h<42)return l<.42?'rust':'orange';if(h<72)return l<.45?'mustard':'yellow';if(h<160)return l<.45?'olive':'green';if(h<255)return l<.42?'navy':'blue';if(h<310)return l<.46?'purple':'lavender';return l<.5?'rose':'pink'}
const family=n=>{const s=String(n||'').toLowerCase();for(const[k,w]of Object.entries(COLORS))if(w.some(x=>s.includes(x)))return k;return'unknown'};
async function detectColor(blob){try{const im=await imageFromSource(await readFile(blob));const c=document.createElement('canvas');c.width=c.height=72;const x=c.getContext('2d',{willReadFrequently:true});if(!x)return{name:'neutral',family:'neutral'};x.drawImage(im,0,0,72,72);const d=x.getImageData(6,6,60,60).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=4){if(d[i+3]<100)continue;const v=hsl(d[i],d[i+1],d[i+2]);if(v.v>.98&&v.s<.08)continue;r+=d[i];g+=d[i+1];b+=d[i+2];n++}if(!n)return{name:'neutral',family:'neutral'};const name=colorName(r/n,g/n,b/n);return{name,family:family(name)}}catch{return{name:'neutral',family:'neutral'}}}
const categoryFromText=t=>{const s=String(t||'').toLowerCase();if(/dress/.test(s))return'dresses';if(/jeans|trouser|cargo|chino|shorts|skirt|pants/.test(s))return'bottoms';if(/sneaker|boot|loafer|sandal|heel|slide/.test(s))return'shoes';if(/jacket|coat|blazer|overshirt|hoodie|sweater|cardigan|suit/.test(s))return'outerwear';if(/bag|backpack|cap|hat|belt|watch|scarf|glasses/.test(s))return'accessories';return'tops'};
const styleFromText=t=>{const s=String(t||'').toLowerCase();if(/cargo|hoodie|jacket|overshirt|graphic|wide-leg/.test(s))return'streetwear';if(/blazer|loafer|oxford|suit|tailored|formal/.test(s))return'smart';if(/sport|running|trainer|gym|athletic/.test(s))return'athletic';if(/utility|workwear/.test(s))return'utility';if(/vintage|retro|heritage|washed/.test(s))return'vintage';if(/polo|classic|varsity/.test(s))return'preppy';if(/minimal|plain|clean/.test(s))return'minimal';return'casual'};
const silhouetteFromText=t=>{const s=String(t||'').toLowerCase();if(/oversized|boxy|baggy/.test(s))return'oversized';if(/wide[- ]leg|wide|relaxed/.test(s))return'relaxed';if(/slim|skinny|tapered|fitted/.test(s))return'slim';return'regular'};
async function classify(blob){if(!classifier)return[];const u=URL.createObjectURL(blob);try{return await timeout(classifier(u,LABELS),30000,'Classification timed out')||[]}catch{return[]}finally{URL.revokeObjectURL(u)}}
const filenameMeta=f=>{const text=f?.name?.replace(/\.[^/.]+$/,'').replace(/[-_]+/g,' ').trim()||'';return{text,category:categoryFromText(text),style:styleFromText(text),silhouette:silhouetteFromText(text)}};
async function analyse(file){if(!file)throw new Error('No image supplied');setStage('Optimizing the photo…');const normalized=await normalizeImage(file);const meta=filenameMeta(file);const classifierReady=ensureClassifier();let cutout=null,bgRemoved=false,bgError=null;try{cutout=await cleanCutout(normalized);bgRemoved=true}catch(e){bgError=e?.message||String(e);console.warn('[Dolapy] BG removal failed:',bgError)}setStage('Reading garment type…');await classifierReady;const results=await classify(cutout||normalized),best=results[0]||{label:'',score:0},label=best.label||'',text=`${label} ${meta.text}`.trim(),category=label&&Number(best.score||0)>=.08?categoryFromText(label):meta.category,style=styleFromText(text),silhouette=silhouetteFromText(text);setStage('Reading garment color…');const color=await detectColor(cutout||normalized),lower=text.toLowerCase(),season=/linen|tank|shorts|sandal|summer|tee/.test(lower)?'summer':/wool|coat|puffer|fleece|thermal|winter|knit/.test(lower)?'winter':'all',confidence=clamp(Number(best.score||0));const nameBase=label||(category==='tops'?'T-Shirt':category==='bottoms'?'Bottoms':category);return{id:uid(),name:title([color.name||'',style!=='casual'?style:'',nameBase].filter(Boolean).join(' ')),image:await readFile(cutout||normalized),category,color:color.name||'neutral',colorFamily:color.family,style,season,occasion:style==='smart'?'smart':style==='athletic'?'sport':'everyday',silhouette,pattern:/stripe/.test(lower)?'stripe':/check|plaid/.test(lower)?'check':/graphic|print/.test(lower)?'graphic':'solid',warmth:category==='outerwear'?4:category==='shoes'?2:season==='summer'?1:season==='winter'?4:3,formality:style==='smart'?4:style==='preppy'?3:style==='athletic'?1:2,wearCount:0,favorite:false,aiIdentified:Boolean(label),backgroundRemoved:bgRemoved,visualConfidence:confidence,recognitionMargin:results[1]?clamp(confidence-Number(results[1].score||0)):confidence,aiAlternatives:results.slice(0,4).map(x=>({label:x.label,score:Number(x.score||0)})),metadataConfidence:clamp(confidence*.65+(color.name?.25:.08)+.1),createdAt:Date.now(),_bgWarning:bgRemoved?null:`Background removal didn't work for this photo (${bgError||'unknown error'}). The original photo was saved — you can still edit the details below.`}}
function openResult(item){current=item;$('#previewImg').src=item.image;$('#fName').value=item.name;$('#fCategory').value=item.category;$('#fColor').value=item.color;$('#fStyle').value=item.style;$('#queueInfo').textContent=item._bgWarning||`${queue.length?queue.length+' more piece'+(queue.length===1?'':'s')+' ready':'AI processing complete'}${item.backgroundRemoved?' · Background removed':''}`;$('#modal').hidden=false}
function closeResult(){current=null;$('#modal').hidden=true}
function save(){if(!current)return;const patch={name:$('#fName').value.trim()||current.name,category:$('#fCategory').value,color:$('#fColor').value.trim()||current.color,style:$('#fStyle').value};const{_persistedId,_bgWarning,...clean}=current;const item={...clean,...patch,formality:patch.style==='smart'?4:patch.style==='preppy'?3:patch.style==='athletic'?1:2};let items=[];try{items=JSON.parse(localStorage.getItem(STORE)||'[]');if(!Array.isArray(items))items=[]}catch{}items.unshift(item);try{localStorage.setItem(STORE,JSON.stringify(items))}catch{alert('Your browser storage is full. Remove an older photo and try again.');return}window.dispatchEvent(new CustomEvent('dolapy:items-changed'));if(_persistedId)window.DolapyQueueStore?.removeEntry(_persistedId).catch(()=>{});const next=queue.shift();if(next)openResult(next);else closeResult();updateBatchChip()}
async function fallbackItem(file,err){
  const meta=filenameMeta(file);
  let normalized=null,imageData=null;
  try{
    normalized=await normalizeImage(file);
    imageData=await readFile(normalized);
  }catch(normalizeErr){
    // The photo genuinely can't be decoded/displayed at all — don't fall back to the raw
    // undecodable file (that's what was producing a broken-image icon in ~2s with no
    // real processing). Surface the real reason clearly instead of a silent garbage item.
    throw new Error(err?.message&&!/timed out/i.test(err.message)?err.message:normalizeErr.message);
  }
  return{id:uid(),name:title(meta.text||'New Piece'),image:imageData,category:meta.category,color:'neutral',colorFamily:'neutral',style:meta.style,season:'all',occasion:'everyday',silhouette:meta.silhouette,pattern:'solid',warmth:3,formality:2,wearCount:0,favorite:false,aiIdentified:false,backgroundRemoved:false,visualConfidence:0,recognitionMargin:0,aiAlternatives:[],metadataConfidence:0.1,createdAt:Date.now(),_bgWarning:`AI processing timed out or failed (${err?.message||'unknown error'}). Saved the original photo — you can edit the details below.`}
}

// ---- Non-blocking batch processing (IndexedDB-persisted, resumable) ----
// Replaces the old "modal blocks until first photo is ready" flow. Photos are written
// to IndexedDB the instant they're queued, BEFORE processing starts — closing the tab
// mid-batch no longer loses any unprocessed photo. Processing runs entirely in the
// background behind a small dismissible progress chip; the review modal opens only
// when the user taps a finished item, never forced automatically.
let batchActive=false,batchQueueMeta={total:0,done:0,failed:0};
let photoDurations=[]; // rolling samples, first one excluded once we have a second (it includes one-time classifier warm-up)
let currentStage='';
let lastFailureReason='';
function setStage(text){currentStage=text;updateBatchChip()}

function chip(){
  let e=$('#batchChip');
  if(!e){e=document.createElement('div');e.id='batchChip';e.className='batch-chip';e.hidden=true;document.body.appendChild(e)}
  return e;
}

function estimateRemaining(){
  const left=batchQueueMeta.total-batchQueueMeta.done-batchQueueMeta.failed;
  if(left<=0)return'';
  if(!photoDurations.length)return', estimating time…';
  // The first photo often pays a one-time classifier warm-up cost that doesn't recur —
  // once we have a second, faster sample, drop the first outlier from the average so the
  // estimate reflects steady-state speed rather than a wildly inflated first-photo number.
  const samples=photoDurations.length>1?photoDurations.slice(1):photoDurations;
  const avgMs=samples.reduce((a,b)=>a+b,0)/samples.length;
  const secs=Math.round((avgMs*left)/1000);
  if(secs<60)return`, about ${secs}s left`;
  return`, about ${Math.round(secs/60)} min left`;
}

function updateBatchChip(){
  const e=chip();
  const {total,done,failed}=batchQueueMeta;
  const finished=done+failed;
  if(!total||finished>=total){
    if(total&&finished>=total){
      e.className='batch-chip batch-chip-done';
      e.innerHTML=`<div class="batch-chip-spinner"></div><div class="batch-chip-body"><div class="batch-chip-title">${done} piece${done===1?'':'s'} ready to review${failed?`, ${failed} failed`:''}</div><div class="batch-chip-sub">${failed&&lastFailureReason?lastFailureReason:'Tap to open'}</div></div><div class="batch-chip-actions"><button data-chip-dismiss aria-label="Dismiss">×</button></div>`;
      e.hidden=false;
      setTimeout(()=>{if(!batchActive)e.hidden=true},8000);
    } else {
      e.hidden=true;
    }
    return;
  }
  e.className='batch-chip';
  e.innerHTML=`<div class="batch-chip-spinner"></div><div class="batch-chip-body"><div class="batch-chip-title">Processing photo ${finished+1} of ${total}</div><div class="batch-chip-sub">${currentStage||'Working…'} · ${queue.length} ready${estimateRemaining()}</div></div><div class="batch-chip-actions">${queue.length?'<button data-chip-review aria-label="Review ready pieces"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>':''}</div>`;
  e.hidden=false;
}

document.addEventListener('click',e=>{
  if(e.target.closest('[data-chip-dismiss]')){chip().hidden=true;return}
  if(e.target.closest('[data-chip-review]')||e.target.closest('.batch-chip-done')){
    const next=queue.shift();
    if(next)openResult(next);
  }
});

async function persistQueueEntry(file){
  const id=uid();
  try{
    await window.DolapyQueueStore?.addEntry({id,blob:file,fileName:file.name||'photo.jpg',status:'pending',result:null,error:null,addedAt:Date.now()});
  }catch(e){console.warn('[Dolapy] Could not persist queue entry (IndexedDB unavailable):',e?.message||e)}
  return id;
}

async function processOneFile(file,persistedId){
  const startedAt=Date.now();
  let item=null;
  try{
    item=await timeout(analyse(file),210000,'Processing timed out');
  }catch(e){
    console.error('[Dolapy] Vision error:',e);
    try{item=await fallbackItem(file,e)}catch(e2){console.error('[Dolapy] Fallback also failed:',e2);lastFailureReason=e2?.message||String(e2)}
  }
  photoDurations.push(Date.now()-startedAt);
  if(persistedId){
    if(item)await window.DolapyQueueStore?.updateEntry(persistedId,{status:'done',result:item}).catch(()=>{});
    else await window.DolapyQueueStore?.updateEntry(persistedId,{status:'failed',error:'processing failed'}).catch(()=>{});
  }
  return item;
}

async function runBatch(entries){
  // entries: [{file, persistedId}]
  batchActive=true;
  batchQueueMeta={total:entries.length,done:0,failed:0};
  photoDurations=[];
  currentStage='';
  updateBatchChip();
  for(const {file,persistedId} of entries){
    const item=await processOneFile(file,persistedId);
    if(item){
      batchQueueMeta.done++;
      item._persistedId=persistedId||null; // carried so save() can clear the persisted copy
      queue.push(item);
    } else {
      batchQueueMeta.failed++;
      if(persistedId)await window.DolapyQueueStore?.removeEntry(persistedId).catch(()=>{});
    }
    updateBatchChip();
  }
  batchActive=false;
  updateBatchChip();
  window.DolapyQueueStore?.clearFinished().catch(()=>{});
}

async function processFiles(files){
  const list=[...(files||[])].filter(f=>f?.type?.startsWith('image/'));
  if(!list.length)return;
  const entries=[];
  for(const file of list){
    const persistedId=await persistQueueEntry(file);
    entries.push({file,persistedId});
  }
  runBatch(entries); // intentionally not awaited — runs in the background
}

async function resumeUnfinishedQueue(){
  try{
    const all=await window.DolapyQueueStore?.getAllEntries();
    if(!all||!all.length)return;
    const pending=all.filter(e=>e.status==='pending'); // never finished AI processing — needs re-running
    const readyToReview=all.filter(e=>e.status==='done'&&e.result); // finished, just never got saved
    const failed=all.filter(e=>e.status==='failed');
    if(!pending.length&&!readyToReview.length){
      for(const f of failed)await window.DolapyQueueStore?.removeEntry(f.id).catch(()=>{});
      return;
    }
    const total=pending.length+readyToReview.length;
    const banner=document.createElement('div');
    banner.className='resume-banner';
    banner.innerHTML=`<div class="resume-banner-body"><strong>Unfinished photos found</strong>${total} photo${total===1?'':'s'} from last time — some already processed, just never saved.</div><div class="resume-banner-actions"><button class="resume-yes">Resume</button><button class="resume-no">Discard</button></div>`;
    document.body.appendChild(banner);
    banner.querySelector('.resume-yes').addEventListener('click',()=>{
      banner.remove();
      // Already-processed items skip straight into the review queue — no reprocessing needed.
      for(const r of readyToReview){r.result._persistedId=r.id;queue.push(r.result)}
      if(queue.length&&!current)openResult(queue.shift());
      // Anything that never finished AI processing goes through the normal batch pipeline.
      if(pending.length){
        const entries=pending.map(p=>({file:p.blob,persistedId:p.id}));
        runBatch(entries);
      }
    });
    banner.querySelector('.resume-no').addEventListener('click',async()=>{
      banner.remove();
      for(const e of[...pending,...readyToReview,...failed])await window.DolapyQueueStore?.removeEntry(e.id).catch(()=>{});
    });
  }catch(e){console.warn('[Dolapy] Resume check failed:',e?.message||e)}
}

window.startAIUpload=(files)=>{const list=[...(files||[])].filter(f=>f?.type?.startsWith('image/'));if(!list.length)return;processFiles(list).catch(e=>{console.error(e);alert('Dolapy could not process that photo. Please try another photo.')})};

const isMobile=()=>/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'')||Boolean(globalThis.matchMedia?.('(pointer: coarse)')?.matches);
function wire(){const input=$('#aiFileInput');if(!input||input.dataset.dolapyVisionWired==='1')return;input.dataset.dolapyVisionWired='1';if(isMobile())input.setAttribute('capture','environment');else input.removeAttribute('capture');input.addEventListener('change',()=>{const files=[...(input.files||[])];input.value='';window.startAIUpload(files)});['addHeroAI','addWardrobeAI','bottomAddAI'].forEach(id=>{const b=$('#'+id);if(!b||b.dataset.dolapyVisionWired==='1')return;b.dataset.dolapyVisionWired='1';b.addEventListener('click',e=>{e.preventDefault();input.click()});});const close=$('#closeModal'),saveBtn=$('#saveItem');close?.addEventListener('click',closeResult);saveBtn?.addEventListener('click',save);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modal').hidden)closeResult()})}
function bootWire(){wire();if('requestIdleCallback'in window)requestIdleCallback(()=>window.warmDolapyAI?.(),{timeout:4000});else setTimeout(()=>window.warmDolapyAI?.(),1500);setTimeout(()=>resumeUnfinishedQueue(),1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootWire,{once:true});else bootWire();
setTimeout(bootWire,500);
window.DolapyVision={analyse:processFiles,preload:()=>ensureClassifier()};
})();
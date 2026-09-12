(()=>{
'use strict';
const STORE='dolapy.pages.v3';
const TF_URL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
const MODEL='Xenova/clip-vit-base-patch32';
const RMBG_WORKER='https://marwanmorsy999-dolapy-rmbg.hf.space';
const $=s=>document.querySelector(s);

let classifier=null,aiLoadPromise=null,current=null,queue=[];

const perf=()=>window.DolapyPerformance||{
  mobile:/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent),
  lowPower:/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)&&!navigator.gpu,
  classifierOptions:()=>({device:'wasm',dtype:'q8'})
};

const LABELS=['t-shirt','graphic t-shirt','polo shirt','button-up shirt','shirt',
  'hoodie','sweater','cardigan','jacket','coat','blazer','overshirt',
  'jeans','wide-leg trousers','trousers','cargo pants','chinos','shorts',
  'skirt','dress','suit','sneakers','boots','loafers','sandals','heels',
  'slides','bag','backpack','cap','hat','belt','watch','scarf','glasses'];

const COLORS={black:['black','charcoal','graphite'],white:['white','cream','ivory'],
  grey:['grey','gray','silver'],neutral:['beige','tan','camel','khaki','sand','stone','oat'],
  brown:['brown','chocolate','mocha','coffee'],blue:['navy','blue','denim','cobalt','teal','sky','azure'],
  green:['green','olive','sage','forest','mint'],red:['red','burgundy','maroon','wine','crimson'],
  orange:['orange','rust','terracotta','coral'],yellow:['yellow','mustard','gold'],
  purple:['purple','lavender','lilac','violet'],pink:['pink','rose','blush']};

const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const title=s=>String(s||'').replace(/(^|[\s-])([a-z])/g,(m,p,c)=>p+c.toUpperCase());

// Status overlay
function status(show,label='',pct=0,sub=''){
  let e=$('#aiScanStatus');
  if(!e){
    e=document.createElement('div');
    e.id='aiScanStatus';e.className='scan-status';e.hidden=true;
    e.innerHTML='<div class="scan-card"><div class="scan-spinner"></div><div class="scan-copy"><strong id="aiScanLabel"></strong><span id="aiScanSub"></span></div><div class="scan-track"><span id="aiScanBar"></span></div></div>';
    document.body.appendChild(e);
  }
  e.hidden=!show;
  if(show){
    $('#aiScanLabel').textContent=label;
    $('#aiScanSub').textContent=sub;
    $('#aiScanBar').style.width=`${clamp(pct/100)*100}%`;
  }
}

function timeout(p,ms,msg){
  let t;
  return Promise.race([p,new Promise((_,r)=>t=setTimeout(()=>r(new Error(msg)),ms))])
    .finally(()=>clearTimeout(t));
}

// Load only the classifier — IMG.LY removed entirely
async function loadAI(){
  if(aiLoadPromise)return aiLoadPromise;
  aiLoadPromise=(async()=>{
    try{
      status(true,'Loading garment recognition…',15,'One-time download, cached after.');
      const tf=await import(TF_URL);
      classifier=await timeout(
        tf.pipeline('zero-shot-image-classification',MODEL,perf().classifierOptions()),
        perf().lowPower?8000:20000,
        'Classifier timed out'
      );
      console.log('[Dolapy] Classifier ready');
    }catch(e){
      console.warn('[Dolapy] Classifier unavailable:',e.message);
      classifier=null;
    }
    return true;
  })();
  return aiLoadPromise;
}

window.warmDolapyAI=()=>loadAI().catch(()=>{});

// Image utilities
function readFile(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onerror=()=>rej(new Error('Could not read image'));
    r.onload=()=>res(r.result);
    r.readAsDataURL(file);
  });
}

function imageFromSource(src){
  return new Promise((res,rej)=>{
    const i=new Image();
    i.onload=()=>res(i);
    i.onerror=()=>rej(new Error('Could not decode image'));
    i.src=src;
  });
}

async function normalizeImage(input,maxSize){
  const max=maxSize||768;
  let bitmap=null;
  if(typeof createImageBitmap==='function'&&(input instanceof Blob||input instanceof File)){
    try{
      bitmap=await createImageBitmap(input,{imageOrientation:'from-image'});
    }catch(ex){bitmap=null}
  }
  const source=bitmap||await imageFromSource(typeof input==='string'?input:await readFile(input));
  const w=bitmap?bitmap.width:source.naturalWidth;
  const h=bitmap?bitmap.height:source.naturalHeight;
  const scale=Math.min(1,max/Math.max(w||1,h||1));
  const c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(w*scale));
  c.height=Math.max(1,Math.round(h*scale));
  const x=c.getContext('2d',{alpha:false});
  if(!x){bitmap?.close?.();throw new Error('Canvas unavailable')}
  x.drawImage(source,0,0,c.width,c.height);
  bitmap?.close?.();
  return new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('Encoding failed')),'image/jpeg',.9));
}

async function measureTransparency(blob){
  try{
    const im=await imageFromSource(await readFile(blob));
    const s=Math.min(100,im.naturalWidth,im.naturalHeight);
    const c=document.createElement('canvas');c.width=c.height=s;
    const x=c.getContext('2d',{willReadFrequently:true});
    if(!x)return 0;
    x.drawImage(im,0,0,s,s);
    const d=x.getImageData(0,0,s,s).data;
    let t=0;for(let i=3;i<d.length;i+=4)if(d[i]<64)t++;
    return t/(d.length/4);
  }catch{return 0}
}

// Server BG removal — only path
async function cleanCutout(blob){
  console.log('[Dolapy] BG removal: server (RMBG-2.0)');
  status(true,'Removing background…',40,'Processing on our servers.');
  const form=new FormData();
  form.append('image',blob,'photo.jpg');
  const res=await timeout(
    fetch(`${RMBG_WORKER}/remove-bg`,{method:'POST',body:form}),
    45000,'Server BG removal timed out'
  );
  if(!res.ok){
    const err=await res.json().catch(()=>({error:'unknown'}));
    throw new Error(`Server ${res.status}: ${err.error||'unknown'}`);
  }
  const png=await res.blob();
  if(!png||png.size<1000)throw new Error('Server returned empty result');
  const transparency=await measureTransparency(png);
  if(transparency<0.05)throw new Error(`BG removal failed (${Math.round(transparency*100)}% transparent)`);
  console.log(`[Dolapy] BG removal OK — ${Math.round(transparency*100)}% transparent`);
  return png;
}

// Color detection
function hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,l=(mx+mn)/2,s=d?d/(1-Math.abs(2*l-1)):0;let h=0;if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=(h*60+360)%360}return{h,s,l,v:mx}}
function colorName(r,g,b){const{h,s,l,v}=hsl(r,g,b);if(v<.16)return'black';if(v<.28&&s<.28)return'charcoal';if(l>.92&&s<.13)return'white';if(l>.82&&s<.24)return'cream';if(s<.1&&l<.7)return'grey';if(s<.2&&l>=.7)return'beige';if(l<.42&&h>=15&&h<45&&s>.22)return'brown';if(h>=345||h<12)return l<.45?'burgundy':'red';if(h<42)return l<.42?'rust':'orange';if(h<72)return l<.45?'mustard':'yellow';if(h<160)return l<.45?'olive':'green';if(h<255)return l<.42?'navy':'blue';if(h<310)return l<.46?'purple':'lavender';return l<.5?'rose':'pink'}
const family=n=>{const s=String(n||'').toLowerCase();for(const[k,w]of Object.entries(COLORS))if(w.some(x=>s.includes(x)))return k;return'unknown'};

async function detectColor(blob){
  try{
    const im=await imageFromSource(await readFile(blob));
    const c=document.createElement('canvas');c.width=c.height=72;
    const x=c.getContext('2d',{willReadFrequently:true});
    if(!x)return{name:'',family:''};
    x.drawImage(im,0,0,72,72);
    const d=x.getImageData(6,6,60,60).data,b=new Map;
    for(let i=0;i<d.length;i+=4){
      if(d[i+3]<100)continue;
      const r=d[i],g=d[i+1],bl=d[i+2],v=hsl(r,g,bl);
      if(v.v>.975&&v.s<.08)continue;
      const k=`${Math.round(r/20)*20},${Math.round(g/20)*20},${Math.round(bl/20)*20}`;
      const e=b.get(k)||{w:0,r:0,g:0,b:0};
      const ww=.7+Math.min(1,v.s*1.4);
      e.w+=ww;e.r+=r*ww;e.g+=g*ww;e.b+=bl*ww;b.set(k,e);
    }
    const top=[...b.values()].sort((a,z)=>z.w-a.w)[0];
    if(!top)return{name:'',family:''};
    const n=colorName(top.r/top.w,top.g/top.w,top.b/top.w);
    return{name:n,family:family(n)};
  }catch{return{name:'',family:''}}
}

const categoryFromText=t=>{const s=String(t||'').toLowerCase();if(/dress/.test(s))return'dresses';if(/jeans|trouser|cargo|chino|shorts|skirt|pants/.test(s))return'bottoms';if(/sneaker|boot|loafer|sandal|heel|slide/.test(s))return'shoes';if(/jacket|coat|blazer|overshirt|hoodie|sweater|cardigan|suit/.test(s))return'outerwear';if(/bag|backpack|cap|hat|belt|watch|scarf|glasses/.test(s))return'accessories';return'tops'};
const styleFromText=t=>{const s=String(t||'').toLowerCase();if(/cargo|hoodie|jacket|overshirt|graphic|wide-leg/.test(s))return'streetwear';if(/blazer|loafer|oxford|suit|tailored|formal/.test(s))return'smart';if(/sport|running|trainer|gym|athletic/.test(s))return'athletic';if(/utility|workwear/.test(s))return'utility';if(/vintage|retro|heritage|washed/.test(s))return'vintage';if(/polo|classic|varsity/.test(s))return'preppy';if(/minimal|plain|clean/.test(s))return'minimal';return'casual'};
const silhouetteFromText=t=>{const s=String(t||'').toLowerCase();if(/oversized|boxy|baggy/.test(s))return'oversized';if(/wide[- ]leg|wide|relaxed/.test(s))return'relaxed';if(/slim|skinny|tapered|fitted/.test(s))return'slim';return'regular'};

async function classify(blob){
  if(!classifier)return[];
  const u=URL.createObjectURL(blob);
  try{return await timeout(classifier(u,LABELS),perf().lowPower?8000:20000)||[]}
  catch{return[]}
  finally{URL.revokeObjectURL(u)}
}

const filenameMeta=f=>{const text=f?.name?.replace(/\.[^/.]+$/,'').replace(/[-_]+/g,' ').trim()||'';return{text,category:categoryFromText(text),style:styleFromText(text),silhouette:silhouetteFromText(text)}};

async function analyse(file){
  if(!file)throw new Error('No image supplied');
  status(true,'Preparing photo…',10,'Optimizing the camera image.');
  const normalized=await normalizeImage(file);
  const fallback=filenameMeta(file);

  // Load classifier in background (non-blocking for BG removal)
  const classifierReady=loadAI().catch(()=>{});

  // BG removal — server only
  let cutout=null,bgRemoved=false;
  try{
    cutout=await cleanCutout(normalized);
    bgRemoved=true;
  }catch(e){
    console.warn('[Dolapy] BG removal failed:',e.message);
    cutout=null;
  }

  // Classify
  status(true,'Identifying piece…',75,'Reading garment type.');
  await classifierReady;
  let results=[];
  if(classifier){
    try{results=await classify(cutout||normalized)}catch{}
  }

  const best=results[0]||{label:'',score:0};
  const label=best.label||'';
  const text=`${label} ${fallback.text}`.trim();
  const category=label&&Number(best.score||0)>=.08?categoryFromText(label):fallback.category;
  const style=styleFromText(text);
  const silhouette=silhouetteFromText(text);

  status(true,'Detecting color…',88,'Reading garment color.');
  const color=await detectColor(cutout||normalized);
  const lower=text.toLowerCase();
  const season=/linen|tank|shorts|sandal|summer|tee/.test(lower)?'summer':/wool|coat|puffer|fleece|thermal|winter|knit/.test(lower)?'winter':'all';
  const confidence=clamp(Number(best.score||0));
  const imageData=await readFile(cutout||normalized);

  return{
    id:uid(),
    name:title([color.name||'',style!=='casual'?style:'',title(label||(category==='tops'?'T-Shirt':category==='bottoms'?'Bottoms':category))].filter(Boolean).join(' ')),
    image:imageData,category,color:color.name||'neutral',colorFamily:color.family,
    style,season,occasion:style==='smart'?'smart':style==='athletic'?'sport':'everyday',
    silhouette,pattern:/stripe/.test(lower)?'stripe':/check|plaid/.test(lower)?'check':/graphic|print/.test(lower)?'graphic':'solid',
    warmth:category==='outerwear'?4:category==='shoes'?2:season==='summer'?1:season==='winter'?4:3,
    formality:style==='smart'?4:style==='preppy'?3:style==='athletic'?1:2,
    wearCount:0,favorite:false,aiIdentified:Boolean(label),backgroundRemoved:bgRemoved,
    visualConfidence:confidence,
    recognitionMargin:results[1]?clamp(confidence-Number(results[1].score||0)):confidence,
    aiAlternatives:results.slice(0,4).map(x=>({label:x.label,score:Number(x.score||0)})),
    metadataConfidence:clamp(confidence*.65+(color.name?.25:.08)+.1),
    createdAt:Date.now(),
    _bgWarning:bgRemoved?null:'Background removal server unavailable. Please try again in a moment.'
  };
}

function openResult(item){
  current=item;
  const p=$('#previewImg');if(p)p.src=item.image;
  $('#fName').value=item.name;
  $('#fCategory').value=item.category;
  $('#fColor').value=item.color;
  $('#fStyle').value=item.style;
  let info='';
  if(item._bgWarning){info=item._bgWarning;}
  else if(queue.length){info=`${queue.length} more piece${queue.length===1?'':'s'} to review`;}
  else{info=`AI confidence ${Math.round((item.metadataConfidence||0)*100)}%`+(item.backgroundRemoved?' · Background removed':'');}
  $('#queueInfo').textContent=info;
  $('#modal').hidden=false;
}

function closeResult(){current=null;queue=[];$('#modal').hidden=true;status(false)}

function save(){
  if(!current)return;
  current.name=String($('#fName').value||'').trim()||current.name;
  current.category=$('#fCategory').value;
  current.color=String($('#fColor').value||'').trim()||current.color;
  current.style=$('#fStyle').value;
  current.formality=current.style==='smart'?4:current.style==='preppy'?3:current.style==='athletic'?1:2;
  let items=[];
  try{items=JSON.parse(localStorage.getItem(STORE)||'[]')}catch{}
  if(!Array.isArray(items))items=[];
  items.unshift(current);
  try{localStorage.setItem(STORE,JSON.stringify(items))}catch{
    alert('Storage full. Remove an older piece first.');return;
  }
  current=null;
  if(queue.length){
    const next=queue.shift();openResult(next);
  }else{
    status(false);$('#modal').hidden=true;
    window.renderAll?.();
    window.DolapyIntelligence?.refresh?.();
    window.DolapyContext?.render?.();
    window.DolapyEngineV3?.generate?.();
  }
}

async function startAIUpload(files){
  const list=[...(files||[])].filter(f=>f?.type?.startsWith('image/'));
  if(!list.length)return;
  queue=[];current=null;
  for(let i=0;i<list.length;i++){
    status(true,`Processing ${i+1} of ${list.length}…`,5,'Your photo stays local.');
    try{
      queue.push(await analyse(list[i]));
    }catch(e){
      console.error('[Dolapy] Item failed:',e);
      try{
        const n=await normalizeImage(list[i]),m=filenameMeta(list[i]);
        queue.push({
          id:uid(),name:title(m.text||'Untitled item'),image:await readFile(n),
          category:m.category,color:'neutral',colorFamily:'neutral',style:m.style,
          season:'all',occasion:'everyday',silhouette:m.silhouette,pattern:'solid',
          warmth:3,formality:2,wearCount:0,favorite:false,aiIdentified:false,
          backgroundRemoved:false,visualConfidence:0,recognitionMargin:0,
          aiAlternatives:[],metadataConfidence:.1,createdAt:Date.now(),
          _bgWarning:'Could not process this photo. Try again with better lighting.'
        });
      }catch(fe){console.error('[Dolapy] Fallback failed:',fe)}
    }
  }
  status(false);
  if(queue.length)openResult(queue.shift());
  else alert('Could not process that photo. Please try again.');
}

function wire(){
  $('#closeModal')?.addEventListener('click',closeResult);
  $('#saveItem')?.addEventListener('click',save);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!$('#modal')?.hidden)closeResult();
  });
}

window.startCamera=()=>{};
window.stopCamera=()=>{};
window.startAIUpload=startAIUpload;
window.DolapyVision={analyse,startAIUpload,warm:()=>window.warmDolapyAI?.()};

if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',wire,{once:true});
else wire();
})();

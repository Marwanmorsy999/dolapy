(()=>{
'use strict';
const STORE='dolapy.pages.v3';
const BG_URL='https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const TF_URL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
const MODEL='ff13/fashion-clip';
const $=s=>document.querySelector(s);
let removeBackground=null,segmentForeground=null,classifier=null,aiLoadPromise=null,cameraStream=null,current=null,queue=[];
const perf=()=>window.DolapyPerformance||{mobile:/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent),lowPower:/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)&&!navigator.gpu,imageSize:()=>768,segmentationModel:()=>'isnet_fp16',classifierOptions:()=>navigator.gpu?{device:'webgpu',dtype:'fp16'}:{device:'wasm',dtype:'q8'}};
const LABELS=['t-shirt','graphic t-shirt','polo shirt','button-up shirt','shirt','hoodie','sweater','cardigan','jacket','coat','blazer','overshirt','jeans','wide-leg trousers','trousers','cargo pants','chinos','shorts','skirt','dress','suit','sneakers','boots','loafers','sandals','heels','slides','bag','backpack','cap','hat','belt','watch','scarf','glasses'];
const COLORS={black:['black','charcoal','graphite'],white:['white','cream','ivory'],grey:['grey','gray','silver'],neutral:['beige','tan','camel','khaki','sand','stone','oat'],brown:['brown','chocolate','mocha','coffee'],blue:['navy','blue','denim','cobalt','teal','sky','azure'],green:['green','olive','sage','forest','mint'],red:['red','burgundy','maroon','wine','crimson'],orange:['orange','rust','terracotta','coral'],yellow:['yellow','mustard','gold'],purple:['purple','lavender','lilac','violet'],pink:['pink','rose','blush']};
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const title=s=>String(s||'').replace(/(^|[\s-])([a-z])/g,(m,p,c)=>p+c.toUpperCase());

/* ── IN-APP DEBUG PANEL ─────────────────────────────────────────────────── */
let debugPanel=null,debugLog=[],debugTimer=null;
function dbg(msg,type='info'){
  const ts=new Date().toTimeString().slice(0,8);
  const entry={ts,msg,type};
  debugLog.push(entry);
  console.log('[Dolapy]',msg);
  if(!debugPanel){
    debugPanel=document.createElement('div');
    debugPanel.id='dolapyDebug';
    debugPanel.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;background:rgba(0,0,0,0.92);color:#fff;font:12px/1.5 monospace;padding:8px 10px 12px;max-height:45vh;overflow-y:auto;border-top:2px solid #f60';
    const hdr=document.createElement('div');
    hdr.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;border-bottom:1px solid #444;padding-bottom:4px';
    hdr.innerHTML='<b style="color:#f90">Dolapy Debug</b><button id="dbgClose" style="background:#f60;border:none;color:#fff;border-radius:3px;padding:2px 8px;cursor:pointer;font:11px monospace">✕</button>';
    debugPanel.appendChild(hdr);
    const list=document.createElement('div');
    list.id='dbgList';
    debugPanel.appendChild(list);
    document.body.appendChild(debugPanel);
    document.getElementById('dbgClose').onclick=()=>{debugPanel.remove();debugPanel=null};
  }
  const list=document.getElementById('dbgList');
  if(list){
    const colors={info:'#adf',warn:'#ff9',error:'#f88',ok:'#8f8'};
    const line=document.createElement('div');
    line.style.cssText=`color:${colors[type]||'#adf'};word-break:break-all;margin-bottom:1px`;
    line.textContent=`${ts} ${msg}`;
    list.appendChild(line);
    debugPanel.scrollTop=debugPanel.scrollHeight;
  }
  clearTimeout(debugTimer);
  debugTimer=setTimeout(()=>{debugPanel?.remove();debugPanel=null},30000);
}
function dbgReset(){debugLog=[];const l=document.getElementById('dbgList');if(l)l.innerHTML=''}
/* ──────────────────────────────────────────────────────────────────────── */

function status(show,label='',pct=0,sub=''){let e=$('#aiScanStatus');if(!e){e=document.createElement('div');e.id='aiScanStatus';e.className='scan-status';e.hidden=true;e.innerHTML='<div class="scan-card"><div class="scan-spinner"></div><div class="scan-copy"><strong id="aiScanLabel"></strong><span id="aiScanSub"></span></div><div class="scan-track"><span id="aiScanBar"></span></div></div>';document.body.appendChild(e)}e.hidden=!show;if(show){$('#aiScanLabel').textContent=label;$('#aiScanSub').textContent=sub;$('#aiScanBar').style.width=`${clamp(pct/100)*100}%`}}

function timeout(p,ms,msg){let t;return Promise.race([p,new Promise((_,r)=>t=setTimeout(()=>r(new Error(msg)),ms))]).finally(()=>clearTimeout(t))}

async function loadAI(){
  if(aiLoadPromise&&aiLoadPromise!==true)return aiLoadPromise;
  if(aiLoadPromise===true)return true;
  aiLoadPromise=(async()=>{
    status(true,'Preparing vision…',8,'Starting the local vision engine.');
    dbg('Loading AI modules…');
    const r=await Promise.allSettled([import(BG_URL),import(TF_URL)]);
    const bg=r[0].status==='fulfilled'?r[0].value:null;
    const tf=r[1].status==='fulfilled'?r[1].value:null;
    let bgLoaded=false;
    if(bg){
      removeBackground=bg.removeBackground||bg.default||null;
      segmentForeground=bg.segmentForeground||null;
      bgLoaded=!!(removeBackground||segmentForeground);
      dbg(`BG module OK. removeBg=${typeof removeBackground} segmentFg=${typeof segmentForeground}`,'ok');
    } else {
      dbg('BG module FAILED: '+String(r[0].reason),'error');
    }
    let classifierLoaded=false;
    if(tf){
      try{
        status(true,'Preparing garment recognition…',20,'Loading recognition only once per session.');
        dbg('Loading classifier…');
        classifier=await timeout(tf.pipeline('zero-shot-image-classification',MODEL,perf().classifierOptions()),perf().lowPower?60000:90000,'Classifier timed out');
        classifierLoaded=true;
        dbg('Classifier OK','ok');
      }catch(e){dbg('Classifier FAILED: '+e.message,'warn');classifier=null}
    } else {
      dbg('Transformers module FAILED: '+String(r[1].reason),'error');
    }
    if(!bgLoaded&&!classifierLoaded)throw new Error('Vision modules could not be loaded');
    dbg(`AI ready. bgLoaded=${bgLoaded} classifierLoaded=${classifierLoaded}`,'ok');
    return true;
  })().catch(e=>{aiLoadPromise=null;throw e});
  return aiLoadPromise;
}

window.warmDolapyAI=()=>loadAI().catch(e=>dbg('AI warmup failed: '+e.message,'error'));

function readFile(file){return new Promise((res,rej)=>{const r=new FileReader();r.onerror=()=>rej(new Error('Could not read the image'));r.onload=()=>res(r.result);r.readAsDataURL(file)})}
function imageFromSource(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Could not decode image'));i.src=src})}

async function normalizeImage(input,maxSize){
  const max=maxSize||Math.max(768,perf().imageSize?.()||768);
  let bitmap=null;
  if(typeof createImageBitmap==='function'&&(input instanceof Blob||input instanceof File)){
    try{
      bitmap=await createImageBitmap(input,{imageOrientation:'from-image'});
      dbg(`createImageBitmap OK: ${bitmap.width}x${bitmap.height}`,'ok');
    }catch(ex){
      dbg('createImageBitmap failed: '+ex.message+' — using img fallback','warn');
      bitmap=null;
    }
  }
  if(bitmap){
    const scale=Math.min(1,max/Math.max(bitmap.width||1,bitmap.height||1));
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round((bitmap.width||1)*scale));
    c.height=Math.max(1,Math.round((bitmap.height||1)*scale));
    const x=c.getContext('2d',{alpha:false});
    if(!x){bitmap.close?.();throw new Error('Canvas unavailable')}
    x.drawImage(bitmap,0,0,c.width,c.height);
    bitmap.close?.();
    dbg(`Normalized (bitmap): ${c.width}x${c.height}`);
    return new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('Encoding failed')),'image/jpeg',.9));
  }
  const src=typeof input==='string'?input:await readFile(input);
  const im=await imageFromSource(src);
  const scale=Math.min(1,max/Math.max(im.naturalWidth||1,im.naturalHeight||1));
  const c=document.createElement('canvas');
  c.width=Math.max(1,Math.round((im.naturalWidth||1)*scale));
  c.height=Math.max(1,Math.round((im.naturalHeight||1)*scale));
  const x=c.getContext('2d',{alpha:false});
  if(!x)throw new Error('Canvas unavailable');
  x.drawImage(im,0,0,c.width,c.height);
  dbg(`Normalized (img fallback): ${c.width}x${c.height}`);
  return new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('Encoding failed')),'image/jpeg',.9));
}

async function measureTransparency(blob){
  try{
    const im=await imageFromSource(await readFile(blob));
    const size=Math.min(120,im.naturalWidth||120,im.naturalHeight||120);
    const c=document.createElement('canvas');
    c.width=c.height=size;
    const x=c.getContext('2d',{willReadFrequently:true});
    if(!x)return 0;
    x.drawImage(im,0,0,size,size);
    const d=x.getImageData(0,0,size,size).data;
    let transparent=0;
    for(let i=3;i<d.length;i+=4){if(d[i]<64)transparent++}
    const ratio=transparent/(d.length/4);
    dbg(`Transparency: ${Math.round(ratio*100)}% transparent`,ratio>0.05?'ok':'error');
    return ratio;
  }catch(e){dbg('Transparency check failed: '+e.message,'warn');return 0}
}

async function maskComposite(original,mask){
  const src=await imageFromSource(await readFile(original));
  const msk=await imageFromSource(await readFile(mask));
  const w=src.naturalWidth||src.width,h=src.naturalHeight||src.height;
  const mc=document.createElement('canvas'),oc=document.createElement('canvas');
  mc.width=oc.width=w;mc.height=oc.height=h;
  const mx=mc.getContext('2d',{willReadFrequently:true}),ox=oc.getContext('2d',{alpha:true});
  if(!mx||!ox)throw new Error('Canvas unavailable for compositing');
  mx.drawImage(msk,0,0,w,h);
  ox.drawImage(src,0,0,w,h);
  const md=mx.getImageData(0,0,w,h).data,od=ox.getImageData(0,0,w,h),px=od.data;
  for(let i=0,p=0;i<px.length;i+=4,p+=1){
    const r=md[i],g=md[i+1],b=md[i+2],a=md[i+3];
    const lum=(r+g+b)/3;
    const m=a<245&&a>0?a:lum;
    let alpha=m<26?0:m>238?255:m;
    if(alpha>0&&alpha<145){
      let strong=0;
      const x=p%w,y=Math.floor(p/w);
      for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++){
        if(!xx&&!yy)continue;
        const nx=x+xx,ny=y+yy;
        if(nx<0||ny<0||nx>=w||ny>=h)continue;
        const q=(ny*w+nx)*4,qr=md[q],qg=md[q+1],qb=md[q+2],qa=md[q+3],qm=qa<245&&qa>0?qa:(qr+qg+qb)/3;
        if(qm>205)strong++;
      }
      if(strong===0&&alpha<100)alpha=0;
    }
    px[i+3]=Math.round(alpha);
  }
  dbg('maskComposite done','ok');
  return new Promise((res,rej)=>oc.toBlob(b=>b?res(b):rej(new Error('Cutout encoding failed')),'image/png',1));
}

async function cleanCutout(blob){
  if(!removeBackground&&!segmentForeground)throw new Error('BG removal module not loaded');
  const model=perf().segmentationModel?.()||'isnet_fp16';
  const device=navigator.gpu?'gpu':'cpu';
  dbg(`BG removal: model=${model} device=${device} segFg=${typeof segmentForeground}`);
  let result=null;
  if(segmentForeground){
    dbg('Using segmentForeground path');
    const mask=await timeout(
      segmentForeground(blob,{device,model,output:{format:'image/png',quality:1}}),
      perf().lowPower?90000:60000,'BG mask timed out'
    );
    dbg('Got mask blob, compositing…');
    result=await maskComposite(blob,mask);
  } else {
    dbg('Using removeBackground path');
    result=await timeout(
      removeBackground(blob,{device,model,output:{format:'image/png',quality:1}}),
      perf().lowPower?90000:60000,'BG removal timed out'
    );
  }
  if(!result)throw new Error('BG removal returned empty result');
  const transparency=await measureTransparency(result);
  if(transparency<0.05)throw new Error(`BG removal failed — only ${Math.round(transparency*100)}% transparent`);
  dbg(`BG removal succeeded (${Math.round(transparency*100)}% transparent)`,'ok');
  return result;
}

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

async function classify(blob){if(!classifier)return[];const u=URL.createObjectURL(blob);try{return await timeout(classifier(u,LABELS),perf().lowPower?30000:45000)||[]}finally{URL.revokeObjectURL(u)}}
const filenameMeta=f=>{const text=f?.name?.replace(/\.[^/.]+$/,'').replace(/[-_]+/g,' ').trim()||'';return{text,category:categoryFromText(text),style:styleFromText(text),silhouette:silhouetteFromText(text)}};

async function analyse(file){
  if(!file)throw new Error('No image supplied');
  dbgReset();
  dbg(`Photo received: ${file.name||'unnamed'} ${Math.round((file.size||0)/1024)}KB type=${file.type}`);
  status(true,'Preparing your photo…',22,'Optimizing the camera image.');
  const normalized=await normalizeImage(file);
  const fallback=filenameMeta(file);
  dbg('Normalizing done, loading AI…');
  try{await loadAI()}catch(e){dbg('AI load failed: '+e.message,'error')}

  let cutout=null,bgRemoved=false;
  if(removeBackground||segmentForeground){
    status(true,'Removing background…',38,'Isolating the garment.');
    try{
      cutout=await cleanCutout(normalized);
      bgRemoved=true;
    }catch(e){
      dbg('BG removal failed: '+e.message,'error');
      cutout=null;
    }
  } else {
    dbg('BG modules not available — skipping removal','warn');
  }

  const imageForClassification=cutout||normalized;
  let results=[];
  if(classifier){
    status(true,'Identifying the piece…',62,'Reading garment type and style.');
    try{results=await classify(imageForClassification)}catch(e){
      dbg('Classification failed on cutout: '+e.message,'warn');
      try{results=await classify(normalized)}catch{}
    }
  } else {
    dbg('No classifier — skipping identification','warn');
  }

  const best=results[0]||{label:'',score:0};
  const label=best.label||'';
  const text=`${label} ${fallback.text}`.trim();
  const category=label&&Number(best.score||0)>=.08?categoryFromText(label):fallback.category;
  const style=styleFromText(text);
  const silhouette=silhouetteFromText(text);
  status(true,'Reading color…',80,'Analyzing garment color.');
  const color=await detectColor(imageForClassification);
  const lower=text.toLowerCase();
  const season=/linen|tank|shorts|sandal|summer|tee/.test(lower)?'summer':/wool|coat|puffer|fleece|thermal|winter|knit/.test(lower)?'winter':'all';
  const confidence=clamp(Number(best.score||0));
  const imageData=await readFile(cutout||normalized);
  dbg(`Done. bgRemoved=${bgRemoved} label="${label}" color="${color.name}"`,bgRemoved?'ok':'warn');

  const item={
    id:uid(),
    name:title([color.name||'',style!=='casual'?style:'',title(label||(category==='tops'?'T-Shirt':category==='bottoms'?'Bottoms':category))].filter(Boolean).join(' ')),
    image:imageData,category,color:color.name||'neutral',colorFamily:color.family,style,season,
    occasion:style==='smart'?'smart':style==='athletic'?'sport':'everyday',silhouette,
    pattern:/stripe/.test(lower)?'stripe':/check|plaid/.test(lower)?'check':/graphic|print/.test(lower)?'graphic':'solid',
    warmth:category==='outerwear'?4:category==='shoes'?2:season==='summer'?1:season==='winter'?4:3,
    formality:style==='smart'?4:style==='preppy'?3:style==='athletic'?1:2,
    wearCount:0,favorite:false,aiIdentified:Boolean(label),backgroundRemoved:bgRemoved,
    visualConfidence:confidence,recognitionMargin:results[1]?clamp(confidence-Number(results[1].score||0)):confidence,
    aiAlternatives:results.slice(0,4).map(x=>({label:x.label,score:Number(x.score||0)})),
    metadataConfidence:clamp(confidence*.65+(color.name?.25:.08)+.1),createdAt:Date.now()
  };
  if(!bgRemoved)item._bgWarning='Background could not be removed. See orange debug panel for details.';
  return item;
}

function openResult(item){
  current=item;
  const p=$('#previewImg');if(p)p.src=item.image;
  $('#fName').value=item.name;$('#fCategory').value=item.category;$('#fColor').value=item.color;$('#fStyle').value=item.style;
  let info='';
  if(item._bgWarning){info=item._bgWarning;}
  else if(queue.length){info=`${queue.length} more piece${queue.length===1?'':'s'} to review`;}
  else{info=`AI confidence ${Math.round((item.metadataConfidence||0)*100)}%`+(item.backgroundRemoved?' · Background removed':'');}
  $('#queueInfo').textContent=info;
  $('#modal').hidden=false;
}

function closeResult(){current=null;queue=[];$('#modal').hidden=true;status(false)}
function next(){if(queue.length)openResult(queue.shift());else closeResult()}
function save(){
  if(!current)return;
  current.name=String($('#fName').value||'').trim()||current.name;
  current.category=$('#fCategory').value;
  current.color=String($('#fColor').value||'').trim()||current.color;
  current.style=$('#fStyle').value;
  current.formality=current.style==='smart'?4:current.style==='preppy'?3:current.style==='athletic'?1:2;
  let items=[];try{items=JSON.parse(localStorage.getItem(STORE)||'[]')}catch{}
  if(!Array.isArray(items))items=[];
  items.unshift(current);
  try{localStorage.setItem(STORE,JSON.stringify(items))}catch{alert('Storage full. Remove an older piece first.');return}
  current=null;
  if(queue.length)next();else{status(false);$('#modal').hidden=true;window.renderAll?.();window.DolapyIntelligence?.refresh?.();window.DolapyContext?.render?.();window.DolapyEngineV3?.generate?.()}
}

async function startAIUpload(files){
  const list=[...(files||[])].filter(f=>f?.type?.startsWith('image/'));
  if(!list.length)return;
  queue=[];current=null;
  try{
    for(let i=0;i<list.length;i++){
      status(true,`Processing piece ${i+1} of ${list.length}…`,5,'Your original photo stays local.');
      try{queue.push(await analyse(list[i]));}
      catch(e){
        dbg('Item failed: '+e.message,'error');
        try{
          const n=await normalizeImage(list[i]),m=filenameMeta(list[i]);
          queue.push({id:uid(),name:title(m.text||'Untitled item'),image:await readFile(n),category:m.category,color:'neutral',colorFamily:'neutral',style:m.style,season:'all',occasion:'everyday',silhouette:m.silhouette,pattern:'solid',warmth:3,formality:2,wearCount:0,favorite:false,aiIdentified:false,backgroundRemoved:false,visualConfidence:0,recognitionMargin:0,aiAlternatives:[],metadataConfidence:.1,createdAt:Date.now(),_bgWarning:'Analysis failed. Original saved. Check debug panel.'});
        }catch(fe){dbg('Fallback failed: '+fe.message,'error')}
      }
    }
    status(false);
    if(queue.length)openResult(queue.shift());
    else throw new Error('No usable images produced');
  }catch(e){
    dbg('Upload failed: '+e.message,'error');
    status(false);
    alert('Dolapy could not process that photo. Check the orange debug panel for details.');
    closeResult();
  }
}

function wire(){
  $('#closeModal')?.addEventListener('click',closeResult);
  $('#saveItem')?.addEventListener('click',save);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modal')?.hidden)closeResult()});
}

window.startCamera=()=>{};
window.stopCamera=()=>{cameraStream?.getTracks?.().forEach(t=>t.stop());cameraStream=null;const v=$('#cameraVideo');if(v)v.srcObject=null};
window.startAIUpload=startAIUpload;
window.DolapyVision={analyse,startAIUpload,warm:()=>window.warmDolapyAI?.()};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
})();

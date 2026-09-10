/* Dolapy contextual ranking layer — deterministic and API-free. */
(() => {
  'use strict';
  const STORE_KEY = 'dolapy.pages.v3';
  const CONTEXT_KEY = 'dolapy.context.v1';
  const $ = (s) => document.querySelector(s);
  const load = () => { try { const v = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const getContext = () => {
    try { return { occasion: 'everyday', season: 'auto', time: 'auto', ...JSON.parse(localStorage.getItem(CONTEXT_KEY) || '{}') }; }
    catch { return { occasion:'everyday', season:'auto', time:'auto' }; }
  };
  const saveContext = (patch) => { const next={...getContext(),...patch}; try{localStorage.setItem(CONTEXT_KEY,JSON.stringify(next));}catch{} return next; };
  const seasonNow = () => { const m=new Date().getMonth()+1; return m<=2||m===12?'winter':m<=5?'spring':m<=8?'summer':'autumn'; };
  const timeNow = () => { const h=new Date().getHours(); return h<11?'morning':h<17?'day':h<21?'evening':'night'; };
  const styleOf = (x) => String(`${x?.style||''} ${x?.name||''}`).toLowerCase();
  const contextScore = (item, ctx) => {
    const season=ctx.season==='auto'?seasonNow():ctx.season;
    const time=ctx.time==='auto'?timeNow():ctx.time;
    const text=styleOf(item);
    let score=50;
    if(ctx.occasion==='sport' && /sport|athletic|gym|running|trainer/.test(text)) score+=25;
    if(ctx.occasion==='smart' && /smart|formal|tailored|blazer|office|dress|loafer/.test(text)) score+=25;
    if(ctx.occasion==='date' && /smart|minimal|preppy|clean|tailored|dress/.test(text)) score+=16;
    if(ctx.occasion==='travel' && /casual|utility|street|oversized|cargo|comfortable/.test(text)) score+=16;
    if(season==='summer' && /linen|short|tank|sandal|tee|light/.test(text)) score+=18;
    if(season==='winter' && /coat|puffer|wool|fleece|knit|hoodie|jacket/.test(text)) score+=22;
    if((time==='evening'||time==='night') && /smart|date|dark|minimal/.test(text)) score+=8;
    if((time==='morning'||time==='day') && /casual|sport|athletic/.test(text)) score+=5;
    return Math.max(0,Math.min(100,score));
  };
  function render(){
    const host=$('#wardrobeIntel'); if(!host||!load().length)return;
    if($('#contextEngineCard')) return;
    const ctx=getContext(), season=ctx.season==='auto'?seasonNow():ctx.season, time=ctx.time==='auto'?timeNow():ctx.time;
    const items=load().map(item=>({...item,_context:contextScore(item,ctx)})).sort((a,b)=>b._context-a._context);
    const best=items[0];
    const card=document.createElement('div'); card.id='contextEngineCard'; card.className='context-engine-card';
    card.innerHTML=`<div><div class="eyebrow green">Context engine</div><h4>Style for <em>right now.</em></h4><p>${best?`Your strongest context match is <strong>${escapeHtml(best.name||'a wardrobe piece')}</strong> at ${best._context}/100.`:'Add pieces to activate contextual ranking.'}</p></div><div class="context-controls"><label>Occasion<select data-context="occasion"><option value="everyday">Everyday</option><option value="smart">Smart</option><option value="date">Date</option><option value="travel">Travel</option><option value="sport">Sport</option></select></label><label>Season<select data-context="season"><option value="auto">Auto</option><option value="spring">Spring</option><option value="summer">Summer</option><option value="autumn">Autumn</option><option value="winter">Winter</option></select></label><label>Time<select data-context="time"><option value="auto">Auto</option><option value="morning">Morning</option><option value="day">Day</option><option value="evening">Evening</option><option value="night">Night</option></select></label></div>`;
    host.appendChild(card);
    card.querySelectorAll('[data-context]').forEach(select=>{select.value=ctx[select.dataset.context]||'auto';select.addEventListener('change',()=>{saveContext({[select.dataset.context]:select.value});card.remove();render();});});
  }
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  window.DolapyContext={get:getContext,save:saveContext,score:contextScore,render};
  const boot=()=>{setTimeout(render,700);setTimeout(render,1800);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

(() => {
  'use strict';
  const KEY='dolapy.pages.v3';
  const $=s=>document.querySelector(s);
  let index=0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}};
  const slot=(item,role)=>item?`<div class="fit-piece fit-${role}"><div class="fit-image"><img src="${esc(item.image||'')}" alt="${esc(item.name||role)}" loading="eager" decoding="async"></div><div class="fit-label"><span>${esc(role)}</span><strong>${esc(item.name||'Wardrobe piece')}</strong></div></div>`:'';
  function decorate(){
    const host=$('#engineBody'); if(!host||!window.DolapyEngineV3?.generate)return;
    const all=window.DolapyEngineV3.generate(window.DolapyEngineV3.context?.()||{}); if(!all?.length){index=0;return}
    index=Math.min(index,all.length-1); const chosen=all[index]; if(!chosen?.set)return;
    const set=chosen.set; const layer=set.find(i=>i.category==='outerwear'),top=set.find(i=>i.category==='tops'),bottom=set.find(i=>i.category==='bottoms'),dress=set.find(i=>i.category==='dresses'),shoe=set.find(i=>i.category==='shoes'),accessories=set.filter(i=>i.category==='accessories');
    let board=host.querySelector('.engine-v3-look'); if(!board)return;
    board.className='engine-v3-look fit-board';
    board.innerHTML=`<div class="fit-board-head"><div><span>THE LOOK</span><strong>${chosen.score}% match</strong></div><div><span>${dress?'Dress look':'Complete outfit'}</span><small>${layer?'Layer included':''}</small></div></div><div class="fit-stage">${layer?slot(layer,'layer'):''}${dress?slot(dress,'dress'):slot(top,'top')}${bottom?slot(bottom,'bottom'):''}${shoe?slot(shoe,'shoes'):''}${accessories.length?`<div class="fit-accessories"><span>Finish with</span>${accessories.map(a=>slot(a,'detail')).join('')}</div>`:''}</div><div class="fit-steps">${layer?'<span>01 Layer</span>':''}${dress?'<span>01 Dress</span>':'<span>01 Top</span>'}${bottom?'<span>02 Bottom</span>':''}${shoe?'<span>${bottom?'03':'02'} Shoes</span>':''}</div>`;
  }
  function schedule(){window.setTimeout(decorate,40);window.setTimeout(decorate,250);}
  function wire(){
    document.addEventListener('click',e=>{if(e.target.closest('[data-engine-next]')){index++;window.setTimeout(decorate,80)}else if(e.target.closest('[data-engine-occasion]')){index=0;window.setTimeout(decorate,100)}});
    window.addEventListener('storage',e=>{if(e.key===KEY)index=0;schedule()});
    const observer=new MutationObserver(()=>schedule()); const body=$('#engineBody'); if(body)observer.observe(body,{childList:true,subtree:true});
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
})();
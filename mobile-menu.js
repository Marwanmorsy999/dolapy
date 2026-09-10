(() => {
  'use strict';

  const CSS = `
    .mobile-menu{width:42px;height:42px;border:0;border-radius:12px;background:transparent;color:#fff;display:grid;place-items:center;cursor:pointer;padding:9px}
    .mobile-menu:hover{background:#222834}
    .mobile-menu svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .mobile-drawer-wrap{position:fixed;inset:0;z-index:80}
    .mobile-drawer-wrap[hidden]{display:none!important}
    .mobile-drawer-backdrop{position:absolute;inset:0;background:#0f131899;backdrop-filter:blur(3px)}
    .mobile-drawer{position:absolute;left:0;top:0;bottom:0;width:min(310px,84vw);background:#171b23;color:#fff;padding:22px 18px;display:flex;flex-direction:column;box-shadow:20px 0 60px #0004;transform:translateX(-100%);animation:dolapyDrawerIn .22s ease-out forwards}
    .mobile-drawer-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .mobile-drawer-head .icon-button{color:#fff;background:#222834;width:40px;height:40px}
    .mobile-drawer-note{margin-top:48px;color:#aeb7c1;line-height:1.55;font-size:14px}
    .mobile-drawer-note em{color:#fff;font-style:normal}
    .mobile-drawer-nav{margin-top:28px;display:grid;gap:7px}
    .mobile-drawer-nav button{display:flex;align-items:center;gap:12px;width:100%;min-height:50px;padding:11px 13px;border:0;border-radius:12px;background:transparent;color:#adb6c0;text-align:left;font-weight:750;cursor:pointer}
    .mobile-drawer-nav button:hover,.mobile-drawer-nav button:focus-visible{background:#222834;color:#fff;outline:none}
    .drawer-nav-icon{width:23px;height:23px;display:grid;place-items:center}
    .drawer-nav-icon svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .mobile-drawer-foot{margin-top:auto;color:#7f8a96;font-size:11px;display:flex;align-items:center;gap:7px;padding:8px 2px}
    .status-dot{width:7px;height:7px;border-radius:50%;background:#c8f536;display:inline-block;box-shadow:0 0 0 4px #c8f53618}
    body.drawer-open{overflow:hidden}
    @keyframes dolapyDrawerIn{to{transform:translateX(0)}}
    @media(min-width:981px){.mobile-menu{display:none}.mobile-drawer-wrap{display:none!important}}
  `;

  function initMobileMenu(){
    const trigger=document.querySelector('.mobile-menu');
    if(!trigger||document.getElementById('mobileDrawer'))return;
    const style=document.createElement('style');style.id='mobile-menu-style';style.textContent=CSS;document.head.appendChild(style);
    const drawer=document.createElement('div');drawer.id='mobileDrawer';drawer.className='mobile-drawer-wrap';drawer.hidden=true;
    drawer.innerHTML=`<div class="mobile-drawer-backdrop" data-close-drawer></div><aside class="mobile-drawer" aria-label="Navigation"><div class="mobile-drawer-head"><div class="brand"><span class="logo-mark">D</span><span>Dolapy</span><b>.</b></div><button class="icon-button" type="button" data-close-drawer aria-label="Close menu">×</button></div><div class="mobile-drawer-note">your wardrobe,<br><em>sorted.</em></div><nav class="mobile-drawer-nav"><button type="button" data-mobile-nav="style"><span class="drawer-nav-icon"><svg><use href="#i-spark"></use></svg></span><span>Style me</span></button><button type="button" data-mobile-nav="wardrobe"><span class="drawer-nav-icon"><svg><use href="#i-closet"></use></svg></span><span>My wardrobe</span></button></nav><div class="mobile-drawer-foot"><span class="status-dot"></span> AI vision · local outfit engine</div></aside>`;
    document.body.appendChild(drawer);

    const setOpen=open=>{drawer.hidden=!open;document.body.classList.toggle('drawer-open',open);trigger.setAttribute('aria-expanded',String(open));if(open)drawer.querySelector('[data-mobile-nav]')?.focus();else trigger.focus();};
    trigger.setAttribute('role','button');trigger.setAttribute('tabindex','0');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','mobileDrawer');
    trigger.addEventListener('click',()=>setOpen(true));
    trigger.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setOpen(true);}});
    drawer.addEventListener('click',e=>{
      if(e.target.closest('[data-close-drawer]')){setOpen(false);return;}
      const nav=e.target.closest('[data-mobile-nav]');if(!nav)return;
      if(nav.dataset.mobileNav==='style')window.showStyle?.();
      if(nav.dataset.mobileNav==='wardrobe')window.showWardrobe?.();
      setOpen(false);
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!drawer.hidden)setOpen(false);});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initMobileMenu,{once:true});else initMobileMenu();
})();

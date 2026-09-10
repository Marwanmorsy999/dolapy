(() => {
  'use strict';

  const KEY = 'dolapy.settings.v1';
  const defaults = { defaultOccasion:'everyday', reduceMotion:false, autoName:true, showAIStatus:true, confirmBeforeDelete:true };
  const load = () => { try { return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY) || '{}') || {}) }; } catch { return { ...defaults }; } };
  let settings = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(settings));
  const $ = (s) => document.querySelector(s);

  function open() {
    let wrap = $('#settingsPanel');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'settingsPanel';
      wrap.className = 'settings-wrap';
      wrap.hidden = true;
      wrap.innerHTML = `
        <div class="settings-backdrop" data-close-settings></div>
        <aside class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
          <div class="settings-head"><div><div class="eyebrow green">Preferences</div><h2 id="settingsTitle">Settings.</h2></div><button class="icon-button" type="button" data-close-settings aria-label="Close settings">×</button></div>
          <p class="settings-intro">Make Dolapy fit the way you dress. Preferences stay on this device for now.</p>
          <section class="settings-section install-section">
            <div class="settings-label"><strong>Dolapy on your phone</strong><span>Keep Dolapy one tap away with an app-like home-screen shortcut.</span></div>
            <button type="button" class="install-app" id="installDolapy"><span class="install-icon"><svg><use href="#i-download"></use></svg></span><span><b id="installTitle">Install Dolapy</b><small id="installHint">Add Dolapy to your home screen.</small></span><span class="install-arrow">›</span></button>
          </section>
          <section class="settings-section"><div class="settings-label"><strong>Styling</strong><span>How Dolapy should start each edit.</span></div><label class="settings-row"><span><b>Default occasion</b><small>Used when you start a new styling session.</small></span><select id="settingsOccasion"><option value="everyday">Everyday</option><option value="smart">Smart</option><option value="date">Date</option><option value="travel">Travel</option><option value="sport">Sport</option></select></label></section>
          <section class="settings-section"><div class="settings-label"><strong>AI & privacy</strong><span>Control how the browser experience behaves.</span></div><label class="settings-row"><span><b>Auto-name pieces</b><small>Suggest a clean name after recognition.</small></span><input id="settingsAutoName" class="toggle" type="checkbox"></label><label class="settings-row"><span><b>Show AI processing</b><small>Display recognition and cleanup progress.</small></span><input id="settingsAIStatus" class="toggle" type="checkbox"></label></section>
          <section class="settings-section"><div class="settings-label"><strong>Experience</strong><span>Small controls for a smoother interface.</span></div><label class="settings-row"><span><b>Reduce motion</b><small>Minimize animations and transitions.</small></span><input id="settingsMotion" class="toggle" type="checkbox"></label><label class="settings-row"><span><b>Confirm before deleting</b><small>Ask before removing a wardrobe piece.</small></span><input id="settingsDelete" class="toggle" type="checkbox"></label></section>
          <div class="settings-foot"><span>Dolapy</span><button type="button" class="secondary" id="settingsReset">Reset preferences</button></div>
        </aside>`;
      document.body.appendChild(wrap);
      wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close-settings]')) close(); });
      $('#settingsOccasion').addEventListener('change', apply); $('#settingsAutoName').addEventListener('change', apply); $('#settingsAIStatus').addEventListener('change', apply); $('#settingsMotion').addEventListener('change', apply); $('#settingsDelete').addEventListener('change', apply); $('#settingsReset').addEventListener('click', () => { settings = { ...defaults }; save(); sync(); applyEffects(); }); $('#installDolapy').addEventListener('click', installApp);
    }
    sync(); syncInstall(); wrap.hidden = false; document.body.classList.add('settings-open'); $('#settingsOccasion')?.focus();
  }

  function close() { const wrap=$('#settingsPanel'); if(!wrap)return; wrap.hidden=true; document.body.classList.remove('settings-open'); $('.mobile-settings, .side-settings')?.focus(); }
  function sync() { $('#settingsOccasion').value=settings.defaultOccasion; $('#settingsAutoName').checked=settings.autoName; $('#settingsAIStatus').checked=settings.showAIStatus; $('#settingsMotion').checked=settings.reduceMotion; $('#settingsDelete').checked=settings.confirmBeforeDelete; }
  function syncInstall() {
    const b=$('#installDolapy'),t=$('#installTitle'),h=$('#installHint'); if(!b||!t||!h)return;
    const installed=window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone;
    if(installed){t.textContent='Dolapy is installed';h.textContent='You are using the app from your home screen.';b.disabled=true;return;}
    const available=window.DolapyPWA?.canInstall?.();
    b.disabled=false;
    t.textContent=available?'Install Dolapy':'Add Dolapy to your phone';
    h.textContent=available?'Install Dolapy like an app from this screen.':'Use your browser menu and choose “Add to Home Screen” or “Install app”.';
  }
  async function installApp(){
    const installed=await window.DolapyPWA?.install?.();
    if(installed){syncInstall();return;}
    syncInstall();
    const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    const message=isIOS?'On iPhone/iPad: open Safari’s Share menu, then choose “Add to Home Screen”.':'Open your browser menu and choose “Install app” or “Add to Home screen”.';
    alert(message);
  }
  function apply(){ settings.defaultOccasion=$('#settingsOccasion').value; settings.autoName=$('#settingsAutoName').checked; settings.showAIStatus=$('#settingsAIStatus').checked; settings.reduceMotion=$('#settingsMotion').checked; settings.confirmBeforeDelete=$('#settingsDelete').checked; save(); applyEffects(); }
  function applyEffects(){ document.documentElement.classList.toggle('reduce-motion',settings.reduceMotion); document.documentElement.dataset.defaultOccasion=settings.defaultOccasion; document.dispatchEvent(new CustomEvent('dolapy:settings-changed',{detail:{...settings}})); }
  function init(){ applyEffects(); $('.mobile-settings')?.addEventListener('click',open); $('.side-settings')?.addEventListener('click',open); document.addEventListener('dolapy:install-state',syncInstall); document.addEventListener('keydown',(e)=>{if(e.key==='Escape'&&$('#settingsPanel')&&!$('#settingsPanel').hidden)close();}); }
  window.DolapySettings={open,close,get:()=>({...settings})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

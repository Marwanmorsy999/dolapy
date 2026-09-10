(() => {
  'use strict';

  const KEY = 'dolapy.settings.v1';
  const defaults = {
    defaultOccasion: 'everyday',
    reduceMotion: false,
    autoName: true,
    showAIStatus: true,
    confirmBeforeDelete: true
  };

  const load = () => {
    try { return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY) || '{}') || {}) }; }
    catch { return { ...defaults }; }
  };
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
          <div class="settings-head">
            <div><div class="eyebrow green">Preferences</div><h2 id="settingsTitle">Settings.</h2></div>
            <button class="icon-button" type="button" data-close-settings aria-label="Close settings">×</button>
          </div>
          <p class="settings-intro">Make Dolapy fit the way you dress. Your preferences are stored locally in this browser.</p>
          <section class="settings-section">
            <div class="settings-label"><strong>Styling</strong><span>How Dolapy should start each edit.</span></div>
            <label class="settings-row"><span><b>Default occasion</b><small>Used when you start a new styling session.</small></span><select id="settingsOccasion"><option value="everyday">Everyday</option><option value="smart">Smart</option><option value="date">Date</option><option value="travel">Travel</option><option value="sport">Sport</option></select></label>
          </section>
          <section class="settings-section">
            <div class="settings-label"><strong>AI & privacy</strong><span>Control how the browser experience behaves.</span></div>
            <label class="settings-row"><span><b>Auto-name pieces</b><small>Suggest a clean name after recognition.</small></span><input id="settingsAutoName" class="toggle" type="checkbox"></label>
            <label class="settings-row"><span><b>Show AI processing</b><small>Display recognition and cleanup progress.</small></span><input id="settingsAIStatus" class="toggle" type="checkbox"></label>
          </section>
          <section class="settings-section">
            <div class="settings-label"><strong>Experience</strong><span>Small controls for a smoother interface.</span></div>
            <label class="settings-row"><span><b>Reduce motion</b><small>Minimize animations and transitions.</small></span><input id="settingsMotion" class="toggle" type="checkbox"></label>
            <label class="settings-row"><span><b>Confirm before deleting</b><small>Ask before removing a wardrobe piece.</small></span><input id="settingsDelete" class="toggle" type="checkbox"></label>
          </section>
          <div class="settings-foot"><span>Dolapy</span><button type="button" class="secondary" id="settingsReset">Reset preferences</button></div>
        </aside>`;
      document.body.appendChild(wrap);
      wrap.addEventListener('click', (e) => {
        if (e.target.closest('[data-close-settings]')) close();
      });
      $('#settingsOccasion').addEventListener('change', apply);
      $('#settingsAutoName').addEventListener('change', apply);
      $('#settingsAIStatus').addEventListener('change', apply);
      $('#settingsMotion').addEventListener('change', apply);
      $('#settingsDelete').addEventListener('change', apply);
      $('#settingsReset').addEventListener('click', () => { settings = { ...defaults }; save(); sync(); applyEffects(); });
    }
    sync();
    wrap.hidden = false;
    document.body.classList.add('settings-open');
    $('#settingsOccasion')?.focus();
  }

  function close() {
    const wrap = $('#settingsPanel');
    if (!wrap) return;
    wrap.hidden = true;
    document.body.classList.remove('settings-open');
    $('.mobile-settings, .side-settings')?.focus();
  }

  function sync() {
    $('#settingsOccasion').value = settings.defaultOccasion;
    $('#settingsAutoName').checked = settings.autoName;
    $('#settingsAIStatus').checked = settings.showAIStatus;
    $('#settingsMotion').checked = settings.reduceMotion;
    $('#settingsDelete').checked = settings.confirmBeforeDelete;
  }

  function apply() {
    settings.defaultOccasion = $('#settingsOccasion').value;
    settings.autoName = $('#settingsAutoName').checked;
    settings.showAIStatus = $('#settingsAIStatus').checked;
    settings.reduceMotion = $('#settingsMotion').checked;
    settings.confirmBeforeDelete = $('#settingsDelete').checked;
    save();
    applyEffects();
  }

  function applyEffects() {
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
    document.documentElement.dataset.defaultOccasion = settings.defaultOccasion;
    document.dispatchEvent(new CustomEvent('dolapy:settings-changed', { detail: { ...settings } }));
  }

  function init() {
    applyEffects();
    $('.mobile-settings')?.addEventListener('click', open);
    $('.side-settings')?.addEventListener('click', open);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#settingsPanel') && !$('#settingsPanel').hidden) close(); });
  }

  window.DolapySettings = { open, close, get: () => ({ ...settings }) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();

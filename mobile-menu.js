(() => {
  'use strict';

  function initMobileMenu() {
    const trigger = document.querySelector('.mobile-menu');
    const main = document.querySelector('.main');
    if (!trigger || !main || document.getElementById('mobileDrawer')) return;

    const drawer = document.createElement('div');
    drawer.id = 'mobileDrawer';
    drawer.className = 'mobile-drawer-wrap';
    drawer.hidden = true;
    drawer.innerHTML = `
      <div class="mobile-drawer-backdrop" data-close-drawer></div>
      <aside class="mobile-drawer" aria-label="Mobile navigation">
        <div class="mobile-drawer-head">
          <div class="brand"><span class="logo-mark">D</span><span>Dolapy</span><b>.</b></div>
          <button class="icon-button" type="button" data-close-drawer aria-label="Close menu">×</button>
        </div>
        <div class="mobile-drawer-note">your wardrobe,<br><em>sorted.</em></div>
        <nav class="mobile-drawer-nav">
          <button type="button" data-mobile-nav="style"><span class="drawer-nav-icon"><svg><use href="#i-spark"></use></svg></span><span>Style me</span></button>
          <button type="button" data-mobile-nav="wardrobe"><span class="drawer-nav-icon"><svg><use href="#i-closet"></use></svg></span><span>My wardrobe</span></button>
        </nav>
        <div class="mobile-drawer-foot"><span class="status-dot"></span> AI vision · local outfit engine</div>
      </aside>`;

    document.body.appendChild(drawer);

    const setOpen = (open) => {
      drawer.hidden = !open;
      document.body.classList.toggle('drawer-open', open);
      trigger.setAttribute('aria-expanded', String(open));
      if (open) drawer.querySelector('[data-mobile-nav]')?.focus();
    };

    trigger.setAttribute('role', 'button');
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('aria-label', 'Open navigation menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', () => setOpen(true));
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
      }
    });

    drawer.addEventListener('click', (event) => {
      if (event.target.closest('[data-close-drawer]')) {
        setOpen(false);
        return;
      }
      const nav = event.target.closest('[data-mobile-nav]');
      if (!nav) return;
      if (nav.dataset.mobileNav === 'style') window.showStyle?.();
      if (nav.dataset.mobileNav === 'wardrobe') window.showWardrobe?.();
      setOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !drawer.hidden) setOpen(false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenu, { once: true });
  } else {
    initMobileMenu();
  }
})();

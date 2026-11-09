/** Native anchor scrolling and a single mobile-menu state. */
(function () {
  const toggle = document.getElementById('mobileNavToggle');
  const menu = document.getElementById('navbarNavGroup');
  const desktop = window.matchMedia?.('(min-width: 1081px)');
  const compact = window.matchMedia?.('(max-width: 1080px)');
  if (!toggle || !menu) return;

  function setOpen(open) {
    menu.classList.toggle('mobile-open', open);
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'ปิดเมนูนำทาง' : 'เปิดเมนูนำทาง');
    window.TD_Auth?.syncNavigation();
  }
  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('mobile-open')));
  menu.addEventListener('click', event => {
    if (event.target.closest('a, #navAccountDetailsBtn, #navAccountLogoutBtn') || document.getElementById('authModal')?.classList.contains('active')) setOpen(false);
  });
  document.addEventListener('click', event => {
    if (menu.classList.contains('mobile-open') && !menu.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.defaultPrevented && menu.classList.contains('mobile-open') && (compact?.matches || document.getElementById('navAccountPanel')?.hidden !== false)) {
      event.preventDefault();
      setOpen(false);
      toggle.focus();
    }
  });
  desktop?.addEventListener?.('change', event => { if (event.matches) setOpen(false); });
})();

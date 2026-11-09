/** Pause decorative work outside the viewport or in background tabs. */
(function () {
  function syncVisibility() {
    document.body.classList.toggle('page-hidden', document.hidden);
  }
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();

  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.classList.toggle('animation-paused', !entry.isIntersecting);
  }, { rootMargin: '100px' });
  document.querySelectorAll('[data-animate-visible]').forEach(element => {
    element.classList.add('animation-paused');
    observer.observe(element);
  });
})();

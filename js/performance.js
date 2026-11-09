/** Phone and data-saving defaults, shared by media and background work. */
(function () {
  const smallViewport = window.matchMedia?.('(max-width: 900px)');
  const coarsePointer = window.matchMedia?.('(pointer: coarse)');
  const connection = window.navigator.connection;
  const listeners = new Set();
  let lightweight = false;
  let dialogOpen = false;

  function notify() {
    for (const listener of listeners) listener();
  }
  function syncDevice() {
    const next = Boolean(smallViewport?.matches || coarsePointer?.matches || connection?.saveData ||
      ['slow-2g', '2g'].includes(connection?.effectiveType));
    document.body.classList.toggle('performance-light', next);
    if (next === lightweight) return;
    lightweight = next;
    notify();
  }

  window.TD_Performance = {
    isLightweight: () => lightweight,
    isDialogOpen: () => dialogOpen,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setDialogOpen(open) {
      const next = Boolean(open);
      if (next === dialogOpen) return;
      dialogOpen = next;
      document.body.classList.toggle('page-dialog-open', next);
      notify();
    }
  };
  smallViewport?.addEventListener?.('change', syncDevice);
  coarsePointer?.addEventListener?.('change', syncDevice);
  connection?.addEventListener?.('change', syncDevice);
  syncDevice();
})();

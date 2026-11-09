/** Shared focus and page-scroll handling for the public dialogs, including iOS. */
(function () {
  const opened = new Map();
  let savedBody = null;
  let scrollY = 0;

  function focus(element) {
    element?.focus({ preventScroll: true });
  }

  function open(dialog, initialFocus = dialog) {
    if (!opened.has(dialog)) {
      if (!opened.size) {
        scrollY = window.scrollY || window.pageYOffset || 0;
        savedBody = {};
        for (const key of ['position', 'top', 'left', 'right', 'width', 'overflow']) {
          savedBody[key] = document.body.style[key] || '';
        }
        Object.assign(document.body.style, {
          position: 'fixed', top: `-${scrollY}px`, left: '0', right: '0', width: '100%', overflow: 'hidden'
        });
      }
      opened.set(dialog, document.activeElement);
    }
    dialog.classList.add('active');
    dialog.inert = false;
    window.TD_Performance.setDialogOpen(true);
    dialog.setAttribute('aria-hidden', 'false');
    dialog.setAttribute('tabindex', '-1');
    dialog.scrollTop = 0;
    focus(initialFocus);
  }

  function close(dialog) {
    if (!opened.has(dialog)) return;
    const trigger = opened.get(dialog);
    opened.delete(dialog);
    dialog.classList.remove('active');
    dialog.inert = true;
    dialog.setAttribute('aria-hidden', 'true');
    window.TD_Performance.setDialogOpen(opened.size > 0);
    if (!opened.size) {
      Object.assign(document.body.style, savedBody);
      window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' });
      const toggle = document.getElementById('mobileNavToggle');
      // A menu action may have hidden its own trigger while the dialog was open.
      focus(trigger?.getClientRects?.().length === 0 ? (toggle?.getClientRects?.().length ? toggle : null) : trigger);
    } else {
      focus([...opened.keys()].at(-1));
    }
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !opened.size || event.defaultPrevented) return;
    const dialog = [...opened.keys()].at(-1);
    const controls = [...dialog.querySelectorAll('a[href], button, summary, input, select, textarea, iframe, [tabindex]')].filter(element => {
      if (element.disabled || element.getAttribute('tabindex') === '-1' || element.getAttribute('type') === 'hidden') return false;
      for (let node = element; node && node !== dialog; node = node.parentElement) {
        if (node.hidden || node.inert || node.style.display === 'none') return false;
      }
      return element.getClientRects?.().length !== 0;
    });
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); focus(dialog); }
    else if (!dialog.contains(document.activeElement) || document.activeElement === dialog) {
      event.preventDefault(); focus(event.shiftKey ? last : first);
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); focus(last);
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); focus(first);
    }
  });

  window.TD_Dialog = { open, close, isTop: dialog => [...opened.keys()].at(-1) === dialog };
})();

/**
 * TRIAMDOD 10 — Split-Flap Departure Board Countdown Engine
 * Airport Departure Board Mechanical Flipping & Countdown to 8 มกราคม 2570
 */

(function() {
  const TARGET_DATE = new Date('2027-01-08T13:00:00+07:00');
  let countdownTimer = null;
  let isVisible = !('IntersectionObserver' in window);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const backgroundCovered = () => window.TD_Performance.isDialogOpen();

  const flapUnits = Object.fromEntries(['months', 'days', 'hours', 'minutes', 'seconds'].map(name => {
    const suffix = name[0].toUpperCase() + name.slice(1);
    const element = prefix => document.getElementById(prefix + suffix);
    return [name, {
      card: element('card'), top: document.getElementById('cd' + suffix + 'Top'),
      bottom: document.getElementById('cd' + suffix + 'Bottom'),
      leafFront: document.getElementById('leaf' + suffix + 'Front'),
      leafBack: document.getElementById('leaf' + suffix + 'Back'), currentVal: '', timer: null
    }];
  }));

  function updateFlapUnit(unit, newVal, shouldPlaySound = true) {
    if (!unit.card || unit.currentVal === newVal) return;
    clearTimeout(unit.timer);
    unit.timer = null;

    if (unit.currentVal === '' || reducedMotion?.matches) {
      // First initialization without animation
      unit.currentVal = newVal;
      if (unit.top) unit.top.textContent = newVal;
      if (unit.bottom) unit.bottom.textContent = newVal;
      if (unit.leafFront) unit.leafFront.textContent = newVal;
      if (unit.leafBack) unit.leafBack.textContent = newVal;
      unit.card.classList.remove('flipping');
      return;
    }

    if (unit.currentVal !== newVal) {
      const oldVal = unit.currentVal;
      unit.currentVal = newVal;

      // Prepare flip leaf
      if (unit.leafFront) unit.leafFront.textContent = oldVal;
      if (unit.leafBack) unit.leafBack.textContent = newVal;
      if (unit.bottom) unit.bottom.textContent = newVal;

      // Animate flip forward
      unit.card.classList.add('flipping');
      if (shouldPlaySound && window.TD_Audio && window.TD_Audio.playSplitFlapSound) {
        window.TD_Audio.playSplitFlapSound();
      }

      unit.timer = setTimeout(() => {
        // Apply final values
        if (unit.top) unit.top.textContent = newVal;
        if (unit.leafFront) unit.leafFront.textContent = newVal;
        unit.card.classList.remove('flipping');
        unit.timer = null;
      }, 280);
    }
  }

  function updateCountdown() {
    if (document.hidden || !isVisible || backgroundCovered()) return;
    const now = new Date();
    const diffMs = TARGET_DATE.getTime() - now.getTime();

    if (diffMs <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      ['months', 'days', 'hours', 'minutes', 'seconds'].forEach(k => {
        updateFlapUnit(flapUnits[k], '00', false);
      });
      return;
    }

    let months = 0;
    let tempDate = new Date(now.getTime());

    while (true) {
      let nextMonth = new Date(tempDate.getTime());
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      if (nextMonth <= TARGET_DATE) {
        months++;
        tempDate = nextMonth;
      } else {
        break;
      }
    }

    let remainingMs = TARGET_DATE.getTime() - tempDate.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const oneHour = 1000 * 60 * 60;
    const oneMinute = 1000 * 60;

    const days = Math.floor(remainingMs / oneDay);
    remainingMs -= days * oneDay;

    const hours = Math.floor(remainingMs / oneHour);
    remainingMs -= hours * oneHour;

    const minutes = Math.floor(remainingMs / oneMinute);
    remainingMs -= minutes * oneMinute;

    const seconds = Math.floor(remainingMs / 1000);

    const pad = (n) => String(n).padStart(2, '0');

    updateFlapUnit(flapUnits.months, pad(months));
    updateFlapUnit(flapUnits.days, pad(days));
    updateFlapUnit(flapUnits.hours, pad(hours));
    updateFlapUnit(flapUnits.minutes, pad(minutes));
    updateFlapUnit(flapUnits.seconds, pad(seconds));
  }

  function syncCountdown() {
    clearInterval(countdownTimer);
    countdownTimer = null;
    if (document.hidden || !isVisible || backgroundCovered()) {
      // Finish in-flight flips now instead of leaving delayed background work.
      Object.values(flapUnits).forEach(unit => {
        if (unit.timer === null) return;
        clearTimeout(unit.timer);
        unit.timer = null;
        if (unit.top) unit.top.textContent = unit.currentVal;
        if (unit.leafFront) unit.leafFront.textContent = unit.currentVal;
        unit.card?.classList.remove('flipping');
      });
      return;
    }
    updateCountdown();
    if (!document.hidden && isVisible && Date.now() < TARGET_DATE.getTime()) {
      countdownTimer = setInterval(updateCountdown, 1000);
    }
  }
  document.addEventListener('visibilitychange', syncCountdown);
  window.TD_Performance.subscribe(syncCountdown);
  const section = document.getElementById('countdownSection');
  if (section && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      isVisible = entries[0].isIntersecting;
      syncCountdown();
    }).observe(section);
  }
  syncCountdown();

  window.TD_SplitFlap = {
    updateCountdown
  };
})();

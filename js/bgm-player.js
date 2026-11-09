/** Phones opt into music; covered or hidden pages do not keep playing. */
(function () {
  const bgMusic = document.getElementById('bgMusic');
  const status = document.getElementById('tvBgmStatus');
  const toggle = document.getElementById('audioToggleBtn');
  const icon = document.getElementById('audioIconPath');
  const label = document.getElementById('osdAudioTag');
  if (!bgMusic) return;

  const activeIcon = icon?.getAttribute('d');
  const mutedIcon = "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z";
  let userPaused = false;
  let started = false;
  let playPending = false;
  let explicitPlayback = false;
  const performance = window.TD_Performance;

  function mayPlay() {
    return !userPaused && !document.hidden && !performance.isDialogOpen() &&
      (explicitPlayback || !performance.isLightweight());
  }

  function updateBgmUI(playing) {
    status?.classList.toggle('playing', playing);
    status?.classList.toggle('muted', !playing);
    status?.setAttribute('aria-pressed', String(playing));
    status?.setAttribute('aria-label', playing ? 'หยุดเพลงพื้นหลัง' : 'เล่นเพลงพื้นหลัง');
    toggle?.setAttribute('aria-pressed', String(playing));
    toggle?.setAttribute('aria-label', playing ? 'หยุดเพลงพื้นหลัง' : 'เล่นเพลงพื้นหลัง');
    icon?.setAttribute('d', playing ? activeIcon : mutedIcon);
    if (label) {
      label.textContent = playing ? 'BGM: TATTOO COLOUR [OFFICIAL MV]' : 'MUTE [OFF]';
      label.style.color = playing ? '#38ef7d' : '#fde047';
    }
  }

  async function startBgmPlayback(automatic = false) {
    if (!automatic) explicitPlayback = true;
    if (!mayPlay() || playPending || !bgMusic.paused) return;
    started = true;
    playPending = true;
    bgMusic.volume = 0.85;
    if (!bgMusic.getAttribute('src') && bgMusic.dataset.src) bgMusic.src = bgMusic.dataset.src;
    try {
      await bgMusic.play();
      if (!mayPlay()) bgMusic.pause();
    } catch {
      // A blocked play can be retried with the sound button.
    } finally {
      playPending = false;
      updateBgmUI(!bgMusic.paused);
    }
  }

  function toggleBgm(event) {
    event?.preventDefault();
    window.TD_Audio?.playCassetteClickSound();
    userPaused = playPending || !bgMusic.paused;
    if (userPaused) bgMusic.pause();
    else startBgmPlayback();
    updateBgmUI(!bgMusic.paused);
  }

  const gestures = ['click', 'touchstart', 'keydown'];
  function onFirstGesture(event) {
    gestures.forEach(name => document.removeEventListener(name, onFirstGesture, true));
    if (!event.target.closest?.('#audioToggleBtn, #tvBgmStatus')) startBgmPlayback(true);
  }
  gestures.forEach(name => document.addEventListener(name, onFirstGesture, { capture: true, passive: true }));
  toggle?.addEventListener('click', toggleBgm);
  status?.addEventListener('click', toggleBgm);
  status?.setAttribute('role', 'button');
  status?.setAttribute('tabindex', '0');
  status?.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key) || event.repeat) return;
    event.preventDefault();
    toggleBgm(event);
  });
  function syncPlayback() {
    if (!mayPlay()) bgMusic.pause();
    else if (started) void startBgmPlayback(!explicitPlayback);
    updateBgmUI(!bgMusic.paused);
  }
  document.addEventListener('visibilitychange', syncPlayback);
  performance.subscribe(syncPlayback);
  updateBgmUI(false);
  window.TD_Bgm = { startBgmPlayback, toggleBgm };
})();

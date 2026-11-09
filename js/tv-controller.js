/**
 * TRIAMDOD 10 — CRT TV & Vintage Cassette Tape Controller
 * Features:
 * - 5 Channels video archive switching
 * - CRT static white noise canvas rendering
 * - Tactile TV power on/off button with complete CRT power-down
 * - Channel +/- navigation buttons
 * - Synced tape stack and spoiler bar active states
 */

(function() {
  const ARCHIVE_CHANNELS = [
    {
      channelLabel: "CH 01 // 2022",
      title: "TRIAMDOD10 : THE ORIGIN RECAP",
      videoSrc: "https://assets.mixkit.co/videos/14084/14084-720.mp4"
    },
    {
      channelLabel: "CH 02 // 2023",
      title: "TRIAMDOD10 : NIGHT GLOW MOSH",
      videoSrc: "https://assets.mixkit.co/videos/48507/48507-720.mp4"
    },
    {
      channelLabel: "CH 03 // 2024",
      title: "TRIAMDOD10 : FREQUENCY OVERDRIVE",
      videoSrc: "https://assets.mixkit.co/videos/14088/14088-720.mp4"
    },
    {
      channelLabel: "CH 04 // 2025",
      title: "TRIAMDOD10 : NEXT WAVE TEASER",
      videoSrc: "https://assets.mixkit.co/videos/48504/48504-720.mp4"
    },
    {
      channelLabel: "CH 05 // 2027",
      title: "TRIAMDOD10 : LIVE CONCERT 2027",
      videoSrc: "https://assets.mixkit.co/videos/22427/22427-720.mp4"
    }
  ];

  const video = document.getElementById('crtVideo');
  const screen = document.getElementById('tvScreen');
  const glitch = document.getElementById('crtGlitch');
  const canvas = document.getElementById('noiseCanvas');
  const channelLabel = document.getElementById('osdChannel');
  const title = document.getElementById('osdTitle');
  const status = document.getElementById('osdStatus');
  const powerLed = document.getElementById('powerLed');
  const tapes = document.querySelectorAll('.tape-item');
  const spoilers = document.querySelectorAll('.spoiler-item');
  const hasObserver = 'IntersectionObserver' in window;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const performance = window.TD_Performance;
  let currentChannel = 0, powered = true, visible = !hasObserver;
  let noiseFrame = null, noiseTimeout = null, powerTimeout = null;
  let lastNoiseFrame = null, playPending = null;
  let userPaused = false, playbackBlocked = false;
  let context = null, image = null, pixels = null;

  const isLightweight = () => !!performance?.isLightweight();
  const dialogOpen = () => !!performance?.isDialogOpen();

  function stopStatic() {
    clearTimeout(noiseTimeout);
    noiseTimeout = null;
    if (noiseFrame !== null) cancelAnimationFrame(noiseFrame);
    noiseFrame = null;
    lastNoiseFrame = null;
    canvas?.classList.remove('visible');
    glitch?.classList.remove('glitch-active');
  }

  function drawStatic(timestamp) {
    // Static does not need to regenerate at a high-refresh display's frame rate.
    if (timestamp === undefined || lastNoiseFrame === null || timestamp - lastNoiseFrame >= 1000 / 30) {
      for (let i = 0; i < pixels.length; i++) pixels[i] = Math.random() < 0.5 ? 0xffffffff : 0xff101010;
      context.putImageData(image, 0, 0);
      lastNoiseFrame = timestamp ?? null;
    }
    // One short static frame keeps the CRT feedback without a phone render loop.
    if (!isLightweight()) noiseFrame = requestAnimationFrame(drawStatic);
  }

  function triggerStaticBurst(duration = 240) {
    if (!canvas || !powered || !visible || document.hidden || dialogOpen() || reducedMotion?.matches) return;
    if (!context) {
      context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = 160; canvas.height = 120;
      image = context.createImageData(160, 120);
      pixels = new Uint32Array(image.data.buffer);
    }
    clearTimeout(noiseTimeout);
    canvas.classList.add('visible');
    glitch?.classList.add('glitch-active');
    window.TD_Audio?.playCRTStaticHum();
    if (noiseFrame === null) drawStatic();
    noiseTimeout = setTimeout(stopStatic, duration);
  }

  function shouldPlay() {
    return powered && visible && !document.hidden && !dialogOpen() && !userPaused;
  }

  function updatePlayControl() {
    const playing = shouldPlay() && (!!playPending || !video?.paused);
    if (status) status.textContent = !powered ? 'OFF' : playing ? 'PLAY' : 'PAUSE';
    if (!screen) return;
    screen.setAttribute('aria-pressed', String(playing));
    screen.setAttribute('aria-disabled', String(!powered));
    screen.setAttribute('aria-label', !powered ? 'ทีวีปิดอยู่' :
      playing ? 'หยุดวิดีโอชั่วคราว' : 'เล่นวิดีโอบนจอทีวี');
  }

  function updatePlayback() {
    if (!video) return;
    if (!shouldPlay()) {
      if (playPending) playPending.interrupted = true;
      video.pause(); stopStatic();
      updatePlayControl();
      return;
    }
    // Autoplay may be refused by the browser. Wait for a deliberate tap rather
    // than repeatedly requesting playback as visibility notifications arrive.
    if (playbackBlocked) { updatePlayControl(); return; }
    const src = ARCHIVE_CHANNELS[currentChannel].videoSrc;
    if (video.getAttribute('src') !== src) {
      video.src = src;
      video.load();
    }
    if (!video.paused || playPending) { updatePlayControl(); return; }
    const request = { src, interrupted: false };
    playPending = request;
    let playback;
    try { playback = video.play(); }
    catch { playPending = null; playbackBlocked = true; updatePlayControl(); return; }
    updatePlayControl();
    Promise.resolve(playback).then(() => {
      // A play request can finish after a visibility or power change.
      if (!shouldPlay()) video.pause();
    }).catch(() => {
      if (!request.interrupted && request.src === video.getAttribute('src')) playbackBlocked = true;
    }).finally(() => {
      if (playPending !== request) return;
      playPending = null;
      updatePlayControl();
      // load()/pause() can reject an earlier request. Retry only when a newer
      // visible request superseded it, never loop on autoplay/network failures.
      if (shouldPlay() && video.paused &&
          (request.interrupted || request.src !== video.getAttribute('src'))) updatePlayback();
    });
  }

  function switchChannel(index, soundEffect = true, userAction = true) {
    if (userAction) { userPaused = false; playbackBlocked = false; }
    currentChannel = (index + ARCHIVE_CHANNELS.length) % ARCHIVE_CHANNELS.length;
    const channel = ARCHIVE_CHANNELS[currentChannel];
    if (channelLabel) channelLabel.textContent = channel.channelLabel;
    if (title) title.textContent = channel.title;
    tapes.forEach((tape, i) => tape.classList.toggle('active-tape', i === currentChannel));
    spoilers.forEach(item => item.classList.toggle('active', Number(item.dataset.tape) === currentChannel));
    if (soundEffect) {
      window.TD_Audio?.playCassetteClickSound();
      triggerStaticBurst(260);
    }
    updatePlayback();
  }

  tapes.forEach((tape, index) => {
    tape.addEventListener('click', () => switchChannel(index));
    tape.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); switchChannel(index);
      }
    });
  });
  spoilers.forEach(item => item.addEventListener('click', () => switchChannel(Number(item.dataset.tape))));

  document.getElementById('powerBtn')?.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation();
    powered = !powered;
    if (powered) { userPaused = false; playbackBlocked = false; }
    clearTimeout(powerTimeout);
    window.TD_Audio?.playCassetteClickSound();
    powerLed?.classList.toggle('off', !powered);
    if (status) status.textContent = powered ? 'PLAY' : 'OFF';
    if (screen) {
      screen.classList.remove('crt-turning-on', 'crt-turning-off');
      screen.classList.toggle('power-off', !powered);
      if (!reducedMotion?.matches) {
        screen.classList.add(powered ? 'crt-turning-on' : 'crt-turning-off');
        powerTimeout = setTimeout(() => screen.classList.remove('crt-turning-on', 'crt-turning-off'), 400);
      }
    }
    if (video) video.style.display = powered ? 'block' : 'none';
    updatePlayback();
    if (powered) triggerStaticBurst(300);
  });
  for (const [id, direction] of [['prevChBtn', -1], ['nextChBtn', 1]]) {
    document.getElementById(id)?.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      switchChannel(currentChannel + direction);
    });
  }

  function togglePlayback(event) {
    event.preventDefault(); event.stopPropagation();
    if (!powered) return;
    const playing = shouldPlay() && (!!playPending || !video?.paused);
    userPaused = playing;
    playbackBlocked = false;
    updatePlayback();
  }
  screen?.addEventListener('click', togglePlayback);
  screen?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') togglePlayback(event);
  });
  video?.addEventListener('playing', () => {
    if (!shouldPlay()) video.pause();
    updatePlayControl();
  });
  video?.addEventListener('pause', updatePlayControl);

  document.addEventListener('visibilitychange', updatePlayback);
  function updateEnvironment() {
    stopStatic();
    updatePlayback();
  }
  performance?.subscribe(updateEnvironment);
  reducedMotion?.addEventListener?.('change', updateEnvironment);
  const stage = document.getElementById('stageSection');
  if (stage && hasObserver) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      updatePlayback();
    }, { rootMargin: '0px' }).observe(stage);
  }
  switchChannel(0, false, false);
  window.TD_TV = { switchChannel, triggerStaticBurst };
})();

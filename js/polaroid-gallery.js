/** Polaroid stories, camera sound, and the back-to-top control. */
(function () {
  let shutterContext = null;
  let shutterBuffer = null;

  function playCameraShutterSound() {
    try {
      const ctx = window.TD_Audio?.initAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // 1. Mirror slap transient (Low thump)
      const mirrorOsc = ctx.createOscillator();
      const mirrorGain = ctx.createGain();
      mirrorOsc.type = 'triangle';
      mirrorOsc.frequency.setValueAtTime(160, now);
      mirrorOsc.frequency.exponentialRampToValueAtTime(30, now + 0.04);
      mirrorGain.gain.setValueAtTime(0.2, now);
      mirrorGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      mirrorOsc.connect(mirrorGain);
      mirrorGain.connect(ctx.destination);
      mirrorOsc.start(now);
      mirrorOsc.stop(now + 0.05);

      // 2. High-speed shutter curtain click (Mechanical metallic snap)
      if (shutterContext !== ctx) {
        const bufferSize = Math.floor(ctx.sampleRate * 0.06);
        shutterBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = shutterBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
        }
        shutterContext = ctx;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = shutterBuffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(1400, now + 0.01);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, now + 0.01);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now + 0.01);

      // Schedule the winder on the audio clock, without a main-thread timer.
      const windNow = now + 0.07;
      const windOsc = ctx.createOscillator();
      const windGain = ctx.createGain();
      windOsc.type = 'sawtooth';
      windOsc.frequency.setValueAtTime(450, windNow);
      windOsc.frequency.exponentialRampToValueAtTime(320, windNow + 0.08);
      windGain.gain.setValueAtTime(0.08, windNow);
      windGain.gain.exponentialRampToValueAtTime(0.001, windNow + 0.09);
      windOsc.connect(windGain);
      windGain.connect(ctx.destination);
      windOsc.start(windNow);
      windOsc.stop(windNow + 0.1);

    } catch (e) {
      // AudioContext fallback
    }
  }

  const lightboxModal = document.getElementById('polaroidLightboxModal');
  const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxStory = document.getElementById('lightboxStory');
  const lightboxDate = document.getElementById('lightboxDate');
  const lightboxCamera = document.getElementById('lightboxCamera');
  const lightboxFrame = document.getElementById('lightboxFrame');
  const polaroids = document.querySelectorAll('.polaroid-card');

  polaroids.forEach(card => {
    card.addEventListener('click', () => {
      playCameraShutterSound();

      const title = card.dataset.title || 'ความทรงจำ TRIAMDOD';
      const story = card.dataset.story || '';
      const date = card.dataset.date || '';
      const camera = card.dataset.camera || '35mm Film Camera';
      const svgArt = card.querySelector('.polaroid-photo-viewport')?.innerHTML || '';

      if (lightboxTitle) lightboxTitle.textContent = title;
      if (lightboxStory) lightboxStory.textContent = story;
      if (lightboxDate) lightboxDate.textContent = date;
      if (lightboxCamera) lightboxCamera.textContent = camera;
      if (lightboxFrame) lightboxFrame.innerHTML = svgArt;

      if (lightboxModal) {
        window.TD_Dialog.open(lightboxModal, lightboxCloseBtn);
      }
    });
  });

  function closeLightbox() {
    if (!lightboxModal) return;
    window.TD_Dialog.close(lightboxModal);
  }

  if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) closeLightbox();
    });
  }

  // ESC key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.defaultPrevented && window.TD_Dialog.isTop(lightboxModal)) {
      e.preventDefault();
      closeLightbox();
    }
  });

  // --------------------------------------------------------------------------
  // 7. Back To Top Button
  // --------------------------------------------------------------------------
  const backToTopBtn = document.getElementById('btnBackToTop');
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      playCameraShutterSound();
      window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }

})();

/**
 * TRIAMDOD 10 — Web Audio Synthesizer Module
 * Synthesizes vintage mechanical audio textures:
 * - Mechanical Split-Flap Airport Display Clack
 * - Cassette Deck Mechanical Button Click
 * - Nokia 3310 DTMF Dual-Tone Frequencies
 * - Nokia 3310 Monophonic 8-bit Ringtone Tune
 * - CRT TV White Noise Static Burst
 */

(function () {
  let audioCtx = null;
  const noiseBuffers = new Map();

  function initAudioContext() {
    if (document.hidden) return null;
    // Timer-driven effects must not create suspended audio nodes before interaction.
    if (!audioCtx && window.navigator?.userActivation && !window.navigator.userActivation.hasBeenActive) {
      return null;
    }
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  // A new source is needed for each sound, but its sample data can be reused.
  function getNoiseBuffer(name, duration, decay = 0) {
    if (noiseBuffers.has(name)) return noiseBuffers.get(name);
    const length = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const envelope = decay ? Math.exp(-i / (length * decay)) : 1;
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
    noiseBuffers.set(name, buffer);
    return buffer;
  }

  // Tactile Mechanical Split-Flap "Clack" Sound
  function playSplitFlapSound() {
    try {
      if (!initAudioContext()) return;

      const now = audioCtx.currentTime;

      // Transient click
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.025);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.03);

      // Low flap resonant body
      const bodyOsc = audioCtx.createOscillator();
      const bodyGain = audioCtx.createGain();

      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(240, now + 0.005);
      bodyOsc.frequency.exponentialRampToValueAtTime(80, now + 0.035);

      bodyGain.gain.setValueAtTime(0.03, now + 0.005);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(audioCtx.destination);

      bodyOsc.start(now + 0.005);
      bodyOsc.stop(now + 0.045);
    } catch (e) {}
  }

  // Vintage Cassette Deck Click
  function playCassetteClickSound() {
    try {
      if (!initAudioContext()) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, audioCtx.currentTime);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.065);
    } catch (e) {}
  }

  // Nokia 3310 DTMF Dual-Tone Synthesizer
  function playDTMFTone(freq1 = 1209, freq2 = 697) {
    try {
      if (!initAudioContext()) return;

      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq1, audioCtx.currentTime);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq2, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.07);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(audioCtx.currentTime + 0.075);
      osc2.stop(audioCtx.currentTime + 0.075);
    } catch (e) {}
  }

  // Nokia 3310 Monophonic Ringtone Tune
  function playNokiaTune() {
    try {
      if (!initAudioContext()) return;

      const notes = [
        { freq: 1318.5, dur: 0.12 }, // E6
        { freq: 1174.7, dur: 0.12 }, // D6
        { freq: 739.99, dur: 0.24 }, // F#5
        { freq: 830.61, dur: 0.24 }, // G#5
        { freq: 1108.7, dur: 0.12 }, // C#6
        { freq: 987.77, dur: 0.12 }, // B5
        { freq: 587.33, dur: 0.24 }, // D5
        { freq: 659.25, dur: 0.28 }  // E5
      ];

      let startTime = audioCtx.currentTime + 0.05;

      notes.forEach((note) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(note.freq, startTime);

        gain.gain.setValueAtTime(0.06, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + note.dur - 0.02);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + note.dur);

        startTime += note.dur + 0.03;
      });
    } catch (e) {}
  }

  // CRT TV White Noise Static Burst
  function playCRTStaticHum() {
    try {
      if (!initAudioContext()) return;

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = getNoiseBuffer('crt', 0.12);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800;

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      whiteNoise.start();
    } catch (e) {}
  }

  // Fabric Rustle / Hanger Movement Sound
  function playHangerSwaySound() {
    try {
      if (!initAudioContext()) return;

      const noise = audioCtx.createBufferSource();
      noise.buffer = getNoiseBuffer('hanger', 0.15, 0.35);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + 0.14);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.045, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      noise.start();
    } catch (e) {}
  }

  // Nokia Snake Food Beep
  function playSnakeBeep() {
    try {
      if (!initAudioContext()) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1250, audioCtx.currentTime);
      osc.frequency.setValueAtTime(1580, audioCtx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.075);
    } catch (e) {}
  }

  // Nokia Snake Game Over Buzz
  function playSnakeDie() {
    try {
      if (!initAudioContext()) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, audioCtx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.23);
    } catch (e) {}
  }

  // Metallic Coin Drop Sound (เหรียญหล่นลงช่องหยอดเหรียญตู้โทรศัพท์ Clink-clank)
  function playCoinDropSound() {
    try {
      if (!initAudioContext()) return;
      const now = audioCtx.currentTime;

      // Metallic chime 1
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(3200, now);
      osc1.frequency.exponentialRampToValueAtTime(1800, now + 0.08);
      gain1.gain.setValueAtTime(0.16, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.09);

      // Metallic chime 2 (Clink)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(4400, now + 0.035);
      osc2.frequency.exponentialRampToValueAtTime(2400, now + 0.14);
      gain2.gain.setValueAtTime(0.14, now + 0.035);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.035);
      osc2.stop(now + 0.16);
    } catch (e) {}
  }

  // Metallic Coin Return Flap Sound (เปิดช่องคืนเหรียญ PUSH)
  function playCoinReturnSound() {
    try {
      if (!initAudioContext()) return;
      const now = audioCtx.currentTime;

      // Metallic spring flap
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(320, now);
      osc1.frequency.exponentialRampToValueAtTime(80, now + 0.05);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.065);

      // Coins jingling in cup
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2800, now + 0.03);
      osc2.frequency.exponentialRampToValueAtTime(1400, now + 0.11);
      gain2.gain.setValueAtTime(0.12, now + 0.03);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.03);
      osc2.stop(now + 0.13);
    } catch (e) {}
  }

  // Handset Lift / Dial Tone Sound
  function playHandsetLiftSound() {
    try {
      if (!initAudioContext()) return;
      const now = audioCtx.currentTime;

      // Switch click
      const oscClick = audioCtx.createOscillator();
      const gainClick = audioCtx.createGain();
      oscClick.type = 'triangle';
      oscClick.frequency.setValueAtTime(500, now);
      oscClick.frequency.exponentialRampToValueAtTime(100, now + 0.03);
      gainClick.gain.setValueAtTime(0.18, now);
      gainClick.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      oscClick.connect(gainClick);
      gainClick.connect(audioCtx.destination);
      oscClick.start(now);
      oscClick.stop(now + 0.04);

      // Authentic continuous dial tone burst (350Hz + 440Hz)
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(350, now + 0.04);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(440, now + 0.04);
      gain.gain.setValueAtTime(0.06, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);
      osc1.start(now + 0.04);
      osc2.start(now + 0.04);
      osc1.stop(now + 0.36);
      osc2.stop(now + 0.36);
    } catch (e) {}
  }

  window.TD_Audio = {
    initAudioContext,
    playSplitFlapSound,
    playCassetteClickSound,
    playDTMFTone,
    playCoinDropSound,
    playCoinReturnSound,
    playHandsetLiftSound,
    playNokiaTune,
    playCRTStaticHum,
    playHangerSwaySound,
    playSnakeBeep,
    playSnakeDie
  };
})();

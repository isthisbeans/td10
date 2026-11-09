/**
 * TRIAMDOD 10 — Nokia 3310 Timetable Controller
 * Features:
 * - Timetable scrolling & slot activation
 * - DTMF keypad tone sound synthesis
 * - Nokia Monophonic 8-bit Ringtone Tune player
 * - Phone vibration physics feedback
 */

(function() {
  const scheduleSlots = document.querySelectorAll('.schedule-slot');
  const nokiaScheduleList = document.getElementById('nokiaScheduleList');
  const nokiaPageIndicator = document.getElementById('nokiaPageIndicator');
  const nokiaUpBtn = document.getElementById('nokiaUpBtn');
  const nokiaDownBtn = document.getElementById('nokiaDownBtn');
  const nokiaNaviBtn = document.getElementById('nokiaNaviBtn');
  const nokiaCBtn = document.getElementById('nokiaCBtn');
  const nokiaRingtoneBtn = document.getElementById('nokiaRingtoneBtn');
  const nokiaVibeBtn = document.getElementById('nokiaVibeBtn');
  const numKeys = document.querySelectorAll('.num-key');
  const phoneBody = document.querySelector('.nokia-phone-body');

  let currentScheduleIdx = 0;
  const totalScheduleSlots = scheduleSlots.length;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let vibrationTimers = [];

  function stopVibration() {
    vibrationTimers.forEach(clearTimeout);
    vibrationTimers = [];
    if (phoneBody) phoneBody.style.transform = '';
  }

  function setScheduleSlot(idx, playSound = true, scrollInternalOnly = true) {
    if (!totalScheduleSlots) return;
    if (idx < 0) idx = 0;
    if (idx >= totalScheduleSlots) idx = totalScheduleSlots - 1;

    currentScheduleIdx = idx;

    if (playSound && window.TD_Audio && window.TD_Audio.playDTMFTone) {
      window.TD_Audio.playDTMFTone(1209, 697);
    }

    scheduleSlots.forEach((slot, i) => {
      if (i === idx) {
        slot.classList.add('active-slot');
        if (nokiaScheduleList && scrollInternalOnly) {
          nokiaScheduleList.scrollTop = slot.offsetTop - nokiaScheduleList.offsetTop - 10;
        }
      } else {
        slot.classList.remove('active-slot');
      }
    });

    if (nokiaPageIndicator) {
      nokiaPageIndicator.textContent = `${idx + 1}/${totalScheduleSlots}`;
    }
  }

  function initAudio() {
    if (window.TD_Audio && window.TD_Audio.initAudioContext) {
      window.TD_Audio.initAudioContext();
    }
  }

  if (nokiaUpBtn) {
    nokiaUpBtn.addEventListener('click', () => {
      initAudio();
      if (window.TD_NokiaSnake && window.TD_NokiaSnake.isActive()) {
        window.TD_NokiaSnake.changeDirection(0, -1);
      } else {
        setScheduleSlot(currentScheduleIdx - 1);
      }
    });
  }

  if (nokiaDownBtn) {
    nokiaDownBtn.addEventListener('click', () => {
      initAudio();
      if (window.TD_NokiaSnake && window.TD_NokiaSnake.isActive()) {
        window.TD_NokiaSnake.changeDirection(0, 1);
      } else {
        setScheduleSlot(currentScheduleIdx + 1);
      }
    });
  }

  if (nokiaNaviBtn) {
    nokiaNaviBtn.addEventListener('click', () => {
      initAudio();
      if (window.TD_NokiaSnake && window.TD_NokiaSnake.isActive()) {
        window.TD_NokiaSnake.togglePause();
      } else {
        const nextIdx = (currentScheduleIdx + 1) % totalScheduleSlots;
        setScheduleSlot(nextIdx);
      }
    });
  }

  if (nokiaCBtn) {
    nokiaCBtn.addEventListener('click', () => {
      initAudio();
      if (window.TD_NokiaSnake && window.TD_NokiaSnake.isActive()) {
        window.TD_NokiaSnake.setSnakeMode(false);
      } else {
        setScheduleSlot(0); // Reset to opening band
      }
    });
  }

  if (nokiaRingtoneBtn) {
    nokiaRingtoneBtn.addEventListener('click', () => {
      initAudio();
      if (window.TD_Audio && window.TD_Audio.playNokiaTune) {
        window.TD_Audio.playNokiaTune();
      }
    });
  }

  if (nokiaVibeBtn) {
    nokiaVibeBtn.addEventListener('click', () => {
      initAudio();
      if (window.TD_Audio && window.TD_Audio.playDTMFTone) {
        window.TD_Audio.playDTMFTone(1477, 941);
      }
      stopVibration();
      if (phoneBody && !document.hidden && !reducedMotion?.matches) {
        phoneBody.style.transform = 'translate(2px, 1px) rotate(0.5deg)';
        vibrationTimers = [
          setTimeout(() => { phoneBody.style.transform = 'translate(-2px, -1px) rotate(-0.5deg)'; }, 60),
          setTimeout(() => { phoneBody.style.transform = 'translate(1px, -2px) rotate(0.3deg)'; }, 120),
          setTimeout(stopVibration, 200)
        ];
      }
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopVibration();
  });

  numKeys.forEach((key) => {
    key.addEventListener('click', () => {
      const keyVal = key.getAttribute('data-key');
      initAudio();

      if (window.TD_NokiaSnake && window.TD_NokiaSnake.isActive()) {
        if (keyVal === '2') window.TD_NokiaSnake.changeDirection(0, -1);
        else if (keyVal === '8') window.TD_NokiaSnake.changeDirection(0, 1);
        else if (keyVal === '4') window.TD_NokiaSnake.changeDirection(-1, 0);
        else if (keyVal === '6') window.TD_NokiaSnake.changeDirection(1, 0);
        else if (keyVal === '5') window.TD_NokiaSnake.togglePause();
        else if (keyVal === '9') window.TD_NokiaSnake.setSnakeMode(false);
        return;
      }

      if (keyVal === '9') {
        if (window.TD_NokiaSnake) {
          window.TD_NokiaSnake.setSnakeMode(true);
          return;
        }
      }

      if (keyVal === '1') {
        setScheduleSlot(1);
      } else if (keyVal === '2') {
        setScheduleSlot(2);
      } else if (keyVal === '3') {
        setScheduleSlot(3);
      } else if (keyVal === '4') {
        setScheduleSlot(4);
      } else if (keyVal === '5') {
        setScheduleSlot(6); // ศิลปินรับเชิญ 1.1
      } else if (keyVal === '6') {
        setScheduleSlot(8); // ศิลปินรับเชิญ 1.2
      } else if (keyVal === '7') {
        setScheduleSlot(9); // พิธีปิด
      } else if (keyVal === '8') {
        setScheduleSlot(0); // ประตูงานเปิด
      } else if (keyVal === '0') {
        setScheduleSlot(6); // ทางลัด ศิลปินรับเชิญ
      }
    });
  });

  scheduleSlots.forEach((slot, i) => {
    slot.addEventListener('click', () => {
      initAudio();
      setScheduleSlot(i);
    });
  });

  setScheduleSlot(0, false, false);

  window.TD_Nokia = {
    setScheduleSlot
  };
})();

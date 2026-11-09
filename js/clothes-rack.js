/**
 * TRIAMDOD 10 — Clothes Rack & Merch Showcase Controller
 * Features:
 * - Interactive garment sways on click/hover with momentum
 * - Tactile fabric rustle audio feedback
 * - Shirt color switcher (Dark Espresso Brown vs Vintage Sand Beige)
 * - Quick-booking CTA pre-selecting shirt bundle in waitlist modal
 */

(function() {
  const hangers = document.querySelectorAll('.hanger-assembly');
  const rackRow = document.getElementById('rackHangersRow');
  const colorChoiceBtns = document.querySelectorAll('.color-chip-btn, .color-choice-btn');
  const drawerTitle = document.getElementById('drawerShirtTitle');
  const drawerVariant = document.getElementById('drawerShirtVariant');
  const drawerBadge = document.getElementById('drawerColorBadge');
  const drawerDesc = document.getElementById('drawerShirtDesc');
  const btnDrawerReserve = document.getElementById('btnDrawerReserve');

  const SHIRT_DATA = {
    brown: {
      title: "เสื้อยืดที่ระลึก TRIAMDOD10",
      variant: "ESPRESSO WASH • HEAVY COTTON 240 GSM",
      badge: "COLOR: DARK ESPRESSO BROWN",
      desc: "ผ้าคอตตอนฟอกวินเทจสีน้ำตาลเข้มหนานุ่ม 240 GSM สกรีนลายสัญลักษณ์ TRIAMDOD10 โครเมียมสีเงินกลางอก พร้อมตราสัญลักษณ์งาน 8 มกราคม 2570 บรรจุในแพ็คเกจบัตรพิเศษ",
    },
    beige: {
      title: "เสื้อยืดที่ระลึก TRIAMDOD10",
      variant: "SAND CREME • HEAVY COTTON 240 GSM",
      badge: "COLOR: VINTAGE SAND BEIGE",
      desc: "ผ้าคอตตอนสีเนื้อธรรมชาติสัมผัสนุ่มพิเศษ สกรีนลายกราฟิกเรโทร Y2K สีน้ำตาลช็อกโกแลตตัดลายเส้นเงิน 'THE SOUND OF YOUTH 2570' รุ่นพิเศษเฉพาะผู้ถือแพ็คเกจเสื้อ",
    }
  };

  let activeColor = 'brown';
  const swayTimers = new Map();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const compactView = window.matchMedia?.('(max-width: 1080px)');
  const phoneView = window.matchMedia?.('(max-width: 680px)');

  function stopSway(hanger) {
    clearTimeout(swayTimers.get(hanger));
    swayTimers.delete(hanger);
    hanger.classList.remove('swaying-active');
  }

  function revealHanger(hanger) {
    if (!compactView?.matches || !hanger || !rackRow?.scrollTo) return;
    // Scroll only the gallery; swatches must not move the whole page.
    rackRow.scrollTo({
      left: hanger.offsetLeft - (rackRow.clientWidth - hanger.offsetWidth) / 2,
      behavior: 'instant'
    });
  }

  function selectShirt(color, triggerSound = true, preferredHanger) {
    if (!Object.hasOwn(SHIRT_DATA, color)) color = 'brown';
    activeColor = color;
    const data = SHIRT_DATA[color];
    const frontHanger = [...hangers].find(hanger => hanger.getAttribute('data-color') === color);
    const selectedHanger = [...hangers].includes(preferredHanger) && preferredHanger.getAttribute('data-color') === color
      ? preferredHanger
      : frontHanger;

    if (drawerTitle) drawerTitle.textContent = data.title;
    if (drawerVariant) drawerVariant.textContent = data.variant;
    if (drawerBadge) drawerBadge.textContent = data.badge;
    if (drawerDesc) drawerDesc.textContent = data.desc;

    // Update active state on color choice buttons & chips
    colorChoiceBtns.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-color') === color));
      if (btn.getAttribute('data-color') === color) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update active highlight on matching hanger
    hangers.forEach((hanger) => {
      stopSway(hanger);
      hanger.setAttribute('aria-pressed', String(hanger === selectedHanger));
      if (hanger === selectedHanger) {
        hanger.classList.add('selected');
        if (triggerSound && !document.hidden && !reducedMotion?.matches && !compactView?.matches && !window.TD_Performance?.isLightweight()) {
          hanger.classList.add('swaying-active');
          swayTimers.set(hanger, setTimeout(() => stopSway(hanger), 1400));
        }
      } else {
        hanger.classList.remove('selected');
      }
    });

    if (triggerSound) revealHanger(selectedHanger);

    if (triggerSound && window.TD_Audio && window.TD_Audio.playHangerSwaySound) {
      window.TD_Audio.playHangerSwaySound();
    }
  }

  // Hanger click & touch events
  hangers.forEach((hanger) => {
    hanger.setAttribute('role', 'button');
    hanger.setAttribute('tabindex', '0');
    hanger.setAttribute('aria-label', hanger.getAttribute('title') || 'เลือกสีเสื้อ');
    hanger.addEventListener('click', () => {
      const color = hanger.getAttribute('data-color') || 'brown';
      selectShirt(color, true, hanger);
    });

    hanger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        hanger.click();
      }
    });

    hanger.addEventListener('mouseenter', () => {
      if (window.TD_Audio && window.TD_Audio.playHangerSwaySound) {
        window.TD_Audio.playHangerSwaySound();
      }
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hangers.forEach(stopSway);
  });

  // Preserve the chosen view when rotating or moving into the compact gallery.
  function syncGalleryLayout() {
    hangers.forEach(stopSway);
    revealHanger([...hangers].find(hanger => hanger.classList.contains('selected')));
  }
  compactView?.addEventListener?.('change', syncGalleryLayout);
  phoneView?.addEventListener?.('change', syncGalleryLayout);

  // Color Swatch buttons in Drawer
  colorChoiceBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.getAttribute('data-color');
      selectShirt(color, true);
    });
  });

  // Pre-select shirt package and open Retro Payphone Booth
  if (btnDrawerReserve) {
    btnDrawerReserve.addEventListener('click', (e) => {
      e.preventDefault();
      window.TD_Payphone.openPayphoneModal('3', activeColor);
    });
  }

  // Initialize with Dark Brown selected
  selectShirt('brown', false);

  window.TD_ClothesRack = {
    selectShirt
  };
})();

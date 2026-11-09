/**
 * TRIAMDOD 10 — Retro Coin-Operated Payphone Booth Controller
 * (ตู้โทรศัพท์สาธารณะหยอดเหรียญ พร้อมบัตรโทรศัพท์ข้างฝา & ทุกปุ่มใช้งานได้จริง)
 * Features:
 * - Account-specific student/alumni packages shared with checkout
 * - Role-appropriate package keys, authentic DTMF tones and LCD feedback
 * - Interactive Coin Slot: Adds coin credit with metallic clink & LCD alert
 * - Interactive Coin Return Cup (PUSH): Flap depression with coin rattle refund sound
 * - Interactive Handset Receiver: Clickable to lift receiver with dial tone burst
 * - Shirt color and size pickers with instant LCD updates
 * - Connect Call CTA: Continues the selection to account details or confirmation
 */

(function() {
  const payphoneModal = document.getElementById('payphoneModal');
  const closePayphoneBtn = document.getElementById('closePayphoneBtn');
  const btnInsertCoin = document.getElementById('btnInsertCoin');
  const coinCreditBadge = document.getElementById('coinCreditBadge');
  const lcdSelectedPackage = document.getElementById('lcdSelectedPackage');
  const lcdShirtColor = document.getElementById('lcdShirtColor');
  const lcdSizeAndCredit = document.getElementById('lcdSizeAndCredit');
  const lcdCallStatus = document.getElementById('lcdCallStatus');
  const selectedPkgSummaryText = document.getElementById('selectedPkgSummaryText');
  const btnPayphoneProceed = document.getElementById('btnPayphoneProceed');
  const payphoneCoinReturn = document.getElementById('payphoneCoinReturn');
  const payphoneHandset = document.getElementById('payphoneHandset');
  const dockSizeCluster = document.getElementById('dockSizeCluster');
  const dockColorCluster = document.getElementById('dockColorCluster');
  const pkgCards = document.querySelectorAll('.payphone-pkg-card');
  const keypadBtns = document.querySelectorAll('.keypad-btn');
  const sizeBtns = document.querySelectorAll('.size-choice-btn');
  const colorBtns = document.querySelectorAll('.payphone-color-choice-btn');
  const roleLabel = document.getElementById('payphoneRoleLabel');
  const boothHint = document.getElementById('payphoneSelectionHint');
  const dialHint = document.getElementById('payphoneDialHint');

  // Triggers for opening Payphone Package Modal
  const openPackageBtns = document.querySelectorAll('#openInfoBtn, .btn-open-package-modal');

  const PACKAGES = Object.fromEntries(window.TD_PACKAGES.map(pkg => [pkg.id, pkg]));

  // DTMF frequency map for telephone keypad
  const DTMF_MAP = {
    '1': [1209, 697],
    '2': [1336, 697],
    '3': [1477, 697],
    '4': [1209, 770],
    '5': [1336, 770],
    '6': [1477, 770],
    '7': [1209, 852],
    '8': [1336, 852],
    '9': [1477, 852],
    '*': [1209, 941],
    '0': [1336, 941],
    '#': [1477, 941]
  };

  const CHEST_MAP = {
    'S': 'รอบอก 38"',
    'M': 'รอบอก 40"',
    'L': 'รอบอก 42"',
    'XL': 'รอบอก 44"',
    '2XL': 'รอบอก 48"'
  };
  const COLOR_LABELS = { brown: 'Espresso', beige: 'Sand Beige' };

  let currentPkgId = '1';
  let currentColor = 'brown';
  let currentSize = 'L';
  let insertedCredit = 99;
  let dialedBuffer = '';
  let lcdRestoreTimer = null;
  const accountRole = () => window.TD_Auth?.getPackageRole() || null;
  const eligiblePackages = role => window.TD_PACKAGES.filter(pkg => pkg.role === role);

  function applyAccountRole() {
    const role = accountRole();
    if (payphoneModal) payphoneModal.dataset.packageRole = role || 'guest';
    const packages = eligiblePackages(role);
    if (roleLabel) roleLabel.textContent = role === 'student-current' ? 'นักเรียนปัจจุบัน · 3 แพ็กเกจ' : role === 'alumni' ? 'ศิษย์เก่า · 2 แพ็กเกจ' : 'เข้าสู่ระบบเพื่อเลือกแพ็กเกจ';
    if (boothHint) boothHint.textContent = 'เลือกแพ็กเกจ → เลือกสีและไซส์ถ้ามีเสื้อ → ดำเนินการต่อ · ไม่ต้องหยอดเหรียญ';
    if (dialHint) dialHint.textContent = role === 'student-current' ? 'คลิกการ์ด หรือกด [1] [2] [3] เพื่อเลือกแพ็กเกจนักเรียน' : 'คลิกการ์ด หรือกด [4] [5] เพื่อเลือกแพ็กเกจศิษย์เก่า';
    pkgCards.forEach(card => {
      const allowed = PACKAGES[card.dataset.pkg]?.role === role;
      card.hidden = !allowed;
      card.classList.toggle('filtered-out', !allowed);
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', allowed ? '0' : '-1');
      card.setAttribute('aria-hidden', String(!allowed));
      card.setAttribute('aria-pressed', String(allowed && card.dataset.pkg === currentPkgId));
    });
    keypadBtns.forEach(button => {
      if (!button.dataset.pkg) return;
      button.disabled = PACKAGES[button.dataset.pkg]?.role !== role;
      button.setAttribute('aria-disabled', String(button.disabled));
      if (button.disabled) button.classList.remove('active-key');
    });
    if (btnPayphoneProceed) btnPayphoneProceed.disabled = !packages.length;
    return role;
  }

  function syncAccount() {
    const role = applyAccountRole();
    if (!payphoneModal?.classList.contains('active')) return;
    if (!role) { closePayphoneModal(); return; }
    if (PACKAGES[currentPkgId]?.role !== role) selectPackage(eligiblePackages(role)[0].id, false);
  }

  function refreshLcd() {
    const pkg = PACKAGES[currentPkgId];
    if (lcdSelectedPackage) {
      lcdSelectedPackage.textContent = `PKG [${pkg.id}]: ${pkg.shortName} ${pkg.price}.-`;
    }
    if (lcdShirtColor) {
      lcdShirtColor.hidden = !pkg.hasShirt;
      lcdShirtColor.textContent = pkg.hasShirt ? `COLOR: ${COLOR_LABELS[currentColor]}` : '';
    }
    if (lcdSizeAndCredit) {
      if (pkg.hasShirt) {
        lcdSizeAndCredit.textContent = `SIZE: ${currentSize} (${CHEST_MAP[currentSize] || ''}) • เครดิต: ฿${insertedCredit}`;
      } else {
        lcdSizeAndCredit.textContent = `(ไม่ต้องระบุไซส์เสื้อ) • เครดิต: ฿${insertedCredit}`;
      }
    }
    if (coinCreditBadge) {
      coinCreditBadge.innerHTML = `เหรียญจำลอง: <b>฿${insertedCredit}.00</b>`;
    }
    const dockChestBadge = document.getElementById('dockChestBadge');
    if (dockChestBadge) {
      dockChestBadge.textContent = CHEST_MAP[currentSize] || `ไซส์ ${currentSize}`;
    }
    if (dockSizeCluster) {
      dockSizeCluster.classList.toggle('no-shirt', !pkg.hasShirt);
    }
    if (dockColorCluster) dockColorCluster.hidden = !pkg.hasShirt;
    colorBtns.forEach(button => { button.disabled = !pkg.hasShirt; });
    sizeBtns.forEach(button => { button.disabled = !pkg.hasShirt; });
    if (selectedPkgSummaryText) {
      const roleText = pkg.role === 'student-current' ? 'นักเรียน' : 'ศิษย์เก่า';
      selectedPkgSummaryText.innerHTML = `
        <span class="summary-badge-pkg">PKG [${pkg.id}] [${roleText}]</span>
        <span class="summary-badge-name">${pkg.name}</span>
        <span class="summary-badge-price">${pkg.price}.-</span>
      `;
    }
  }

  function flashLcdMessage(mainMsg, subMsg = '', duration = 1400) {
    if (lcdRestoreTimer) clearTimeout(lcdRestoreTimer);
    if (lcdSelectedPackage) lcdSelectedPackage.textContent = mainMsg;
    if (subMsg && lcdSizeAndCredit) lcdSizeAndCredit.textContent = subMsg;

    lcdRestoreTimer = setTimeout(() => {
      refreshLcd();
    }, duration);
  }

  function selectPackage(pkgId, triggerSound = true) {
    const role = applyAccountRole();
    if (!role || PACKAGES[pkgId]?.role !== role) return false;
    clearTimeout(lcdRestoreTimer);
    currentPkgId = pkgId;
    const pkg = PACKAGES[pkgId];
    insertedCredit = pkg.price;
    dialedBuffer = '';

    // Update active package card
    pkgCards.forEach(card => {
      card.setAttribute('aria-pressed', String(card.dataset.pkg === pkgId));
      if (card.dataset.pkg === pkgId) {
        card.classList.add('active-pkg');
      } else {
        card.classList.remove('active-pkg');
      }
    });

    // Update active key on keypad
    keypadBtns.forEach(btn => {
      if (btn.dataset.pkg === pkgId) {
        btn.classList.add('active-key');
      } else if (btn.dataset.pkg) {
        btn.classList.remove('active-key');
      }
    });

    refreshLcd();

    if (triggerSound && window.TD_Audio && window.TD_Audio.playDTMFTone) {
      const freqs = DTMF_MAP[pkgId] || [1209, 697];
      window.TD_Audio.playDTMFTone(freqs[0], freqs[1]);
    }
    return true;
  }

  function selectSize(size, triggerSound = true) {
    if (!CHEST_MAP[size]) return;
    currentSize = size;
    sizeBtns.forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.size === size));
      if (btn.dataset.size === size) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    refreshLcd();
    if (triggerSound && window.TD_Audio && window.TD_Audio.playCassetteClickSound) {
      window.TD_Audio.playCassetteClickSound();
    }
  }

  function selectColor(color, triggerSound = true) {
    if (!['brown', 'beige'].includes(color)) return;
    currentColor = color;
    colorBtns.forEach(button => {
      const selected = button.dataset.color === color;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    clearTimeout(lcdRestoreTimer);
    refreshLcd();
    if (triggerSound) window.TD_Audio?.playCassetteClickSound?.();
  }

  function openPayphoneModal(defaultPkg = '1', color = 'brown', size = currentSize) {
    if (!payphoneModal) return;
    const role = applyAccountRole();
    if (!role) {
      window.TD_Auth?.openForPhone({ packageId: defaultPkg, color, size });
      return;
    }
    if (window.TD_Audio) {
      if (window.TD_Audio.initAudioContext) window.TD_Audio.initAudioContext();
      if (window.TD_Audio.playCassetteClickSound) window.TD_Audio.playCassetteClickSound();
    }
    window.TD_Dialog.open(payphoneModal, closePayphoneBtn);
    const pkg = PACKAGES[defaultPkg]?.role === role ? PACKAGES[defaultPkg] : eligiblePackages(role)[0];
    selectPackage(pkg.id, false);
    selectColor(['brown', 'beige'].includes(color) ? color : 'brown', false);
    selectSize(size, false);
    if (lcdCallStatus) lcdCallStatus.textContent = '[READY]';
  }

  function closePayphoneModal() {
    if (!payphoneModal?.classList.contains('active')) return;
    if (window.TD_Audio && window.TD_Audio.playCassetteClickSound) {
      window.TD_Audio.playCassetteClickSound();
    }
    clearTimeout(lcdRestoreTimer);
    window.TD_Dialog.close(payphoneModal);
  }

  // Event Listeners for Package Cards
  pkgCards.forEach(card => {
    card.addEventListener('click', () => {
      const pkgId = card.dataset.pkg;
      selectPackage(pkgId, true);
    });
    card.addEventListener('keydown', event => {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      selectPackage(card.dataset.pkg, true);
    });
  });

  // Event Listeners for Keypad Buttons (ALL 12 BUTTONS FULLY FUNCTIONAL)
  keypadBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const key = btn.dataset.key;
      const freqs = DTMF_MAP[key] || [1209, 697];
      
      // Play authentic DTMF tone
      if (window.TD_Audio && window.TD_Audio.playDTMFTone) {
        window.TD_Audio.playDTMFTone(freqs[0], freqs[1]);
      }

      // Visual press animation
      btn.classList.add('active-key');
      if (!['1', '2', '3', '4', '5'].includes(key) || key !== currentPkgId) {
        setTimeout(() => btn.classList.remove('active-key'), 180);
      }

      // Keys 1 to 5: Select package
      if (['1', '2', '3', '4', '5'].includes(key)) {
        selectPackage(key, false);
      }
      // Key *: Reset dialed numbers and extra credit
      else if (key === '*') {
        dialedBuffer = '';
        insertedCredit = PACKAGES[currentPkgId].price;
        flashLcdMessage('[RESET] DIAL BUFFER CLEARED', `CREDIT: ฿${insertedCredit}.00`, 1200);
      }
      // Key #: Connect call
      else if (key === '#') {
        btnPayphoneProceed?.click();
      }
      // Keys 6-9, 0: Dial numbers with live LCD feedback
      else {
        dialedBuffer += key;
        if (dialedBuffer.length > 10) dialedBuffer = dialedBuffer.slice(-10);
        flashLcdMessage(`DIAL: ${dialedBuffer}`, `TONE OK • CREDIT: ฿${insertedCredit}`, 1800);
      }
    });
  });

  // Shirt color and size controls keep the booth selection ready for checkout.
  colorBtns.forEach(button => {
    button.addEventListener('click', () => {
      if (button.disabled || !accountRole() || !PACKAGES[currentPkgId].hasShirt) return;
      selectColor(button.dataset.color);
    });
  });

  sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      selectSize(btn.dataset.size);
    });
  });

  // Interactive Coin Insertion Slot (Adds +10 Baht & Clink sound)
  if (btnInsertCoin) {
    btnInsertCoin.addEventListener('click', () => {
      if (window.TD_Audio && window.TD_Audio.playCoinDropSound) {
        window.TD_Audio.playCoinDropSound();
      }
      insertedCredit += 10;
      refreshLcd();
      flashLcdMessage(`+10฿ COIN INSERTED`, `CREDIT: ฿${insertedCredit}.00`, 1400);
    });
  }

  // Interactive Coin Return Flap (Refunds extra coins)
  if (payphoneCoinReturn) {
    payphoneCoinReturn.addEventListener('click', () => {
      if (window.TD_Audio && window.TD_Audio.playCoinReturnSound) {
        window.TD_Audio.playCoinReturnSound();
      } else if (window.TD_Audio && window.TD_Audio.playCoinDropSound) {
        window.TD_Audio.playCoinDropSound();
      }
      payphoneCoinReturn.classList.add('flapped');
      setTimeout(() => payphoneCoinReturn.classList.remove('flapped'), 250);

      const refundAmount = Math.max(0, insertedCredit - PACKAGES[currentPkgId].price);
      insertedCredit = PACKAGES[currentPkgId].price;
      refreshLcd();
      flashLcdMessage(`COIN RETURN // คืนเหรียญ`, refundAmount > 0 ? `REFUNDED: ฿${refundAmount}.00` : `TRAY CHECKED (฿0)`, 1500);
    });
  }

  // Interactive Handset (Click to lift receiver & hear dial tone)
  if (payphoneHandset) {
    payphoneHandset.addEventListener('click', () => {
      if (window.TD_Audio && window.TD_Audio.playHandsetLiftSound) {
        window.TD_Audio.playHandsetLiftSound();
      }
      payphoneHandset.classList.add('lifted');
      setTimeout(() => payphoneHandset.classList.remove('lifted'), 600);
      flashLcdMessage(`HANDSET LIFTED // ยกหู`, accountRole() === 'student-current' ? 'LINE READY • DIAL 1-3' : 'LINE READY • DIAL 4-5', 1500);
    });
  }

  // Open Payphone Modal Triggers
  openPackageBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openPayphoneModal('1');
    });
  });

  // Close / Hangup
  if (closePayphoneBtn) closePayphoneBtn.addEventListener('click', closePayphoneModal);
  if (payphoneModal) {
    payphoneModal.addEventListener('click', (e) => {
      if (e.target === payphoneModal) closePayphoneModal();
    });
  }

  // Keyboard Navigation & Dialing
  document.addEventListener('keydown', (e) => {
    if (!payphoneModal || !payphoneModal.classList.contains('active')) return;

    if (e.key === 'Escape' && !e.defaultPrevented && window.TD_Dialog.isTop(payphoneModal)) {
      e.preventDefault();
      closePayphoneModal();
      return;
    }
    if (e.defaultPrevented || e.target.closest?.('button, [role="button"], a, input, select, textarea, [contenteditable]')) return;

    if (e.key === 'Enter') {
      if (btnPayphoneProceed) btnPayphoneProceed.click();
      return;
    }

    if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '*', '#'].includes(e.key)) {
      const targetBtn = document.querySelector(`.keypad-btn[data-key="${e.key}"]`);
      if (targetBtn) {
        targetBtn.click();
      }
    }
  });

  // Proceed / Connect Call Button -> Opens Cassette Deck
  if (btnPayphoneProceed) {
    btnPayphoneProceed.addEventListener('click', () => {
      const role = accountRole();
      if (!role || PACKAGES[currentPkgId]?.role !== role) {
        syncAccount();
        return;
      }
      if (window.TD_Audio && window.TD_Audio.playDTMFTone) {
        window.TD_Audio.playDTMFTone(1477, 941);
      }
      closePayphoneModal();

      window.TD_Auth?.openAuth('register', { packageId: currentPkgId, size: currentSize, color: currentColor });
    });
  }

  // Global export
  window.TD_Payphone = {
    openPayphoneModal,
    closePayphoneModal,
    selectPackage,
    syncAccount
  };
  applyAccountRole();

})();

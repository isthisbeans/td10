/** Verified account, checkout, slips, and order history. */
(function () {
  'use strict';

  const authModal = document.getElementById('authModal');
  const openAuthBtns = document.querySelectorAll('.btn-open-auth-trigger, #openWaitlistBtn');
  const closeAuthBtn = document.getElementById('closeAuthBtn');
  const tapeB = document.getElementById('tapeB');
  const tapeC = document.getElementById('tapeC');
  const tapeD = document.getElementById('tapeD');
  const tapeE = document.getElementById('tapeE');
  const cassetteStackStage = document.getElementById('cassetteStackStage');
  const cassetteBackplates = document.querySelectorAll('[data-cassette-back]');
  const navAuthButton = document.getElementById('openAuthModalBtn');
  const navAuthText = navAuthButton?.querySelector('.auth-btn-text');
  const navAccountPanel = document.getElementById('navAccountPanel');
  const navAccountName = document.getElementById('navAccountName');
  const navAccountEmail = document.getElementById('navAccountEmail');
  const navAccountStatus = document.getElementById('navAccountStatus');
  const compactNavigation = window.matchMedia?.('(max-width: 1080px)');
  const concertPassRows = document.querySelectorAll('.price-row[data-package-id]');

  // Tape B: one account entry, preserving the สมัครสมาชิก design
  const accountSignIn = document.getElementById('accountSignIn');

  // Tape B: Current Student View Elements
  const tapeBStepStudent = document.getElementById('tapeBStepStudent');
  const btnStudentChangeAccount = document.getElementById('btnStudentChangeAccount');
  const btnStudentProceedPackages = document.getElementById('btnStudentProceedPackages');

  // Tape B: Alumni View Elements
  const tapeBStepAlumni = document.getElementById('tapeBStepAlumni');
  const alumniDetailsForm = document.getElementById('alumniDetailsForm');
  const alumniFullNameInput = document.getElementById('alumniFullNameInput');
  const alumniPhoneInput = document.getElementById('alumniPhoneInput');
  const alumniAddressInput = document.getElementById('alumniAddressInput');
  const alumniBatchSelect = document.getElementById('alumniBatchSelect');
  const btnAlumniChangeAccount = document.getElementById('btnAlumniChangeAccount');
  const btnAlumniProceedPackages = document.getElementById('btnAlumniProceedPackages');
  const profileSaveStatus = document.getElementById('profileSaveStatus');

  // Confirmation, payment and order history each have their own cassette.
  const tapeDPaymentView = document.getElementById('tapeDPaymentView');
  const tapeEOrdersView = document.getElementById('tapeEOrdersView');
  const tapeEReceiptView = document.getElementById('tapeEReceiptView');
  const myOrdersList = document.getElementById('myOrdersList');
  const myOrdersStatus = document.getElementById('myOrdersStatus');
  const myOrdersEmpty = document.getElementById('myOrdersEmpty');
  const myOrdersCount = document.getElementById('myOrdersCount');
  const btnLoadMyOrders = document.getElementById('btnLoadMyOrders');
  const btnConfirmPurchase = document.getElementById('btnConfirmPurchase');
  const btnEditPurchase = document.getElementById('btnEditPurchase');
  const ppDynamicAmount = document.getElementById('ppDynamicAmount');
  const tapeCPriceTag = document.getElementById('tapeCPriceTag');
  const regSlipInput = document.getElementById('regSlipInput');
  const slipDropzone = document.getElementById('slipDropzone');
  const slipEmptyState = document.getElementById('slipEmptyState');
  const slipPreviewState = document.getElementById('slipPreviewState');
  const slipPreviewImg = document.getElementById('slipPreviewImg');
  const slipFileName = document.getElementById('slipFileName');
  const btnReselectSlip = document.getElementById('btnReselectSlip');
  const btnBackToPayphone = document.getElementById('btnBackToPayphone');
  const btnSubmitPayment = document.getElementById('btnSubmitPayment');

  // Tape E: Saved receipt and review status.
  const summaryFullname = document.getElementById('summaryFullname');
  const summaryRole = document.getElementById('summaryRole');
  const summaryIdOrYear = document.getElementById('summaryIdOrYear');
  const summaryContact = document.getElementById('summaryContact');
  const summaryPackageChosen = document.getElementById('summaryPackageChosen');
  const summaryDeliveryNote = document.getElementById('summaryDeliveryNote');
  const summaryPaidAmountText = document.getElementById('summaryPaidAmountText');
  const summarySlipThumbnail = document.getElementById('summarySlipThumbnail');
  const summarySubmitTime = document.getElementById('summarySubmitTime');
  const btnBackToOrders = document.getElementById('btnBackToOrders');
  const btnOrdersBackToAccount = document.getElementById('btnOrdersBackToAccount');

  // User State
  let currentUser = null;
  let savedProfile = null;
  let bookingRequested = false;
  let pendingPhoneSelection = null;
  let preferredPackageId = null;
  let selectedPackage = null;
  let selectedShirtColor = 'สีน้ำตาลเข้ม Espresso';
  let selectedShirtSize = 'L';
  let currentSlipDataUrl = null;
  let slipReadId = 0;
  let paymentSending = false;
  let pendingSubmission = null;
  let receiptOrder = null;
  let purchaseReview = null;
  let confirmedPurchase = null;
  let ordersLoading = null;
  let ordersRequestId = 0;
  // Only the Worker supplies account identity; forms supply delivery details.
  try { localStorage.removeItem('td10_google_client_id'); } catch {}

  const googleButton = document.getElementById('btnGoogleSignIn');
  const googleStatus = document.getElementById('googleSignInStatus');
  const authBrowser = window.TD_AuthBrowser.detect(navigator.userAgent || '');
  const browserHelp = document.getElementById('authBrowserHelp');
  const browserHelpToggle = document.getElementById('showAuthBrowserHelp');
  const browserLink = document.getElementById('openAuthBrowser');
  const browserUrl = document.getElementById('authBrowserUrl');
  const browserCopyStatus = document.getElementById('authBrowserCopyStatus');
  const accountDeck = authModal.querySelector('.cassette-deck-modal');
  let accountRequest = null;
  let googleInitialized = false;
  let googleButtonWidth = 0;
  let googleButtonReady = false;
  let googleButtonReadyPromise = Promise.resolve(false);
  let cancelGoogleButtonWait = null;
  let googleSetupPromise = null;
  let googleConfig = null;
  let googlePreparedAt = 0;
  let googleScriptPromise = null;
  let sessionRequest = null;
  let sessionExpiryTimer = null;
  let identityRevision = 0;
  let browserHelpRequested = false;

  async function authRequest(path, body) {
    return window.TD_API.request(`/api/auth/${path}`, body);
  }

  function hasSession() {
    return currentUser && currentUser.expiresAt > Date.now();
  }

  function studentClass(info) {
    return info.grade && info.room && info.studentNumber
      ? `ม.${info.grade} / ห้อง ${info.room} / เลขที่ ${info.studentNumber}`
      : 'ยังไม่มีข้อมูล';
  }

  function alumniDetails() {
    return {
      fullname: alumniFullNameInput.value.trim(),
      phone: alumniPhoneInput.value.trim(),
      address: alumniAddressInput.value.trim(),
      batch: alumniBatchSelect.value
    };
  }

  function hasCheckoutDetails() {
    if (!currentUser) return false;
    if (currentUser.role === 'student-current') return true;
    if (savedProfile?.accountId !== currentUser.id || savedProfile.role !== currentUser.role) return false;
    return Object.entries(alumniDetails()).every(([key, value]) => value === savedProfile[key]);
  }

  function updateProfileActions(message) {
    const ready = hasCheckoutDetails();
    [btnStudentProceedPackages, btnAlumniProceedPackages].forEach(button => {
      if (!button) return;
      const continueToPhone = button === btnStudentProceedPackages || ready;
      button.querySelector('.mechanical-text').textContent = continueToPhone ? 'ไปที่ตู้โทรศัพท์' : 'บันทึก';
      const icon = button.querySelector('.mechanical-icon');
      icon.textContent = continueToPhone ? '▶▶' : '●';
      icon.classList.toggle('is-save-dot', !continueToPhone);
    });
    if (profileSaveStatus) {
      profileSaveStatus.hidden = !currentUser;
      profileSaveStatus.textContent = message || (currentUser?.role === 'student-current'
        ? 'ใช้ข้อมูลบัญชีโรงเรียนเพื่อเลือกแพ็กเกจได้ทันที'
        : ready ? 'ข้อมูลบันทึกแล้ว' : 'กรุณาบันทึกข้อมูลก่อนเลือกแพ็กเกจ');
    }
  }

  function resumeBooking() {
    if (!bookingRequested) return;
    if (!hasSession() || !hasCheckoutDetails()) return;
    bookingRequested = false;
    const pkg = window.TD_PACKAGES.find(item => item.id === preferredPackageId);
    if (!pkg || pkg.role !== currentUser.role) {
      updateProfileActions('กรุณาเลือกแพ็กเกจที่ตรงกับสถานะบัญชีของคุณที่ตู้โทรศัพท์');
      return;
    }
    selectedPackage = pkg;
    preferredPackageId = null;
    receiptOrder = null;
    switchTape('confirmation', false);
  }

  function readSession() {
    if (!sessionRequest) {
      sessionRequest = authRequest('session').finally(() => { sessionRequest = null; });
    }
    return sessionRequest;
  }

  function closeAccountPanel() {
    if (navAccountPanel) navAccountPanel.hidden = true;
    navAuthButton?.setAttribute('aria-expanded', 'false');
  }

  function syncNavigation() {
    if (!compactNavigation?.matches) return;
    // A verified member pass is part of the phone menu, with no second toggle.
    if (navAccountPanel) navAccountPanel.hidden = !hasSession() || !document.getElementById('navbarNavGroup')?.classList.contains('mobile-open');
    navAuthButton?.setAttribute('aria-expanded', 'false');
  }
  compactNavigation?.addEventListener?.('change', () => {
    closeAccountPanel();
    syncNavigation();
  });

  function updateAccountHeader(user) {
    const signedIn = Boolean(user);
    concertPassRows.forEach(row => {
      const pkg = window.TD_PACKAGES.find(item => item.id === row.dataset.packageId);
      row.classList.toggle('featured', !signedIn || pkg?.role === user.role);
    });
    if (navAuthText) navAuthText.hidden = signedIn;
    navAuthButton?.classList.toggle('is-signed-in', signedIn);
    navAuthButton?.setAttribute('aria-label', signedIn ? `บัญชีของ ${user.fullname}` : 'เข้าสู่ระบบ');
    if (navAccountName) navAccountName.textContent = user?.fullname || '';
    if (navAccountEmail) navAccountEmail.textContent = user?.email || '';
    if (navAccountStatus) {
      navAccountStatus.textContent = !user ? '' : user.status === 'admin' ? 'admin'
        : user.role === 'student-current' ? 'นักเรียนปัจจุบัน' : 'ศิษย์เก่า';
    }
    if (!signedIn) closeAccountPanel();
    syncNavigation();
    document.getElementById('navAdminLink').hidden = user?.status !== 'admin';
  }

  async function restoreSession() {
    const revision = identityRevision;
    try {
      const { user } = await readSession();
      if (revision !== identityRevision) return;
      if (user) showAccount(user, true);
      else {
        resetAccountView();
        // Prepare the real button after the session response, without opening UI.
        void prepareSignedOutEntry();
      }
    } catch {
      // Keep the signed-out header if the API is unavailable. Never infer an
      // account or admin status from localStorage or the demo admin session.
    }
  }

  function showAccount(user, preserveView = false) {
    if (!user?.id || !user.email || !['student-current', 'alumni'].includes(user.role) || !Number.isFinite(user.expiresAt) || user.expiresAt <= Date.now()) {
      throw new Error('Invalid account');
    }
    const sameAccount = currentUser?.id === user.id && currentUser.role === user.role;
    if (!sameAccount) identityRevision++;
    currentUser = sameAccount
      ? { ...currentUser, ...user, fullname: user.role === 'alumni' ? currentUser.fullname : user.fullname }
      : user;
    let profileMessage;
    if (!sameAccount) {
      purchaseReview = confirmedPurchase = null;
      selectedPackage = null;
      resetSlipPreview();
      receiptOrder = null;
      pendingSubmission = null;
      resetOrderHistory();
      savedProfile = null;
      if (user.role === 'alumni') {
        try { savedProfile = window.TD_Profiles.load(user); }
        catch { profileMessage = 'อ่านข้อมูลที่บันทึกไว้ไม่สำเร็จ กรุณาตรวจสอบแล้วบันทึกอีกครั้ง'; }
        currentUser = {
          ...currentUser,
          fullname: savedProfile?.fullname || '',
          phone: savedProfile?.phone || '', address: savedProfile?.address || '', batch: savedProfile?.batch || ''
        };
      }
    }
    updateAccountHeader(user);
    clearTimeout(sessionExpiryTimer);
    sessionExpiryTimer = setTimeout(() => {
      resetAccountView();
      void prepareSignedOutEntry();
    }, user.expiresAt - Date.now());
    accountSignIn.style.display = 'none';
    const student = user.role === 'student-current';
    tapeBStepStudent.style.display = student ? 'block' : 'none';
    tapeBStepAlumni.style.display = student ? 'none' : 'block';
    document.getElementById('stuDisplayFullname').textContent = user.fullname;
    document.getElementById('stuDisplayAccountName').textContent = user.fullname;
    document.getElementById('stuDisplayGrade').textContent = studentClass(user);
    document.getElementById('stuDisplayId').textContent = user.studentId || 'ยังไม่มีข้อมูล';
    document.getElementById('stuDisplayEmail').textContent = user.email;
    document.getElementById('alumniDisplayEmail').textContent = user.email;
    if (!student && (!preserveView || !sameAccount)) {
      alumniFullNameInput.value = currentUser.fullname;
      alumniPhoneInput.value = currentUser.phone || '';
      alumniAddressInput.value = currentUser.address || '';
      alumniBatchSelect.value = currentUser.batch || '';
    }
    updateProfileActions(profileMessage);
    if (confirmedPurchase && !isPurchaseConfirmed()) {
      invalidatePurchase();
      if (!tapeD.hidden && !receiptOrder) switchTape(hasCheckoutDetails() ? 'confirmation' : 'register', false);
    }
    if (!preserveView || !sameAccount) switchTape('register', false);
    setGoogleEntryPending(false);
    window.TD_Payphone?.syncAccount();
    if (pendingPhoneSelection) {
      const selection = pendingPhoneSelection;
      pendingPhoneSelection = null;
      closeAuth();
      window.TD_Payphone.openPayphoneModal(selection.packageId, selection.color, selection.size);
      return;
    }
    resumeBooking();
  }

  function loadGoogleScript() {
    if (window.google?.accounts?.id) return Promise.resolve();
    if (!googleScriptPromise) {
      googleScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        const timer = setTimeout(() => { script.remove(); reject(new Error('Google SDK timeout')); }, 15000);
        script.onload = () => { clearTimeout(timer); resolve(); };
        script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Google SDK unavailable')); };
        document.head.appendChild(script);
      }).catch(error => { googleScriptPromise = null; throw error; });
    }
    return googleScriptPromise;
  }

  function updateAuthBrowserHelp() {
    browserHelp.hidden = !authBrowser.embedded && !browserHelpRequested;
    browserHelpToggle.hidden = authBrowser.embedded;
    browserHelpToggle.setAttribute('aria-expanded', String(!browserHelp.hidden));
    googleButton.hidden = authBrowser.embedded;
    if (browserHelp.hidden) return;
    const selection = pendingPhoneSelection || (bookingRequested ? {
      packageId: preferredPackageId,
      color: selectedShirtColor === 'สีเนื้อ Sand Beige' ? 'beige' : 'brown',
      size: selectedShirtSize
    } : null);
    const signInLink = window.TD_AuthBrowser.signInUrl(window.location.href, selection);
    if (browserUrl.value !== signInLink) browserCopyStatus.textContent = '';
    browserUrl.value = signInLink;
    const external = window.TD_AuthBrowser.externalUrl(browserUrl.value, authBrowser);
    browserLink.hidden = !external;
    if (external) browserLink.href = external;
    browserLink.textContent = authBrowser.app === 'LINE' ? 'เปิดในเบราว์เซอร์' : 'เปิดใน Chrome';
    document.getElementById('authBrowserExplanation').textContent = authBrowser.embedded
      ? `Google ไม่รองรับการเข้าสู่ระบบในเบราว์เซอร์ของ ${authBrowser.app || 'แอปนี้'} กรุณาเปิดเว็บไซต์ใน Safari หรือ Chrome แล้วเข้าสู่ระบบต่อ`
      : 'หากหน้าต่าง Google ไม่เปิด หรือเว็บไซต์นี้เปิดอยู่ในแอปอื่น กรุณาคัดลอกลิงก์ไปเปิดใน Safari หรือ Chrome แล้วเข้าสู่ระบบอีกครั้ง';
    document.getElementById('authBrowserInstructions').textContent =
      `แตะเมนู ⋯ หรือไอคอนแชร์ของ ${authBrowser.app || 'แอป'} แล้วเลือก “เปิดในเบราว์เซอร์”${authBrowser.ios ? ' หรือ “เปิดใน Safari”' : ''} หากเปิดไม่ได้ ให้คัดลอกลิงก์ด้านล่างไปวางในเบราว์เซอร์`;
  }

  browserHelpToggle.addEventListener('click', () => {
    browserHelpRequested = !browserHelpRequested;
    updateAuthBrowserHelp();
  });
  browserLink.addEventListener('click', updateAuthBrowserHelp);
  document.getElementById('copyAuthBrowserUrl').addEventListener('click', async () => {
    updateAuthBrowserHelp();
    try {
      await navigator.clipboard.writeText(browserUrl.value);
      browserCopyStatus.textContent = 'คัดลอกแล้ว เปิด Safari หรือ Chrome แล้ววางลิงก์เพื่อเข้าสู่ระบบต่อ';
    } catch {
      // Clipboard access is sometimes disabled by the host app. Keep the link
      // visible and selected so the native Copy menu still works.
      browserUrl.focus();
      browserUrl.select();
      browserUrl.setSelectionRange(0, browserUrl.value.length);
      browserCopyStatus.textContent = 'แตะค้างที่ลิงก์แล้วเลือก “คัดลอก” จากนั้นนำไปวางใน Safari หรือ Chrome';
    }
  });
  browserUrl.addEventListener('click', () => browserUrl.select());
  updateAuthBrowserHelp();

  async function receiveGoogleCredential(result) {
    googleButton.inert = true;
    googleStatus.textContent = 'กำลังยืนยันบัญชี Google…';
    try {
      const { user } = await authRequest('google', { credential: result.credential });
      // Successful sign-in consumes the nonce cookie; a later login needs a new one.
      googlePreparedAt = 0;
      showAccount(user);
    } catch {
      googleStatus.textContent = 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง หากยังไม่ได้ให้โหลดหน้าเว็บใหม่';
    } finally { googleButton.inert = false; }
  }

  function googleSetupFresh() {
    // Renew before the browser-bound nonce's one-hour cookie can expire.
    return googleInitialized && Date.now() - googlePreparedAt < 55 * 60 * 1000;
  }

  function setGoogleEntryPending(pending) {
    pending = pending && !authBrowser.embedded;
    const wasPending = authModal.classList.contains('google-button-pending');
    authModal.classList.toggle('google-button-pending', pending);
    accountDeck.inert = pending;
    if (wasPending && !pending && window.TD_Dialog.isTop(authModal) && document.activeElement === authModal) {
      authModal.querySelector('.cassette-tape-card.active-front')?.focus({ preventScroll: true });
    }
  }

  function renderGoogleButton() {
    if (!googleInitialized || !googleButton.clientWidth) return googleButtonReadyPromise;
    const width = Math.max(120, Math.min(280, Math.floor(googleButton.clientWidth)));
    if (width === googleButtonWidth && (googleButtonReady || cancelGoogleButtonWait)) return googleButtonReadyPromise;
    cancelGoogleButtonWait?.();
    googleButtonReady = false;
    googleButtonWidth = width;
    googleButtonReadyPromise = new Promise(resolve => {
      let frame = null, observer = null, finished = false;
      const timer = setTimeout(() => finish(false), 15000);
      function finish(ready) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        observer?.disconnect();
        frame?.removeEventListener('load', onLoad);
        frame?.removeEventListener('error', onError);
        cancelGoogleButtonWait = null;
        googleButtonReady = ready;
        resolve(ready);
      }
      const onLoad = () => finish(true);
      const onError = () => finish(false);
      cancelGoogleButtonWait = () => finish(false);
      function watchFrame() {
        frame = googleButton.querySelector('iframe');
        if (!frame) return false;
        observer?.disconnect();
        frame.addEventListener('load', onLoad, { once: true });
        frame.addEventListener('error', onError, { once: true });
        return true;
      }
      try {
        // Google's replacement frame may be inserted asynchronously. Remove the
        // previous frame so readiness always tracks the button being rendered.
        googleButton.innerHTML = '';
        window.google.accounts.id.renderButton(googleButton, {
          type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width, locale: 'th'
        });
        if (!watchFrame()) {
          if ('MutationObserver' in window) {
            observer = new MutationObserver(watchFrame);
            observer.observe(googleButton, { childList: true, subtree: true });
          } else finish(true);
        }
      } catch { finish(false); }
    });
    return googleButtonReadyPromise;
  }
  async function waitForGoogleButton() {
    renderGoogleButton();
    let pending, ready;
    do {
      pending = googleButtonReadyPromise;
      ready = await pending;
    } while (pending !== googleButtonReadyPromise);
    return ready;
  }

  async function prepareGoogleButton() {
    if (hasSession()) return true;
    if (authBrowser.embedded) return false;
    if (googleSetupFresh()) return waitForGoogleButton();
    if (!googleSetupPromise) {
      const revision = identityRevision;
      googleSetupPromise = (async () => {
        const [config] = await Promise.all([authRequest('config'), loadGoogleScript()]);
        if (revision !== identityRevision || hasSession()) return false;
        if (!googleInitialized || config.nonce !== googleConfig?.nonce || config.clientId !== googleConfig?.clientId) {
          cancelGoogleButtonWait?.();
          window.google.accounts.id.initialize({
            client_id: config.clientId, nonce: config.nonce,
            callback: receiveGoogleCredential, auto_select: false, ux_mode: 'popup'
          });
          googleInitialized = true;
          googleButtonWidth = 0;
          googleButtonReady = false;
        }
        googleConfig = config;
        googlePreparedAt = Date.now();
        return waitForGoogleButton();
      })().finally(() => { googleSetupPromise = null; });
    }
    return googleSetupPromise;
  }

  async function prepareSignedOutEntry() {
    const revision = identityRevision;
    googleStatus.textContent = '';
    if (authBrowser.embedded) {
      updateAuthBrowserHelp();
      setGoogleEntryPending(false);
      return;
    }
    setGoogleEntryPending(authModal.classList.contains('active') && (!googleSetupFresh() || !googleButtonReady));
    try {
      if (!await prepareGoogleButton()) throw new Error('Google button unavailable');
    } catch {
      if (revision === identityRevision) {
        googleStatus.textContent = 'เชื่อมต่อ Google ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง';
        browserHelpRequested = true;
        updateAuthBrowserHelp();
      }
    } finally {
      if (revision === identityRevision) setGoogleEntryPending(false);
    }
  }
  window.addEventListener('resize', renderGoogleButton);

  async function prepareAccount() {
    if (accountRequest) return accountRequest;
    let revision = identityRevision;
    googleStatus.textContent = '';
    accountRequest = (async () => {
      try {
        const { user } = await readSession();
        if (revision !== identityRevision) return;
        if (user) { showAccount(user, true); return; }
        if (currentUser) {
          resetAccountView();
          revision = identityRevision;
          if (googleInitialized) { window.location.reload(); return; }
        }
        await prepareSignedOutEntry();
        if (revision !== identityRevision) return;
      } catch {
        googleStatus.textContent = 'เชื่อมต่อ Google ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง';
      } finally {
        accountRequest = null;
        setGoogleEntryPending(false);
      }
    })();
    return accountRequest;
  }

  async function signOut() {
    try {
      await authRequest('logout', {});
      resetAccountView();
      window.google?.accounts?.id.disableAutoSelect();
      // A fresh page obtains a fresh nonce and initializes Google exactly once.
      window.location.reload();
    } catch { alert('ออกจากระบบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง'); }
  }

  // Populate Alumni Batch Select (1 - 37)
  if (alumniBatchSelect) {
    alumniBatchSelect.innerHTML = '<option value="" disabled selected>-- เลือกรุ่นที่จบ (รุ่นที่ 1 ถึง 37) --</option>';
    for (let b = 1; b <= 37; b++) {
      const opt = document.createElement('option');
      opt.value = String(b);
      opt.textContent = `เตรียมน้อม รุ่นที่ ${b}`;
      alumniBatchSelect.appendChild(opt);
    }
  }

  function openAuth(defaultTab = 'register', selection = null) {
    if (!authModal) return;
    closeAccountPanel();
    if (window.TD_Audio && window.TD_Audio.playCassetteClickSound) {
      window.TD_Audio.playCassetteClickSound();
    }
    if (selection && paymentSending) { selection = null; defaultTab = 'payment'; }
    if (selection) {
      invalidatePurchase();
      bookingRequested = true;
      preferredPackageId = selection.packageId;
      selectedShirtSize = ['S', 'M', 'L', 'XL', '2XL'].includes(selection.size) ? selection.size : 'L';
      selectedShirtColor = selection.color === 'beige' ? 'สีเนื้อ Sand Beige' : 'สีน้ำตาลเข้ม Espresso';
    }
    updateAuthBrowserHelp();
    setGoogleEntryPending(!hasSession() && (!googleSetupFresh() || !googleButtonReady));
    window.TD_Dialog.open(authModal);
    switchTape(defaultTab, false);
    if (hasSession()) resumeBooking();
    void prepareAccount();
  }

  function closeAuth() {
    if (!authModal?.classList.contains('active')) return;
    purchaseReview = null;
    pendingPhoneSelection = null;
    if (window.TD_Audio && window.TD_Audio.playCassetteClickSound) {
      window.TD_Audio.playCassetteClickSound();
    }
    window.TD_Dialog.close(authModal);
    setGoogleEntryPending(false);
  }

  // Decorative backs show the stack without exposing inactive forms or receipts.
  function updateCassetteStack(activeTab) {
    const previous = cassetteStackStage.dataset.activeTape || 'register';
    const names = { register: 'ACCOUNT', confirmation: 'CONFIRM', payment: 'PAYMENT', orders: 'MY ORDERS' };
    const choices = [...new Set([previous, 'orders', 'confirmation', 'payment', 'register'])].filter(tab => tab !== activeTab);
    cassetteStackStage.dataset.activeTape = activeTab;
    cassetteBackplates.forEach((backplate, index) => {
      backplate.dataset.tape = choices[index];
      backplate.querySelector('.cassette-back-label').textContent = names[choices[index]];
    });
  }

  function switchTape(tab, playSound = true) {
    let activeTab = 'register';
    if (tab === 'orders' && hasSession()) activeTab = 'orders';
    else if (hasSession() && hasCheckoutDetails() && selectedPackage?.role === currentUser.role) {
      if (tab === 'payment' && isPurchaseConfirmed()) activeTab = 'payment';
      else if (tab === 'confirmation' || tab === 'payment') activeTab = 'confirmation';
    }
    purchaseReview = null;
    if (activeTab === 'confirmation') renderPurchaseConfirmation();
    if (activeTab === 'orders') {
      tapeEOrdersView.hidden = Boolean(receiptOrder);
      tapeEReceiptView.hidden = !receiptOrder;
      document.getElementById('ordersAccountEmail').textContent = currentUser.email;
    }
    authModal.classList.toggle('account-entry-open', activeTab === 'register');
    updateCassetteStack(activeTab);
    if (playSound) window.TD_Audio?.playCassetteClickSound();
    [tapeB, tapeC, tapeD, tapeE].forEach(tape => {
      if (!tape) return;
      const active = tape.dataset.tape === activeTab;
      tape.classList.toggle('active-front', active);
      tape.hidden = !active;
      tape.inert = !active;
      tape.setAttribute('aria-hidden', String(!active));
      if (active && authModal.classList.contains('active')) {
        tape.setAttribute('tabindex', '-1'); tape.focus({ preventScroll: true }); authModal.scrollTop = 0;
      }
    });
    authModal.setAttribute('aria-label', activeTab === 'orders' ? (receiptOrder ? 'รายละเอียดคำสั่งซื้อและสถานะ' : 'ตรวจสอบคำสั่งซื้อ') : activeTab === 'payment' ? 'ชำระเงินและแนบสลิป' : activeTab === 'confirmation' ? 'ยืนยันรายการที่เลือก' : 'ข้อมูลบัญชี Google');
  }

  function resetAccountView() {
    if (currentUser) {
      identityRevision++;
      pendingPhoneSelection = null;
    }
    currentUser = null;
    savedProfile = null;
    bookingRequested = false;
    clearTimeout(sessionExpiryTimer);
    sessionExpiryTimer = null;
    updateAccountHeader(null);
    window.TD_Payphone?.syncAccount();
    receiptOrder = null;
    purchaseReview = confirmedPurchase = null;
    selectedPackage = null;
    pendingSubmission = null;
    resetOrderHistory();
    summarySlipThumbnail?.removeAttribute('src');
    resetSlipPreview();
    if (accountSignIn) accountSignIn.style.display = 'block';
    if (tapeBStepStudent) tapeBStepStudent.style.display = 'none';
    if (tapeBStepAlumni) tapeBStepAlumni.style.display = 'none';
    updateProfileActions();
    switchTape('register', false);
    setGoogleEntryPending(authModal.classList.contains('active') && (!googleSetupFresh() || !googleButtonReady));
  }
  btnStudentChangeAccount?.addEventListener('click', signOut);
  btnAlumniChangeAccount?.addEventListener('click', signOut);

  function purchaseSelection() {
    if (!hasSession() || !hasCheckoutDetails() || selectedPackage?.role !== currentUser.role) return null;
    return {
      accountId: currentUser.id, role: currentUser.role, fullname: currentUser.fullname, email: currentUser.email,
      packageId: selectedPackage.id, packageName: selectedPackage.name, description: selectedPackage.desc,
      price: selectedPackage.price, hasShirt: selectedPackage.hasShirt,
      shirtColor: selectedPackage.hasShirt ? selectedShirtColor : null,
      shirtSize: selectedPackage.hasShirt ? selectedShirtSize : null,
      details: currentUser.role === 'alumni' ? alumniDetails() : undefined
    };
  }

  function isPurchaseConfirmed() {
    const selection = purchaseSelection();
    return selection && confirmedPurchase?.signature === JSON.stringify(selection);
  }

  function isPaymentReady() {
    return authModal.classList.contains('active') && !tapeD.hidden && !receiptOrder && isPurchaseConfirmed();
  }

  function invalidatePurchase() {
    confirmedPurchase = null;
    purchaseReview = null;
    resetSlipPreview();
    pendingSubmission = null;
  }

  function deliveryDescription(selection) {
    return selection.role === 'alumni' ? 'จัดส่ง: ' + selection.details.address : 'รับของที่โรงเรียน (วันเวลาจะแจ้งให้ทราบ)';
  }

  function renderPurchaseConfirmation() {
    const selection = purchaseSelection();
    if (!selection) return;
    confirmedPurchase = null;
    purchaseReview = { ...selection, signature: JSON.stringify(selection), revision: identityRevision };
    document.getElementById('purchaseConfirmationRole').textContent = selection.role === 'student-current'
      ? 'ORDER CONFIRMATION // นักเรียนปัจจุบัน' : 'ORDER CONFIRMATION // ศิษย์เก่า';
    document.getElementById('confirmPackageName').textContent = selection.packageName;
    document.getElementById('confirmPackageDescription').textContent = selection.description;
    document.getElementById('confirmShirtRow').hidden = !selection.hasShirt;
    document.getElementById('confirmShirtOptions').textContent = selection.hasShirt ? selection.shirtColor + ' / ' + selection.shirtSize : '';
    document.getElementById('confirmBuyer').textContent = selection.fullname;
    document.getElementById('confirmEmail').textContent = selection.email;
    document.getElementById('confirmDelivery').textContent = deliveryDescription(selection);
    document.getElementById('confirmPurchaseTotal').textContent = '฿' + selection.price.toFixed(2);
    tapeCPriceTag.textContent = '฿' + selection.price + '.-';
    ppDynamicAmount.textContent = selection.price.toFixed(2);
  }

  btnConfirmPurchase.addEventListener('click', () => {
    if (paymentSending || !purchaseReview || tapeC.hidden || !authModal.classList.contains('active')) return;
    const selection = purchaseSelection();
    if (!selection || purchaseReview.revision !== identityRevision || purchaseReview.signature !== JSON.stringify(selection)) {
      purchaseReview = null;
      switchTape(selection ? 'confirmation' : 'register', false);
      return;
    }
    confirmedPurchase = { ...selection, signature: purchaseReview.signature };
    receiptOrder = null;
    tapeDPaymentView.style.display = 'flex';
    document.getElementById('tapeDBrandPrint').textContent = 'TRIAMDOD // PAYMENT';
    document.getElementById('tapeDBrandSub').textContent = '03 / QR PAYMENT & SLIP';
    document.getElementById('tapeDPriceTag').textContent = '฿' + selection.price + '.-';
    document.getElementById('paymentPurchaseName').textContent = selection.packageName;
    document.getElementById('paymentPurchaseOptions').textContent = selection.hasShirt ? selection.shirtColor + ' / ' + selection.shirtSize : 'จำนวน 1 ชุด';
    document.getElementById('paymentPurchaseBuyer').textContent = selection.fullname + ' · ' + deliveryDescription(selection);
    ppDynamicAmount.textContent = selection.price.toFixed(2);
    switchTape('payment');
  });
  btnEditPurchase.addEventListener('click', editPurchaseAtPhone);
  document.querySelectorAll('[data-close-auth]').forEach(button => button.addEventListener('click', closeAuth));

  // Students use verified account data immediately; alumni save delivery details.
  function saveProfileOrOpenPhone() {
    if (!hasSession()) {
      switchTape('register', false);
      void prepareAccount();
      return;
    }
    if (hasCheckoutDetails()) {
      const packages = window.TD_PACKAGES.filter(pkg => pkg.role === currentUser.role);
      const pkg = packages.find(item => item.id === preferredPackageId) || packages[0];
      if (!window.TD_Payphone) return;
      bookingRequested = false;
      closeAuth();
      window.TD_Payphone.openPayphoneModal(pkg.id, selectedShirtColor === 'สีเนื้อ Sand Beige' ? 'beige' : 'brown', selectedShirtSize);
      return;
    }
    const details = alumniDetails();
    if (Object.values(details).some(value => !value)) {
      updateProfileActions('กรุณากรอกชื่อ เบอร์โทรศัพท์ ที่อยู่จัดส่ง และรุ่นที่จบให้ครบ');
      return;
    }
    try {
      const record = window.TD_Profiles.save(currentUser, details);
      savedProfile = record;
      currentUser = { ...currentUser, ...details };
      updateProfileActions('บันทึกข้อมูลแล้ว สามารถไปเลือกแพ็กเกจที่ตู้โทรศัพท์ได้');
      resumeBooking();
    } catch {
      updateProfileActions('บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบข้อมูลและพื้นที่จัดเก็บ แล้วบันทึกอีกครั้ง');
    }
  }

  if (btnStudentProceedPackages) {
    btnStudentProceedPackages.addEventListener('click', () => {
      if (!hasSession() || currentUser.role !== 'student-current') {
        switchTape('register', false);
        void prepareAccount();
        return;
      }
      saveProfileOrOpenPhone();
    });
  }

  // Tape B Proceed to Tape C: Alumni Form
  if (alumniDetailsForm) {
    alumniDetailsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!hasSession() || currentUser.role !== 'alumni') {
        switchTape('register', false);
        void prepareAccount();
        return;
      }
      saveProfileOrOpenPhone();
    });
    alumniDetailsForm.addEventListener('input', () => updateProfileActions());
    alumniDetailsForm.addEventListener('change', () => updateProfileActions());
  }

  // Both edit buttons return to the booth with the current package and shirt choices.
  function editPurchaseAtPhone() {
    if (paymentSending || !hasSession()) return;
    invalidatePurchase();
    closeAuth();
    window.TD_Payphone?.openPayphoneModal(
      selectedPackage?.id,
      selectedShirtColor === 'สีเนื้อ Sand Beige' ? 'beige' : 'brown',
      selectedShirtSize
    );
  }
  btnBackToPayphone.addEventListener('click', editPurchaseAtPhone);

  // Resize before uploading, and release the temporary decoded image.
  function resetSlipPreview() {
    currentSlipDataUrl = null;
    slipReadId++;
    slipPreviewImg?.removeAttribute('src');
    if (regSlipInput) regSlipInput.value = '';
    if (slipEmptyState) slipEmptyState.style.display = 'flex';
    if (slipPreviewState) slipPreviewState.style.display = 'none';
    if (btnSubmitPayment) btnSubmitPayment.disabled = paymentSending;
  }

  async function handleSlipFile(file) {
    if (!isPaymentReady() || paymentSending) return;
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('กรุณาเลือกไฟล์ภาพสลิปที่ถูกต้อง (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert('กรุณาเลือกภาพสลิปขนาดไม่เกิน 8 MB');
      return;
    }

    const readId = ++slipReadId;
    const accountId = currentUser.id;
    if (btnSubmitPayment) btnSubmitPayment.disabled = true;
    try {
      const dataUrl = await window.TD_SlipImage.prepare(file, () => readId === slipReadId && currentUser?.id === accountId && isPaymentReady());
      if (readId !== slipReadId) return;
      currentSlipDataUrl = dataUrl;
      if (slipPreviewImg) slipPreviewImg.src = currentSlipDataUrl;
      if (slipFileName) slipFileName.textContent = file.name;
      if (slipEmptyState) slipEmptyState.style.display = 'none';
      if (slipPreviewState) slipPreviewState.style.display = 'flex';
      window.TD_Audio?.playCassetteClickSound();
    } catch (error) {
      if (readId === slipReadId && error.name !== 'AbortError') alert('ไม่สามารถเปิดภาพสลิปได้ กรุณาเลือกภาพใหม่');
    } finally {
      if (readId === slipReadId && btnSubmitPayment) btnSubmitPayment.disabled = paymentSending;
    }
  }

  if (regSlipInput) {
    regSlipInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleSlipFile(e.target.files[0]);
      }
    });
  }

  if (btnReselectSlip) {
    btnReselectSlip.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isPaymentReady() || paymentSending) return;
      resetSlipPreview();
      if (regSlipInput) regSlipInput.click();
    });
  }

  if (slipDropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      slipDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        slipDropzone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      slipDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        slipDropzone.classList.remove('drag-over');
      });
    });

    slipDropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleSlipFile(e.dataTransfer.files[0]);
      }
    });
  }

  // Submit Payment & Slip -> Pending Approval View
  if (btnSubmitPayment) {
    btnSubmitPayment.addEventListener('click', async () => {
      if (!hasSession() || !hasCheckoutDetails()) {
        switchTape('register', false);
        void prepareAccount();
        return;
      }
      if (!isPaymentReady()) { switchTape('confirmation', false); return; }
      if (!currentSlipDataUrl) {
        alert('กรุณาแนบภาพสลิปหลักฐานการโอนเงินก่อนส่งขออนุมัติครับ');
        if (slipDropzone) {
          slipDropzone.style.borderColor = '#ef4444';
          setTimeout(() => { slipDropzone.style.borderColor = ''; }, 1500);
        }
        return;
      }

      if (!currentUser || !selectedPackage) {
        alert('กรุณาเลือกแพ็กเกจให้เรียบร้อยก่อนชำระเงิน');
        return;
      }

      if (paymentSending || btnSubmitPayment.disabled || selectedPackage.role !== currentUser.role) return;
      const accountId = currentUser.id;
      const revision = identityRevision;
      const purchase = confirmedPurchase;
      const signature = JSON.stringify([purchase.signature, slipReadId]);
      if (pendingSubmission?.signature !== signature) pendingSubmission = { signature, requestId: crypto.randomUUID() };
      paymentSending = true;
      btnSubmitPayment.disabled = btnEditPurchase.disabled = btnConfirmPurchase.disabled = btnBackToPayphone.disabled = true;
      try {
        const { order } = await window.TD_API.request('/api/orders', {
          requestId: pendingSubmission.requestId, accountId, packageId: purchase.packageId,
          shirtColor: purchase.shirtColor, shirtSize: purchase.shirtSize, details: purchase.details, slipDataUrl: currentSlipDataUrl
        });
        // A completed request belongs to its original account even if another tab signs out.
        if (revision !== identityRevision || currentUser?.id !== accountId || !hasSession()) return;
        window.TD_Audio?.playCassetteClickSound();
        if (confirmedPurchase === purchase) showReceipt(order);
        resetSlipPreview();
        pendingSubmission = null;
      } catch (error) {
        if (revision !== identityRevision) return;
        if (error.status === 401) { resetAccountView(); void prepareAccount(); }
        alert(error.status ? error.message : 'ส่งคำขอไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วส่งอีกครั้ง หรือตรวจสอบคำสั่งซื้อของฉัน');
      } finally {
        paymentSending = false;
        btnSubmitPayment.disabled = btnEditPurchase.disabled = btnConfirmPurchase.disabled = btnBackToPayphone.disabled = false;
      }
    });
  }

  const orderLabels = { pending: 'รอตรวจสอบ', approved: 'อนุมัติแล้ว', rejected: 'ไม่ผ่านการตรวจสอบ' };

  function showReceipt(order) {
    if (!hasSession()) return;
    confirmedPurchase = null;
    purchaseReview = null;
    receiptOrder = order;
    const student = order.role === 'student-current';
    summaryFullname.textContent = order.fullname;
    summaryRole.textContent = student ? 'นักเรียนปัจจุบัน' : 'ศิษย์เก่า';
    summaryIdOrYear.textContent = student
      ? `เลขประจำตัว ${order.studentId || 'ยังไม่มีข้อมูล'} • ${studentClass(order)}`
      : `รุ่นที่ ${order.batch}`;
    summaryContact.textContent = student ? order.email : `${order.phone} (${order.email})`;
    summaryPackageChosen.textContent = `${order.packageName} (${order.price}.-)${order.hasShirt ? ` [${order.shirtColor} / ${order.shirtSize}]` : ''}`;
    summaryDeliveryNote.textContent = student ? 'รับของที่โรงเรียน (วันเวลาจะแจ้งให้ทราบ)' : `จัดส่ง: ${order.address}`;
    summaryPaidAmountText.textContent = `ยอดคำสั่งซื้อ ฿${order.price}.00 • ${orderLabels[order.status]}`;
    summarySlipThumbnail.src = order.slipUrl;
    summarySubmitTime.textContent = new Date(order.submittedAt).toLocaleString('th-TH');
    document.getElementById('summaryOrderId').textContent = order.id;
    document.getElementById('summaryOrderStatus').textContent = `STATUS: ${order.status.toUpperCase()} // ${orderLabels[order.status]}`;
    document.getElementById('summaryReviewNote').textContent = order.status === 'rejected'
      ? 'ไม่ผ่านการตรวจสอบ' + (order.rejectReason ? ' • ' + order.rejectReason : '')
      : order.status === 'approved' ? 'ตรวจแล้วผ่าน • คณะกรรมการอนุมัติการชำระเงินแล้ว' : 'รอคณะกรรมการสภานักเรียนตรวจสอบการชำระเงิน';
    tapeEReceiptView.setAttribute('data-status', order.status);
    document.getElementById('receiptStatusBadge').setAttribute('data-status', order.status);
    document.getElementById('tapeEBrandPrint').textContent = 'TRIAMDOD // ORDER RECEIPT';
    document.getElementById('tapeEBrandSub').textContent = 'ORDER STATUS';
    document.getElementById('tapeEInfoTag').textContent = '฿' + order.price + '.-';
    switchTape('orders', false);
  }

  function resetOrderHistory() {
    ordersRequestId++;
    ordersLoading = null;
    myOrdersList.textContent = '';
    myOrdersList.setAttribute('aria-busy', 'false');
    myOrdersStatus.textContent = '';
    myOrdersCount.textContent = 'คำสั่งซื้อของบัญชีนี้';
    myOrdersEmpty.hidden = true;
    btnLoadMyOrders.disabled = false;
    tapeEOrdersView.hidden = false;
    tapeEReceiptView.hidden = true;
    document.getElementById('ordersAccountEmail').textContent = '';
    summarySlipThumbnail.removeAttribute('src');
  }

  function openOrders() {
    if (!hasSession()) { resetAccountView(); openAuth(); return; }
    receiptOrder = null;
    document.getElementById('tapeEBrandPrint').textContent = 'TRIAMDOD // MY ORDERS';
    document.getElementById('tapeEBrandSub').textContent = 'ORDER HISTORY & STATUS';
    document.getElementById('tapeEInfoTag').textContent = 'MY ORDERS';
    switchTape('orders');
    void loadMyOrders();
  }

  async function loadMyOrders(force = false) {
    if (!hasSession() || (ordersLoading === identityRevision && !force)) return;
    const revision = identityRevision;
    const requestId = ++ordersRequestId;
    ordersLoading = revision;
    btnLoadMyOrders.disabled = true;
    myOrdersList.setAttribute('aria-busy', 'true');
    myOrdersEmpty.hidden = true;
    myOrdersStatus.textContent = 'กำลังโหลดคำสั่งซื้อ…';
    try {
      const result = await window.TD_API.request('/api/orders');
      if (revision !== identityRevision || requestId !== ordersRequestId || !hasSession()) return;
      myOrdersList.textContent = '';
      for (const order of result.orders) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'order-history-card';
        button.innerHTML = '<span class="order-history-heading"><strong class="order-history-package"></strong><span class="order-history-status"></span></span><span class="order-history-meta"><span class="order-history-id"></span><strong class="order-history-price"></strong></span><span class="order-history-date"></span>';
        button.querySelector('.order-history-package').textContent = order.packageName;
        const badge = button.querySelector('.order-history-status');
        badge.textContent = orderLabels[order.status];
        badge.setAttribute('data-status', order.status);
        button.querySelector('.order-history-id').textContent = order.id;
        button.querySelector('.order-history-price').textContent = '฿' + order.price.toFixed(2);
        button.querySelector('.order-history-date').textContent = new Date(order.submittedAt).toLocaleString('th-TH');
        button.addEventListener('click', () => {
          if (revision === identityRevision && hasSession()) showReceipt(order);
        });
        myOrdersList.appendChild(button);
      }
      const count = result.orders.length;
      myOrdersCount.textContent = result.nextCursor ? count + ' รายการล่าสุด' : count + ' รายการ';
      myOrdersEmpty.hidden = count !== 0;
      myOrdersStatus.textContent = !count ? 'ยังไม่มีคำสั่งซื้อของบัญชีนี้' : result.nextCursor
        ? 'แสดง 50 รายการล่าสุด • เลือกรายการเพื่อดูสลิปและสถานะ'
        : 'เลือกรายการเพื่อดูสลิปและสถานะ';
    } catch (error) {
      if (revision !== identityRevision || requestId !== ordersRequestId) return;
      if (error.status === 401) { resetAccountView(); void prepareAccount(); return; }
      myOrdersStatus.textContent = error.status ? error.message : 'โหลดคำสั่งซื้อไม่สำเร็จ กรุณาลองอีกครั้ง';
    } finally {
      if (requestId === ordersRequestId) {
        ordersLoading = null;
        btnLoadMyOrders.disabled = false;
        myOrdersList.setAttribute('aria-busy', 'false');
      }
    }
  }
  document.querySelectorAll('[data-open-orders]').forEach(button => button.addEventListener('click', openOrders));
  btnLoadMyOrders.addEventListener('click', () => void loadMyOrders());
  btnBackToOrders.addEventListener('click', openOrders);
  btnOrdersBackToAccount.addEventListener('click', () => switchTape('register'));

  // Global auth helpers
  navAuthButton?.addEventListener('click', () => {
    if (!hasSession()) {
      resetAccountView();
      openAuth();
      return;
    }
    const opening = navAuthButton.getAttribute('aria-expanded') !== 'true';
    navAccountPanel.hidden = !opening;
    navAuthButton.setAttribute('aria-expanded', String(opening));
  });
  document.getElementById('navAccountDetailsBtn')?.addEventListener('click', () => openAuth());
  document.getElementById('navAccountLogoutBtn')?.addEventListener('click', signOut);
  document.addEventListener('click', event => {
    if (compactNavigation?.matches && document.getElementById('navbarNavGroup')?.classList.contains('mobile-open')) return;
    if (!navAuthButton?.parentElement.contains(event.target)) closeAccountPanel();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (navAuthButton?.getAttribute('aria-expanded') === 'true') {
      closeAccountPanel();
      navAuthButton.focus();
      event.preventDefault();
    }
    if (window.TD_Dialog.isTop(authModal)) { event.preventDefault(); closeAuth(); }
  });
  // Restore the header, then quietly prepare sign-in only for signed-out visitors.
  void restoreSession();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void restoreSession();
  });

  openAuthBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openAuth();
    });
  });

  window.TD_Auth = {
    syncNavigation,
    openAuth,
    closeAuth,
    switchTape,
    getPackageRole: () => hasSession() ? currentUser.role : null,
    openForPhone(selection) {
      bookingRequested = false;
      openAuth();
      pendingPhoneSelection = selection;
      updateAuthBrowserHelp();
    }
  };

  if (closeAuthBtn) closeAuthBtn.addEventListener('click', closeAuth);
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeAuth();
    });
  }

  const pencilInputs = document.querySelectorAll('.pencil-input, .pencil-select');
  pencilInputs.forEach(input => {
    input.addEventListener('input', () => {
      const card = input.closest('.cassette-tape-card');
      if (card) {
        card.classList.add('spinning');
        clearTimeout(card._spinTimer);
        card._spinTimer = setTimeout(() => {
          card.classList.remove('spinning');
        }, 800);
      }
    });
  });

  const signInContinuation = window.TD_AuthBrowser.readSignIn(window.location.href, window.TD_PACKAGES.map(pkg => pkg.id));
  if (signInContinuation) {
    // The destination browser gets its own nonce and session. Only reopen the
    // account or booth; never transfer credentials or automatically submit orders.
    try { window.history.replaceState(window.history.state, '', signInContinuation.pageUrl); } catch {}
    if (signInContinuation.selection) window.TD_Auth.openForPhone(signInContinuation.selection);
    else openAuth();
  }

})();

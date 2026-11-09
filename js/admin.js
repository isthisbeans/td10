// Shared Cloudflare records; the Worker authorizes every read, image and review.
(function () {
  const byId = id => document.getElementById(id);
  const labels = { pending: 'รอตรวจสอบ', approved: 'อนุมัติแล้ว', rejected: 'ปฏิเสธสลิป' };
  const filterIds = ['filterStatus', 'filterRole', 'filterPackage'];
  let orders = [], nextCursor = null, currentCursor = null, cursorHistory = [];
  let inspected = null, loading = 0, listBusy = false, reviewing = false, searchTimer;
  let authorized = false, isOwner = false, userId = null, sessionEpoch = 0;
  let accessRevision = 0, statsRevision = 0, adminListRevision = 0, reviewRevision = 0;
  let inspectionRevision = 0, signingOut = false, refreshing = false, refreshRevision = 0;
  const money = (value, decimals = 2) => '฿' + Number(value).toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const time = value => new Date(value).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  const setText = (id, value) => { byId(id).textContent = value; };
  const message = error => error.status ? error.message : 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองอีกครั้ง';

  function closeInspector() {
    const orderId = inspected?.id;
    inspectionRevision++;
    inspected = null;
    byId('slipModal').classList.remove('active');
    byId('slipModal').setAttribute('aria-hidden', 'true');
    byId('slipInspectorImg').removeAttribute('src');
    byId('slipOriginalLink').removeAttribute('href');
    byId('rejectPanel').hidden = true;
    byId('slipInspectReviewerInfo').hidden = true;
    setText('slipInspectReviewer', '');
    setText('reviewHistoryStatus', '');
    byId('reviewHistoryList').textContent = '';
    byId('reviewHistoryList').hidden = true;
    byId('reviewHistoryList').setAttribute('aria-busy', 'false');
    byId('adminApp').inert = false;
    document.body.classList.remove('modal-open');
    if (authorized && orderId) {
      (document.querySelector('button[data-id="' + orderId + '"]') || byId('ordersHeading')).focus();
    }
  }
  function lock(text) {
    accessRevision++; sessionEpoch++; loading++; reviewRevision++; adminListRevision++;
    refreshRevision++; refreshing = false; byId('btnRefreshOrders').disabled = false;
    authorized = isOwner = false; userId = null; reviewing = listBusy = false;
    clearTimeout(searchTimer);
    orders = []; nextCursor = currentCursor = null; cursorHistory = [];
    closeInspector(); render();
    byId('adminApp').style.display = 'none';
    byId('ownerAccessPanel').hidden = true;
    byId('ownerAccessPanel').open = false;
    byId('adminAccessList').textContent = '';
    byId('adminAccountEmail').textContent = '';
    for (const id of ['slipInspectName', 'slipInspectMeta', 'slipInspectStudentInfo', 'slipInspectOrderId', 'ownerAccountLabel']) setText(id, '');
    byId('slipInspectStudentInfo').hidden = true;
    byId('adminLockScreen').style.display = 'flex';
    setText('adminAccessStatus', text);
  }
  function failure(error) {
    if ([401, 403].includes(error.status)) { lock(error.message); return; }
    setText('adminStatus', message(error));
    if (inspected) {
      setText('slipReviewStatus', message(error));
      byId('slipReviewStatus').classList.add('error-text');
    }
  }
  async function checkAccess() {
    if (signingOut) return;
    const revision = ++accessRevision;
    byId('btnAdminLogin').disabled = true;
    try {
      const { user } = await window.TD_API.request('/api/auth/session');
      if (revision !== accessRevision) return;
      if (user?.status !== 'admin') {
        lock(user ? 'บัญชีนี้ยังไม่ได้รับสิทธิ์ผู้ดูแล กรุณาติดต่อเจ้าของเว็บไซต์' : 'กรุณาเข้าสู่ระบบด้วย Google ที่หน้าเว็บหลัก แล้วกลับมาตรวจสอบสิทธิ์');
        return;
      }
      if (userId !== user.id || isOwner !== !!user.isOwner) {
        refreshRevision++; refreshing = false;
        sessionEpoch++; orders = []; cursorHistory = []; nextCursor = currentCursor = null;
        closeInspector(); render(); byId('adminAccessList').textContent = '';
      }
      userId = user.id; isOwner = !!user.isOwner; authorized = true;
      byId('adminLockScreen').style.display = 'none';
      byId('adminApp').style.display = 'block';
      byId('ownerAccessPanel').hidden = !isOwner;
      setText('adminAccountEmail', user.email || '');
      setText('ownerAccountLabel', isOwner ? 'เจ้าของบัญชี: ' + user.email : '');
      if (!reviewing) await refresh();
      if (isOwner && byId('ownerAccessPanel').open) void loadAccess().catch(accessFailure);
    } catch (error) {
      if (revision === accessRevision) lock('ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง');
    } finally { if (revision === accessRevision || !authorized) byId('btnAdminLogin').disabled = false; }
  }

  async function loadAccess() {
    if (!authorized || !isOwner) return;
    const epoch = sessionEpoch, revision = ++adminListRevision;
    setText('adminListStatus', 'กำลังโหลดผู้ดูแล…');
    let result;
    try { result = await window.TD_API.request('/api/admin/access'); }
    catch (error) {
      if (authorized && isOwner && epoch === sessionEpoch && revision === adminListRevision) throw error;
      return;
    }
    if (!authorized || !isOwner || epoch !== sessionEpoch || revision !== adminListRevision) return;
    setText('ownerAccountLabel', 'เจ้าของบัญชี: ' + result.owner);
    const list = byId('adminAccessList'); list.textContent = '';
    for (const item of result.admins) {
      const row = document.createElement('div'); row.className = 'admin-access-row';
      const label = document.createElement('span');
      label.textContent = item.email + ' · ' + (item.active ? 'ยืนยันบัญชีแล้ว' : 'รอเข้าสู่ระบบครั้งแรก');
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'btn btn-quiet'; remove.textContent = 'ลบสิทธิ์';
      remove.addEventListener('click', async () => {
        if (!confirm('ลบสิทธิ์ผู้ดูแลของ ' + item.email + '?')) return;
        remove.disabled = true;
        try { await window.TD_API.request('/api/admin/access/remove', { email: item.email }); await loadAccess(); }
        catch (error) { accessFailure(error); remove.disabled = false; }
      });
      row.appendChild(label); row.appendChild(remove); list.appendChild(row);
    }
    setText('adminListStatus', result.admins.length ? result.admins.length + ' บัญชี' : 'ยังไม่มีผู้ดูแลเพิ่มเติม');
  }
  function accessFailure(error) {
    if (!authorized) return;
    setText('adminListStatus', message(error));
    if ([401, 403].includes(error.status)) lock(error.message);
  }
  byId('ownerAccessPanel').addEventListener('toggle', () => {
    if (byId('ownerAccessPanel').open) void loadAccess().catch(accessFailure);
  });
  byId('adminAccessForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!authorized || !isOwner) return;
    byId('btnAddAdmin').disabled = true;
    try {
      await window.TD_API.request('/api/admin/access', { email: byId('adminEmailInput').value.trim() });
      byId('adminEmailInput').value = ''; await loadAccess();
    } catch (error) { accessFailure(error); }
    finally { byId('btnAddAdmin').disabled = false; }
  });

  function textNode(parent, value, className) {
    const span = document.createElement('span'); span.className = className;
    span.textContent = value; parent.appendChild(span); return span;
  }
  function cell(row, className) {
    const td = document.createElement('td'); td.className = className;
    row.appendChild(td); return td;
  }
  function renderReviewer(container, order) {
    container.textContent = '';
    if (order.status === 'pending') return;
    const action = order.status === 'approved' ? 'อนุมัติโดย ' : 'ปฏิเสธโดย ';
    textNode(container, order.reviewerEmail ? action + order.reviewerEmail : 'ไม่พบข้อมูลผู้ตรวจสอบ', 'reviewer-email');
    if (order.reviewedAt) {
      const reviewedAt = document.createElement('time');
      reviewedAt.className = 'reviewed-time'; reviewedAt.dateTime = order.reviewedAt;
      reviewedAt.textContent = time(order.reviewedAt); container.appendChild(reviewedAt);
    }
  }
  function renderStudentInfo(container, order, compact = false) {
    container.textContent = '';
    container.hidden = order.role !== 'student-current';
    if (container.hidden) return;
    container.className = 'student-info-grid' + (compact ? ' student-info-compact' : '');
    const grade = order.grade ? (/^\d+$/.test(order.grade) ? 'ม.' + order.grade : order.grade) : null;
    for (const [label, value] of [[compact ? 'รหัส' : 'รหัสนักเรียน', order.studentId], ['ชั้น', grade], ['ห้อง', order.room], ['เลขที่', order.studentNumber]]) {
      const field = document.createElement('div');
      const term = document.createElement('dt'); term.textContent = label;
      const detail = document.createElement('dd'); detail.textContent = value || '—';
      if (!value) detail.title = 'ยังไม่มีข้อมูล';
      field.appendChild(term); field.appendChild(detail); container.appendChild(field);
    }
  }
  function syncFilters() {
    const status = byId('filterStatus').value || 'all';
    for (const button of document.querySelectorAll('button[data-status]')) button.setAttribute('aria-pressed', String(button.getAttribute('data-status') === status));
    byId('btnClearFilters').hidden = !byId('adminSearchInput').value.trim() && filterIds.every(id => !byId(id).value || byId(id).value === 'all');
  }
  function syncListControls() {
    byId('btnPrevOrders').disabled = listBusy || reviewing || !cursorHistory.length;
    byId('btnNextOrders').disabled = listBusy || reviewing;
    byId('btnExportCsv').disabled = listBusy || !orders.length;
    byId('ordersTableSection').setAttribute('aria-busy', String(listBusy));
    for (const button of byId('ordersTableBody').querySelectorAll('button')) button.disabled = listBusy || reviewing;
  }
  function render() {
    const body = byId('ordersTableBody'); body.textContent = '';
    byId('ordersTableSection').hidden = !orders.length && !cursorHistory.length;
    for (const order of orders) {
      const row = document.createElement('tr');
      const buyer = cell(row, 'user-cell-name');
      textNode(buyer, order.fullname, 'cell-primary');
      textNode(buyer, order.email, 'cell-secondary');
      if (order.role === 'student-current') {
        const academic = document.createElement('dl');
        academic.setAttribute('aria-label', 'ข้อมูลนักเรียน');
        renderStudentInfo(academic, order, true); buyer.appendChild(academic);
      } else textNode(buyer, 'ศิษย์เก่า · รุ่น ' + order.batch, 'cell-secondary');
      const pack = cell(row, 'cell-package');
      textNode(pack, order.packageName, 'cell-primary');
      if (order.hasShirt) textNode(pack, order.shirtColor + ' / ' + order.shirtSize, 'cell-secondary');
      const amount = cell(row, 'price-cell-val');
      textNode(amount, money(order.price), 'cell-primary');
      textNode(amount, time(order.submittedAt), 'cell-secondary');
      textNode(amount, order.id.slice(0, 13), 'cell-secondary cell-reference').title = order.id;
      const status = cell(row, 'cell-status');
      const badge = textNode(status, labels[order.status], 'status-pill status-' + order.status);
      badge.title = order.rejectReason || '';
      if (order.rejectReason) textNode(status, order.rejectReason, 'rejection-note').title = order.rejectReason;
      if (order.status !== 'pending') {
        const reviewer = document.createElement('div'); reviewer.className = 'reviewer-note';
        renderReviewer(reviewer, order); status.appendChild(reviewer);
      }
      const actions = cell(row, 'cell-action');
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'btn btn-view-slip' + (order.status === 'pending' ? ' btn-primary' : '');
      button.textContent = order.status === 'pending' ? 'ตรวจสอบ' : 'เปลี่ยนสถานะ';
      button.setAttribute('data-action', 'view'); button.setAttribute('data-id', order.id);
      button.setAttribute('aria-label', button.textContent + ' · ' + order.fullname);
      actions.appendChild(button); body.appendChild(row);
    }
    setText('tableCountInfo', orders.length + ' รายการในหน้านี้ · ล่าสุดก่อน · สรุปด้านบนรวมทุกหน้า');
    setText('ordersPageInfo', 'หน้า ' + (cursorHistory.length + 1));
    byId('btnNextOrders').hidden = !nextCursor;
    byId('ordersPagination').hidden = !nextCursor && !cursorHistory.length;
    syncFilters(); syncListControls();
  }
  function query(cursor) {
    const params = new URLSearchParams();
    for (const [id, key] of [['filterStatus', 'status'], ['filterRole', 'role'], ['filterPackage', 'package']]) {
      const value = byId(id).value;
      if (value && value !== 'all') params.set(key, value);
    }
    const q = byId('adminSearchInput').value.trim(); if (q) params.set('q', q);
    if (cursor) params.set('cursor', cursor);
    return '/api/admin/orders?' + params;
  }
  async function loadOrders(cursor = null, navigation = 'reset') {
    if (!authorized) return false;
    const revision = ++loading, epoch = sessionEpoch;
    listBusy = true; syncFilters(); syncListControls();
    setText('adminStatus', 'กำลังโหลดคำสั่งซื้อ…');
    try {
      const result = await window.TD_API.request(query(cursor));
      if (revision !== loading || !authorized || epoch !== sessionEpoch) return false;
      if (navigation === 'next') cursorHistory.push(currentCursor);
      else if (navigation === 'previous') cursorHistory.pop();
      else if (navigation === 'reset') cursorHistory = [];
      currentCursor = cursor; orders = result.orders; nextCursor = result.nextCursor;
      render();
      setText('adminStatus', orders.length ? '' : 'ไม่พบคำสั่งซื้อ');
      setText('adminUpdatedAt', 'อัปเดต ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
      return true;
    } catch (error) {
      if (revision === loading && epoch === sessionEpoch) {
        orders = []; nextCursor = null; render(); failure(error);
      }
      return false;
    } finally {
      if (revision === loading && epoch === sessionEpoch) { listBusy = false; syncListControls(); }
    }
  }
  async function loadStats() {
    if (!authorized) return;
    const epoch = sessionEpoch, revision = ++statsRevision;
    const summary = await window.TD_API.request('/api/admin/stats');
    if (!authorized || epoch !== sessionEpoch || revision !== statsRevision) return;
    setText('kpiTotalRevenue', money(summary.revenue, 0)); setText('kpiTotalOrders', summary.total);
    setText('kpiPendingOrders', summary.pending); setText('kpiRejectedOrders', summary.rejected);
    setText('kpiOrdersRatioMeta', 'นักเรียน ' + summary.students + ' · ศิษย์เก่า ' + summary.alumni);
    let total = 0;
    for (const [name, color] of [['Brown', 'สีน้ำตาลเข้ม Espresso'], ['Beige', 'สีเนื้อ Sand Beige']]) {
      let count = 0;
      for (const size of ['S', 'M', 'L', 'XL', '2XL']) {
        const quantity = summary.shirts.find(item => item.color === color && item.size === size)?.count || 0;
        setText('cnt' + name + size, quantity); count += quantity;
      }
      setText('sum' + name + 'Total', count + ' ตัว'); total += count;
    }
    setText('kpiTotalShirts', 'อนุมัติแล้ว ' + total + ' ตัว');
  }
  async function refresh() {
    if (!authorized || refreshing) return;
    refreshing = true; clearTimeout(searchTimer);
    const revision = ++refreshRevision;
    byId('btnRefreshOrders').disabled = true;
    const epoch = sessionEpoch;
    try {
      const results = await Promise.allSettled([loadOrders(currentCursor, 'stay'), loadStats()]);
      if (authorized && epoch === sessionEpoch) for (const result of results) if (result.status === 'rejected') failure(result.reason);
    } finally {
      if (revision === refreshRevision) { refreshing = false; byId('btnRefreshOrders').disabled = false; }
    }
  }

  function syncReviewControls() {
    const index = orders.findIndex(order => order.id === inspected?.id);
    byId('btnInspectApprove').disabled = reviewing || !inspected || inspected.status === 'approved';
    byId('btnInspectReject').disabled = reviewing || !inspected || inspected.status === 'rejected';
    byId('btnConfirmReject').disabled = reviewing || !inspected;
    byId('btnPreviousSlip').disabled = reviewing || index <= 0;
    byId('btnNextSlip').disabled = reviewing || index < 0 || index >= orders.length - 1;
    byId('autoNextReview').disabled = reviewing;
    byId('rejectReasonTextarea').disabled = reviewing;
    for (const button of document.querySelectorAll('.btn-quick-reason')) button.disabled = reviewing;
  }
  function renderInspectionOrder(order) {
    byId('slipInspectorImg').src = order.slipUrl;
    byId('slipOriginalLink').setAttribute('href', order.slipUrl);
    setText('slipInspectName', order.fullname); setText('slipInspectOrderId', order.id);
    setText('slipInspectMeta', order.email + '\n' + (order.role === 'alumni' ? 'ศิษย์เก่า รุ่น ' + order.batch + '\n' + order.phone + '\n' + order.address : 'นักเรียนปัจจุบัน'));
    renderStudentInfo(byId('slipInspectStudentInfo'), order);
    setText('slipInspectPackage', order.packageName + (order.hasShirt ? ' · ' + order.shirtColor + ' / ' + order.shirtSize : ''));
    setText('slipInspectAmount', money(order.price)); setText('slipInspectTime', time(order.submittedAt));
    setText('slipInspectStatus', labels[order.status] + (order.rejectReason ? ': ' + order.rejectReason : ''));
    byId('slipInspectReviewerInfo').hidden = order.status === 'pending';
    renderReviewer(byId('slipInspectReviewer'), order);
    setText('btnInspectApprove', order.status === 'approved' ? 'อนุมัติแล้ว' : order.status === 'rejected' ? 'เปลี่ยนเป็นอนุมัติ' : 'อนุมัติ');
    setText('btnInspectReject', order.status === 'rejected' ? 'ปฏิเสธแล้ว' : order.status === 'approved' ? 'เปลี่ยนเป็นปฏิเสธ' : 'ปฏิเสธสลิป');
    const index = orders.findIndex(item => item.id === order.id);
    setText('slipPosition', index < 0 ? 'นอกตัวกรอง' : (index + 1) + ' / ' + orders.length);
  }
  async function loadInspectionDetails(order) {
    const epoch = sessionEpoch, revision = inspectionRevision, reviewTicket = reviewRevision;
    const current = () => authorized && epoch === sessionEpoch && revision === inspectionRevision && reviewTicket === reviewRevision && inspected?.id === order.id;
    const list = byId('reviewHistoryList');
    list.textContent = ''; list.hidden = true; list.setAttribute('aria-busy', 'true');
    setText('reviewHistoryStatus', 'กำลังโหลดประวัติการตรวจสอบ…');
    byId('reviewHistoryStatus').classList.remove('error-text');
    try {
      const result = await window.TD_API.request('/api/orders/' + order.id);
      if (!current()) return;
      // A detail read must not overwrite a newer order loaded while the modal was open.
      const listed = orders.find(item => item.id === order.id);
      if (result.order.version < Math.max(inspected.version, listed?.version ?? 0)) {
        setText('reviewHistoryStatus', 'ข้อมูลเปลี่ยนแปลงแล้ว กรุณาเปิดคำสั่งซื้ออีกครั้ง');
        return;
      }
      if (result.order.version !== inspected.version) byId('rejectPanel').hidden = true;
      inspected = result.order;
      const selectedStatus = byId('filterStatus').value;
      orders = orders.map(item => item.id === order.id ? result.order : item)
        .filter(item => !selectedStatus || selectedStatus === 'all' || item.status === selectedStatus);
      render(); renderInspectionOrder(inspected); syncReviewControls();
      for (const review of result.reviews) {
        const item = document.createElement('li');
        textNode(item, labels[review.status] || review.status, 'status-pill status-' + review.status);
        textNode(item, review.reviewer_email || 'ไม่พบข้อมูลผู้ตรวจสอบ', 'review-history-email');
        const reviewedAt = document.createElement('time');
        reviewedAt.dateTime = review.created_at; reviewedAt.textContent = time(review.created_at);
        item.appendChild(reviewedAt);
        if (review.reason) textNode(item, review.reason, 'review-history-reason');
        list.appendChild(item);
      }
      list.hidden = !result.reviews.length;
      setText('reviewHistoryStatus', result.reviews.length ? '' : 'ยังไม่มีประวัติการตรวจสอบ');
    } catch (error) {
      if (!current()) return;
      if ([401, 403].includes(error.status)) { failure(error); return; }
      setText('reviewHistoryStatus', 'โหลดประวัติการตรวจสอบไม่สำเร็จ กรุณาเปิดคำสั่งซื้ออีกครั้ง');
      byId('reviewHistoryStatus').classList.add('error-text');
    } finally {
      if (current()) list.setAttribute('aria-busy', 'false');
    }
  }
  function inspect(order) {
    if (!authorized) return;
    inspectionRevision++; inspected = order;
    renderInspectionOrder(order);
    byId('rejectPanel').hidden = true; byId('rejectReasonTextarea').value = '';
    byId('rejectReasonTextarea').removeAttribute('aria-invalid'); setText('rejectReasonError', '');
    setText('slipReviewStatus', ''); byId('slipReviewStatus').classList.remove('error-text');
    syncReviewControls();
    byId('slipModal').classList.add('active'); byId('slipModal').setAttribute('aria-hidden', 'false');
    byId('adminApp').inert = true; document.body.classList.add('modal-open');
    byId('slipModal').querySelector('.admin-modal-card').scrollTop = 0;
    byId('btnCloseSlipModal').focus();
    void loadInspectionDetails(order);
  }
  function moveSlip(direction) {
    if (reviewing) return;
    const index = orders.findIndex(order => order.id === inspected?.id);
    if (index >= 0 && orders[index + direction]) inspect(orders[index + direction]);
  }
  async function review(order, status, reason = '') {
    if (!authorized || reviewing || order.status === status) return;
    const epoch = sessionEpoch, ticket = ++reviewRevision, inspection = inspectionRevision;
    const index = orders.findIndex(item => item.id === order.id);
    const queue = [...orders.slice(index + 1), ...orders.slice(0, index)].filter(item => item.status === 'pending');
    const advance = order.status === 'pending' && byId('autoNextReview').checked;
    reviewing = true; syncReviewControls(); syncListControls();
    setText('slipReviewStatus', 'กำลังบันทึก…'); byId('slipReviewStatus').classList.remove('error-text');
    try {
      const result = await window.TD_API.request('/api/admin/orders/' + order.id + '/review', { status, reason, version: order.version });
      if (!authorized || epoch !== sessionEpoch) return;
      const needsReload = listBusy;
      // Invalidate list reads started before this write, so they cannot restore an old status.
      loading++; listBusy = false;
      const selectedStatus = byId('filterStatus').value;
      orders = orders.map(item => item.id === order.id ? result.order : item)
        .filter(item => !selectedStatus || selectedStatus === 'all' || item.status === selectedStatus);
      render();
      if (needsReload || (!orders.length && nextCursor)) await loadOrders(currentCursor, 'stay');
      if (!authorized || epoch !== sessionEpoch) return;
      const next = advance && (queue.map(item => orders.find(current => current.id === item.id && current.status === 'pending')).find(Boolean) || orders.find(item => item.status === 'pending'));
      if (inspection === inspectionRevision) {
        if (next) inspect(next);
        else closeInspector();
      }
      setText('adminStatus', 'บันทึกแล้ว · ' + order.fullname + ' · ' + labels[result.order.status]);
      // The write returns the current order. Only the small global totals need another read.
      void loadStats().catch(error => { if (epoch === sessionEpoch) failure(error); });
    } catch (error) {
      if (!authorized || epoch !== sessionEpoch) return;
      if (error.status === 409) { closeInspector(); await refresh(); }
      failure(error);
      if (inspected?.id === order.id && inspection === inspectionRevision) void loadInspectionDetails(inspected);
    } finally {
      if (ticket === reviewRevision) { reviewing = false; syncReviewControls(); syncListControls(); }
    }
  }

  byId('ordersTableBody').addEventListener('click', event => {
    const button = event.target.closest('button[data-id]');
    const order = orders.find(item => item.id === button?.getAttribute('data-id'));
    if (order && !reviewing && !listBusy) inspect(order);
  });
  byId('btnInspectApprove').addEventListener('click', () => { if (inspected) void review(inspected, 'approved'); });
  byId('btnInspectReject').addEventListener('click', () => {
    if (!inspected || reviewing || inspected.status === 'rejected') return;
    byId('rejectPanel').hidden = false; byId('rejectReasonTextarea').focus();
  });
  byId('btnCancelReject').addEventListener('click', () => { byId('rejectPanel').hidden = true; byId('btnInspectReject').focus(); });
  byId('btnConfirmReject').addEventListener('click', () => {
    const reason = byId('rejectReasonTextarea').value.trim();
    if (!reason) {
      setText('rejectReasonError', 'กรุณาระบุเหตุผล');
      byId('rejectReasonTextarea').setAttribute('aria-invalid', 'true');
      byId('rejectReasonTextarea').focus(); return;
    }
    if (inspected) void review(inspected, 'rejected', reason);
  });
  byId('rejectReasonTextarea').addEventListener('input', () => {
    setText('rejectReasonError', ''); byId('rejectReasonTextarea').removeAttribute('aria-invalid');
  });
  for (const button of document.querySelectorAll('.btn-quick-reason')) button.addEventListener('click', () => {
    byId('rejectReasonTextarea').value = button.dataset.reason;
    setText('rejectReasonError', ''); byId('rejectReasonTextarea').removeAttribute('aria-invalid');
  });
  byId('btnPreviousSlip').addEventListener('click', () => moveSlip(-1));
  byId('btnNextSlip').addEventListener('click', () => moveSlip(1));
  byId('btnCloseSlipModal').addEventListener('click', closeInspector);
  byId('slipModal').addEventListener('click', event => { if (event.target === byId('slipModal')) closeInspector(); });
  document.addEventListener('keydown', event => {
    if (!inspected) return;
    if (event.key === 'Escape') {
      if (!byId('rejectPanel').hidden) { byId('rejectPanel').hidden = true; byId('btnInspectReject').focus(); }
      else closeInspector();
    }
    if (event.key === 'Tab') {
      const controls = [...byId('slipModal').querySelectorAll('button, a[href], input, textarea')]
        .filter(node => !node.disabled && !node.closest('[hidden]') && (!node.getClientRects || node.getClientRects().length));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  function applyFilters() { clearTimeout(searchTimer); syncFilters(); void loadOrders(); }
  for (const id of filterIds) byId(id).addEventListener('change', applyFilters);
  for (const button of document.querySelectorAll('button[data-status]')) button.addEventListener('click', () => {
    byId('filterStatus').value = button.getAttribute('data-status'); applyFilters();
  });
  byId('adminSearchInput').addEventListener('input', () => {
    clearTimeout(searchTimer); syncFilters(); searchTimer = setTimeout(() => void loadOrders(), 250);
  });
  byId('btnClearFilters').addEventListener('click', () => {
    for (const id of filterIds) byId(id).value = 'all';
    byId('adminSearchInput').value = ''; applyFilters();
  });
  byId('btnRefreshOrders').addEventListener('click', () => void refresh());
  byId('btnNextOrders').addEventListener('click', () => void loadOrders(nextCursor, 'next'));
  byId('btnPrevOrders').addEventListener('click', () => void loadOrders(cursorHistory[cursorHistory.length - 1], 'previous'));
  byId('btnAdminLogin').addEventListener('click', () => void checkAccess());
  byId('btnLogoutAdmin').addEventListener('click', async () => {
    if (signingOut) return;
    signingOut = true; lock('กำลังออกจากระบบ…');
    try { await window.TD_API.request('/api/auth/logout', {}); lock('ออกจากระบบแล้ว'); }
    catch (error) { lock('ออกจากระบบไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง'); }
    finally { signingOut = false; }
  });
  byId('btnExportCsv').addEventListener('click', () => {
    function csv(value) {
      let text = String(value ?? '');
      if (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    }
    const rows = [['ID','ชื่อ','อีเมล','ประเภท','เลขประจำตัวนักเรียน','ชั้น','ห้อง','เลขที่','โทร','ที่อยู่','รุ่น','แพ็กเกจ','ยอด','สี','ไซส์','สถานะ','เหตุผล','เวลาส่ง','อีเมลผู้ตรวจสอบล่าสุด','เวลาตรวจสอบล่าสุด'],
      ...orders.map(order => [order.id,order.fullname,order.email,order.role,order.studentId,order.grade,order.room,order.studentNumber,order.phone,order.address,order.batch,order.packageName,order.price,order.shirtColor,order.shirtSize,order.status,order.rejectReason,order.submittedAt,order.reviewerEmail,order.reviewedAt])];
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(csv).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'triamdod-orders-page.csv';
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void checkAccess(); });
  void checkAccess();
})();

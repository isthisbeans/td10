// Local alumni delivery profiles, isolated by the server-verified Google subject. These
// records hold contact details; they never establish identity or account roles.
(function () {
  'use strict';
  const key = user => `td10_profile_${encodeURIComponent(user.id)}`;

  function valid(user, record) {
    if (!record || record.accountId !== user.id || record.role !== user.role ||
        typeof record.fullname !== 'string' || !record.fullname.trim() || record.fullname.length > 200 ||
        typeof record.savedAt !== 'string') return false;
    return user.role === 'alumni' &&
      typeof record.phone === 'string' && record.phone.trim().length > 0 && record.phone.length <= 50 &&
      typeof record.address === 'string' && record.address.trim().length > 0 && record.address.length <= 1000 &&
      typeof record.batch === 'string' &&
      /^(?:[1-9]|[12][0-9]|3[0-7])$/.test(record.batch);
  }

  function load(user) {
    const raw = localStorage.getItem(key(user));
    if (!raw) return null;
    const record = JSON.parse(raw);
    return valid(user, record) ? record : null;
  }

  function save(user, details = {}) {
    const record = {
      accountId: user.id, role: user.role, email: user.email,
      fullname: details.fullname,
      savedAt: new Date().toISOString()
    };
    record.phone = details.phone;
    record.address = details.address;
    record.batch = details.batch;
    if (!valid(user, record)) throw new Error('Invalid profile details');
    // Failed writes must reach the caller, so it cannot show a false success.
    localStorage.setItem(key(user), JSON.stringify(record));
    return record;
  }

  window.TD_Profiles = { load, save };
})();

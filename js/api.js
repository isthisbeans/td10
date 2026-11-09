// All shared records go through the same-origin Worker; credentials stay HttpOnly.
(function () {
  async function request(path, body) {
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000)
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error || 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองอีกครั้ง');
      error.status = response.status;
      throw error;
    }
    return result;
  }
  window.TD_API = { request };
})();

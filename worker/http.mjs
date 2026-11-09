export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function json(body, status = 200, setCookies = []) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  for (const value of setCookies) headers.append('Set-Cookie', value);
  return new Response(JSON.stringify(body), { status, headers });
}

export function checkOrigin(request, env) {
  const url = new URL(request.url);
  const local = url.hostname === 'localhost' && url.protocol === 'http:';
  if (!env.GOOGLE_CLIENT_ID || !env.APP_ORIGIN) throw new HttpError(503, 'Sign-in is not configured');
  if (!local && url.origin !== env.APP_ORIGIN) throw new HttpError(403, 'Unrecognized site origin');
  if (request.method === 'POST' && (request.headers.get('origin') !== url.origin ||
      request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')) {
    throw new HttpError(403, 'Same-origin JSON request required');
  }
}

// Bound streamed bodies as well as Content-Length before parsing JSON.
export async function readJson(request, limit) {
  if (Number(request.headers.get('content-length')) > limit) throw new HttpError(413, 'Request too large');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Missing request body');
  let text = '', bytes = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new HttpError(413, 'Request too large'); }
      text += decoder.decode(value, { stream: true });
    }
    const body = JSON.parse(text + decoder.decode());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch (error) {
    if (error.status) throw error;
    throw new HttpError(400, 'Invalid JSON');
  } finally { reader.releaseLock(); }
}

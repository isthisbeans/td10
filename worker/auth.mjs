// Google ID tokens are the short-lived, HttpOnly session credential. No refresh
// token, OAuth client secret, or browser token storage is needed.
import { HttpError as AuthError, json, checkOrigin, readJson } from './http.mjs';
import { adminAccess } from './admin-access.mjs';
import { studentInfo } from './student-info.mjs';
const GOOGLE_KEYS = 'https://www.googleapis.com/oauth2/v3/certs';
let keyCache;
let pendingKeys;
// Keys are tied to the cached certificate objects, so expired certificates and
// their imported keys can be collected together. Tokens are always reverified.
const importedKeys = new WeakMap();

function decode(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new AuthError(401, 'Invalid Google credential');
  return Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

async function googleKeys() {
  if (keyCache && keyCache.until > Date.now()) return keyCache.keys;
  if (!pendingKeys) {
    pendingKeys = (async () => {
      const response = await fetch(GOOGLE_KEYS, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Google key service unavailable');
      const { keys } = await response.json();
      if (!Array.isArray(keys) || !keys.length) throw new Error('Invalid Google key response');
      const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 300);
      keyCache = { keys, until: Date.now() + Math.min(maxAge, 86400) * 1000 };
      return keys;
    })().finally(() => { pendingKeys = null; });
  }
  return pendingKeys;
}

export async function verifyGoogleToken(token, clientId, nonce) {
  if (typeof token !== 'string' || token.length > 3800) throw new AuthError(401, 'Invalid Google credential');
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError(401, 'Invalid Google credential');
  let header, claims, signature;
  try {
    header = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(parts[0])));
    claims = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(parts[1])));
    signature = decode(parts[2]);
  } catch { throw new AuthError(401, 'Invalid Google credential'); }
  const now = Math.floor(Date.now() / 1000);
  if (header?.alg !== 'RS256' || typeof header.kid !== 'string' || header.crit ||
      !claims || claims.aud !== clientId || (claims.azp && claims.azp !== clientId) ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) ||
      !Number.isInteger(claims.exp) || claims.exp <= now ||
      !Number.isInteger(claims.iat) || claims.iat > now + 60 || claims.exp > claims.iat + 7200 ||
      (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > now)) ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255 ||
      claims.email_verified !== true || typeof claims.email !== 'string' || !claims.email.includes('@') ||
      (nonce !== undefined && claims.nonce !== nonce)) {
    throw new AuthError(401, 'Invalid or expired Google credential');
  }
  const jwk = (await googleKeys()).find(key => key.kid === header.kid && key.kty === 'RSA' && key.alg === 'RS256' && key.use === 'sig');
  if (!jwk) throw new AuthError(401, 'Unknown Google signing key');
  let pendingKey = importedKeys.get(jwk);
  if (!pendingKey) {
    pendingKey = crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
      .catch(error => { importedKeys.delete(jwk); throw error; });
    importedKeys.set(jwk, pendingKey);
  }
  const key = await pendingKey;
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new AuthError(401, 'Invalid Google signature');
  return claims;
}

async function profile(claims, env) {
  // A verified Workspace domain determines the school flow. A Google display
  // name/email does not prove a grade, student number, or alumni membership.
  const role = claims.hd === 'tun.ac.th' && claims.email.toLowerCase().endsWith('@tun.ac.th') ? 'student-current' : 'alumni';
  const access = await adminAccess(claims, env);
  return {
    id: claims.sub,
    fullname: typeof claims.name === 'string' ? claims.name : claims.email,
    email: claims.email,
    role,
    ...studentInfo(claims),
    status: access.admin ? 'admin' : role,
    isOwner: access.isOwner,
    expiresAt: claims.exp * 1000
  };
}

function sessionCookies(request) {
  const url = new URL(request.url);
  const local = url.hostname === 'localhost' && url.protocol === 'http:';
  const prefix = local ? 'td10_' : '__Host-td10_';
  const cookie = (name, value, age) => `${prefix}${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${local ? '' : '; Secure'}`;
  const cookies = Object.fromEntries((request.headers.get('cookie') || '').split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1)];
  }));
  return { prefix, cookies, cookie };
}

export async function requireUser(request, env) {
  checkOrigin(request, env);
  const { prefix, cookies } = sessionCookies(request);
  const token = cookies[`${prefix}session`];
  if (!token) throw new AuthError(401, 'กรุณาเข้าสู่ระบบด้วย Google ก่อน');
  return profile(await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID), env);
}

export async function handleAuth(request, env) {
  const url = new URL(request.url);
  const { prefix, cookies, cookie } = sessionCookies(request);
  try {
    checkOrigin(request, env);
    const method = request.method;
    const route = url.pathname;
    if (!['GET', 'POST'].includes(method)) return json({ error: 'Method not allowed' }, 405);
    if (route === '/api/auth/config' && method === 'GET') {
      // Bind the Google response to this browser, including login CSRF protection.
      const existing = cookies[`${prefix}nonce`];
      const nonce = /^[a-f0-9]{64}$/.test(existing || '') ? existing : [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
      return json({ clientId: env.GOOGLE_CLIENT_ID, nonce }, 200, [cookie('nonce', nonce, 3600)]);
    }
    if (route === '/api/auth/google' && method === 'POST') {
      const body = await readJson(request, 5000);
      const nonce = cookies[`${prefix}nonce`];
      if (!/^[a-f0-9]{64}$/.test(nonce || '')) throw new AuthError(401, 'Reload the page and try again');
      const claims = await verifyGoogleToken(body?.credential, env.GOOGLE_CLIENT_ID, nonce);
      return json({ user: await profile(claims, env) }, 200, [cookie('session', body.credential, Math.min(3600, claims.exp - Math.floor(Date.now() / 1000))), cookie('nonce', '', 0)]);
    }
    if (route === '/api/auth/session' && method === 'GET') {
      const token = cookies[`${prefix}session`];
      if (!token) return json({ user: null });
      try {
        return json({ user: await profile(await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID), env) });
      } catch (error) {
        if (error.status !== 401) throw error;
        return json({ user: null }, 200, [cookie('session', '', 0)]);
      }
    }
    if (route === '/api/auth/logout' && method === 'POST') {
      return json({ user: null }, 200, [cookie('session', '', 0), cookie('nonce', '', 0)]);
    }
    return json({ error: 'Not found' }, 404);
  } catch (error) {
    return json({ error: error.status ? error.message : 'Google sign-in is temporarily unavailable' }, error.status || 503);
  }
}

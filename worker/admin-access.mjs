import { HttpError, json, readJson } from './http.mjs';

function authoritativeEmail(claims) {
  // Google is authoritative for Gmail or a verified Workspace hosted domain.
  const domain = claims.email.toLowerCase().split('@')[1];
  return domain === 'gmail.com' || (typeof claims.hd === 'string' && claims.hd.toLowerCase() === domain);
}

export async function adminAccess(claims, env) {
  if (!env.DB) return { admin: false, isOwner: false };
  const email = claims.email.toLowerCase();
  let owner = await env.DB.prepare('SELECT google_sub, email FROM admin_owner WHERE id = 1').first();
  if (!owner && email === env.OWNER_GOOGLE_EMAIL?.toLowerCase() && authoritativeEmail(claims)) {
    await env.DB.prepare('INSERT OR IGNORE INTO admin_owner (id,google_sub,email,created_at) VALUES (1,?,?,?)').bind(claims.sub, email, new Date().toISOString()).run();
    owner = await env.DB.prepare('SELECT google_sub, email FROM admin_owner WHERE id = 1').first();
  }
  if (owner?.google_sub === claims.sub) return { admin: true, isOwner: true };
  let entry = await env.DB.prepare('SELECT email, google_sub FROM admins WHERE google_sub = ? OR email = ? ORDER BY google_sub IS NULL LIMIT 1').bind(claims.sub, email).first();
  if (entry && !entry.google_sub && authoritativeEmail(claims)) {
    await env.DB.prepare('UPDATE admins SET google_sub = ?, activated_at = ? WHERE email = ? AND google_sub IS NULL').bind(claims.sub, new Date().toISOString(), email).run();
    entry = await env.DB.prepare('SELECT google_sub FROM admins WHERE email = ?').bind(email).first();
  }
  return { admin: entry?.google_sub === claims.sub, isOwner: false };
}

export async function handleAdminAccess(request, env, user) {
  if (!user.isOwner) throw new HttpError(403, 'เฉพาะเจ้าของบัญชีเท่านั้นที่จัดการผู้ดูแลได้');
  const path = new URL(request.url).pathname;
  if (path === '/api/admin/access' && request.method === 'GET') {
    const owner = await env.DB.prepare('SELECT email FROM admin_owner WHERE id = 1').first();
    const { results } = await env.DB.prepare('SELECT email, google_sub IS NOT NULL AS active, created_at FROM admins ORDER BY created_at, email LIMIT 101').all();
    return json({ owner: owner.email, admins: results.map(row => ({ email: row.email, active: Boolean(row.active), createdAt: row.created_at })) });
  }
  if (request.method !== 'POST' || !['/api/admin/access', '/api/admin/access/remove'].includes(path)) throw new HttpError(404, 'Not found');
  const body = await readJson(request, 1000);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'กรุณากรอกอีเมล Google ให้ถูกต้อง');
  const owner = await env.DB.prepare('SELECT email FROM admin_owner WHERE id = 1').first();
  if (email === owner.email) throw new HttpError(400, 'บัญชีเจ้าของได้รับสิทธิ์อยู่แล้วและลบจากรายชื่อนี้ไม่ได้');
  if (path.endsWith('/remove')) {
    await env.DB.prepare('DELETE FROM admins WHERE email = ?').bind(email).run();
    return json({ removed: true });
  }
  // Keep the management list bounded; repeat additions are harmless.
  const result = await env.DB.prepare(`INSERT OR IGNORE INTO admins (email,added_by,created_at)
    SELECT ?,?,? WHERE (SELECT COUNT(*) FROM admins) < 100`).bind(email, user.id, new Date().toISOString()).run();
  if (!result.meta.changes && !await env.DB.prepare('SELECT email FROM admins WHERE email = ?').bind(email).first()) throw new HttpError(400, 'รายชื่อผู้ดูแลเต็มแล้ว (สูงสุด 100 บัญชี)');
  return json({ added: true });
}

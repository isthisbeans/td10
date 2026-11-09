import '../js/catalog.js';
import { requireUser } from './auth.mjs';
import { HttpError, json, readJson } from './http.mjs';
import { handleAdminAccess } from './admin-access.mjs';

const packages = globalThis.TD_PACKAGES;
const colors = ['สีน้ำตาลเข้ม Espresso', 'สีเนื้อ Sand Beige'];
const sizes = ['S', 'M', 'L', 'XL', '2XL'];
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const maxSlipBytes = 500000;

function field(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) {
    throw new HttpError(400, `กรุณาตรวจสอบ${label}`);
  }
  return value.trim();
}

function slipBytes(dataUrl) {
  const prefix = 'data:image/jpeg;base64,';
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(prefix)) throw new HttpError(400, 'กรุณาแนบภาพสลิปที่ถูกต้อง');
  const encoded = dataUrl.slice(prefix.length);
  if (encoded.length > 4 * Math.ceil(maxSlipBytes / 3)) throw new HttpError(413, 'ไม่สามารถรับภาพนี้ได้ กรุณาเลือกภาพสลิปใหม่');
  if (encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new HttpError(400, 'ภาพสลิปไม่ถูกต้อง');
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  if (bytes.length > maxSlipBytes) throw new HttpError(413, 'ไม่สามารถรับภาพนี้ได้ กรุณาเลือกภาพสลิปใหม่');
  // Inspect JPEG markers and dimensions without decoding an image in Worker memory.
  if (bytes.length < 12 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) {
    throw new HttpError(400, 'ภาพสลิปไม่ถูกต้อง');
  }
  let dimensions = false, scan = false;
  for (let offset = 2; offset + 3 < bytes.length;) {
    if (bytes[offset++] !== 255) break;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    const length = bytes[offset] * 256 + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    if ([192, 193, 194].includes(marker) && length >= 8) {
      const height = bytes[offset + 3] * 256 + bytes[offset + 4];
      const width = bytes[offset + 5] * 256 + bytes[offset + 6];
      dimensions = width > 0 && height > 0 && width <= 1600 && height <= 1600;
    }
    if (marker === 218) { scan = true; break; }
    offset += length;
  }
  if (!dimensions || !scan) throw new HttpError(400, 'กรุณาเลือกภาพสลิปใหม่');
  return bytes;
}

async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}

function orderSelection(admin = false) {
  // Read the saved reviewer snapshot, including historical or removed admins.
  // The existing (order_id, id) index keeps the latest-review lookup bounded.
  return admin ? `SELECT orders.*, (
    SELECT reviewer_email FROM order_reviews WHERE order_id = orders.id ORDER BY id DESC LIMIT 1
  ) AS reviewer_email FROM orders` : 'SELECT * FROM orders';
}

function publicOrder(row, admin = false) {
  return {
    id: row.id, fullname: row.fullname, email: row.buyer_email, role: row.role,
    phone: row.phone, address: row.address, batch: row.batch,
    studentId: row.student_id ?? null, grade: row.grade ?? null,
    room: row.room ?? null, studentNumber: row.student_number ?? null,
    packageId: row.package_id, packageName: row.package_name, price: row.price,
    hasShirt: Boolean(row.shirt_size), shirtColor: row.shirt_color, shirtSize: row.shirt_size,
    slipUrl: `/api/orders/${row.id}/slip`, submittedAt: row.created_at,
    status: row.status, rejectReason: row.reject_reason, reviewedAt: row.reviewed_at, version: row.version,
    ...(admin ? { reviewerEmail: row.reviewer_email ?? null } : {})
  };
}

async function createOrder(request, env, user) {
  const body = await readJson(request, 4 * Math.ceil(maxSlipBytes / 3) + 10000);
  if (body.accountId !== user.id) throw new HttpError(401, 'บัญชีเปลี่ยนไป กรุณาเข้าสู่ระบบอีกครั้ง');
  if (!uuid.test(body.requestId || '')) throw new HttpError(400, 'Invalid request ID');
  const pkg = packages.find(item => item.id === body.packageId);
  if (!pkg || pkg.role !== user.role) throw new HttpError(403, 'แพ็กเกจนี้ไม่ตรงกับประเภทบัญชีของคุณ');
  const buyer = { fullname: field(user.fullname, 200, 'ชื่อ'), phone: '', address: '', batch: '' };
  field(user.email, 254, 'อีเมล');
  if (user.role === 'alumni') {
    const details = body.details || {};
    buyer.fullname = field(details.fullname, 200, 'ชื่อผู้รับ');
    buyer.phone = field(details.phone, 50, 'เบอร์โทรศัพท์');
    buyer.address = field(details.address, 1000, 'ที่อยู่จัดส่ง');
    if (!/^(?:[1-9]|[12]\d|3[0-7])$/.test(details.batch || '')) throw new HttpError(400, 'กรุณาเลือกรุ่นที่จบ');
    buyer.batch = String(details.batch);
  }
  if (pkg.hasShirt && (!colors.includes(body.shirtColor) || !sizes.includes(body.shirtSize))) throw new HttpError(400, 'กรุณาเลือกสีและไซส์เสื้อให้ถูกต้อง');
  const color = pkg.hasShirt ? body.shirtColor : null;
  const size = pkg.hasShirt ? body.shirtSize : null;
  const bytes = slipBytes(body.slipDataUrl);
  const slipHash = await sha256(bytes);
  const fingerprint = await sha256(new TextEncoder().encode(JSON.stringify([pkg.id, buyer, color, size, slipHash])));
  const findRetry = () => env.DB.prepare('SELECT * FROM orders WHERE buyer_sub = ? AND request_id = ?').bind(user.id, body.requestId).first();
  function retryResponse(existing) {
    if (existing.fingerprint !== fingerprint) throw new HttpError(409, 'คำขอเดิมมีข้อมูลต่างกัน กรุณาเลือกสลิปใหม่ก่อนส่ง');
    return json({ order: publicOrder(existing) });
  }
  const existing = await findRetry();
  if (existing) return retryResponse(existing);
  if (await env.DB.prepare('SELECT id FROM orders WHERE slip_sha256 = ?').bind(slipHash).first()) {
    throw new HttpError(409, 'สลิปนี้ถูกส่งแล้ว กรุณาตรวจสอบคำสั่งซื้อของคุณก่อนส่งสลิปใหม่');
  }
  const id = `TD10-${crypto.randomUUID()}`;
  const slipKey = `slips/${crypto.randomUUID()}.jpg`;
  const created = new Date().toISOString();
  await env.SLIPS.put(slipKey, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
  try {
    await env.DB.prepare(`INSERT INTO orders
      (id,buyer_sub,buyer_email,fullname,role,phone,address,batch,package_id,package_name,price,
       shirt_color,shirt_size,slip_key,slip_sha256,slip_bytes,request_id,fingerprint,created_at,
       student_id,grade,room,student_number)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id, user.id, user.email, buyer.fullname, user.role, buyer.phone, buyer.address, buyer.batch,
      pkg.id, pkg.name, pkg.price, color, size, slipKey, slipHash, bytes.byteLength, body.requestId, fingerprint, created,
      user.studentId, user.grade, user.room, user.studentNumber
    ).run();
  } catch (error) {
    // Confirm the insert outcome before deleting: a transport error may follow a commit.
    // If D1 cannot be read, keep the object for reconciliation rather than lose a slip.
    const retry = await findRetry();
    if (retry?.id === id) return retryResponse(retry);
    try { await env.SLIPS.delete(slipKey); } catch { console.error('Order upload cleanup failed'); }
    if (retry) return retryResponse(retry);
    if (await env.DB.prepare('SELECT id FROM orders WHERE slip_sha256 = ?').bind(slipHash).first()) throw new HttpError(409, 'สลิปนี้ถูกส่งแล้ว กรุณาตรวจสอบคำสั่งซื้อของคุณ');
    throw error;
  }
  const saved = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  return json({ order: publicOrder(saved) }, 201);
}

async function listOrders(url, env, user, admin) {
  const where = [], params = [];
  if (!admin) { where.push('buyer_sub = ?'); params.push(user.id); }
  for (const [param, column, allowed] of [
    ['status', 'status', ['pending', 'approved', 'rejected']],
    ['role', 'role', ['student-current', 'student-m4', 'student-m5', 'student-m6', 'alumni']],
    ['package', 'package_id', packages.map(pkg => pkg.id)]
  ]) {
    const value = url.searchParams.get(param);
    if (!value || value === 'all') continue;
    if (!allowed.includes(value)) throw new HttpError(400, 'Invalid order filter');
    if (param === 'role' && value.startsWith('student-m')) {
      where.push("role = 'student-current'", 'grade = ?');
      params.push(value.at(-1));
    } else {
      where.push(`${column} = ?`); params.push(value);
    }
  }
  const query = url.searchParams.get('q')?.trim();
  if (query) {
    if (query.length > 100) throw new HttpError(400, 'Search is too long');
    where.push("instr(lower(fullname || ' ' || buyer_email || ' ' || phone || ' ' || id || ' ' || COALESCE(student_id,'') || ' ' || COALESCE(grade,'') || ' ' || COALESCE(room,'') || ' ' || COALESCE(student_number,'')), lower(?)) > 0"); params.push(query);
  }
  const cursor = url.searchParams.get('cursor');
  if (cursor) {
    if (!/^\d{1,16}$/.test(cursor) || !Number.isSafeInteger(Number(cursor))) throw new HttpError(400, 'Invalid cursor');
    where.push('seq < ?'); params.push(Number(cursor));
  }
  const { results } = await env.DB.prepare(`${orderSelection(admin)} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY seq DESC LIMIT 51`).bind(...params).all();
  const rows = results.slice(0, 50);
  return json({ orders: rows.map(row => publicOrder(row, admin)), nextCursor: results.length > 50 ? String(rows.at(-1).seq) : null });
}

async function stats(env) {
  // At most 63 groups for the current catalog, regardless of buyer count.
  const { results } = await env.DB.prepare('SELECT * FROM order_totals WHERE order_count > 0').all();
  const summary = { total: 0, pending: 0, rejected: 0, revenue: 0, students: 0, alumni: 0, shirts: [] };
  for (const row of results) {
    summary.total += row.order_count;
    summary[row.role === 'student-current' ? 'students' : 'alumni'] += row.order_count;
    if (row.status === 'pending') summary.pending += row.order_count;
    if (row.status === 'rejected') summary.rejected += row.order_count;
    if (row.status !== 'approved') continue;
    summary.revenue += row.total_price;
    if (row.shirt_size) {
      let shirt = summary.shirts.find(item => item.color === row.shirt_color && item.size === row.shirt_size);
      if (!shirt) { shirt = { color: row.shirt_color, size: row.shirt_size, count: 0 }; summary.shirts.push(shirt); }
      shirt.count += row.order_count;
    }
  }
  return json(summary);
}

async function reviewOrder(request, env, user, id) {
  const body = await readJson(request, 4000);
  if (!['approved', 'rejected'].includes(body.status) || !Number.isSafeInteger(body.version) || body.version < 0) throw new HttpError(400, 'Invalid review');
  const reason = body.status === 'rejected' ? field(body.reason, 1000, 'เหตุผลการปฏิเสธ') : '';
  const time = new Date().toISOString();
  const results = await env.DB.batch([
    env.DB.prepare(`INSERT INTO order_reviews (order_id,reviewer_sub,reviewer_email,status,reason,created_at)
      SELECT id,?,?,?,?,? FROM orders WHERE id = ? AND version = ? AND status != ?`).bind(user.id, user.email, body.status, reason, time, id, body.version, body.status),
    env.DB.prepare("UPDATE orders SET status = ?, reject_reason = ?, reviewed_at = ?, version = version + 1 WHERE id = ? AND version = ? AND status != ?").bind(body.status, reason, time, id, body.version, body.status)
  ]);
  if (results[1].meta.changes !== 1) {
    const exists = await env.DB.prepare('SELECT id FROM orders WHERE id = ?').bind(id).first();
    throw new HttpError(exists ? 409 : 404, exists ? 'รายการนี้เปลี่ยนแปลงแล้วหรือมีสถานะตรงกับที่เลือก กรุณาโหลดข้อมูลล่าสุด' : 'ไม่พบคำสั่งซื้อ');
  }
  const saved = await env.DB.prepare(`${orderSelection(true)} WHERE id = ?`).bind(id).first();
  return json({ order: publicOrder(saved, true) });
}

export async function handleOrders(request, env) {
  try {
    if (!['GET', 'POST'].includes(request.method)) throw new HttpError(405, 'Method not allowed');
    const user = await requireUser(request, env);
    const url = new URL(request.url);
    const adminRoute = url.pathname.startsWith('/api/admin/');
    if (adminRoute && user.status !== 'admin') throw new HttpError(403, 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแล');
    if (!env.DB || !env.SLIPS) throw new HttpError(503, 'ยังไม่ได้เชื่อมต่อฐานข้อมูลและพื้นที่เก็บสลิป');
    if (url.pathname.startsWith('/api/admin/access')) return await handleAdminAccess(request, env, user);
    if (url.pathname === '/api/orders') {
      if (request.method === 'POST') return await createOrder(request, env, user);
      return await listOrders(url, env, user, false);
    }
    if (url.pathname === '/api/admin/orders' && request.method === 'GET') return await listOrders(url, env, user, true);
    if (url.pathname === '/api/admin/stats' && request.method === 'GET') return await stats(env);
    const review = url.pathname.match(/^\/api\/admin\/orders\/(TD10-[a-f0-9-]{36})\/review$/);
    if (review && request.method === 'POST') return await reviewOrder(request, env, user, review[1]);
    const match = url.pathname.match(/^\/api\/orders\/(TD10-[a-f0-9-]{36})(\/slip)?$/);
    if (match && request.method === 'GET') {
      const admin = user.status === 'admin';
      const row = await env.DB.prepare(`${orderSelection(admin && !match[2])} WHERE id = ?`).bind(match[1]).first();
      if (!row || (row.buyer_sub !== user.id && user.status !== 'admin')) throw new HttpError(404, 'ไม่พบคำสั่งซื้อ');
      if (!match[2]) {
        const { results } = await env.DB.prepare(`SELECT status, reason, created_at${admin ? ', reviewer_email' : ''} FROM order_reviews WHERE order_id = ? ORDER BY id`).bind(row.id).all();
        return json({ order: publicOrder(row, admin), reviews: results });
      }
      const object = await env.SLIPS.get(row.slip_key);
      if (!object) throw new HttpError(404, 'ไม่พบภาพสลิป');
      return new Response(object.body, { headers: {
        'Content-Type': 'image/jpeg', 'Content-Length': String(row.slip_bytes), 'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin',
        'Content-Security-Policy': "default-src 'none'; sandbox", 'Content-Disposition': 'inline; filename="slip.jpg"'
      } });
    }
    throw new HttpError(404, 'Not found');
  } catch (error) {
    if (!error.status) console.error('Order service failed'); // Never log slips, tokens or buyer details.
    return json({ error: error.status ? error.message : 'บันทึกหรือโหลดคำสั่งซื้อไม่สำเร็จ กรุณาลองอีกครั้ง' }, error.status || 503);
  }
}

import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test, { after } from 'node:test';
import { handleOrders } from '../worker/orders.mjs';

// Exercise the real auth and order handlers without Google or Cloudflare access.
const origin = 'https://orders.test';
const clientId = 'order-review-tests';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'local-tests', alg: 'RS256', use: 'sig' };
const originalFetch = globalThis.fetch;
globalThis.fetch = async url => {
  assert.equal(String(url), 'https://www.googleapis.com/oauth2/v3/certs');
  return new Response(JSON.stringify({ keys: [jwk] }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' }
  });
};
after(() => { globalThis.fetch = originalFetch; });

const adminA = { sub: 'admin-a', email: 'alice@gmail.com', name: 'Alice Admin' };
const adminB = { sub: 'admin-b', email: 'bob@gmail.com', name: 'Bob Admin' };
const buyer = { sub: 'buyer', email: '12345@tun.ac.th', hd: 'tun.ac.th', name: '611.16 Buyer' };
const stranger = { sub: 'stranger', email: 'stranger@gmail.com', name: 'Other Buyer' };

function token(user) {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({
    ...user, aud: clientId, iss: 'https://accounts.google.com',
    email_verified: true, iat: now, exp: now + 3600
  })}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
}

// The adapter executes actual migration/query SQL and preserves D1's atomic batch.
function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  const migrations = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'));
  }
  function prepare(sql, values = []) {
    return {
      bind(...args) { return prepare(sql, args); },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      async run() {
        const result = sqlite.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      }
    };
  }
  return {
    sqlite,
    prepare,
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    }
  };
}

function fixture(t) {
  const DB = database();
  t.after(() => DB.sqlite.close());
  for (const admin of [adminA, adminB]) {
    DB.sqlite.prepare('INSERT INTO admins (email,google_sub,added_by,created_at) VALUES (?,?,?,?)')
      .run(admin.email, admin.sub, 'owner', '2026-01-01T00:00:00.000Z');
  }
  const slips = new Map();
  const env = {
    DB, APP_ORIGIN: origin, GOOGLE_CLIENT_ID: clientId,
    SLIPS: {
      async put(key, bytes) { slips.set(key, bytes); },
      async get(key) { return slips.has(key) ? { body: slips.get(key) } : null; },
      async delete(key) { slips.delete(key); }
    }
  };
  async function request(path, user = adminA, body) {
    const headers = { Cookie: `__Host-td10_session=${token(user)}` };
    if (body !== undefined) Object.assign(headers, { Origin: origin, 'Content-Type': 'application/json' });
    const response = await handleOrders(new Request(`${origin}${path}`, {
      method: body === undefined ? 'GET' : 'POST', headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    }), env);
    return { status: response.status, body: await response.json() };
  }
  function order(number, overrides = {}) {
    const suffix = String(number).padStart(12, '0');
    const row = {
      id: `TD10-00000000-0000-4000-8000-${suffix}`, buyer_sub: buyer.sub, buyer_email: buyer.email,
      fullname: buyer.name, role: 'student-current', package_id: '1', package_name: 'Admission', price: 99,
      slip_key: `slips/${number}.jpg`, slip_sha256: `hash-${number}`, slip_bytes: 100,
      request_id: `request-${number}`, fingerprint: `fingerprint-${number}`,
      created_at: '2026-01-01T00:00:00.000Z', ...overrides
    };
    const columns = Object.keys(row);
    DB.sqlite.prepare(`INSERT INTO orders (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`)
      .run(...Object.values(row));
    return row.id;
  }
  function review(id, user, status, time = '2026-01-01T01:00:00.000Z') {
    DB.sqlite.prepare('INSERT INTO order_reviews (order_id,reviewer_sub,reviewer_email,status,reason,created_at) VALUES (?,?,?,?,?,?)')
      .run(id, user.sub, user.email, status, status === 'rejected' ? 'Unreadable slip' : '', time);
  }
  const audits = id => DB.sqlite.prepare('SELECT * FROM order_reviews WHERE order_id = ? ORDER BY id').all(id);
  return { DB, request, order, review, audits };
}

test('admin lists attribute historical decisions by latest review id and leave pending orders unassigned', async t => {
  const f = fixture(t);
  const pending = f.order(1);
  const approved = f.order(2, { status: 'approved', version: 1 });
  f.review(approved, adminA, 'approved');
  const rejected = f.order(3, { status: 'rejected', version: 2 });
  // Equal timestamps must still select the later audit's reviewer.
  f.review(rejected, adminA, 'approved');
  f.review(rejected, adminB, 'rejected');
  const historical = f.order(4, { status: 'approved', version: 2 });
  f.review(historical, adminA, 'rejected', '2026-01-02T00:00:00.000Z');
  f.review(historical, adminB, 'approved', '2026-01-01T00:00:00.000Z');

  const result = await f.request('/api/admin/orders');
  assert.equal(result.status, 200);
  assert.equal(result.body.orders.length, 4);
  const orders = new Map(result.body.orders.map(order => [order.id, order]));
  assert.equal(orders.get(pending).reviewerEmail, null);
  assert.equal(orders.get(approved).reviewerEmail, adminA.email);
  assert.equal(orders.get(rejected).reviewerEmail, adminB.email);
  assert.equal(orders.get(historical).reviewerEmail, adminB.email);

  const filtered = await f.request('/api/admin/orders?status=rejected&q=Buyer');
  assert.equal(filtered.status, 200);
  assert.deepEqual(filtered.body.orders.map(order => order.id), [rejected]);
  assert.equal(filtered.body.orders[0].reviewerEmail, adminB.email);
  const pendingDetail = await f.request(`/api/orders/${pending}`);
  assert.equal(pendingDetail.status, 200);
  assert.equal(pendingDetail.body.order.reviewerEmail, null);
  assert.deepEqual(pendingDetail.body.reviews, []);
});

test('approval and rejection identify the authenticated admins in responses and audit history', async t => {
  const f = fixture(t);
  const id = f.order(1);
  const approval = await f.request(`/api/admin/orders/${id}/review`, adminA, {
    status: 'approved', version: 0, reviewerEmail: 'forged@gmail.com',
    reviewer_email: 'forged@gmail.com', reviewer_sub: 'forged-user'
  });
  assert.equal(approval.status, 200);
  assert.equal(approval.body.order.status, 'approved');
  assert.equal(approval.body.order.version, 1);
  assert.equal(approval.body.order.reviewerEmail, adminA.email);
  assert.equal(f.audits(id)[0].reviewer_sub, adminA.sub);
  assert.equal(f.audits(id)[0].reviewer_email, adminA.email);

  const rejection = await f.request(`/api/admin/orders/${id}/review`, adminB, {
    status: 'rejected', reason: '  Unreadable slip  ', version: 1
  });
  assert.equal(rejection.status, 200);
  assert.equal(rejection.body.order.status, 'rejected');
  assert.equal(rejection.body.order.rejectReason, 'Unreadable slip');
  assert.equal(rejection.body.order.version, 2);
  assert.equal(rejection.body.order.reviewerEmail, adminB.email);

  const detail = await f.request(`/api/orders/${id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.order.reviewerEmail, adminB.email);
  assert.deepEqual(detail.body.reviews.map(({ status, reviewer_email }) => ({ status, reviewer_email })), [
    { status: 'approved', reviewer_email: adminA.email },
    { status: 'rejected', reviewer_email: adminB.email }
  ]);
  assert.equal(detail.body.reviews[1].reason, 'Unreadable slip');
  assert.equal(typeof detail.body.reviews[1].created_at, 'string');
  assert.equal(Object.hasOwn(detail.body.reviews[0], 'reviewer_sub'), false);
  assert.equal(f.audits(id)[1].reviewer_sub, adminB.sub);
});

test('stale, duplicate and missing-order decisions create no extra audit or reviewer change', async t => {
  const f = fixture(t);
  const id = f.order(1);
  const approved = await f.request(`/api/admin/orders/${id}/review`, adminA, { status: 'approved', version: 0 });
  assert.equal(approved.status, 200);
  for (const body of [
    { status: 'rejected', reason: 'Old screen', version: 0 },
    { status: 'approved', version: 1 },
    { status: 'approved', version: 0 }
  ]) {
    const result = await f.request(`/api/admin/orders/${id}/review`, adminB, body);
    assert.equal(result.status, 409);
  }
  const missing = 'TD10-00000000-0000-4000-8000-999999999999';
  assert.equal((await f.request(`/api/admin/orders/${missing}/review`, adminB, {
    status: 'approved', version: 0
  })).status, 404);
  assert.equal(f.audits(id).length, 1);
  const detail = await f.request(`/api/orders/${id}`);
  assert.equal(detail.body.order.version, 1);
  assert.equal(detail.body.order.reviewerEmail, adminA.email);
  assert.equal(detail.body.order.status, 'approved');
});

test('buyers retain order history without reviewer identities and cannot access admin review routes', async t => {
  const f = fixture(t);
  const id = f.order(1, { status: 'rejected', version: 1, reject_reason: 'Unreadable slip' });
  f.review(id, adminA, 'rejected');
  f.order(2, { buyer_sub: stranger.sub, buyer_email: stranger.email });
  const adminsOwnOrder = f.order(3, {
    buyer_sub: adminA.sub, buyer_email: adminA.email, status: 'approved', version: 1
  });
  f.review(adminsOwnOrder, adminB, 'approved');

  for (const user of [buyer, adminA]) {
    // The buyer-facing list has the same privacy contract even for admin buyers.
    const list = await f.request('/api/orders', user);
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.orders.map(order => order.id), [user === buyer ? id : adminsOwnOrder]);
    for (const order of list.body.orders) {
      assert.equal(Object.hasOwn(order, 'reviewerEmail'), false);
      assert.equal(Object.hasOwn(order, 'reviewer_email'), false);
    }
  }
  const detail = await f.request(`/api/orders/${id}`, buyer);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.order.status, 'rejected');
  assert.equal(Object.hasOwn(detail.body.order, 'reviewerEmail'), false);
  assert.deepEqual(Object.keys(detail.body.reviews[0]).sort(), ['created_at', 'reason', 'status']);
  assert.equal(detail.body.reviews[0].reason, 'Unreadable slip');
  assert.equal((await f.request(`/api/orders/${id}`, stranger)).status, 404);
  assert.equal((await f.request('/api/admin/orders', buyer)).status, 403);
  assert.equal((await f.request(`/api/admin/orders/${id}/review`, buyer, {
    status: 'approved', version: 1
  })).status, 403);
  assert.equal(f.audits(id).length, 1);
});

test('buyer creation and idempotent retry omit reviewer identities', async t => {
  const f = fixture(t);
  // A tiny JPEG marker stream accepted by the server's dimension/scan checks.
  const jpeg = Buffer.from([255, 216, 255, 192, 0, 8, 8, 0, 1, 0, 1, 1, 255, 218, 0, 2, 255, 217]);
  const body = {
    accountId: buyer.sub, requestId: '00000000-0000-4000-8000-000000000001', packageId: '1',
    slipDataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
    reviewerEmail: 'forged@gmail.com'
  };
  const created = await f.request('/api/orders', buyer, body);
  assert.equal(created.status, 201);
  assert.equal(created.body.order.status, 'pending');
  assert.equal(Object.hasOwn(created.body.order, 'reviewerEmail'), false);
  const retry = await f.request('/api/orders', buyer, body);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.order.id, created.body.order.id);
  assert.equal(Object.hasOwn(retry.body.order, 'reviewerEmail'), false);
  assert.equal(f.audits(created.body.order.id).length, 0);
  const adminList = await f.request('/api/admin/orders');
  assert.equal(adminList.body.orders[0].reviewerEmail, null);
  assert.equal((await f.request(`/api/admin/orders/${created.body.order.id}/review`, adminA, {
    status: 'approved', version: 0
  })).status, 200);
  const reviewedRetry = await f.request('/api/orders', buyer, body);
  assert.equal(reviewedRetry.status, 200);
  assert.equal(reviewedRetry.body.order.status, 'approved');
  assert.equal(Object.hasOwn(reviewedRetry.body.order, 'reviewerEmail'), false);
});

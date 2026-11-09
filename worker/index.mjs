import { handleAuth } from './auth.mjs';
import { handleOrders } from './orders.mjs';
import { json } from './http.mjs';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/auth/')) return handleAuth(request, env);
    if (path === '/api/orders' || path.startsWith('/api/orders/') || path.startsWith('/api/admin/')) return handleOrders(request, env);
    if (path.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    return env.ASSETS.fetch(request);
  }
};

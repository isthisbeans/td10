/** Static local preview. Use Wrangler for authenticated checkout and orders. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function isPublicPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.some(part => part.startsWith('.') || part.includes('\\'))) return false;
  if (['/index.html', '/admin.html', '/app.js', '/favicon.ico'].includes(pathname)) return true;
  if (parts.length < 2) return false;
  const extension = path.extname(pathname).toLowerCase();
  if (parts[0] === 'css') return extension === '.css';
  if (parts[0] === 'js') return extension === '.js';
  return parts[0] === 'assets' && Object.hasOwn(MIME_TYPES, extension);
}

// A single range covers media seeking. Validate numbers before opening a stream.
function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || !size) return null;
  const first = Number(match[1]), last = Number(match[2]);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) return null;
  const start = match[1] ? first : Math.max(0, size - last);
  const end = match[1] && match[2] ? Math.min(last, size - 1) : size - 1;
  return start <= end && start < size ? { start, end } : null;
}

function createPreviewServer(directory = __dirname) {
  const root = fs.realpathSync(directory);
  return http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-cache');

    function fail(status, message, headers = {}) {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
      res.end(req.method === 'HEAD' ? undefined : message);
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (!['GET', 'HEAD'].includes(req.method)) {
      fail(405, 'Method not allowed', { Allow: 'GET, HEAD, OPTIONS' });
      return;
    }

    let pathname;
    try { pathname = decodeURIComponent((req.url || '/').split('?')[0]); }
    catch { fail(400, 'Invalid path'); return; }
    if (pathname.includes('\0')) { fail(400, 'Invalid path'); return; }
    if (pathname === '/') pathname = '/index.html';
    if (pathname === '/admin' || pathname === '/admin/') pathname = '/admin.html';
    if (!isPublicPath(pathname)) { fail(404, 'Not found'); return; }

    const filePath = path.resolve(root, '.' + pathname);
    fs.realpath(filePath, (error, resolved) => {
      // Resolve symlinks as well: the preview must never expose private sources.
      const relative = !error && path.relative(root, resolved).split(path.sep).join('/');
      if (error || !isPublicPath('/' + relative)) { fail(404, 'Not found'); return; }
      fs.stat(resolved, (error, stat) => {
        if (error || !stat.isFile()) { fail(404, 'Not found'); return; }
        const contentType = MIME_TYPES[path.extname(resolved).toLowerCase()] || 'application/octet-stream';
        const range = req.method === 'GET' && req.headers.range;
        const selected = range ? byteRange(range, stat.size) : null;
        if (range && !selected) {
          fail(416, 'Range not satisfiable', { 'Content-Range': `bytes */${stat.size}` });
          return;
        }
        const headers = {
          'Content-Type': contentType,
          'Content-Length': selected ? selected.end - selected.start + 1 : stat.size,
          'Accept-Ranges': 'bytes'
        };
        if (selected) headers['Content-Range'] = `bytes ${selected.start}-${selected.end}/${stat.size}`;
        res.writeHead(selected ? 206 : 200, headers);
        if (req.method === 'HEAD') { res.end(); return; }
        const stream = fs.createReadStream(resolved, selected || undefined);
        stream.on('error', () => res.destroy());
        res.on('close', () => stream.destroy());
        stream.pipe(res);
      });
    });
  });
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createPreviewServer().listen(port, () => {
    console.log(`TRIAMDOD static preview: http://localhost:${port}`);
    console.log('Use Wrangler for Google sign-in and orders.');
  });
}

module.exports = { createPreviewServer };

// Keep source files modular; ship one cacheable stylesheet and script per page.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const pages = ['index.html', 'admin.html'];
const publicFiles = ['favicon.ico', '_headers', 'assets'];

function stripCssComments(source) {
  // Preserve quoted text and data URLs; do not minify CSS with regular expressions.
  let result = '', quote = null;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '\\') { result += source.slice(i, i + 2); i++; continue; }
    if (quote) {
      result += char;
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char; result += char;
    } else if (char === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unclosed CSS comment');
      result += ' '; i = end + 1;
    } else result += char;
  }
  return result;
}

function bundlePage(html, name, root, output) {
  const styles = [], scripts = [];
  html.replace(/<link\b[^>]*>/g, tag => {
    const href = tag.match(/\bhref="([^"]+)"/)?.[1];
    if (/\brel="stylesheet"/.test(tag) && href?.startsWith('css/')) styles.push(href);
    return tag;
  });
  html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g, (tag, src) => {
    if (!/^https?:/.test(src)) scripts.push(src);
    return tag;
  });

  function writeBundle(files, extension) {
    const source = files.map(file => readFileSync(path.join(root, file), 'utf8'));
    const content = extension === 'css' ? stripCssComments(source.join('\n')) : source.join('\n;\n');
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
    const file = `${extension}/${name}.${hash}.${extension}`;
    mkdirSync(path.join(output, extension), { recursive: true });
    writeFileSync(path.join(output, file), content);
    return file;
  }
  const styleBundle = writeBundle(styles, 'css');
  const scriptBundle = writeBundle(scripts, 'js');
  let wroteStyle = false, wroteScript = false;
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<link\b[^>]*>/g, tag => {
    const href = tag.match(/\bhref="([^"]+)"/)?.[1];
    if (!styles.includes(href)) return tag;
    if (wroteStyle) return '';
    wroteStyle = true;
    return `<link rel="stylesheet" href="${styleBundle}">`;
  }).replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g, (tag, src) => {
    if (!scripts.includes(src)) return tag;
    if (wroteScript) return '';
    wroteScript = true;
    return `<script src="${scriptBundle}" defer></script>`;
  });
}

export function buildCloudflare(root = projectRoot) {
  for (const file of [...pages, ...publicFiles]) {
    if (!existsSync(path.join(root, file))) throw new Error(`Missing public file: ${file}`);
  }

  const output = path.join(root, 'dist');
  const staging = mkdtempSync(path.join(root, '.dist-build-'));
  const previous = path.join(staging, 'previous');
  const next = path.join(staging, 'next');
  let preserveBackup = false;
  try {
    mkdirSync(next);
    for (const file of publicFiles) {
      cpSync(path.join(root, file), path.join(next, file), { recursive: true });
    }
    for (const page of pages) {
      const html = readFileSync(path.join(root, page), 'utf8');
      const bundled = bundlePage(html, page === 'index.html' ? 'site' : 'admin', root, next);
      writeFileSync(path.join(next, page), bundled);
    }

    // Promote a complete build only. Missing scripts or invalid CSS must leave
    // the last working output available to preview and deployment tools.
    if (existsSync(output)) renameSync(output, previous);
    try {
      renameSync(next, output);
    } catch (error) {
      if (existsSync(previous)) {
        try {
          renameSync(previous, output);
        } catch (restoreError) {
          preserveBackup = true;
          throw new AggregateError([error, restoreError], `Build replacement failed; previous output saved at ${previous}`);
        }
      }
      throw error;
    }
  } finally {
    if (!preserveBackup) rmSync(staging, { recursive: true, force: true });
  }

  let files = 0;
  let bytes = 0;
  function count(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) count(target);
      else { files++; bytes += statSync(target).size; }
    }
  }
  count(output);
  return { directory: output, files, bytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildCloudflare();
  console.log(`Cloudflare assets ready: ${result.files} files, ${(result.bytes / 1024 / 1024).toFixed(2)} MiB in dist/`);
}

/**
 * After Vite builds, inline JS/CSS into a single HTML file so it can be
 * opened with a double-click (file://) without a local server.
 *
 * ES modules loaded from file:// are blocked by CORS. An inlined
 * <script type="module"> does not need a network fetch, so it works.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const htmlPath = join(dist, 'index.html');

let html = readFileSync(htmlPath, 'utf8');

// Do not keep the source-file redirect in the portable build
html = html.replace(/<script id="file-protocol-redirect">[\s\S]*?<\/script>\s*/g, '');

function readDistAsset(href) {
  const cleaned = href.replace(/^\.\//, '').split('?')[0];
  const filePath = join(dist, cleaned);
  if (!existsSync(filePath)) {
    throw new Error(`Cannot inline missing asset: ${filePath}`);
  }
  return readFileSync(filePath, 'utf8');
}

// Drop modulepreload hints (the script will be inlined)
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');

// Inline stylesheets
html = html.replace(
  /<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
  (_, href) => `<style>\n${readDistAsset(href)}\n</style>`
);

// Inline classic and module scripts that point at built files
html = html.replace(
  /<script([^>]*)src="([^"]+)"([^>]*)><\/script>/g,
  (_, before, src, after) => {
    const attrs = `${before} ${after}`.replace(/\s+/g, ' ').trim();
    const code = readDistAsset(src).replace(/<\/script/gi, '<\\/script');
    return `<script ${attrs}>\n${code}\n</script>`;
  }
);

writeFileSync(htmlPath, html);

const portable = join(root, 'KidsCode3D.html');
copyFileSync(htmlPath, portable);

console.log('Inlined build into dist/index.html');
console.log('Copied portable file to KidsCode3D.html — double-click this to play, no server needed.');

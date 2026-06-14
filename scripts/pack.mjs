// Copies the WXT build output to a clearly-named, committed `extension/` folder so
// people can "Load unpacked" without building. Run via: npm run pack
import { rmSync, cpSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'dist/chrome-mv3');
const dest = resolve(root, 'extension');

if (!existsSync(src)) {
  console.error('No build found at dist/chrome-mv3 — run `wxt build` first.');
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log('Copied dist/chrome-mv3 → extension/ (load this folder in chrome://extensions)');

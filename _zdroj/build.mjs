// Sestaví ../prezentace.html: jeden soubor se vším uvnitř (CSS, písma, Three.js, kód).
// Spuštění:  node build.mjs   (stačí Node 18+, žádné balíčky)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');
const b64 = (p) => readFileSync(join(here, p)).toString('base64');
// </script uvnitř vloženého JS by předčasně ukončil <script> blok
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');

const css = read('src/style.css').replace(
  /url\("font:([^"]+)"\)/g,
  (_, file) => `url(data:font/woff2;base64,${b64('fonts/' + file)}) format("woff2")`
);
const app = readdirSync(join(here, 'src/js'))
  .filter((f) => f.endsWith('.js'))
  .sort()
  .map((f) => `/* ---------- ${f} ---------- */\n${read('src/js/' + f)}`)
  .join('\n');
const vendor = read('vendor/three-vendor.min.js');

const html = read('src/index.html')
  .replace('/*__CSS__*/', () => css)
  .replace('/*__VENDOR__*/', () => safe(vendor))
  .replace('/*__APP__*/', () => safe(app));

const out = join(here, '..', 'prezentace.html');
writeFileSync(out, html);
console.log(`Hotovo: ${out} (${Math.round(Buffer.byteLength(html) / 1024)} kB)`);

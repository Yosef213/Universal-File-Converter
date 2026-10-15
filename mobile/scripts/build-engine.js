/*
 * Builds assets/engine/engine.html, a single self-contained offline page that
 * inlines pdf.js, mammoth, docx, SheetJS and the bridge script.
 * Run: npm run build:engine
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const nm = (p) => path.join(root, 'node_modules', p);

function firstExisting(cands) {
  for (const c of cands) {
    if (fs.existsSync(nm(c))) return nm(c);
  }
  throw new Error('None of these files exist:\n  ' + cands.join('\n  '));
}

const libs = [
  firstExisting(['pdfjs-dist/build/pdf.min.js']),
  // Loading the worker in the main thread exposes globalThis.pdfjsWorker,
  // which pdf.js uses as an in-page "fake worker" (no separate file needed).
  firstExisting(['pdfjs-dist/build/pdf.worker.min.js']),
  firstExisting(['mammoth/mammoth.browser.min.js', 'mammoth/mammoth.browser.js']),
  firstExisting(['docx/dist/index.iife.js', 'docx/build/index.iife.js', 'docx/dist/index.umd.cjs']),
  firstExisting(['xlsx/dist/xlsx.full.min.js']),
  path.join(root, 'engine-src', 'bridge.js'),
];

const safe = (code) => code.replace(/<\/script/gi, '<\\/script');

let html =
  '<!DOCTYPE html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n';
for (const file of libs) {
  html += `<script>/* ${path.basename(file)} */\n${safe(fs.readFileSync(file, 'utf8'))}\n</script>\n`;
}
html += '</body></html>';

const outDir = path.join(root, 'assets', 'engine');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'engine.html'), html);
console.log(`engine.html written (${(html.length / 1024 / 1024).toFixed(2)} MB)`);

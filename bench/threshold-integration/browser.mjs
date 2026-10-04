import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { createRequire } from 'node:module';
import { loadFixture } from './fixtures.mjs';
import { sha256 } from './engine.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || resolve('bench/threshold-integration/build/browser-tools/node_modules/playwright'));
const root = resolve('.'); let mode = 'D';
const server = createServer((req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path === '/wasm/pc_wasm.wasm' ? resolve(root, `bench/threshold-integration/build/${mode}.wasm`) : resolve(root, `.${path}`);
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const bytes = readFileSync(file); const mime = ({ '.mjs': 'text/javascript', '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.wasm': 'application/wasm' })[extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' }); res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const ids = ['c7-2plus2-qb-row-039-O', 'c7-2plus2-qb-row-025-T', 'c7-2plus2-qb-row-035-L', 'cycle1-jeremy-a-Z'];
const matrices = ids.map(id => loadFixture(id).matrix), hard = loadFixture('cycle1-pcinfo-031-S').matrix;
const reports = [];
try {
  for (mode of ['S', 'D', 'C', 'A', 'B']) {
    const context = await browser.newContext(); const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${server.address().port}/bench/threshold-integration/browser.html`);
    await page.waitForFunction(() => window.ready === true);
    const result = await page.evaluate(data => window.verify(data), { matrices, hard });
    assert.equal(result.wasmHash, sha256(readFileSync(`bench/threshold-integration/build/${mode}.wasm`)));
    assert.deepEqual(errors, []); assert(result.cancellation.reclaimed && result.restarted);
    for (const row of result.results) {
      const expected = reports[0]?.results.find(r => r.id === row.id);
      if (expected) for (const key of ['keys', 'qualityVector']) assert.deepEqual(row.worker[key], expected.worker[key]);
      assert.deepEqual(row.worker.keys, row.locked.keys); assert.deepEqual(row.worker.qualityVector, row.locked.qualityVector);
    }
    reports.push({ mode, browser: browser.version(), ...result });
    await context.close(); console.log(`${mode}: actual browser product API/progress/locks/worker/cancel/restart passed.`);
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
mkdirSync('bench/threshold-integration/results/correctness', { recursive: true });
writeFileSync('bench/threshold-integration/results/correctness/browser.json', JSON.stringify(reports, null, 2) + '\n');

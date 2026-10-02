import assert from 'node:assert/strict';
import { readFileSync, appendFileSync } from 'node:fs';
import { decoder } from 'tetris-fumen';
import { boardFromFumenPage, popcount } from '../../src/board.mjs';
import { expandPatternCases } from '../../src/pattern.mjs';
const db = JSON.parse(readFileSync(new URL('./cycle1-setups.json', import.meta.url)));
const config = JSON.parse(readFileSync(new URL('./capture-config.json', import.meta.url)));
assert(['smoke', 'all', 'off'].includes(config.suite));
for (const s of db.setups) {
  const board = boardFromFumenPage(decoder.decode(s.fumen)[0], 4);
  assert.equal(`0x${board.toString(16)}`, s.board);
  assert.equal(popcount(board), s.occupied);
  const cases = expandPatternCases(s.pattern);
  assert(cases.every(c => c.queue.length === (40 - s.occupied) / 4 + 1));
}
const ids = config.suite === 'all' ? db.setups.map(s => s.id) : config.suite === 'smoke'
  ? ['cycle1-alt-jaws-a', 'cycle1-pcinfo-030'] : [];
const plan = { enabled: ids.length > 0, matrix: { setup: ids }, suite: config.suite };
console.log(JSON.stringify(plan, null, 2));
if (process.env.GITHUB_OUTPUT) for (const [key, value] of Object.entries(plan)) {
  appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}\n`);
}

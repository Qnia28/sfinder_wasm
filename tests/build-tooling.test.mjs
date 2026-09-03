import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const script = (name) => readFile(new URL(`../scripts/${name}`, import.meta.url), 'utf8');

// #9: a verification command must not mutate a shipped artifact.
test('test-rust.sh does not write into the tracked wasm/ directory', async () => {
  const text = await script('test-rust.sh');
  const writes = text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .filter((line) => /(^|\s)(cp|mv|install|cat\s*>|tee)\b/.test(line) || />\s*\.\.\/wasm\//.test(line))
    .filter((line) => line.includes('wasm/'));
  assert.deepEqual(writes, []);
});

test('build-wasm.sh is the sole producer of the tracked wasm artifacts', async () => {
  const text = await script('build-wasm.sh');
  for (const artifact of ['pc_wasm.wasm', 'batch_wasm.wasm']) {
    assert.match(text, new RegExp(`cp [^\\n]*${artifact.replace('.', '\\.')} \\.\\./wasm/${artifact.replace('.', '\\.')}`));
  }
});

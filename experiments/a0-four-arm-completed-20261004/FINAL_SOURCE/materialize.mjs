// Preserve the original compiled module when the experiment is disabled.
// Only isolated build trees use the explicit four-arm implementation overlay.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ROOT,sha,write} from './common.mjs';
const dest=process.argv[2],mode=process.argv[3];assert(dest&&['M1','M2','diagnostic','test-control'].includes(mode));
assert(!fs.existsSync(dest));fs.mkdirSync(dest,{recursive:true});
fs.cpSync(`${ROOT}/rust`,`${dest}/rust`,{recursive:true,filter:path=>!/(?:^|[/\\])target(?:[/\\]|$)/.test(path)});
const overlay=`${ROOT}/rust/pc-core/src/min_cover_four_arm.rs`;
fs.copyFileSync(overlay,`${dest}/rust/pc-core/src/min_cover.rs`);
write(`${dest}/MATERIALIZATION.json`,{mode,originalModuleSha256:sha(fs.readFileSync(`${ROOT}/rust/pc-core/src/min_cover.rs`)),
 overlaySha256:sha(fs.readFileSync(overlay)),onlyOverlayCompiled:true,sourceChangedInProduct:false});

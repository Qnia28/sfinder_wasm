// Reproduction helper: requires separately installed wabt1.0.39 in the isolated
// research clone. Never instantiates/calls the product solver or edits WASM.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const ROOT='C:/Users/2004a/AppData/Local/Temp/opencode/sfinder-a0-tier-diagnosis-20261003';
const require=createRequire(`${ROOT}/package.json`);
const wabt=await require(`${ROOT}/.a0/disassembly/node_modules/wabt`)();
const module=wabt.readWasm(fs.readFileSync(`${ROOT}/wasm/pc_wasm.wasm`),{readDebugNames:false});
try{fs.writeFileSync(new URL('./ORIGINAL_WASM.wat',import.meta.url),module.toText({foldExprs:false,inlineExport:false}),{flag:'wx'});}finally{module.destroy();}

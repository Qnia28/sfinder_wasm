import fs from 'node:fs';
// Auxiliary telemetry, not the measurement scope's enforced resource contract.
export function optionalFile(file, read = name => fs.readFileSync(name, 'utf8')) {
  try { return {path:file,status:'AVAILABLE',value:read(file)}; }
  catch(error) { return {path:file,status:'UNKNOWN',value:null,errorCode:error.code??'READ_ERROR'}; }
}

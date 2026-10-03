import path from 'node:path';
import {fileURLToPath} from 'node:url';
export {ROOT,BASELINE,EXPECTED_WASM,read,write,sha,jsonSha,matrix,context,verify,seal} from '../a0-integrated-revalidation-20261003/common.mjs';
export const HERE=path.dirname(fileURLToPath(import.meta.url));
export const ARMS=['R','A0','M1','M2'];
export const ORDERS=[['R','A0','M2','M1'],['A0','M1','R','M2'],['M1','M2','A0','R'],['M2','R','M1','A0']];

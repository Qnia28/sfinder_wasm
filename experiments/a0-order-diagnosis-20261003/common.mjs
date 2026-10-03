import path from 'node:path';
import {fileURLToPath} from 'node:url';
export {ROOT,read,write,sha,jsonSha,matrix,context,verify,seal} from '../a0-diagnosis-20261003/common.mjs';
export const HERE=path.dirname(fileURLToPath(import.meta.url));
export const MATRIX_ID='board-028--restricted-split--ordinary';

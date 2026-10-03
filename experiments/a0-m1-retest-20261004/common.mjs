import path from 'node:path';
import {fileURLToPath} from 'node:url';
export {ROOT,read,write,sha,jsonSha,matrix,seal} from '../a0-four-arm-20261003/common.mjs';
export const HERE=path.dirname(fileURLToPath(import.meta.url));
export const ARMS=['R','A0','M1'];

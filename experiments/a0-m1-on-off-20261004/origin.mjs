import { HERE, ROOT, read, write } from './common.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
assert(read(`${HERE}/launch.json`).status==='AUTHORIZED_ONE_PRODUCT_ON_OFF_CAMPAIGN');
const id=process.env.GITHUB_RUN_ID;assert(id);
const info=JSON.parse(execFileSync('gh',['api',`repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${id}`],{encoding:'utf8'}));
const origin=Date.parse(info.created_at);assert(Number.isFinite(origin));
write(`${ROOT}/.a0-m1-comparison/ORIGIN.json`,{runId:Number(id),commit:info.head_sha,origin:info.created_at,
  computeDeadline:origin+160*60000,cancelDeadline:origin+175*60000,overallDeadline:origin+180*60000,clockReset:false});

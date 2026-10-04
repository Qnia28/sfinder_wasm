import { HERE, ROOT, read, write } from './common.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const launch=read(`${HERE}/launch.json`);assert(launch.status==='AUTHORIZED_ONE_PRODUCT_ON_OFF_CAMPAIGN');
const id=process.env.GITHUB_RUN_ID;assert(id);
const info=JSON.parse(execFileSync('gh',['api',`repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${id}`],{encoding:'utf8'}));
const first=launch.originRunId?JSON.parse(execFileSync('gh',['api',`repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${launch.originRunId}`],{encoding:'utf8'})):info;
if(launch.originRunId)assert.equal(first.created_at,'2026-10-04T05:03:42Z');
const origin=Date.parse(first.created_at);assert(Number.isFinite(origin));assert(Date.now()<origin+160*60000);
write(`${ROOT}/.a0-m1-comparison/ORIGIN.json`,{runId:Number(id),originRunId:first.id,commit:info.head_sha,origin:first.created_at,
  computeDeadline:origin+160*60000,cancelDeadline:origin+175*60000,overallDeadline:origin+180*60000,clockReset:false});

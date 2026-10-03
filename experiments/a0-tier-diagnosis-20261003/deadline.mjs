import fs from 'node:fs';
import assert from 'node:assert/strict';
import {CAMPAIGN} from './schedule.mjs';
const r=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${CAMPAIGN.originRunId}`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'}});assert(r.ok);
const origin=await r.json();assert.equal(origin.created_at,CAMPAIGN.originCreated);
const deadline=Date.parse(origin.created_at)+CAMPAIGN.computeMinutes*60000;assert(Date.now()<deadline,'Original campaign compute deadline exhausted');
fs.appendFileSync(process.env.GITHUB_OUTPUT,`compute-deadline=${deadline}\n`);
console.log(JSON.stringify({...CAMPAIGN,deadline:new Date(deadline).toISOString(),clockReset:false}));

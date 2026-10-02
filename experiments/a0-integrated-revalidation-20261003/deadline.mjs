import fs from 'node:fs';
import assert from 'node:assert/strict';
const r=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'}});assert(r.ok);
const run=await r.json(),start=Date.parse(run.created_at),deadline=start+160*60000;assert(Number.isFinite(start)&&Date.now()<deadline);
fs.appendFileSync(process.env.GITHUB_OUTPUT,`compute-deadline=${deadline}\n`);console.log(JSON.stringify({runCreated:run.created_at,computeDeadline:new Date(deadline).toISOString(),cancelMinutes:175}));

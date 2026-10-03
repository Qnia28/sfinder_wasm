import fs from 'node:fs';
import assert from 'node:assert/strict';
const r=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/37115091562`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'}});assert(r.ok);
const data=await r.json();assert.equal(data.created_at,'2026-10-03T10:02:53Z');
fs.appendFileSync(process.env.GITHUB_ENV,`CAMPAIGN_ORIGIN_MS=${Date.parse(data.created_at)}\n`);console.log(JSON.stringify({runId:data.id,origin:data.created_at,clockReset:false}));

import fs from 'node:fs';
import assert from 'node:assert/strict';
const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`, { headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' } });
assert(response.ok); const run = await response.json(), start = Date.parse(run.created_at);
assert(Number.isFinite(start)); const deadline = start + 160 * 60000;
assert(Date.now() < deadline); fs.appendFileSync(process.env.GITHUB_OUTPUT, `compute-deadline=${deadline}\n`);
console.log(JSON.stringify({ runCreated: run.created_at, computeDeadline: new Date(deadline).toISOString(), globalWallMinutes: 180 }));

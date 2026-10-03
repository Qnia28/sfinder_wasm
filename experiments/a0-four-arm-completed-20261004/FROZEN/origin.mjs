import assert from 'node:assert/strict';
import {ROOT,HERE,read,write} from './common.mjs';
const launch=read(`${HERE}/launch.json`);assert.equal(launch.status,'AUTHORIZED_EXECUTION');
const r=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'}});assert(r.ok);
const data=await r.json();assert.equal(data.head_sha,process.env.GITHUB_SHA);
write(`${ROOT}/.a0/four/ORIGIN.json`,{runId:data.id,origin:data.created_at,originMs:Date.parse(data.created_at),sourceCommit:data.head_sha,newBoundedCampaign:true,previousCampaignClosed:true,clockResetWithinCampaign:false});

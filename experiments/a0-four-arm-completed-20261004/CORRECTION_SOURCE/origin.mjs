import assert from 'node:assert/strict';
import {ROOT,HERE,read,write} from './common.mjs';
const launch=read(`${HERE}/launch.json`);assert.equal(launch.status,'AUTHORIZED_EXECUTION');
const campaign=read(`${HERE}/CAMPAIGN.json`);
const r=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${campaign.campaignOriginRunId}`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'}});assert(r.ok);
const data=await r.json();assert.equal(data.created_at,campaign.campaignOriginCreatedAt);
write(`${ROOT}/.a0/four/ORIGIN.json`,{runId:data.id,origin:data.created_at,originMs:Date.parse(data.created_at),sourceCommit:process.env.GITHUB_SHA,originSourceCommit:data.head_sha,newBoundedCampaign:true,previousCampaignClosed:true,clockResetWithinCampaign:false});

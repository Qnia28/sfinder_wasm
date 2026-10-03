import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ROOT,read,write,HERE} from './common.mjs';
const campaign=read(`${HERE}/CAMPAIGN.json`),id=campaign.originRunId??Number(process.env.GITHUB_RUN_ID);
const res=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${id}`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'}});assert(res.ok);
const data=await res.json();assert.equal(data.id,id);if(campaign.originCreatedAt)assert.equal(data.created_at,campaign.originCreatedAt);
else assert.equal(data.head_sha,process.env.GITHUB_SHA);
fs.mkdirSync(`${ROOT}/.a0/m1`,{recursive:true});
write(`${ROOT}/.a0/m1/ORIGIN.json`,{runId:id,origin:data.created_at,originMs:Date.parse(data.created_at),sourceCommit:process.env.GITHUB_SHA,
 originSourceCommit:data.head_sha,clockResetWithinCampaign:false,newCampaignAfterClosedPrior:true});

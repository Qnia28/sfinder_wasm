// Generates a DRAFT only. Historical audit/preflight/source freeze is separate.
import { readJson, writeJson } from './contracts.mjs';
import { POLICY, DEFAULT_LIMITS } from './campaign.mjs';
const [proposalFile, outputFile] = process.argv.slice(2);
const proposal = readJson(proposalFile);
writeJson(outputFile, { schema: 2, state: 'DRAFT', campaignId: 'secondary-wide-20261005',
  approvalRecord: '2026-10-05 user: two pattern families; N+1 or N+2 once; 60s; 2+2 up to10; extra admission before6h; wall cap8h; continue preparation',
  purpose: 'information', lifecycle: 'fresh-process-cold', exactHumanQuality: 'true',
  originPolicy: 'GITHUB_RUN_CREATED_AT', originUtc: null, repeatUnit: 'ENGINE_X_FIXTURE',
  scheduleSeed: proposal.selectionSeed, policy: POLICY,
  limits: Object.fromEntries(['integrated', 'threshold', 'cpsat'].map(engine => [engine, DEFAULT_LIMITS])),
  cpLimitMs: 60000, captureLimits: DEFAULT_LIMITS, capturePhaseLimits: { enumeration: 60000, primary: 60000 },
  fixtureSelection: 'ONE_PER_COMMAND_HASH', commands: proposal.commands, sourceFiles: {},
  inputProposalSummary: proposal.summary,
  pending: ['Full exposure audit and explicit final save-filter sampling freeze', 'Linux cgroup/Actions watchdog and partial-artifact preflight',
    'Complete source lock for current source/workflows', 'Only after these checks change state to APPROVED_TEMPLATE'] });

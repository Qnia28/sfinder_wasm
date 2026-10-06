# Benchmark work: serve the experiment

- Start from the current experiment question and named population. For Astra A/B,
  compare actual policy cost and completion coverage on ALL; per-save and seed
  diagnostics are separate supporting evidence. Follow
  `planning/TRIAGE_PURPOSE_ALIGNMENT_20261006_KO.md` for current adjudication.
- Distinguish execution validity, evidence completeness, measurement uncertainty,
  and candidate selection. A valid negative result is not a harness failure.
- Stop collection for invalid input/witness/proof, changed execution conditions,
  unreclaimed processes, missing evidence, or exhausted budget. Record normal
  censored outcomes and candidate regressions for analysis.
- A two-pair timing screen is not confirmed overhead. Under the explicit v2
  contract, report it with raw pairs and restrict claims; do not block collection,
  loosen its numeric threshold after observing results, or retry until it passes.
- For every added prerequisite, explain its connection to the experiment question,
  the invalid comparison it prevents, and its call/time/collection cost. Prefer
  the existing common executor, indexed history, and zero-solver reanalysis.
- Keep original hashes, run/phase/revision identities, UNKNOWN/NOT_RUN/censored
  states, original clock, and cumulative budgets. Reuse verified completed phases
  after adjudication-only changes rather than rerunning them automatically.
- New adjudication is a versioned manifest contract. Do not rewrite historical
  FAIL reports or confuse an Actions success/evidence PASS with a performance win.
- Explain the actual failure or review reason in console/Actions Summary, not
  only inside an uploaded artifact. Keep summaries and claims phase-specific.

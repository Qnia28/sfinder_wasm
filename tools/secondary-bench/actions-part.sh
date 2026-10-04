#!/usr/bin/env bash
# Owned systemd scope only. Raw errors are artifact data, not workflow failures.
set -u
part="$1"
mkdir -p "results/part-${part}"
set +e
sudo systemd-run --unit="secondary-${GITHUB_RUN_ID}-${STAGE}-${CHUNK}-${part}" --wait --pipe --collect \
  --property=MemoryMax=3G --property=MemorySwapMax=0 --property=RuntimeMaxSec=600 \
  --property=KillMode=control-group --uid="$(id -u)" --working-directory="$GITHUB_WORKSPACE" \
  /usr/bin/env PATH="$PATH" GITHUB_RUN_ID="$GITHUB_RUN_ID" GITHUB_JOB="$GITHUB_JOB" \
  GITHUB_RUN_ATTEMPT="$GITHUB_RUN_ATTEMPT" \
  node tools/secondary-bench/run-chunk.mjs bundle "$CHUNK" "results/part-${part}/data" "$part" results/STOP_FOR_REVIEW.json
status=$?
printf '%s\n' "$status" > "results/part-${part}/scope-exit-code.txt"
if [ "$status" -ne 0 ]; then
  printf '{"reason":"systemd scope failure","exitCode":%s}\n' "$status" > results/STOP_FOR_REVIEW.json
fi
exit 0

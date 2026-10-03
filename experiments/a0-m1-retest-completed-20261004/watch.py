"""One blocking gh watcher with an absolute campaign cancellation deadline."""
import datetime
import json
from pathlib import Path
import subprocess
import sys
import time

run_id=sys.argv[1]
repo="Qnia28/sfinder_wasm"
out=Path(__file__).parent/f"github-run-{run_id}"
out.mkdir(exist_ok=True)
def gh(*args,check=True):
    return subprocess.run(["gh",*args,"--repo",repo],capture_output=True,text=True,encoding="utf-8",check=check)
# The API command uses a route, not --repo.
budget_source=sys.argv[2] if len(sys.argv)>2 else run_id
initial=subprocess.check_output(["gh","api",f"repos/{repo}/actions/runs/{budget_source}"],text=True,encoding="utf-8")
data=json.loads(initial)
(out/"INITIAL_RUN.json").write_text(initial,encoding="utf-8")
created=datetime.datetime.fromisoformat(data["created_at"].replace("Z","+00:00")).timestamp()
cancel_at=created+175*60
with (out/"watch.log").open("w",encoding="utf-8") as log:
    watch=subprocess.Popen(["gh","run","watch",run_id,"--repo",repo,"--exit-status","--interval","20"],stdout=log,stderr=subprocess.STDOUT)
    try:
        code=watch.wait(timeout=max(1,cancel_at-time.time()))
        cancelled=False
    except subprocess.TimeoutExpired:
        cancel=gh("run","cancel",run_id,check=False)
        (out/"WALL_DEADLINE_CANCEL.txt").write_text(cancel.stdout+cancel.stderr,encoding="utf-8")
        cancelled=True
        try:code=watch.wait(timeout=240)
        except subprocess.TimeoutExpired:
            watch.terminate()
            code=watch.wait(timeout=10)

download=gh("run","download",run_id,"--dir",str(out),check=False)
(out/"download.log").write_text(download.stdout+download.stderr,encoding="utf-8")
view=gh("run","view",run_id,"--json","databaseId,status,conclusion,headSha,jobs,url",check=False)
(out/"RUN.json").write_text(view.stdout,encoding="utf-8")
with (out/"actions.log").open("w",encoding="utf-8") as log:
    subprocess.run(["gh","run","view",run_id,"--repo",repo,"--log"],stdout=log,stderr=subprocess.STDOUT,check=False)
artifacts=subprocess.run(["gh","api",f"repos/{repo}/actions/runs/{run_id}/artifacts?per_page=100"],capture_output=True,text=True,encoding="utf-8")
(out/"ARTIFACTS.json").write_text(artifacts.stdout,encoding="utf-8")
decision={"runId":int(run_id),"watchExit":code,"downloadExit":download.returncode,"cancelledAtWallDeadline":cancelled,
          "globalBudgetSourceRunId":int(budget_source),
          "overallWallLimitMinutes":180,"cancelAtMinutes":175,"resultsPreserved":download.returncode==0}
(out/"WATCH_DECISION.json").write_text(json.dumps(decision,indent=2)+"\n",encoding="utf-8")
print(json.dumps(decision,indent=2))
if code or download.returncode:sys.exit(1)

// Compatibility surface only. Execution, scopes, admission and transport are
// owned by the established common executor, not a second triage task loop.
import { executeTask as executeCommonTask } from '../executor.mjs';
export { runChunk } from '../executor.mjs';
export function executeTask(lock, task, bundle, directory, state, options = {}) {
  return executeCommonTask(lock, { stage:task.phase }, { ...task,adapter:'triage-fixture' },
    bundle,directory,state,{checkpointsRemaining:1,...options});
}

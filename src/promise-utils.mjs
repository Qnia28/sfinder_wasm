/**
 * Single-flight loader with a retry-safe cache.
 *
 * Wraps a factory so that:
 *
 * 1. concurrent callers share one in-flight promise;
 * 2. a resolved value stays cached for the lifetime of the module/realm;
 * 3. a rejection clears the cache, so the next caller starts a fresh attempt
 *    instead of awaiting a permanently poisoned promise;
 * 4. a stale rejection handler cannot clear a newer attempt: it only clears the
 *    cache while the cache still holds its own promise.
 *
 * `??=` alone gives 1 and 2 but not 3. Invariant 4 is the identity check in the
 * handler below: an attempt clears the cache only while the cache still holds
 * that attempt. On this loader alone the check cannot currently fire -- the
 * cache is reassigned only by `load()`, and only while it is empty -- so it is
 * a guard rather than a reachable behavior. It is kept because the unconditional
 * `catch { current = null }` it replaces is unsafe the moment any other path
 * reassigns the cache, and because that is the exact failure #6 requires ruling
 * out.
 *
 * A synchronous throw from `factory` is turned into a rejection, so it is
 * retryable on the same terms.
 */
export function retryableLoader(factory) {
  let current = null;
  return function load() {
    if (current) return current;
    const attempt = Promise.resolve()
      .then(() => factory())
      .catch((error) => {
        if (current === attempt) current = null;
        throw error;
      });
    current = attempt;
    return attempt;
  };
}

/**
 * Per-key `retryableLoader`, with the same four invariants held independently
 * for each key. Used for the Worker's solver-per-height cache, where two
 * concurrent requests at the same height must share one construction.
 */
export function keyedRetryableLoader(factory) {
  const loaders = new Map();
  return function load(key) {
    let loader = loaders.get(key);
    if (!loader) {
      loader = retryableLoader(() => factory(key));
      loaders.set(key, loader);
    }
    return loader();
  };
}

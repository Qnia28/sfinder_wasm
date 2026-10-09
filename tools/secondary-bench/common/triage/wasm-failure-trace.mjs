// Diagnostic-only interception: unchanged WASM bytes, arguments, return and throw.
export function installWasmFailureTrace(trace, wasm = WebAssembly) {
  const instantiate = wasm.instantiate, promising = wasm.promising;
  if (typeof promising !== 'function') throw new Error('native failure diagnostic requires JSPI');
  const exports = new WeakMap();
  const describe = error => ({
    thrownType: typeof error, constructor: error?.constructor?.name ?? null,
    name: error?.name ?? null, message: error?.message ?? null,
    string: String(error), stack: error?.stack ?? null,
    wasmException: typeof wasm.Exception === 'function' && error instanceof wasm.Exception,
  });
  wasm.instantiate = async function (bytes, imports) {
    const env = imports?.env, memory = env?.memory, resize = env?.emscripten_resize_heap;
    const state = { memory, lastGrowth: null };
    if (memory && typeof resize === 'function') {
      const wrapped = requested => {
        const before = memory.buffer.byteLength;
        try {
          const result = resize(requested);
          state.lastGrowth = { requestedBytes: requested >>> 0, beforeBytes: before,
            afterBytes: memory.buffer.byteLength, accepted: Boolean(result) };
          trace('wasm-resize-result', state.lastGrowth);
          return result;
        } catch (error) {
          trace('wasm-resize-throw', { requestedBytes: requested >>> 0, wasmBytes: memory.buffer.byteLength, ...describe(error) });
          throw error;
        }
      };
      // env and wasi can refer to the same object. Keep that alias relationship.
      const replacement = { ...env, emscripten_resize_heap: wrapped };
      imports = Object.fromEntries(Object.entries(imports).map(([name, value]) => [name, value === env ? replacement : value]));
    }
    const result = await Reflect.apply(instantiate, wasm, [bytes, imports]);
    const instance = result.instance ?? result;
    for (const [name, value] of Object.entries(instance.exports)) {
      if (typeof value === 'function') exports.set(value, { name, state });
    }
    if (memory) trace('wasm-instantiated', { wasmBytes: memory.buffer.byteLength });
    return result;
  };
  wasm.promising = function (fn) {
    const invoke = Reflect.apply(promising, wasm, [fn]), ref = exports.get(fn);
    if (!ref || !['solve_model', 'solve_model_with_callback_events'].includes(ref.name)) return invoke;
    return async function (...args) {
      try {
        const result = await Reflect.apply(invoke, this, args);
        trace('wasm-export-return', { exportName: ref.name, wasmBytes: ref.state.memory?.buffer.byteLength ?? null });
        return result;
      } catch (error) {
        trace('wasm-export-throw', { exportName: ref.name, wasmBytes: ref.state.memory?.buffer.byteLength ?? null,
          lastGrowth: ref.state.lastGrowth, ...describe(error) });
        throw error;
      }
    };
  };
  return () => { wasm.instantiate = instantiate; wasm.promising = promising; };
}

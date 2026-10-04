process.argv = [process.execPath, new URL('../download-artifacts.mjs', import.meta.url).pathname,
  process.env.INPUT_REPOSITORY, process.env['INPUT_RUN-ID'], process.env.INPUT_PATH, process.env.INPUT_PREFIX];
await import('../download-artifacts.mjs');

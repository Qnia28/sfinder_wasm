// Only invoked inside an owned Linux 3GiB contract scope, never directly/local.
const buffers = [];
process.once('message', () => { for (;;) buffers.push(Buffer.alloc(64 * 1024 * 1024, 0xa5)); });
process.send({ event: 'ready' });

const mode = process.argv[2];
if (mode === 'startup-hang') while (true) {}
if (mode === 'integrated-hang') { process.send?.({ type: 'phase-start', engine: 'integrated' }); while (true) {} }
if (mode === 'threshold-hang') { process.send?.({ type: 'phase-start', engine: 'threshold' }); while (true) {} }
if (mode === 'two-phases') {
  for (const engine of ['integrated', 'threshold']) {
    process.send?.({ type: 'phase-start', engine });
    const start = performance.now(); while (performance.now() - start < 150) {}
    process.send?.({ type: 'phase-done', engine });
  }
}
console.log(JSON.stringify({ status: 'EXACT' }));

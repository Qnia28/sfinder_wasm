import path from 'node:path';
export default {
  root: path.resolve(import.meta.dirname,'..'),
  build:{outDir:'.a0-m1-build/browser',emptyOutDir:false,rollupOptions:{input:path.join(import.meta.dirname,'a0-m1-browser.html')}},
  worker:{format:'es'},
};

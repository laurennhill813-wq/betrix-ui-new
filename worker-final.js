// Small ESM wrapper so starting `node worker-final.js` from project root works on platforms
// that run node from the repo root (like Render). This simply imports the real worker
// implementation located in ./src/worker-final.js which contains the main() invocation.

import './src/worker-final.js';

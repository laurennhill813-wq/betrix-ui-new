/**
 * BETRIX Worker Entry Point
 * Routes to the main database-integrated worker
 */

import('./worker-db.js').catch(err => {
  console.error('❌ Failed to start BETRIX worker:', err);
  process.exit(1);
});

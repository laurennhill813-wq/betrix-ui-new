import { getEnv } from '../utils/env.js';

// Lightweight DB initializer: prefer Drizzle (node-postgres adapter) when available,
// otherwise expose a minimal `query` wrapper around `pg` Pool. Caller should
// call `initDb()` during startup and manage lifecycle (pool.end()).

export async function initDb() {
  const databaseUrl = getEnv('DATABASE_URL', { required: false, defaultValue: '' });

  // Try to initialize Drizzle + node-postgres if available
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: databaseUrl || undefined, max: 10 });

    // Attempt to wire drizzle if it's installed. If not, fall back to raw pool.
    try {
      const { drizzle } = await import('drizzle-orm/node-postgres');
      const db = drizzle(pool);
      return { type: 'drizzle', db, pool };
    } catch (e) {
      // Drizzle not installed — return raw pool wrapper
      return {
        type: 'pg',
        pool,
        query: (...args) => pool.query(...args),
      };
    }
  } catch (err) {
    throw new Error('Failed to initialize database client: ' + String(err));
  }
}

export default initDb;

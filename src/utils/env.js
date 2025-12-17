import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env if present (only for local/dev). Production systems should supply env externally.
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

function getEnv(key, { required = false, defaultValue } = {}) {
  const v = process.env[key];
  if ((v === undefined || v === '') && required && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  if ((v === undefined || v === '') && defaultValue !== undefined) return defaultValue;
  return v;
}

export { getEnv };

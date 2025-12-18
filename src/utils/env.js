import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment files in order of preference for local/dev: .env.local -> .env
// Production systems should supply env externally and not rely on these files.
const localEnv = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

function getEnv(key, { required = false, defaultValue } = {}) {
  const v = process.env[key];
  if ((v === undefined || v === "") && required && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  if ((v === undefined || v === "") && defaultValue !== undefined)
    return defaultValue;
  return v;
}

export { getEnv };

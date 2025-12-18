export const PROVIDER_CONFIG = {
  SPORTRADAR_KEY: process.env.SPORTRADAR_KEY || "",
  REDIS_URL: process.env.REDIS_URL || "",
};

export const REQUIRED_ENVS = ["SPORTRADAR_KEY", "REDIS_URL"];

import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT ? Number(process.env.PORT) : 8080,

  sportradarKey: process.env.SPORTRADAR_API_KEY || null,

  bucket: {
    name: process.env.BUCKET_NAME || null,
    region: process.env.BUCKET_REGION || process.env.AWS_REGION || "us-east-1",
    accessKey: process.env.AWS_ACCESS_KEY_ID || null,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY || null,
  },

  limits: {
    maxAssetBytes: parseInt(process.env.MAX_ASSET_MB || "5", 10) * 1024 * 1024,
    timeoutMs: Number(process.env.FETCH_TIMEOUT_MS || 10000),
  },

  signMode: process.env.SIGN_MODE || "proxy",

  security: {
    allowedIPs: (process.env.ALLOWED_IPS || "0.0.0.0/0")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
};

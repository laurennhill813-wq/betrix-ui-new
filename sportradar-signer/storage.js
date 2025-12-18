import AWS from "aws-sdk";
import path from "path";
import fs from "fs/promises";
import express from "express";
import { config } from "./config.js";

// If BUCKET_NAME is provided, use S3. Otherwise use a local filesystem fallback
let useS3 = Boolean(config.bucket && config.bucket.name);
let s3 = null;
if (useS3) {
  AWS.config.update({
    accessKeyId: config.bucket.accessKey,
    secretAccessKey: config.bucket.secretKey,
    region: config.bucket.region,
  });
  s3 = new AWS.S3();
}

const LOCAL_TMP_DIR = path.join(process.cwd(), "sportradar-signer-tmp");

export async function uploadTempBuffer(
  buffer,
  key,
  contentType = "application/octet-stream",
) {
  if (useS3) {
    await s3
      .putObject({
        Bucket: config.bucket.name,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: "private",
      })
      .promise();
    return;
  }

  // filesystem fallback: write to local tmp dir
  const dest = path.join(LOCAL_TMP_DIR, key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, Buffer.from(buffer));
}

export function getPresignedUrl(key, expiresSec = 60) {
  if (useS3) {
    return s3.getSignedUrl("getObject", {
      Bucket: config.bucket.name,
      Key: key,
      Expires: expiresSec,
    });
  }

  // filesystem fallback: serve via local signer server route
  const port = config.port || 8080;
  // encode key for URL path
  const enc = encodeURIComponent(key);
  return `http://localhost:${port}/_signer_local/${enc}`;
}

// Export helper for server to mount static files when using local fallback
export function localTmpDir() {
  return LOCAL_TMP_DIR;
}

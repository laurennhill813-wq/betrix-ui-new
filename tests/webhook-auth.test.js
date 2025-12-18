import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";

test("webhook auth present in worker code", async () => {
  const worker = readFileSync("src/worker.js", "utf8");
  assert.ok(
    worker.includes("WEBHOOK_SECRET") ||
      worker.includes("TELEGRAM_WEBHOOK_SECRET"),
    "worker should reference webhook secret token",
  );
});

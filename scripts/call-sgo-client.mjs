import dotenv from "dotenv";
import path from "path";
import { sgo } from "../src/services/sportsgameodds-client.js";

for (const f of [".env.local.fixed", ".env.local", ".env"]) {
  try {
    dotenv.config({ path: path.resolve(process.cwd(), f) });
  } catch (_) {}
}

(async () => {
  console.log("Calling sgo /odds/football");
  const r = await sgo("/odds/football");
  console.log("RESULT:", {
    status: r.status,
    ok: r.ok,
    bodyType: typeof r.body,
  });
  if (typeof r.body === "string")
    console.log("BODY_TEXT:", r.body.substring(0, 500));
  else
    console.log("BODY_JSON_SAMPLE:", JSON.stringify(r.body).substring(0, 500));
  process.exit(0);
})();

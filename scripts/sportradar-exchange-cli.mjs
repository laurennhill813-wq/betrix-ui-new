#!/usr/bin/env node
import fetch from "node-fetch";
import readline from "readline";

function ask(q) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((res) =>
    rl.question(q, (a) => {
      rl.close();
      res(a);
    }),
  );
}

async function main() {
  console.log("Sportradar exchange helper");
  const endpoint =
    process.env.SPORTRADAR_SIGN_ENDPOINT ||
    (await ask("Signing endpoint (SPORTRADAR_SIGN_ENDPOINT): "));
  if (!endpoint) {
    console.error(
      "No signing endpoint provided. Set SPORTRADAR_SIGN_ENDPOINT or enter it now.",
    );
    process.exit(2);
  }
  const asset = await ask("Asset URL to exchange: ");
  if (!asset) {
    console.error("No asset URL provided.");
    process.exit(2);
  }

  console.log("Posting to signing endpoint...");
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: asset }),
    });
    const j = await res.json();
    console.log("Signing endpoint response:", JSON.stringify(j, null, 2));
    const signed = j && (j.signedUrl || j.url || j.signed_url || null);
    if (!signed) {
      console.error("No signedUrl found in response.");
      process.exit(3);
    }
    console.log("Attempting to fetch signed URL: ", signed);
    const r2 = await fetch(signed, {
      redirect: "follow",
      headers: { "User-Agent": "BetrixBot/1.0 (+https://betrix.example)" },
    });
    console.log("Fetch status:", r2.status, r2.statusText);
    if (r2.ok) {
      console.log(
        "Signed URL appears fetchable. Content-Type:",
        r2.headers.get("content-type"),
      );
    } else {
      console.error("Signed URL fetch failed.");
    }
  } catch (e) {
    console.error("Error contacting signing endpoint:", e && e.message);
    process.exit(4);
  }
}

if (require.main === module) main();

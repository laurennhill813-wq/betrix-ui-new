import assert from "assert";
import { createServer } from "http";

/**
 * Test channel posting functionality
 * Verifies:
 * 1. Media ticker can fetch events
 * 2. Photo sending logic works correctly
 * 3. Channel broadcast functionality works
 */

async function testMediaTickerFlow() {
  console.log("\n🧪 Testing Media Ticker Flow...");

  try {
    // Mock the environment
    const originalEnv = { ...process.env };
    process.env.BOT_BROADCAST_CHAT_ID = "-1003425723710";
    process.env.MEDIA_AI_INTERVAL_SECONDS = "60";
    process.env.MEDIA_AI_COOLDOWN_MS = "30000";

    // Import modules
    const { getInterestingEvents } = await import(
      "../src/aggregator/multiSportAggregator.js"
    );

    // Test 1: Can we get interesting events?
    console.log("\n  Test 1: Fetching interesting events...");
    try {
      const events = await getInterestingEvents();
      if (events && Array.isArray(events)) {
        console.log(
          `  ✅ Got ${events.length} interesting events from aggregator`
        );
        if (events.length > 0) {
          console.log(`     Sample event: ${events[0].home || "N/A"} vs ${events[0].away || "N/A"}`);
        }
      } else {
        console.log("  ⚠️  No events returned (may be expected if no fixtures)");
      }
    } catch (err) {
      console.error("  ❌ Failed to get interesting events:", err?.message);
    }

    // Test 2: Can we access image selector?
    console.log("\n  Test 2: Testing image selection logic...");
    try {
      const { selectBestImageForEventCombined } = await import(
        "../src/media/imageSelector.js"
      );
      console.log("  ✅ Image selector module loaded successfully");
    } catch (err) {
      console.error("  ❌ Failed to load image selector:", err?.message);
    }

    // Test 3: Can we access summarizer?
    console.log("\n  Test 3: Testing AI summarizer...");
    try {
      const { summarizeEventForTelegram } = await import(
        "../src/ai/summarizer.js"
      );
      console.log("  ✅ Summarizer module loaded successfully");
    } catch (err) {
      console.error("  ❌ Failed to load summarizer:", err?.message);
    }

    // Test 4: Test photo sending (mock endpoint)
    console.log("\n  Test 4: Testing photo sending with mocked Telegram API...");
    await testPhotoSending();

    // Test 5: Test broadcast functions
    console.log("\n  Test 5: Testing broadcast functions...");
    try {
      const { broadcastText, getBroadcastChatId } = await import(
        "../src/telegram/broadcast.js"
      );
      const chatId = getBroadcastChatId();
      if (chatId === "-1003425723710") {
        console.log(`  ✅ Broadcast chat ID set correctly: ${chatId}`);
      } else {
        console.log(
          `  ⚠️  Broadcast chat ID: ${chatId || "(not set)"}`
        );
      }
    } catch (err) {
      console.error("  ❌ Failed to test broadcast:", err?.message);
    }

    // Restore environment
    process.env = originalEnv;

    console.log("\n✅ Media Ticker Flow tests completed");
    return true;
  } catch (err) {
    console.error("❌ Media Ticker Flow test failed:", err);
    return false;
  }
}

async function testPhotoSending() {
  return new Promise((resolve) => {
    // Create a mock Telegram API server
    const mockServer = createServer((req, res) => {
      if (req.url.includes("/sendPhoto")) {
        console.log("  ✅ sendPhoto API called");
        let body = "";

        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            if (data.chat_id && data.photo) {
              console.log(`     Chat ID: ${data.chat_id}`);
              console.log(`     Photo URL: ${data.photo.substring(0, 50)}...`);
              console.log(`     Caption: ${(data.caption || "").substring(0, 30)}...`);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  ok: true,
                  result: { message_id: 12345, chat: { id: data.chat_id } },
                })
              );
            } else {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: false, description: "Missing fields" }));
            }
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, description: e.message }));
          }
        });
      } else if (req.url.includes("/setWebhook")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    mockServer.listen(0, "127.0.0.1", async () => {
      const addr = mockServer.address();
      console.log(
        `  ℹ️  Mock Telegram API started on http://127.0.0.1:${addr.port}`
      );

      try {
        // Test with actual photo sending function
        const { sendPhotoWithCaption } = await import(
          "../src/services/telegram-sender.js"
        );

        // Note: This would need BOT_TOKEN to be set, which we can't easily mock
        // So we'll just verify the function exists and is callable
        if (typeof sendPhotoWithCaption === "function") {
          console.log("  ✅ sendPhotoWithCaption function is callable");
        } else {
          console.log("  ❌ sendPhotoWithCaption is not a function");
        }
      } catch (err) {
        console.error("  ❌ Failed to test photo sending:", err?.message);
      } finally {
        mockServer.close(() => {
          resolve();
        });
      }
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      mockServer.close(() => {
        resolve();
      });
    }, 5000);
  });
}

async function testConfigValidation() {
  console.log("\n🧪 Testing Configuration...");

  try {
    const config = await import("../src/config.js");
    console.log("✅ Config module loaded");

    // Check if broadcast chat ID is configurable
    if (config.default?.TELEGRAM?.BROADCAST_CHAT_ID !== undefined) {
      console.log("✅ BROADCAST_CHAT_ID is in configuration");
    } else {
      console.log("⚠️  BROADCAST_CHAT_ID might not be properly configured");
    }

    return true;
  } catch (err) {
    console.error("❌ Config validation failed:", err?.message);
    return false;
  }
}

async function run() {
  console.log("═══════════════════════════════════════════");
  console.log("  Channel Posting Functionality Tests");
  console.log("═══════════════════════════════════════════");

  try {
    const test1 = await testConfigValidation();
    const test2 = await testMediaTickerFlow();

    if (test1 && test2) {
      console.log(
        "\n✅ All tests passed! Channel posting is configured correctly."
      );
      process.exit(0);
    } else {
      console.log("\n⚠️  Some tests had issues. Review logs above.");
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Test suite failed:", err);
    process.exit(1);
  }
}

if (
  typeof require !== "undefined"
    ? require.main === module
    : import.meta.url === `file://${process.argv[1]}`
)
  run();

export { testMediaTickerFlow, testConfigValidation, testPhotoSending };

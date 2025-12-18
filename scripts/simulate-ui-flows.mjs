import createRedisAdapter from "../src/utils/redis-adapter.js";
import {
  handleMessage,
  handleCallbackQuery,
} from "../src/handlers/telegram-handler-v2.js";

async function run() {
  const adapter = createRedisAdapter(null); // in-memory mock
  const chatId = 9999;
  const userId = 123456;

  console.log("--- Simulate: Press Sign Up (signup_start) ---");
  const cbPayload = { data: "signup_start" };
  const res1 = await handleCallbackQuery(
    cbPayload.data,
    chatId,
    userId,
    adapter,
    {},
    cbPayload,
  ).catch((e) => ({ error: String(e) }));
  console.log("Callback result:", res1);

  // Inspect onboarding state keys
  const onboardKey = `user:${userId}:onboarding`;
  const signupStateKey = `signup:${userId}:state`;
  console.log("onboarding key value:", await adapter.get(onboardKey));
  console.log("signup state key value:", await adapter.get(signupStateKey));

  console.log("\n--- Simulate: Send name during onboarding ---");
  const msgUpdate = {
    message: {
      chat: { id: chatId },
      text: "Alice Example",
      from: { id: userId },
    },
  };
  // If the handler expects the legacy signup state, set it to awaiting_name to simulate that flow
  await adapter.set(signupStateKey, "awaiting_name");
  const res2 = await handleMessage(msgUpdate, adapter, {}).catch((e) => ({
    error: String(e),
  }));
  console.log("Message handler result:", res2);

  console.log("\n--- Simulate: Press Talk to BETRIX AI (mod_ai_chat) ---");
  const cb2 = { data: "mod_ai_chat" };
  const res3 = await handleCallbackQuery(
    cb2.data,
    chatId,
    userId,
    adapter,
    {},
    cb2,
  ).catch((e) => ({ error: String(e) }));
  console.log("AI Callback result:", res3);
  console.log(
    "onboarding key after AI callback:",
    await adapter.get(onboardKey),
  );

  console.log(
    "\n--- Simulate: Ask a question to BETRIX AI via chat message ---",
  );
  const questionUpdate = {
    message: {
      chat: { id: chatId },
      text: "What are the best value bets today?",
      from: { id: userId },
    },
  };
  const res4 = await handleMessage(questionUpdate, adapter, {
    aiService: {},
  }).catch((e) => ({ error: String(e) }));
  console.log("AI message handler result:", res4);
}

run()
  .then(() => console.log("\nSimulation complete"))
  .catch((err) => {
    console.error("Sim failed", err);
    process.exit(1);
  });

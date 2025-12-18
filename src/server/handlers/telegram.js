const { sendText } = require("../utils/send");
const { ask } = require("../utils/openai");

module.exports.handleTelegram = async (update, _ctx) => {
  const message = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;
  if (!message || !chatId) return;

  const lower = message.toLowerCase();
  const isFootball =
    /(arsenal|man city|odds|fixtures|scores|match|goal|jackpot|betrix|vip|fixed|football|analyse|stats|live)/.test(
      lower,
    );

  const reply = await ask(message);

  await sendText(chatId, reply);
};

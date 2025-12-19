import MockRedis from "../helpers/mock-redis.js";
import LiveFeedHandler from "../../src/handlers/live-feed-handler.js";

class MockBot {
  constructor() {
    this.sent = [];
  }
  async sendMessage(chatId, text, opts) {
    this.sent.push({ chatId, text, opts });
    return true;
  }
  onText() {}
}

test("/fixtures and /teams honor ACTIVE state and return formatted results", async () => {
  const redis = new MockRedis();
  // set user active
  await redis.set("user:999", JSON.stringify({ state: "ACTIVE" }));

  const mockAggregator = {
    getFixtures: async () => [{ home: "X", away: "Y", startTime: "2025-12-21T10:00:00Z" }],
    getUpcomingBySport: async (sport) => [{ home: "A", away: "B", startTime: "2025-12-22T11:00:00Z" }],
  };

  const bot = new MockBot();
  const handler = new LiveFeedHandler(bot, mockAggregator, redis);

  // fixtures default (football)
  await handler.handleFixturesCommand({ chat: { id: 999 }, text: "/fixtures", from: { id: 999 } });
  expect(bot.sent.length).toBeGreaterThan(0);
  expect(bot.sent[0].text).toContain("Upcoming");

  // fixtures for nba
  await handler.handleFixturesCommand({ chat: { id: 999 }, text: "/fixtures nba", from: { id: 999 } });
  expect(bot.sent[1].text).toMatch(/NBA|🏀|Upcoming/);

  // teams command
  await handler.handleTeamsCommand({ chat: { id: 999 }, text: "/teams nba", from: { id: 999 } });
  expect(bot.sent[2].text).toContain("Teams");
});

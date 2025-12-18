import { getUnifiedOddsWithFair } from "../../services/odds-aggregator.js";

const ADMIN_IDS = (process.env.TELEGRAM_ADMINS || "")
  .split(",")
  .filter(Boolean);

export async function handleDebugEvent(ctx) {
  const userId = String(ctx.from.id);
  if (!ADMIN_IDS.includes(userId)) return ctx.reply("Not authorized.");

  const parts = ctx.message.text.split(" ").filter(Boolean);
  if (parts.length < 2) return ctx.reply("Usage: /debug_event <eventId>");
  const eventId = parts[1];

  const sports = [
    { sport: "football", league: "nfl" },
    { sport: "basketball", league: "nba" },
    { sport: "baseball", league: "mlb" },
    { sport: "hockey", league: "nhl" },
  ];

  let found = null;
  for (const s of sports) {
    const events = await getUnifiedOddsWithFair(s);
    const ev = events.find((e) => String(e.eventId) === String(eventId));
    if (ev) {
      found = { ...ev, ...s };
      break;
    }
  }

  if (!found) return ctx.reply(`No event found for id: ${eventId}`);

  const providersDump = found.providers
    .map((p) =>
      [
        `Provider: ${p.provider}`,
        `Bookmaker: ${p.bookmaker}`,
        `ML: H ${p.markets.moneyline.home} | A ${p.markets.moneyline.away}`,
      ].join("\n"),
    )
    .join("\n\n");

  const fair = found.fair;
  const fairDump = fair
    ? [
        `Fair Prob: H ${(fair.fair.homeProb * 100).toFixed(2)}% | A ${(fair.fair.awayProb * 100).toFixed(2)}%`,
        `Fair ML: H ${fair.fair.homeOdds} | A ${fair.fair.awayOdds}`,
        `Best Home: ${fair.bestOffers.home.bookmaker} @ ${fair.bestOffers.home.homeOdds ?? fair.bestOffers.home.odds}`,
        `Best Away: ${fair.bestOffers.away.bookmaker} @ ${fair.bestOffers.away.awayOdds ?? fair.bestOffers.away.odds}`,
      ].join("\n")
    : "No fair odds computed.";

  const msg = [
    `🛠 Debug Event ${found.eventId}`,
    `${found.sport.toUpperCase()} | ${found.league.toUpperCase()}`,
    `${found.homeTeam} vs ${found.awayTeam}`,
    `Starts: ${found.startsAt}`,
    "",
    providersDump,
    "",
    fairDump,
  ].join("\n");

  return ctx.reply(msg);
}

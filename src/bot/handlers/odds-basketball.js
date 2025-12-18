import { getUnifiedOddsWithFair } from "../../services/odds-aggregator.js";
import { getUserTier } from "../../services/user-tiers.js";

export async function handleBasketballOdds(ctx) {
  const userId = String(ctx.from.id);
  const tier = await getUserTier(userId);

  const events = await getUnifiedOddsWithFair({
    sport: "basketball",
    league: "nba",
  });

  if (!events || events.length === 0) {
    return ctx.reply(
      "No NBA odds available right now. Try again in a few minutes.",
    );
  }

  const top = events.slice(0, 5);

  const lines = top.map((ev) => {
    const header = `🏀 NBA | ${ev.homeTeam} vs ${ev.awayTeam}\n🕒 ${ev.startsAt}`;
    const providerSample = ev.providers?.[0];

    const basicLine =
      providerSample && providerSample.markets?.moneyline
        ? `💰 Moneyline: H ${providerSample.markets.moneyline.home} | A ${providerSample.markets.moneyline.away} (${providerSample.bookmaker})`
        : "💰 Moneyline: (no line available)";

    const consensusLine = ev.fair?.consensus
      ? `📊 Consensus: H ${(ev.fair.consensus.homeProb * 100).toFixed(1)}% | A ${(ev.fair.consensus.awayProb * 100).toFixed(1)}%`
      : null;

    const vipLines =
      tier === "vip" && ev.fair?.fair && ev.fair?.bestOffers
        ? [
            `🎯 Fair ML: H ${ev.fair.fair.homeOdds} | A ${ev.fair.fair.awayOdds}`,
            `💎 Best Home: ${ev.fair.bestOffers.home.bookmaker} @ ${ev.fair.bestOffers.home.homeOdds ?? ev.fair.bestOffers.home.odds}`,
            `💎 Best Away: ${ev.fair.bestOffers.away.bookmaker} @ ${ev.fair.bestOffers.away.awayOdds ?? ev.fair.bestOffers.away.odds}`,
          ].join("\n")
        : null;

    const freeUpsell =
      tier === "free"
        ? "🔓 VIP unlocks true fair odds, consensus and best-book edges for NBA."
        : null;

    return [header, basicLine, consensusLine, vipLines || freeUpsell]
      .filter(Boolean)
      .join("\n");
  });

  const prefix =
    tier === "vip" ? "🏀 NBA Fair Odds & Edges (VIP)" : "🏀 NBA Odds Snapshot";

  return ctx.reply([prefix, "", ...lines].join("\n\n"), {
    parse_mode: "Markdown",
  });
}

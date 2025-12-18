import { getRedisAdapter } from "../lib/redis-factory.js";
import { mapIsportsOdds } from "./mappers/isports-mapper.js";
// SportMonks removed — do not import mapping
import { mapSgoOdds } from "./mappers/sgo-mapper.js";
import { mapFootballDataFixtures } from "./mappers/footballdata-mapper.js";
import { mapOpenLigaMatches } from "./mappers/openligadb-mapper.js";
import { computeConsensusForEvent } from "./fair-odds-engine.js";

const redis = getRedisAdapter();
try {
  if (typeof redis.connect === "function") await redis.connect();
} catch (_) {}

export async function getUnifiedOddsWithFair({
  sport = "football",
  league = "nfl",
} = {}) {
  const [isportsRaw, sgoRaw] = await Promise.all([
    redis.get(`${sport}:livescores:isports`).catch(() => null),
    redis.get(`${sport}:odds:sgo`).catch(() => null),
  ]);

  const isportsData = isportsRaw ? JSON.parse(isportsRaw) : null;
  const sgoData = sgoRaw ? JSON.parse(sgoRaw) : null;
  console.log("raw presence:", { isportsRaw: !!isportsRaw, sgoRaw: !!sgoRaw });
  const fromIsports = isportsData
    ? mapIsportsOdds(isportsData, { sport, league })
    : [];
  const fromSportmonks = []; // SportMonks removed: no data
  const fromSgo = sgoData ? mapSgoOdds(sgoData, { sport, league }) : [];

  // Fallback: load raw fixtures if SportMonks not available or payload invalid
  let fromFallback = [];
  if (!sportmonksHasData) {
    // Use a fresh Redis adapter here to avoid any module-level connection issues
    const localRedis = getRedisAdapter();
    try {
      if (typeof localRedis.connect === "function") await localRedis.connect();
    } catch (_) {}
    try {
      const fdKeys = await localRedis.keys("raw:fixtures:footballdata:*");
      console.log(
        "found footballdata keys in aggregator (localRedis):",
        fdKeys.length,
      );
      for (const k of fdKeys) {
        try {
          const v = await localRedis.get(k);
          const parsed = v ? JSON.parse(v) : null;
          const mapped = mapFootballDataFixtures(parsed, { sport, league });
          fromFallback = fromFallback.concat(mapped);
        } catch (_) {
          /* ignore parse errors */
        }
      }
    } catch (e) {
      console.warn("fallback footballdata error", e && e.message);
    }

    try {
      const olKeys = await localRedis.keys("openligadb:matchdata:*");
      console.log(
        "found openliga keys in aggregator (localRedis):",
        olKeys.length,
      );
      for (const k of olKeys) {
        try {
          const v = await localRedis.get(k);
          const parsed = v ? JSON.parse(v) : null;
          const mapped = mapOpenLigaMatches(parsed, { sport, league });
          fromFallback = fromFallback.concat(mapped);
        } catch (_) {}
      }
    } catch (e) {
      console.warn("fallback openliga error", e && e.message);
    }

    try {
      if (typeof localRedis.quit === "function") await localRedis.quit();
    } catch (_) {}
  }

  const all = [...fromIsports, ...fromSportmonks, ...fromSgo, ...fromFallback];
  console.log("aggregator counts:", {
    isports: fromIsports.length,
    sgo: fromSgo.length,
    fallback: fromFallback.length,
    total: all.length,
  });

  const grouped = new Map();
  for (const rec of all) {
    if (!rec || !rec.eventId) continue;
    if (!grouped.has(rec.eventId)) grouped.set(rec.eventId, []);
    grouped.get(rec.eventId).push(rec);
  }

  const results = [];
  for (const [eventId, records] of grouped.entries()) {
    const base = records[0];
    const fair = computeConsensusForEvent(records);

    results.push({
      eventId,
      sport,
      league,
      homeTeam: base.homeTeam,
      awayTeam: base.awayTeam,
      startsAt: base.startsAt,
      providers: records,
      fair,
    });
  }

  return results;
}

export default { getUnifiedOddsWithFair };

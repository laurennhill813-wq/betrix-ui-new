import { getRedisAdapter } from "../lib/redis-factory.js";
import { isports } from "./isports.js";
import { getUpcomingFixtures, getTeams } from "../services/sportradar-client.js";
// SportMonks disabled — do not import or call provider
import { sgo } from "./sportsgameodds-client.js";

const redis = getRedisAdapter();
try {
  if (typeof redis.connect === "function") await redis.connect();
} catch (_) {}

// TTLs
const TTL_ODDS = Number(process.env.TTL_ODDS || 600); // 10 minutes
const TTL_LIVE = Number(process.env.TTL_LIVE || 60); // 1 minute

// Helper: safely fetch a value from provider and cache a JSON string
async function safeFetchAndCache(label, fnFetch, redisKey, ttl = TTL_ODDS) {
  try {
    const res = await fnFetch();
    // if provider returns structured { ok, status, body } (SGO), handle it
    if (res && typeof res === "object" && "ok" in res && "body" in res) {
      if (res.ok) {
        await (redis.setex
          ? redis.setex(redisKey, ttl, JSON.stringify(res.body))
          : redis.set(redisKey, JSON.stringify(res.body)));
        return true;
      }
      await (redis.setex
        ? redis.setex(
            `prefetch:failures:${redisKey}`,
            3600,
            JSON.stringify({
              ts: Date.now(),
              status: res.status,
              body: res.body,
            }),
          )
        : redis.set(
            `prefetch:failures:${redisKey}`,
            JSON.stringify({
              ts: Date.now(),
              status: res.status,
              body: res.body,
            }),
          ));
      console.warn(label, "failed status", res.status);
      return false;
    }

    // otherwise assume JSON object
    await (redis.setex
      ? redis.setex(redisKey, ttl, JSON.stringify(res))
      : redis.set(redisKey, JSON.stringify(res)));
    return true;
  } catch (e) {
    console.warn(label, "failed", e.message || e);
    try {
      await (redis.setex
        ? redis.setex(
            `prefetch:failures:${redisKey}`,
            3600,
            JSON.stringify({ ts: Date.now(), error: String(e) }),
          )
        : redis.set(
            `prefetch:failures:${redisKey}`,
            JSON.stringify({ ts: Date.now(), error: String(e) }),
          ));
    } catch (_) {}
    return false;
  }
}

export async function prefetchAllSportsData() {
  console.log("🔄 Prefetching sports data from all providers...");

  await Promise.all([
    prefetchFootball(),
    prefetchBasketball(),
    prefetchBaseball(),
    prefetchHockey(),
    // Sportradar-based extras for broader sports coverage
    (async () => {
      try {
        // NBA fixtures
        const nba = await getUpcomingFixtures("nba");
        await (redis.setex
          ? redis.setex("prefetch:sportradar:nba", TTL_ODDS, JSON.stringify(nba))
          : redis.set("prefetch:sportradar:nba", JSON.stringify(nba)));
      } catch (e) {}
    })(),
    (async () => {
      try {
        const mlb = await getUpcomingFixtures("mlb");
        await (redis.setex
          ? redis.setex("prefetch:sportradar:mlb", TTL_ODDS, JSON.stringify(mlb))
          : redis.set("prefetch:sportradar:mlb", JSON.stringify(mlb)));
      } catch (e) {}
    })(),
    (async () => {
      try {
        const nascar = await getUpcomingFixtures("nascar");
        await (redis.setex
          ? redis.setex("prefetch:sportradar:nascar", TTL_ODDS, JSON.stringify(nascar))
          : redis.set("prefetch:sportradar:nascar", JSON.stringify(nascar)));
      } catch (e) {}
    })(),
  ]).catch((e) =>
    console.warn("prefetchAllSportsData: some fetches failed", e.message || e),
  );

  console.log("✅ Prefetch complete.");
}

async function prefetchFootball() {
  console.log("⚽ Prefetching football...");
  try {
    await safeFetchAndCache(
      "Football livescores (iSports)",
      () => isports("/sport/football/livescores"),
      "football:livescores:isports",
      TTL_LIVE,
    );
  } catch (e) {
    console.warn("isports football livescores failed", e.message || e);
  }

  try {
    // SportMonks disabled — skip fetching fixtures from SportMonks
    console.warn(
      "Skipping SportMonks football fixtures fetch: SportMonks disabled",
    );
  } catch (e) {
    console.warn("sportmonks football fixtures failed", e.message || e);
  }

  try {
    await safeFetchAndCache(
      "Football odds (SGO)",
      () => sgo("/odds/football"),
      "football:odds:sgo",
      TTL_ODDS,
    );
  } catch (e) {
    console.warn("sgo football odds failed", e.message || e);
  }
}

async function prefetchBasketball() {
  console.log("🏀 Prefetching basketball...");
  try {
    const isLive = await isports("/sport/basketball/livescores");
    await redis.set(
      "basketball:livescores:isports",
      JSON.stringify(isLive),
      "EX",
      TTL_LIVE,
    );
  } catch (e) {
    console.warn("isports basketball livescores failed", e.message || e);
  }

  try {
    // SportMonks disabled — skip fetching basketball fixtures
    console.warn(
      "Skipping SportMonks basketball fixtures fetch: SportMonks disabled",
    );
  } catch (e) {
    console.warn("sportmonks basketball fixtures failed", e.message || e);
  }

  try {
    await safeFetchAndCache(
      "Basketball odds (SGO)",
      () => sgo("/odds/nba"),
      "basketball:odds:sgo",
      TTL_ODDS,
    );
  } catch (e) {
    console.warn("sgo nba odds failed", e.message || e);
  }
}

async function prefetchBaseball() {
  console.log("⚾ Prefetching baseball...");
  try {
    const isLive = await isports("/sport/baseball/livescores");
    await redis.set(
      "baseball:livescores:isports",
      JSON.stringify(isLive),
      "EX",
      TTL_LIVE,
    );
  } catch (e) {
    console.warn("isports baseball livescores failed", e.message || e);
  }

  try {
    await safeFetchAndCache(
      "Baseball odds (SGO)",
      () => sgo("/odds/mlb"),
      "baseball:odds:sgo",
      TTL_ODDS,
    );
  } catch (e) {
    console.warn("sgo mlb odds failed", e.message || e);
  }
}

async function prefetchHockey() {
  console.log("🏒 Prefetching hockey...");
  try {
    const isLive = await isports("/sport/hockey/livescores");
    await redis.set(
      "hockey:livescores:isports",
      JSON.stringify(isLive),
      "EX",
      TTL_LIVE,
    );
  } catch (e) {
    console.warn("isports hockey livescores failed", e.message || e);
  }

  try {
    await safeFetchAndCache(
      "Hockey odds (SGO)",
      () => sgo("/odds/nhl"),
      "hockey:odds:sgo",
      TTL_ODDS,
    );
  } catch (e) {
    console.warn("sgo nhl odds failed", e.message || e);
  }
}

export default {
  prefetchAllSportsData,
};

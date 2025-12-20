import cron from "node-cron";
import { Logger } from "../utils/logger.js";
import { getTeams, getUpcomingFixtures, fetchAndNormalizeFixtures, fetchAndNormalizeTeams, sportEmoji } from "../services/sportradar-client.js";
import { SPORTRADAR_SPORTS } from "../config/sportradar-sports.js";
import { getRedisAdapter } from "../lib/redis-factory.js";

const logger = new Logger("SportradarPrefetch");

function nowISO() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function startSportradarPrefetch({ redis, cronExpr, days = 2, ttlFixtures, ttlTeams } = {}) {
  // allow caller to supply redis adapter or create one from env
  if (!redis) {
    try {
      redis = getRedisAdapter();
    } catch (e) {
      throw new Error("redis required for sportradar prefetch");
    }
  }

  const keyHealth = "sportradar:health";
  const lockKey = "sportradar:prefetch:lock";
  const lockTTL = 60 * 5; // 5 minutes

  cronExpr = cronExpr || process.env.SPORTRADAR_PREFETCH_CRON || "*/5 * * * *";
  ttlFixtures = Number(ttlFixtures || process.env.SPORTRADAR_TTL_SEC || 120);
  ttlTeams = Number(ttlTeams || process.env.SPORTRADAR_TEAMS_TTL || 300);

  let scheduledTask = null;

  async function withLock(fn) {
    try {
      // try simple SET NX EX
      const setRes = await redis.set(lockKey, String(Date.now()), "EX", lockTTL, "NX");
      if (!setRes) {
        logger.info("Another instance holds the sportradar prefetch lock; skipping run");
        return;
      }
      try {
        await fn();
      } finally {
        try {
          await redis.del(lockKey);
        } catch (e) {
          logger.warn("Failed to release prefetch lock", e?.message || e);
        }
      }
    } catch (e) {
      logger.error("withLock failed", e?.message || String(e));
    }
  }

  async function prefetchOnce() {
    const key = keyHealth;
    const health = { updatedAt: nowISO(), bySport: {} };

    if (!process.env.SPORTRADAR_KEY) {
      logger.warn("SPORTRADAR_KEY not set; skipping Sportradar prefetch");
      await redis.set(key, JSON.stringify({ ok: false, reason: "no_key", updatedAt: nowISO() }));
      return;
    }

    await withLock(async () => {
      for (const s of SPORTRADAR_SPORTS) {
        const sport = s.id;
        const sportLog = { sport, lastUpdated: null, teamsCount: 0, fixturesCount: 0, httpStatus: null, errorReason: null, pathUsed: null };
        try {
          // prefetch teams (with metadata)
          const teamRes = await fetchAndNormalizeTeams(sport, {});
          const teams = Array.isArray(teamRes.items) ? teamRes.items : [];
          try {
            await redis.set(`sportradar:teams:${sport}`, JSON.stringify({ fetchedAt: nowISO(), items: teams }), "EX", ttlTeams);
          } catch (e) {
            logger.warn("redis set teams failed", e?.message || e);
          }
          sportLog.teamsCount = teams.length;
          if (teamRes.httpStatus) sportLog.httpStatus = teamRes.httpStatus;
          if (teamRes.pathUsed) sportLog.pathUsed = teamRes.pathUsed;
          if (teamRes.errorReason) sportLog.errorReason = teamRes.errorReason;

          // prefetch fixtures for next N days
          const fixtures = [];
          let lastFixtureMeta = {};
          for (let d = 0; d <= days; d++) {
            const date = new Date();
            date.setUTCDate(date.getUTCDate() + d);
            const isoDate = date.toISOString().slice(0, 10);
            try {
              const dayRes = await fetchAndNormalizeFixtures(sport, { date: isoDate });
              const dayFixtures = Array.isArray(dayRes.items) ? dayRes.items : [];
              if (dayFixtures.length) fixtures.push(...dayFixtures);
              // capture last known metadata
              lastFixtureMeta = {
                httpStatus: dayRes.httpStatus || lastFixtureMeta.httpStatus,
                pathUsed: dayRes.pathUsed || lastFixtureMeta.pathUsed,
                errorReason: dayRes.errorReason || lastFixtureMeta.errorReason,
              };
            } catch (e) {
              logger.warn(`fetch fixtures ${sport} ${isoDate} failed`, e?.message || e);
              // record network-level error as lastFixtureMeta
              lastFixtureMeta.errorReason = e?.message || String(e);
            }
            // respect a small pause between date calls
            await sleep(150);
          }

          const normalized = fixtures.map((f) => ({
            sport,
            league: f.league || null,
            eventId: f.eventId || f.id || null,
            startTimeISO: f.startTimeISO || f.startTime || null,
            homeTeam: f.homeTeam || f.home || null,
            awayTeam: f.awayTeam || f.away || null,
            venue: f.venue || null,
            status: f.status || null,
          }));

          if (normalized.length) {
            try {
              await redis.set(`sportradar:upcoming:${sport}`, JSON.stringify({ fetchedAt: nowISO(), items: normalized }), "EX", ttlFixtures);
            } catch (e) {
              logger.warn("redis set upcoming failed", e?.message || e);
            }
          }
          sportLog.fixturesCount = normalized.length;
          sportLog.lastUpdated = nowISO();
          // prefer fixture meta for http/path if available
          if (lastFixtureMeta.httpStatus) sportLog.httpStatus = lastFixtureMeta.httpStatus;
          if (lastFixtureMeta.pathUsed) sportLog.pathUsed = lastFixtureMeta.pathUsed;
          if (lastFixtureMeta.errorReason && !sportLog.errorReason) sportLog.errorReason = lastFixtureMeta.errorReason;
          try {
            await redis.publish("prefetch:updates", JSON.stringify({ type: "sportradar", sport, ts: Date.now(), fixtures: normalized.length, teams: sportLog.teamsCount }));
          } catch (e) {
            // publish is optional on some adapters
          }
        } catch (e) {
          const msg = e?.message || String(e);
          logger.error(`prefetch ${sport} failed`, msg);
          sportLog.errorReason = msg;
          sportLog.fixturesCount = 0;
          sportLog.teamsCount = 0;
          sportLog.lastUpdated = nowISO();
        }

        // Update health per-sport so partial results persist even on failures
        try {
          // read current health, update this sport, and write back
          let raw = null;
          try {
            raw = await redis.get(key);
          } catch (e) {
            raw = null;
          }
          const cur = raw ? JSON.parse(raw) : { updatedAt: nowISO(), bySport: {} };
          cur.bySport = cur.bySport || {};
          cur.bySport[sport] = sportLog;
          cur.updatedAt = nowISO();
          try {
            await redis.set(key, JSON.stringify(cur), "EX", Math.max(300, ttlFixtures));
          } catch (e) {
            logger.warn("failed to write sportradar health to redis (per-sport)", e?.message || e);
          }
        } catch (e) {
          logger.warn("failed to persist per-sport health", e?.message || e);
        }
      }
    });
  }

  // run immediate prefetch then schedule
  (async () => {
    try {
      logger.info("Starting immediate Sportradar prefetch");
      await prefetchOnce();
    } catch (e) {
      logger.error("Immediate sportradar prefetch failed", e?.message || e);
    }
    try {
      scheduledTask = cron.schedule(cronExpr, async () => {
        try {
          logger.info("Sportradar cron tick", { cron: cronExpr });
          await prefetchOnce();
        } catch (e) {
          logger.error("Sportradar scheduled prefetch failed", e?.message || e);
        }
      });
      logger.info("Sportradar prefetch scheduled", { cron: cronExpr });
    } catch (e) {
      logger.warn("Failed to schedule Sportradar prefetch; falling back to interval", e?.message || e);
      const intervalMs = 1000 * 60 * 5;
      scheduledTask = { stop: () => clearInterval(scheduledTask._i) };
      scheduledTask._i = setInterval(async () => prefetchOnce(), intervalMs);
    }
  })();

  return {
    stop: () => {
      try {
        if (scheduledTask && scheduledTask.stop) scheduledTask.stop();
      } catch (e) {}
    },
  };
}

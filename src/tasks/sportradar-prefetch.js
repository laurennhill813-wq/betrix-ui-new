import cron from "node-cron";
import { Logger } from "../utils/logger.js";
import { getTeams, getUpcomingFixtures, sportEmoji } from "../services/sportradar-client.js";
import { SPORTRADAR_SPORTS } from "../config/sportradar-sports.js";

const logger = new Logger("SportradarPrefetch");

function nowISO() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function startSportradarPrefetch({ redis, cronExpr, days = 2, ttlFixtures, ttlTeams } = {}) {
  if (!redis) throw new Error("redis required for sportradar prefetch");

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
        const sportLog = { lastUpdated: null, teams: 0, fixtures: 0, errors: [] };
        try {
          // prefetch teams
          const teams = await getTeams(sport, { forceFetch: true });
          if (Array.isArray(teams)) {
            try {
              await redis.set(`sportradar:teams:${sport}`, JSON.stringify({ fetchedAt: nowISO(), items: teams }), "EX", ttlTeams);
            } catch (e) {
              logger.warn("redis set teams failed", e?.message || e);
            }
            sportLog.teams = teams.length;
          }

          // prefetch fixtures for next N days
          const fixtures = [];
          for (let d = 0; d <= days; d++) {
            const date = new Date();
            date.setUTCDate(date.getUTCDate() + d);
            const isoDate = date.toISOString().slice(0, 10);
            try {
              const dayFixtures = await getUpcomingFixtures(sport, { date });
              if (Array.isArray(dayFixtures) && dayFixtures.length) fixtures.push(...dayFixtures);
            } catch (e) {
              logger.warn(`fetch fixtures ${sport} ${isoDate} failed`, e?.message || e);
            }
            // respect a small pause between date calls
            await sleep(150);
          }
          // normalize minimal shape (client already normalizes partially)
          const normalized = (fixtures || []).map((f) => ({
            sport,
            league: f.league || null,
            eventId: f.eventId || f.id || (f.raw && (f.raw.id || f.raw.event_id)) || null,
            startTimeISO: f.startTime || f.scheduled || f.date || f.startTimeISO || null,
            homeTeam: f.home || f.homeTeam || f.home?.name || null,
            awayTeam: f.away || f.awayTeam || f.away?.name || null,
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
          sportLog.fixtures = normalized.length;
          sportLog.lastUpdated = nowISO();
          await redis.publish("prefetch:updates", JSON.stringify({ type: "sportradar", sport, ts: Date.now(), fixtures: normalized.length, teams: sportLog.teams }));
        } catch (e) {
          const msg = e?.message || String(e);
          logger.error(`prefetch ${sport} failed`, msg);
          sportLog.errors.push(msg);
        }
        health.bySport[sport] = sportLog;
      }
      health.updatedAt = nowISO();
      try {
        await redis.set(key, JSON.stringify(health), "EX", Math.max(300, ttlFixtures));
      } catch (e) {
        logger.warn("failed to write sportradar health to redis", e?.message || e);
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

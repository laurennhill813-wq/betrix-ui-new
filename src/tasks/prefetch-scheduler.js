/**
 * Prefetch scheduler: warms caches for free-data sources and publishes Redis notifications.
 * Configurable via env var PREFETCH_INTERVAL_SECONDS (default 60).
 */
import { setTimeout as wait } from "timers/promises";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import RapidApiLogger from "../lib/rapidapi-logger.js";
import { aggregateFixtures } from "../lib/fixtures-aggregator.js";
import { fetchUpcomingFixtures, fetchLiveMatches } from "../lib/rapidapi-client.js";
import { formatMMDDYYYY, getNextDaysMMDDYYYY } from "../lib/rapidapi-utils.js";
import { normalizeRedisKeyPart } from "../lib/rapidapi-fetcher.js";
import { ensureRedisKeyType } from "../utils/redis-helpers.js";

export function startPrefetchScheduler({
  redis,
  openLiga,
  rss,
  scorebat,
  footballData,
  sportsAggregator,
  sportsgameodds,
  flashlive,
  intervalSeconds = null,
} = {}) {
  if (!redis) throw new Error("redis required");
  intervalSeconds =
    intervalSeconds || Number(process.env.PREFETCH_INTERVAL_SECONDS || 60);

  let running = false;
  let lastRun = 0;
  let intervalHandle = null;
  let rapidLogger = null;

  // Load subscriptions.json at runtime so `subscriptions` is defined
  let subscriptions = [];
  try {
    const subsPath = path.join(process.cwd(), "src", "rapidapi", "subscriptions.json");
    const raw = fs.readFileSync(subsPath, "utf8");
    subscriptions = JSON.parse(raw);
  } catch (e) {
    console.warn("[rapidapi] failed to load subscriptions.json", e && e.message ? e.message : String(e));
    subscriptions = [];
  }

  const safeSet = async (key, value, ttl) => {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttl).catch(() => {});
    } catch (e) {
      void e;
    }
  };

  // Maximum number of items to keep in the prefetch cache for large responses
  const MAX_PREFETCH_STORE = Number(process.env.PREFETCH_STORE_MAX || 1000);

  // Helper: try to extract short live-match summaries from a RapidAPI response body
  const extractLiveMatches = (body) => {
    try {
      if (!body) return [];
      const obj = typeof body === "string" ? JSON.parse(body) : body;
      const arrayKeys = ["matches", "data", "events", "fixtures", "results", "games", "items", "response", "list"];
      const candidates = [];
      for (const k of arrayKeys) if (Array.isArray(obj[k])) candidates.push(obj[k]);
      if (Array.isArray(obj)) candidates.push(obj);
      for (const arr of candidates) {
        const live = arr.filter((it) => {
          if (!it) return false;
          const status = it.status || it.matchStatus || it.gameState || it.state || it.inplay || it.is_live;
          if (typeof status === "string" && /live|inplay/i.test(status)) return true;
          if (typeof status === "boolean" && status === true) return true;
          if (it.score || it.score_full || it.scores || it.result) return true;
          return false;
        });
        if (live && live.length) {
          return live.slice(0, 3).map((it) => {
            const home = it.homeTeam?.name || it.home?.name || it.home || it.team1?.name || it.team1 || (it.teams && it.teams[0]) || "home";
            const away = it.awayTeam?.name || it.away?.name || it.away || it.team2?.name || it.team2 || (it.teams && it.teams[1]) || "away";
            const score = it.score?.full || it.score?.current || it.score_full || (it.scores ? JSON.stringify(it.scores) : undefined) || it.result || null;
            const minute = it.minute || it.time || it.currentMinute || it.elapsed || null;
            const status = it.status || it.matchStatus || (it.is_live ? "LIVE" : undefined) || null;
            let text = `${home} vs ${away}`;
            if (score) text += ` (${score})`;
            if (minute) text += ` [${minute}]`;
            if (status) text += ` ${status}`;
            return text;
          });
        }
      }
    } catch (e) {
      /* ignore */
    }
    return [];
  };

  const recordSuccess = async (type) => {
    try {
      await redis.del(`prefetch:failures:${type}`);
      await redis.del(`prefetch:next:${type}`);
      try {
        const health = { ok: true, ts: Date.now(), message: 'ok' };
        await redis.set(`betrix:provider:health:${type}`, JSON.stringify(health), 'EX', 60 * 60 * 24).catch(() => {});
      } catch (e) { /* ignore */ }
    } catch (e) { void e; }
  };

  const recordFailure = async (type) => {
    try {
      const fails = await redis
        .incr(`prefetch:failures:${type}`)
        .catch(() => 1);
      const maxBackoff = Number(process.env.PREFETCH_MAX_BACKOFF_SECONDS || 3600);
      const baseBackoff = Number(process.env.PREFETCH_BASE_BACKOFF_SECONDS || Math.max(1, intervalSeconds));
      const backoff = Math.min(maxBackoff, baseBackoff * Math.pow(2, Math.max(0, Number(fails) - 1)));
      const next = Math.floor(Date.now() / 1000) + backoff;
      await redis.set(`prefetch:next:${type}`, String(next)).catch(() => {});
      try {
        const health = { ok: false, ts: Date.now(), message: `failures:${fails}` };
        await redis.set(`betrix:provider:health:${type}`, JSON.stringify(health), 'EX', 60 * 60 * 24).catch(() => {});
      } catch (e) { /* ignore */ }
    } catch (e) { void e; }
  };

  const job = async () => {
    if (running) return;
    running = true;
    lastRun = Date.now();

    try {
      // lazy-init rapidLogger
      if (!rapidLogger) {
        try { rapidLogger = new RapidApiLogger({ apiKey: process.env.RAPIDAPI_KEY }); } catch (e) { rapidLogger = null; }
      }

      // iterate subscriptions and do a lightweight fetch of sample endpoints
      const apis = Array.isArray(subscriptions) ? subscriptions : [];
      for (const api of apis.slice(0, 50)) {
        try {
          const apiName = api.name || 'unknown';
          const host = api.host;
          const endpoints = Array.isArray(api.sampleEndpoints) ? api.sampleEndpoints.slice(0, 3) : [];
          if (!host || endpoints.length === 0) continue;

          // Skip APIs currently in backoff according to Redis key set by recordFailure
          try {
            const typeKey = String(api.name || api.host || 'unknown');
            const nextVal = await redis.get(`prefetch:next:${typeKey}`).catch(() => null);
            if (nextVal) {
              const nextNum = Number(nextVal);
              const nowSec = Math.floor(Date.now() / 1000);
              if (nextNum && nextNum > nowSec) {
                // mark a lightweight backoff indicator for observability and skip
                try {
                  await safeSet(
                    `rapidapi:backoff:${normalizeRedisKeyPart(String(api.host || api.name))}`,
                    { backoff_active: true, backoffKey: `prefetch:next:${typeKey}`, until: nextNum },
                    Number(process.env.RAPIDAPI_TTL_SEC || 300)
                  );
                } catch (e) { /* ignore */ }
                continue;
              }
            }
          } catch (e) { /* ignore backoff check errors */ }

          for (const endpoint of endpoints) {
            try {
              const res = rapidLogger
                ? await rapidLogger.fetch(host, endpoint, { apiName }).catch(() => null)
                : null;

              const key = `rapidapi:prefetch:${normalizeRedisKeyPart(String(apiName || host))}:${normalizeRedisKeyPart(String(endpoint || 'ep'))}`;
              const payload = { fetchedAt: Date.now(), apiName, host, endpoint, status: res && res.httpStatus ? res.httpStatus : null };
              await safeSet(key, payload, Number(process.env.RAPIDAPI_TTL_SEC || 300));

              // store small live-sample diagnostics
              try {
                const live = extractLiveMatches(res && res.body);
                if (live && live.length) {
                  await safeSet(`rapidapi:live-sample:${normalizeRedisKeyPart(apiName)}`, { sample: live.slice(0,3), ts: Date.now() }, 60).catch(()=>{});
                }
              } catch (e) { /* ignore */ }

            } catch (e) {
              await recordFailure(String(api.name || api.host || 'unknown'));
              /* continue per-endpoint */
            }
          }

          await recordSuccess(String(api.name || api.host || 'unknown'));
        } catch (e) {
          /* continue per-api */
        }
      }

      // Optionally aggregate fixtures if helper available
      try {
        if (typeof aggregateFixtures === 'function') {
          try {
            const agg = await aggregateFixtures().catch(()=>null);
            if (agg) {
              await safeSet('rapidapi:fixtures:list', agg, Number(process.env.RAPIDAPI_FIXTURES_TTL_SEC || 300));
            }
          } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore */ }

    } catch (e) {
      // top-level job error
      try { console.warn('[prefetch] job error', e && e.message ? e.message : String(e)); } catch (e2) { /* ignore */ }
    } finally {
      running = false;
    }
  };

  // start immediately and schedule
  (async () => {
    try { await job(); } catch (e) { /* ignore */ }
    try {
      intervalHandle = setInterval(() => {
        void job();
      }, Math.max(1000, Number(intervalSeconds) * 1000));
    } catch (e) { /* ignore */ }
  })();

  return {
    stop: () => {
      try {
        if (intervalHandle) clearInterval(intervalHandle);
      } catch (e) {}
    },
    lastRun: () => lastRun,
  };
}

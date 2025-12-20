#!/usr/bin/env node
import fs from "fs";
import path from "path";
import createRedisAdapter from "../src/utils/redis-adapter.js";
import { getRedis, MockRedis } from "../src/lib/redis-factory.js";
import { RapidApiFetcher, normalizeRedisKeyPart } from "../src/lib/rapidapi-fetcher.js";

const subscriptionsPath = path.join(process.cwd(), "src", "rapidapi", "subscriptions.json");
let subs = [];
try {
  subs = JSON.parse(fs.readFileSync(subscriptionsPath, "utf8"));
} catch (e) {
  console.error("Failed to load subscriptions.json", e?.message || e);
  process.exit(1);
}

const redisClient = createRedisAdapter(getRedis());
const fetcher = new RapidApiFetcher({ apiKey: process.env.RAPIDAPI_KEY });
const TTL = Number(process.env.RAPIDAPI_TTL_SEC || 300);
console.log(`Starting RapidAPI prefetch for ${subs.length} subscriptions (TTL=${TTL}s)`);

// Helper: extract short live-match summaries from RapidAPI responses
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

async function run() {
  const ts = Date.now();
  const diag = { updatedAt: ts, apis: {} };
  // summary collects per-API ok/error counts for final reporting
  const summary = {};
  for (const api of subs) {
    const name = api.name || "unknown";
    const host = api.host;
    console.log(`Processing API: ${name} (${host}) with ${Array.isArray(api.sampleEndpoints)?api.sampleEndpoints.length:0} sample endpoints`);
    diag.apis[name] = { status: "unknown", lastUpdated: null, endpoints: {} };
    const endpoints = Array.isArray(api.sampleEndpoints) ? api.sampleEndpoints : [];
    for (const endpoint of endpoints.slice(0, 10)) {
      try {
        const result = await fetcher.fetchRapidApi(host, endpoint).catch((e) => { throw e; });
        const key = `rapidapi:${normalizeRedisKeyPart(name)}:${normalizeRedisKeyPart(endpoint)}`;
        await redisClient.set(key, JSON.stringify({ fetchedAt: ts, apiName: name, endpoint, httpStatus: result.httpStatus, data: result.body }), "EX", TTL).catch(() => {});
        diag.apis[name].endpoints[endpoint] = {
          httpStatus: result.httpStatus,
          errorReason: result.httpStatus && result.httpStatus >= 400 ? `http_${result.httpStatus}` : null,
          lastUpdated: ts,
        };
        diag.apis[name].lastUpdated = ts;
        diag.apis[name].status = (result.httpStatus >= 200 && result.httpStatus < 300) ? "ok" : "error";
        console.log({ apiName: name, endpoint, httpStatus: result.httpStatus });
        // Detect odds-like responses and log a concise summary
        try {
          let parsed = null;
          try { parsed = typeof result.body === 'string' ? JSON.parse(result.body) : result.body; } catch (e) { parsed = null; }
          const looksLikeOdds = parsed && (Array.isArray(parsed) && parsed.length && (parsed[0].bookmakers || parsed[0].sport_key) || (parsed.bookmakers || parsed.sport_key));
          if (looksLikeOdds) {
            const sample = Array.isArray(parsed) ? parsed[0] : parsed;
            const sport = sample.sport_key || sample.sport || 'unknown';
            const home = sample.home_team || sample.home || (sample.teams && sample.teams[0]) || '';
            const away = sample.away_team || sample.away || (sample.teams && sample.teams[1]) || '';
            const bookmakers = Array.isArray(sample.bookmakers) ? sample.bookmakers.length : 0;
            console.log(`[rapidapi-odds] ${name} ${endpoint} sport=${sport} match="${home} vs ${away}" bookmakers=${bookmakers}`);
            await redisClient.set(`rapidapi:odds:${normalizeRedisKeyPart(name)}`, JSON.stringify({ apiName: name, endpoint, sport, sample: { home, away }, bookmakers, ts }), 'EX', 60).catch(() => {});
          }
        } catch (e) {
          /* ignore */
        }
        // If Odds API, fetch a small list of sports and print per-sport summaries (bounded)
        try {
          if (host && host.includes('odds.p.rapidapi.com')) {
            const maxSports = Number(process.env.RAPIDAPI_ODDS_MAX_SPORTS || 12);
            const sportsRes = await fetcher.fetchRapidApi(host, '/v4/sports/?').catch(() => null);
            let sportsList = [];
            try { sportsList = sportsRes && typeof sportsRes.body === 'string' ? JSON.parse(sportsRes.body) : (sportsRes && sportsRes.body) || []; } catch (e) { sportsList = [] }
            if (Array.isArray(sportsList) && sportsList.length) {
              let c = 0;
              for (const s of sportsList) {
                if (c >= maxSports) break;
                const sportKey = s && (s.key || s.sport_key || s.id);
                if (!sportKey) continue;
                const sportEndpoint = `/v4/sports/${encodeURIComponent(sportKey)}/odds?regions=us&markets=h2h,spreads&oddsFormat=decimal`;
                const r = await fetcher.fetchRapidApi(host, sportEndpoint).catch(() => null);
                if (r && r.httpStatus >= 200 && r.httpStatus < 300) {
                  let parsed = null;
                  try { parsed = typeof r.body === 'string' ? JSON.parse(r.body) : r.body; } catch (e) { parsed = null }
                  const events = Array.isArray(parsed) ? parsed : (parsed && parsed.data && Array.isArray(parsed.data) ? parsed.data : []);
                  const total = events.length;
                  const now = Date.now();
                  const live = events.filter((ev) => { try { const commence = ev.commence_time ? new Date(ev.commence_time).getTime() : null; return commence && commence <= now; } catch (e) { return false } }).length;
                  console.log(`[rapidapi-odds-sport] ${sportKey} total=${total} live=${live}`);
                  await redisClient.set(`rapidapi:odds:sport:${normalizeRedisKeyPart(String(sportKey))}`, JSON.stringify({ apiName: name, sportKey, total, live, ts }), 'EX', 60).catch(() => {});
                }
                c += 1;
              }
            }
          }
        } catch (e) {
          /* ignore */
        }
        try {
          const liveSamples = extractLiveMatches(result.body);
          if (liveSamples && liveSamples.length) {
            console.log(`[rapidapi-live] ${name} ${endpoint} live=${liveSamples.length} sample="${liveSamples[0]}"`);
            await redisClient.set(`rapidapi:live:${normalizeRedisKeyPart(name)}`, JSON.stringify({ apiName: name, endpoint, samples: liveSamples, ts }), "EX", 30).catch(() => {});
          }
        } catch (e) {
          /* ignore */
        }
        if (!summary[name]) summary[name] = { ok: 0, error: 0 };
        if (result.httpStatus >= 200 && result.httpStatus < 300) summary[name].ok += 1;
        else summary[name].error += 1;
      } catch (e) {
        diag.apis[name].endpoints[endpoint] = {
          httpStatus: e && e.status ? e.status : null,
          errorReason: e && e.message ? String(e.message) : String(e),
          lastUpdated: Date.now(),
        };
        diag.apis[name].status = "error";
        console.error({ apiName: name, endpoint, error: e && e.message ? e.message : String(e) });
        if (!summary[name]) summary[name] = { ok: 0, error: 0 };
        summary[name].error += 1;
      }
    }
  }
  try {
    await redisClient.set("rapidapi:health", JSON.stringify(diag)).catch(() => {});
  } catch (e) {}
  console.log("RapidAPI prefetch complete");
  // Print summary
  console.log("\nRapidAPI Summary:");
  for (const [name, s] of Object.entries(summary)) {
    const status = s.error === 0 ? "HEALTHY" : s.ok === 0 ? "FAILING" : "DEGRADED";
    console.log(`${name}: ${status} (ok=${s.ok}, errors=${s.error})`);
  }
  process.exit(0);
}

run().catch((e) => {
  console.error("run-rapidapi-prefetch failed", e?.message || e);
  process.exit(1);
});

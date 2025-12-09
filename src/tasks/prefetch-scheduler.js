/**
 * Prefetch scheduler: warms caches for free-data sources and publishes Redis notifications.
 * Configurable via env var PREFETCH_INTERVAL_SECONDS (default 60).
 * WARNING: setting this below ~10s may stress remote APIs and trigger rate limits.
 */
import { setTimeout as wait } from 'timers/promises';
void wait;

export function startPrefetchScheduler({ redis, openLiga, rss, scorebat, footballData, sportsAggregator, sportsgameodds, intervalSeconds = null } = {}) {
  if (!redis) throw new Error('redis required');
  intervalSeconds = intervalSeconds || Number(process.env.PREFETCH_INTERVAL_SECONDS || 60);

  let running = false;
  let lastRun = 0;

  const safeSet = async (key, value, ttl) => {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttl).catch(()=>{});
    } catch (e) { void e; }
  };

  // Maximum number of items to keep in the prefetch cache for large responses
  const MAX_PREFETCH_STORE = Number(process.env.PREFETCH_STORE_MAX || 1000);

  const job = async () => {
    if (running) return; // avoid overlap
    running = true;
    const ts = Date.now();
    const nowSec = Math.floor(ts / 1000);

    const maxBackoff = Number(process.env.PREFETCH_MAX_BACKOFF_SECONDS || 3600);
    const baseBackoff = Number(process.env.PREFETCH_BASE_BACKOFF_SECONDS || Math.max(1, intervalSeconds));

    const isAllowedToRun = async (type) => {
      try {
        const nxt = await redis.get(`prefetch:next:${type}`);
        if (!nxt) return true;
        const n = Number(nxt);
        return nowSec >= n;
      } catch (e) { void e; return true; }
    };

    const recordSuccess = async (type) => {
      try { await redis.del(`prefetch:failures:${type}`); await redis.del(`prefetch:next:${type}`); } catch (e) { void e; }
    };

    const recordFailure = async (type) => {
      try {
        const fails = await redis.incr(`prefetch:failures:${type}`).catch(()=>1);
        await redis.expire(`prefetch:failures:${type}`, 60 * 60 * 24).catch(()=>{});
        const delay = Math.min(maxBackoff, Math.pow(2, Math.max(0, fails - 1)) * baseBackoff);
        const next = nowSec + Math.max(1, Math.floor(delay));
        await redis.set(`prefetch:next:${type}`, String(next), 'EX', Math.min(maxBackoff + 60, Math.floor(delay) + 60)).catch(()=>{});
        return { fails, next, delay };
      } catch (e) { void e; return null; }
    };
    try {
      // 1) News feeds - lightweight, good to run frequently
      if (rss) {
        try {
          if (!await isAllowedToRun('rss')) { /* skip due to backoff */ }
          else {
            const feeds = ['https://feeds.bbci.co.uk/sport/football/rss.xml', 'https://www.theguardian.com/football/rss', 'https://www.espn.com/espn/rss/football/news'];
            const r = await rss.fetchMultiple(feeds).catch(async (err) => { await recordFailure('rss'); throw err; });
            if (r) { await safeSet('prefetch:rss:football', { fetchedAt: ts, feeds: r }, 60); await recordSuccess('rss'); }
            await redis.publish('prefetch:updates', JSON.stringify({ type: 'rss', ts }));
          }
        } catch (e) {
          await redis.publish('prefetch:error', JSON.stringify({ type: 'rss', error: e.message || String(e), ts }));
          await recordFailure('rss');
        }
      }

      // 2) ScoreBat - lightweight when freeFeed
      if (scorebat) {
        try {
          if (!await isAllowedToRun('scorebat')) { /* skip due to backoff */ }
          else {
            const sb = await scorebat.freeFeed().catch(async (err) => { await recordFailure('scorebat'); throw err; });
            if (sb) { await safeSet('prefetch:scorebat:free', { fetchedAt: ts, data: sb }, 60); await recordSuccess('scorebat'); }
            await redis.publish('prefetch:updates', JSON.stringify({ type: 'scorebat', ts }));
          }
        } catch (e) {
          await redis.publish('prefetch:error', JSON.stringify({ type: 'scorebat', error: e.message || String(e), ts }));
          await recordFailure('scorebat');
        }
      }

      // 3) OpenLigaDB - small queries for popular leagues
      if (openLiga) {
        try {
          if (!await isAllowedToRun('openligadb')) { /* skip due to backoff */ }
          else {
            const leagues = await openLiga.getAvailableLeagues().catch(async (err) => { await recordFailure('openligadb'); throw err; });
            if (leagues) { await safeSet('prefetch:openligadb:leagues', { fetchedAt: ts, leagues }, 120); await recordSuccess('openligadb'); }
            // fetch recent matches for a short list of popular league shortcuts
            const popular = ['bl1','bl2','bl3','1bl','dfl','mls','epl','pd1'];
            for (const l of popular.slice(0,5)) {
              const recent = await openLiga.getRecentMatches(l, (new Date()).getFullYear(), 2).catch(async (_err) => { await recordFailure('openligadb'); return []; });
              await safeSet(`prefetch:openligadb:recent:${l}`, { fetchedAt: ts, recent }, 30);
            }
            await redis.publish('prefetch:updates', JSON.stringify({ type: 'openligadb', ts }));
          }
        } catch (e) {
          await redis.publish('prefetch:error', JSON.stringify({ type: 'openligadb', error: e.message || String(e), ts }));
          await recordFailure('openligadb');
        }
      }

      // 4) Football-data CSVs - heavier, keep longer TTL
      if (footballData) {
        try {
          // try E0 (EPL) and SP1 (LaLiga) short samples
          const samples = [];
          try { const epl = await footballData.fixturesFromCsv('E0', '2324').catch(()=>null); if (epl) samples.push({ comp: 'E0', data: epl }); } catch (e) { void e; }
          try { const la = await footballData.fixturesFromCsv('SP1', '2324').catch(()=>null); if (la) samples.push({ comp: 'SP1', data: la }); } catch (e) { void e; }
          for (const s of samples) {
            await safeSet(`prefetch:footballdata:${s.comp}:2324`, { fetchedAt: ts, data: s.data }, 60 * 60);
          }
          await redis.publish('prefetch:updates', JSON.stringify({ type: 'footballdata', ts }));
        } catch (e) {
          await redis.publish('prefetch:error', JSON.stringify({ type: 'footballdata', error: e.message || String(e), ts }));
        }
      }

      // 5) SportMonks & Football-Data live/fixtures - main providers, prefetch every 60s
      // Note: If SportGameOdds (sgo) is available we prefer it as the authoritative
      // prefetch source for consolidated `betrix:prefetch:*` keys to avoid mixing
      // providers. sportsAggregator will still fetch provider-specific lists but
      // will skip writing consolidated keys when sgo is present.
      if (sportsAggregator) {
        try {
          if (!await isAllowedToRun('sportsmonks')) { /* skip due to backoff */ }
          else {
            // Fetch full lists (but cap to MAX_PREFETCH_STORE to avoid unbounded Redis usage)
            const live = await sportsAggregator.getAllLiveMatches().catch(async (err) => { await recordFailure('sportsmonks'); throw err; });
            if (live && live.length > 0) {
              const cappedLive = Array.isArray(live) ? live.slice(0, Math.min(MAX_PREFETCH_STORE, live.length)) : [];
              await safeSet('prefetch:sportsmonks:live', { fetchedAt: ts, count: live.length, data: cappedLive }, 30);
              // Only write the consolidated betrix key if SportGameOdds isn't present
              if (!sportsgameodds) {
                const bySport = { sports: { soccer: { fetchedAt: ts, count: live.length, samples: cappedLive } } };
                await safeSet('betrix:prefetch:live:by-sport', bySport, 30);
              }
              await recordSuccess('sportsmonks');
            }
            const fixtures = await sportsAggregator.getFixtures().catch(async (_err) => { await recordFailure('sportsmonks-fixtures'); return []; });
            if (fixtures && fixtures.length > 0) {
              const cappedFixtures = Array.isArray(fixtures) ? fixtures.slice(0, Math.min(MAX_PREFETCH_STORE, fixtures.length)) : [];
              await safeSet('prefetch:sportsmonks:fixtures', { fetchedAt: ts, count: fixtures.length, data: cappedFixtures }, 60);
              // Only publish consolidated upcoming fixtures if SportGameOdds isn't present
              if (!sportsgameodds) {
                await safeSet('betrix:prefetch:upcoming:by-sport', { sports: { soccer: { fetchedAt: ts, count: fixtures.length, samples: cappedFixtures } } }, 60);
              }
              await recordSuccess('sportsmonks-fixtures');
            }
            await redis.publish('prefetch:updates', JSON.stringify({ type: 'sportsmonks', ts, live: live ? live.length : 0, fixtures: fixtures ? fixtures.length : 0 }));
          }
        } catch (e) {
          await redis.publish('prefetch:error', JSON.stringify({ type: 'sportsmonks', error: e.message || String(e), ts }));
          await recordFailure('sportsmonks');
        }
      }

      // 6) SportGameOdds (sgo) - use pagination helpers to fetch league events and sample odds
      if (sportsgameodds) {
        try {
          if (!await isAllowedToRun('sportsgameodds')) { /* skip due to backoff */ }
          else {
            const cfg = process.env.SGO_PREFETCH_LEAGUES || 'EPL,NBA,NFL';
            const leagues = cfg.split(',').map(s=>s.trim()).filter(Boolean).slice(0,10);
            // Aggregate across leagues so we can publish consolidated betrix prefetch keys
            const aggregatedEvents = [];
            let totalEventsCount = 0;
            for (const league of leagues) {
              try {
                const events = await sportsgameodds.fetchAllEvents({ league, redis, forceFetch: true }).catch(async (err) => { await recordFailure(`sgo-events:${league}`); throw err; });
                if (events) {
                  const capped = Array.isArray(events) ? events.slice(0, Math.min(MAX_PREFETCH_STORE, events.length)) : events;
                  await safeSet(`prefetch:sgo:events:${league}`, { fetchedAt: ts, count: Array.isArray(events)?events.length:0, data: capped }, 60);
                  // add to aggregated list used for consolidated quick-lookup keys
                  if (Array.isArray(capped) && capped.length) {
                    aggregatedEvents.push(...capped.slice(0, Math.min(MAX_PREFETCH_STORE, capped.length)));
                    totalEventsCount += capped.length;
                  }
                  // For the first few events, fetch odds to warm odds caches
                  const sampleIds = (Array.isArray(capped) ? capped.slice(0,5).map(ev => ev.id || ev.eventId || ev._id).filter(Boolean) : []).slice(0,5);
                  if (sampleIds.length) {
                    try {
                      const odds = await sportsgameodds.fetchAllOdds({ league, eventIDs: sampleIds.join(','), redis, forceFetch: true }).catch(async (err) => { await recordFailure(`sgo-odds:${league}`); throw err; });
                      if (odds) await safeSet(`prefetch:sgo:odds:${league}`, { fetchedAt: ts, sample: sampleIds.length, data: odds }, 60);
                    } catch (e) { console.warn('sgo fetchAllOdds failed', e?.message || String(e)); }
                  }
                  await recordSuccess('sportsgameodds');
                }
              } catch (e) {
                await redis.publish('prefetch:error', JSON.stringify({ type: 'sportsgameodds', league, error: e.message || String(e), ts }));
                await recordFailure('sportsgameodds');
              }
            }
            // After fetching league samples, publish a consolidated key usable by Telegram handlers
            try {
              if (aggregatedEvents.length) {
                const cappedAgg = aggregatedEvents.slice(0, Math.min(MAX_PREFETCH_STORE, aggregatedEvents.length));
                await safeSet('betrix:prefetch:upcoming:by-sport', { sports: { soccer: { fetchedAt: ts, count: totalEventsCount, samples: cappedAgg } } }, 60);
                // For now use same samples for live quick-look; dedicated live feeds will still be provider-specific
                await safeSet('betrix:prefetch:live:by-sport', { sports: { soccer: { fetchedAt: ts, count: 0, samples: cappedAgg.slice(0,5) } } }, 30);
              }
            } catch (e) { void e; }
            await redis.publish('prefetch:updates', JSON.stringify({ type: 'sportsgameodds', ts }));
          }
        } catch (e) {
          await redis.publish('prefetch:error', JSON.stringify({ type: 'sportsgameodds', error: e.message || String(e), ts }));
          await recordFailure('sportsgameodds');
        }
      }

      lastRun = ts;
    } catch (err) {
      await redis.publish('prefetch:error', JSON.stringify({ type: 'unknown', error: err.message || String(err), ts }));
    } finally {
      running = false;
    }
  };

  // Kick off immediate run then interval
  job();
  const handle = setInterval(job, Math.max(1, intervalSeconds) * 1000);

  return {
    stop: () => clearInterval(handle),
    lastRun: () => lastRun,
  };
}

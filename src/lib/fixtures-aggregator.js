// Aggregator: merge fixtures/live matches from multiple cached providers
// Exports: aggregateFixtures(redis) -> returns summary and writes Redis totals
export async function aggregateFixtures(redis, opts = {}) {
  if (!redis) throw new Error('redis required');
  const now = Date.now();
  const cap = Number(opts.cap || 1000);

  const patterns = [
    'prefetch:sportsmonks:live',
    'prefetch:sportsmonks:fixtures',
    'prefetch:sgo:events:*',
    'prefetch:sgo:odds:*',
    'prefetch:openligadb:recent:*',
    'prefetch:scorebat:free',
    'rapidapi:scores:sport:*',
    'rapidapi:odds:sport:*',
    'rapidapi:*:fixtures:*',
    'rapidapi:soccer:fixtures:*',
  ];

  const keys = new Set();
  for (const p of patterns) {
    try {
      if (p.includes('*')) {
        const ks = await redis.keys(p).catch(() => []);
        for (const k of ks || []) keys.add(k);
      } else {
        keys.add(p);
      }
    } catch (e) {
      /* ignore */
    }
  }

  const rawItems = [];
  for (const k of keys) {
    try {
      const v = await redis.get(k).catch(() => null);
      if (!v) continue;
      let parsed = null;
      try { parsed = typeof v === 'string' ? JSON.parse(v) : v; } catch (e) { parsed = v; }
      rawItems.push({ key: k, value: parsed });
    } catch (e) {
      /* ignore per-key parse errors */
    }
  }

  const fixtures = [];
  const providers = {};

  const normalize = (raw, providerName, sportHint) => {
    try {
      if (!raw) return [];
      // raw may contain { data: [...]} or { fixtures: [...] } or be an array
      const candidates = [];
      if (Array.isArray(raw)) candidates.push({ arr: raw });
      if (Array.isArray(raw.data)) candidates.push({ arr: raw.data });
      if (Array.isArray(raw.fixtures)) candidates.push({ arr: raw.fixtures });
      if (Array.isArray(raw.events)) candidates.push({ arr: raw.events });
      if (Array.isArray(raw.items)) candidates.push({ arr: raw.items });
      if (Array.isArray(raw.matches)) candidates.push({ arr: raw.matches });
      if (candidates.length === 0 && raw.list && Array.isArray(raw.list)) candidates.push({ arr: raw.list });
      const out = [];
      for (const c of candidates) {
        for (const ev of (c.arr || [])) {
          const home = ev.home_team || ev.home || ev.homeTeam?.name || ev.team1 || (ev.teams && ev.teams[0]) || ev.home?.name || null;
          const away = ev.away_team || ev.away || ev.awayTeam?.name || ev.team2 || (ev.teams && ev.teams[1]) || ev.away?.name || null;
          const start = ev.commence_time || ev.commence || ev.start || ev.date || ev.kickoff || ev.scheduled || ev.utcDate || null;
          const sport = ev.sport || sportHint || 'soccer';
          const league = ev.league || ev.competition || ev.competition_name || ev.competition?.name || null;
          const odds = ev.odds || ev.bookmakers || ev.markets || null;
          const status = ev.status || ev.matchStatus || (ev.is_live ? 'LIVE' : null) || null;
          out.push({ provider: providerName || 'unknown', sport, league, type: (status && /live|inplay|running/i.test(String(status))) ? 'live' : (start ? (Date.parse(String(start)) <= Date.now() ? 'live' : 'upcoming') : 'upcoming'), homeTeam: home || null, awayTeam: away || null, startTime: start || null, odds });
        }
      }
      return out;
    } catch (e) { return []; }
  };

  for (const item of rawItems) {
    try {
      const k = item.key || '';
      const v = item.value || {};
      let providerName = null;
      if (v && v.apiName) providerName = v.apiName;
      else if (k.includes('sportsmonks') || k.includes('prefetch:sportsmonks')) providerName = 'SportMonks';
      else if (k.includes('footballdata') || k.includes('prefetch:footballdata')) providerName = 'FootballData';
      else if (k.includes('heisenbug')) providerName = 'Heisenbug';
      else if (k.includes('odds') || k.includes('rapidapi:odds')) providerName = 'OddsAPI';
      else providerName = providerName || (k.split(':')[1] || 'unknown');

      const sportHint = (v && v.sportKey) || (v && v.sport) || 'soccer';
      const normalized = normalize(v.data || v || v, providerName, sportHint);
      if (!providers[providerName]) providers[providerName] = { live: 0, upcoming: 0 };
      for (const f of normalized) {
        if (!f.homeTeam || !f.awayTeam) continue;
        fixtures.push(f);
        if (f.type === 'live') providers[providerName].live += 1;
        else providers[providerName].upcoming += 1;
      }
    } catch (e) {}
  }

  // dedupe by home::away::startTime
  const seen = new Map();
  const merged = [];
  for (const f of fixtures) {
    const k = `${f.homeTeam || ''}::${f.awayTeam || ''}::${String(f.startTime || '')}`;
    if (!seen.has(k)) {
      seen.set(k, true);
      merged.push(f);
    }
  }

  const totalLiveMatches = merged.filter((m) => m.type === 'live').length;
  const totalUpcomingFixtures = merged.filter((m) => m.type === 'upcoming').length;

  // per-sport totals
  const bySport = {};
  for (const m of merged) {
    const s = String(m.sport || 'soccer');
    if (!bySport[s]) bySport[s] = { live: 0, upcoming: 0 };
    if (m.type === 'live') bySport[s].live += 1;
    else bySport[s].upcoming += 1;
  }

  // write Redis keys
  try {
    await redis.set('rapidapi:fixtures:live:total', String(totalLiveMatches)).catch(()=>{});
    await redis.set('rapidapi:fixtures:upcoming:total', String(totalUpcomingFixtures)).catch(()=>{});
    for (const [s, counts] of Object.entries(bySport)) {
      const keySafe = String(s).toLowerCase();
      await redis.set(`rapidapi:fixtures:live:${keySafe}`, String(counts.live)).catch(()=>{});
      await redis.set(`rapidapi:fixtures:upcoming:${keySafe}`, String(counts.upcoming)).catch(()=>{});
    }
    await redis.set('rapidapi:fixtures:list', JSON.stringify(merged.slice(0, cap))).catch(()=>{});
    await redis.set('rapidapi:fixtures:providers', JSON.stringify(providers)).catch(()=>{});
  } catch (e) {}

  return { totalLiveMatches, totalUpcomingFixtures, providers, fixtures: merged, bySport };
}

export default { aggregateFixtures };

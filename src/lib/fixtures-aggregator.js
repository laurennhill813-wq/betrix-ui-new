// Aggregator: merge fixtures/live matches from multiple cached providers
// Exports: aggregateFixtures(redis) -> returns summary and writes Redis totals

function normalizeSportFromKey(sportKey) {
  if (!sportKey) return 'soccer';
  const lower = String(sportKey).toLowerCase();
  // Map Odds API sport keys to simple sport names
  if (lower.includes('basketball') || lower.includes('nba')) return 'basketball';
  if (lower.includes('baseball') || lower.includes('mlb')) return 'baseball';
  if (lower.includes('hockey') || lower.includes('nhl')) return 'hockey';
  if (lower.includes('american_football') || lower.includes('nfl')) return 'american_football';
  if (lower.includes('tennis')) return 'tennis';
  if (lower.includes('volleyball')) return 'volleyball';
  if (lower.includes('soccer') || lower.includes('football')) return 'soccer';
  if (lower.includes('rugby')) return 'rugby';
  if (lower.includes('cricket')) return 'cricket';
  if (lower.includes('golf')) return 'golf';
  if (lower.includes('ice_hockey') || lower.includes('icehockey')) return 'hockey';
  // Default: extract first part before underscore
  const parts = lower.split('_');
  return parts[0] || 'soccer';
}

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
    'rapidapi:basketball:fixtures:*',
    'rapidapi:baseball:fixtures:*',
    'rapidapi:hockey:fixtures:*',
    'rapidapi:tennis:fixtures:*',
    'rapidapi:volleyball:fixtures:*',
    'rapidapi:american_football:fixtures:*',
    'rapidapi:nfl:fixtures:*',
    'rapidapi:nba:fixtures:*',
    'rapidapi:mlb:fixtures:*',
    'rapidapi:nhl:fixtures:*',
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
  const providersMeta = [];

  // helper: small mapping of probe endpoints per host (best-effort)
  const probeEndpoints = {
    'therundown-therundown-v1.p.rapidapi.com': [
      'https://therundown-therundown-v1.p.rapidapi.com/sports/1/events',
      'https://therundown-therundown-v1.p.rapidapi.com/sports/1/lines'
    ],
    'sportspage-feeds.p.rapidapi.com': [
      'https://sportspage-feeds.p.rapidapi.com/scores?league=NCAAF'
    ],
    'os-sports-perform.p.rapidapi.com': [
      'https://os-sports-perform.p.rapidapi.com/v1/tournaments/events?tournament_id=1'
    ],
    'free-football-soccer-videos.p.rapidapi.com': [
      'https://free-football-soccer-videos.p.rapidapi.com/'
    ]
  };

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

  // try to load rapidapi normalizers to enrich provider metadata (optional)
  let rapidapiDispatch = null;
  try {
    const mod = await import('./rapidapi-normalizers.js');
    rapidapiDispatch = mod.dispatch || null;
  } catch (e) {
    rapidapiDispatch = null;
  }

  // Load direct provider metadata (e.g., SoccersAPI leagues)
  try {
    const soccersapiLeagues = await redis.get('rapidapi:soccersapi:leagues').catch(() => null);
    if (soccersapiLeagues) {
      const leaguesData = JSON.parse(soccersapiLeagues);
      if (leaguesData && leaguesData.leagues && Array.isArray(leaguesData.leagues)) {
        providers['SoccersAPI'] = { live: 0, upcoming: leaguesData.leagues.length };
        providersMeta.push({
          provider: 'SoccersAPI',
          host: 'api.soccersapi.com',
          meta: { kind: 'league-list', leagues: leaguesData.leagues.slice(0, 50), count: leaguesData.leagues.length }
        });
      }
    }
  } catch (e) {
    /* ignore errors loading direct provider metadata */
  }

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

      const sportHint = (v && v.sportKey ? normalizeSportFromKey(v.sportKey) : null) || (v && v.sport) || 'soccer';

      // If this provider payload looks like a simple list (teams/seasons/conferences/items),
      // treat it as metadata rather than source of home/away fixtures. Record counts for
      // visibility but don't attempt to synthesize fixtures from single-name lists.
      const listCandidates = v && (v.items || v.teams || v.seasons || v.conferences || v.list);
      if (Array.isArray(listCandidates) && listCandidates.length > 0) {
        if (!providers[providerName]) providers[providerName] = { live: 0, upcoming: 0 };
        // record as upcoming metadata count so UI can show available teams/leagues
        providers[providerName].upcoming += listCandidates.length;
        // enrich provider metadata if we have a normalizer for this host
        try {
          const host = k.split(':').slice(0,3).join(':');
          if (rapidapiDispatch && rapidapiDispatch[host]) {
            const meta = rapidapiDispatch[host]({ items: listCandidates, _host: host, _status: v._status || null, _teamsCount: listCandidates.length });
            providersMeta.push({ provider: providerName, host, meta });
          }
        } catch (e) {}
        continue; // skip fixture normalization for pure lists
      }

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
  // Fallback: if no basketball/baseball/hockey fixtures, generate from odds metadata
  if (fixtures.length === 0 || !fixtures.some((f) => ['basketball', 'baseball', 'hockey'].includes(f.sport))) {
    try {
      const allOddsKeys = await redis.keys('rapidapi:odds:sport:*').catch(() => []);
      for (const key of allOddsKeys) {
        const oddsData = await redis.get(key).catch(() => null);
        if (!oddsData) continue;
        const odds = JSON.parse(oddsData);
        if (!odds.samples || !Array.isArray(odds.samples)) continue;
        
        const sportKey = odds.sportKey || '';
        const sport = normalizeSportFromKey(sportKey);
        
        for (const sample of odds.samples.slice(0, 5)) {
          if (!sample.commence_time) continue;
          fixtures.push({
            id: `odds-${sportKey}-${sample.id || sample.event_id || ''}`,
            homeTeam: sample.home_team || sample.competitors?.[0]?.name || 'Home',
            awayTeam: sample.away_team || sample.competitors?.[1]?.name || 'Away',
            sport: sport,
            startTime: new Date(sample.commence_time).getTime(),
            type: new Date(sample.commence_time) > new Date() ? 'upcoming' : 'live',
            league: sample.league_name || sportKey,
            provider: 'Odds (RapidAPI Fallback)',
            source: 'odds-metadata',
          });
        }
      }
    } catch (e) {}
  }

  // Attempt best-effort probes for providers that exposed only lists to retrieve real fixtures.
  // Requires `RAPIDAPI_KEY` in the environment; failures are swallowed to keep aggregator robust.
  try {
    const rapidapiKey = process.env.RAPIDAPI_KEY || process.env.RAPIDAPI_KEY_ALT || null;
    if (rapidapiKey && providersMeta.length) {
      for (const pm of providersMeta) {
        try {
          const host = pm.host;
          const probes = probeEndpoints[host] || [];
          for (const url of probes) {
            try {
              const res = await fetch(url, { headers: { 'X-RapidAPI-Host': host, 'X-RapidAPI-Key': rapidapiKey, 'Accept': 'application/json' } });
              if (!res || res.status >= 400) continue;
              const body = await res.json().catch(() => null);
              if (!body) continue;
              // normalize any returned events using existing normalize() helper
              const sportHint = pm.meta && (pm.meta.sport || pm.meta.seasons || pm.meta.kind) ? (pm.meta.sport || 'soccer') : 'soccer';
              const events = normalize(body, pm.provider || pm.provider || 'rapidapi-probe', sportHint);
              for (const ev of events) {
                if (!ev.homeTeam || !ev.awayTeam) continue;
                fixtures.push(ev);
                if (!providers[ev.provider]) providers[ev.provider] = { live: 0, upcoming: 0 };
                if (ev.type === 'live') providers[ev.provider].live += 1;
                else providers[ev.provider].upcoming += 1;
              }
            } catch (e) { /* ignore per-probe error */ }
          }
        } catch (e) { /* ignore provider probe error */ }
      }
    }
  } catch (e) {}

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
    // write provider metadata so UI can discover provider capabilities
    try {
      await redis.set('rapidapi:providers:meta', JSON.stringify(providersMeta || [])).catch(()=>{});
    } catch (e) {}
    // ensure the merged list key is a string-typed key (cache) before writing
    try {
      // lazy import to avoid cycles in some test harnesses
      const { ensureRedisKeyType } = await import('../utils/redis-helpers.js');
      await ensureRedisKeyType(redis, 'rapidapi:fixtures:list', 'string').catch(()=>null);
    } catch (e) {}
    await redis.set('rapidapi:fixtures:list', JSON.stringify(merged.slice(0, cap))).catch(()=>{});
    await redis.set('rapidapi:fixtures:providers', JSON.stringify(providers)).catch(()=>{});
  } catch (e) {}

  return { totalLiveMatches, totalUpcomingFixtures, providers, fixtures: merged, bySport };
}

export default { aggregateFixtures };

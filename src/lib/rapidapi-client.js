import WebSocket from 'ws';

const DEFAULT_HEADERS = () => ({
  'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
});

async function safeFetchJson(url, host) {
  try {
    const headers = { ...DEFAULT_HEADERS() };
    if (host) headers['X-RapidAPI-Host'] = host;
    const res = await fetch(url, { method: 'GET', headers }).catch((e) => { throw e; });
    if (!res || !res.ok) return null;
    const body = await res.json().catch(() => null);
    return body;
  } catch (e) {
    return null;
  }
}

function normalizeEvent(ev, providerName, sportHint = 'soccer') {
  try {
    const home = ev.home_team || ev.home || ev.homeTeam?.name || ev.team1 || (ev.teams && ev.teams[0]) || null;
    const away = ev.away_team || ev.away || ev.awayTeam?.name || ev.team2 || (ev.teams && ev.teams[1]) || null;
    const start = ev.commence_time || ev.commence || ev.start || ev.date || ev.kickoff || ev.scheduled || ev.utcDate || null;
    const league = ev.league || ev.competition || ev.competition_name || (ev.competition && ev.competition.name) || null;
    const status = ev.status || ev.matchStatus || (ev.is_live ? 'LIVE' : null) || null;
    const type = (status && /live|inplay|running/i.test(String(status))) ? 'live' : (start ? (Date.parse(String(start)) <= Date.now() ? 'live' : 'upcoming') : 'upcoming');
    return {
      provider: providerName || 'unknown',
      sport: ev.sport || sportHint,
      league: league || null,
      type,
      homeTeam: home || null,
      awayTeam: away || null,
      startTime: start || null,
      odds: ev.odds || ev.bookmakers || ev.markets || null,
    };
  } catch (e) {
    return null;
  }
}

export async function fetchUpcomingFixtures(provider = {}, options = {}) {
  if (!provider || !provider.host) throw new Error('provider.host required');
  const apiPath = options.path || '/sports/markets/';
  const base = provider.host.startsWith('http') ? provider.host : `https://${provider.host}`;
  const url = `${base}${apiPath}`;
  const body = await safeFetchJson(url, provider.host);
  if (!body) return [];
  // attempt to extract arrays
  const candidates = [];
  if (Array.isArray(body)) candidates.push(body);
  if (Array.isArray(body.data)) candidates.push(body.data);
  if (Array.isArray(body.fixtures)) candidates.push(body.fixtures);
  if (Array.isArray(body.events)) candidates.push(body.events);
  const arr = candidates.length ? candidates[0] : [];
  const out = [];
  for (const ev of (arr || [])) {
    const n = normalizeEvent(ev, provider.name || provider.host, ev.sport || options.sport || 'soccer');
    if (n) out.push(n);
  }
  return out;
}

export async function fetchLiveMatches(provider = {}, options = {}) {
  if (!provider || !provider.host) throw new Error('provider.host required');
  const apiPath = options.path || '/scores/';
  const base = provider.host.startsWith('http') ? provider.host : `https://${provider.host}`;
  const url = `${base}${apiPath}`;
  const body = await safeFetchJson(url, provider.host);
  if (!body) return [];
  const candidates = [];
  if (Array.isArray(body)) candidates.push(body);
  if (Array.isArray(body.data)) candidates.push(body.data);
  if (Array.isArray(body.matches)) candidates.push(body.matches);
  if (Array.isArray(body.results)) candidates.push(body.results);
  const arr = candidates.length ? candidates[0] : [];
  const out = [];
  for (const ev of (arr || [])) {
    const n = normalizeEvent(ev, provider.name || provider.host, ev.sport || options.sport || 'soccer');
    if (n) out.push(n);
  }
  return out;
}

export function subscribeOdds(provider = {}, opts = {}) {
  // Provide a lightweight wrapper around WebSocket; best-effort if 'ws' package available
  if (!provider || !provider.wsUrl) throw new Error('provider.wsUrl required for subscribeOdds');
  try {
    const ws = new WebSocket(provider.wsUrl, { headers: { ...DEFAULT_HEADERS(), 'X-RapidAPI-Host': provider.host } });
    ws.on('open', () => {
      try { console.log('[therundown] websocket open', provider.host); } catch (e) {}
      if (opts.onOpen) opts.onOpen();
    });
    ws.on('message', (msg) => {
      try { const json = typeof msg === 'string' ? JSON.parse(msg) : JSON.parse(msg.toString()); if (opts.onMessage) opts.onMessage(json); } catch (e) {}
    });
    ws.on('error', (err) => { try { console.warn('[therundown] websocket error', err && err.message ? err.message : err); } catch (e) {} if (opts.onError) opts.onError(err); });
    ws.on('close', (code, reason) => { try { console.log('[therundown] websocket closed', code, String(reason)); } catch (e) {} if (opts.onClose) opts.onClose(code, reason); });
    return ws;
  } catch (e) {
    return null;
  }
}

export default { fetchUpcomingFixtures, fetchLiveMatches, subscribeOdds };

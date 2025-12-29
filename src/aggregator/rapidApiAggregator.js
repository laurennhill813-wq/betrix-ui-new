// rapidApiAggregator: optional RapidAPI-backed event sources
// Reads `process.env.RAPIDAPI_KEY` (and optionally `RAPIDAPI_HOSTS` comma-separated)
// and attempts to fetch additional events from various RapidAPI endpoints.

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

async function fetchJson(url, headers = {}) {
  try {
    const res = await fetch(url, { headers, timeout: 10000 });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function normalizeEvent(ev) {
  if (!ev) return null;
  // Best-effort normalization across different RapidAPI providers
  return {
    sport: (ev.sport || ev.sport_name || ev.sportId || ev.sport_id || 'soccer'),
    league: ev.league || ev.competition || ev.league_name || null,
    home: ev.home || ev.home_team || ev.team_home || ev.home_name || ev.homeTeam || ev.home_team_name || null,
    away: ev.away || ev.away_team || ev.team_away || ev.away_name || ev.awayTeam || ev.away_team_name || null,
    status: ev.status || ev.state || ev.match_status || ev.statusName || 'UPCOMING',
    score: ev.score || ev.result || ev.scores || null,
    time: ev.time || ev.minute || ev.start || null,
    id: ev.id || ev._id || ev.event_id || ev.eventId || (ev.home && ev.away ? `${ev.home}-vs-${ev.away}` : null),
    raw: ev,
  };
}

export async function getExtraEvents() {
  if (!RAPIDAPI_KEY) return [];

  const headersBase = {
    'x-rapidapi-key': RAPIDAPI_KEY,
  };

  const results = [];

  // 1) sportscore1 search (generic event search)
  try {
    const url = 'https://sportscore1.p.rapidapi.com/events/search?sport_id=1&page=1';
    const headers = { ...headersBase, 'x-rapidapi-host': 'sportscore1.p.rapidapi.com' };
    const json = await fetchJson(url, headers);
    if (json && Array.isArray(json.data)) {
      for (const it of json.data.slice(0, 50)) {
        const ev = normalizeEvent({
          sport: it.sport_id || it.sport || 'soccer',
          league: it.league_name || it.competition,
          home: it.home_team_name || it.home_team || it.home,
          away: it.away_team_name || it.away_team || it.away,
          status: it.status || it.match_status,
          id: it.event_id || it.id,
          raw: it,
        });
        if (ev) results.push(ev);
      }
    }
  } catch (e) {}

  // 2) therundown conferences -> try to expand to events per sport if available
  try {
    const url = 'https://therundown-therundown-v1.p.rapidapi.com/sports/1/conferences';
    const headers = { ...headersBase, 'x-rapidapi-host': 'therundown-therundown-v1.p.rapidapi.com' };
    const json = await fetchJson(url, headers);
    if (json && Array.isArray(json)) {
      // not necessarily events, but include as lightweight fixtures placeholder
      for (const c of json.slice(0, 20)) {
        const ev = normalizeEvent({
          sport: 'american_football',
          league: c.name || c.alias || null,
          home: c.home || null,
          away: c.away || null,
          status: 'UPCOMING',
          id: c.id || c.key || null,
          raw: c,
        });
        if (ev) results.push(ev);
      }
    }
  } catch (e) {}

  // 3) live-score API sample (if you know an event id) -- try a small id probe
  try {
    const url = 'https://live-score-api.p.rapidapi.com/scores/events.json?id=164008';
    const headers = { ...headersBase, 'x-rapidapi-host': 'live-score-api.p.rapidapi.com' };
    const json = await fetchJson(url, headers);
    if (json && json.events && Array.isArray(json.events)) {
      for (const it of json.events.slice(0, 10)) {
        const ev = normalizeEvent({
          sport: it.sport || 'soccer',
          league: it.league || it.competition || null,
          home: it.home || it.home_name || it.home_team || null,
          away: it.away || it.away_name || it.away_team || null,
          status: it.status || it.state || null,
          id: it.event_id || it.id,
          raw: it,
        });
        if (ev) results.push(ev);
      }
    }
  } catch (e) {}

  // Deduplicate by id
  const seen = new Set();
  const deduped = [];
  for (const r of results) {
    if (!r || !r.id) continue;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    deduped.push(r);
  }

  return deduped;
}

export default { getExtraEvents };

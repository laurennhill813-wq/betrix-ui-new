#!/usr/bin/env node
import fs from 'fs';

const RAPIDAPI_KEY = 'd04027f383msh0b0565415dfbe6dp1fc23bjsn22d9d050080e';

const endpoints = [
  {
    name: 'SportScore1 - Events Search (POST)',
    method: 'POST',
    host: 'sportscore1.p.rapidapi.com',
    url: "https://sportscore1.p.rapidapi.com/events/search?challenge_id=663&venue_id=6&referee_id=26&league_id=317&page=1&away_team_id=138&home_team_id=6&status=postponed&season_id=1&date_start=2018-09-15&date_end=2020-11-14&sport_id=1",
    body: {}
  },
  {
    name: 'Live Score API - Event',
    method: 'GET',
    host: 'live-score-api.p.rapidapi.com',
    url: 'https://live-score-api.p.rapidapi.com/scores/events.json?id=164008'
  },
  {
    name: 'Sportspage - Rankings (NCAAF)',
    method: 'GET',
    host: 'sportspage-feeds.p.rapidapi.com',
    url: 'https://sportspage-feeds.p.rapidapi.com/rankings?league=NCAAF'
  },
  {
    name: 'The Rundown - Conferences',
    method: 'GET',
    host: 'therundown-therundown-v1.p.rapidapi.com',
    url: 'https://therundown-therundown-v1.p.rapidapi.com/sports/1/conferences'
  },
  {
    name: 'Free Football Soccer Videos - Root',
    method: 'GET',
    host: 'free-football-soccer-videos.p.rapidapi.com',
    url: 'https://free-football-soccer-videos.p.rapidapi.com/'
  },
  {
    name: 'Horse Racing - Race',
    method: 'GET',
    host: 'horse-racing.p.rapidapi.com',
    url: 'https://horse-racing.p.rapidapi.com/race/207660'
  },
  {
    name: 'OS Sports Perform - Tournaments Seasons',
    method: 'GET',
    host: 'os-sports-perform.p.rapidapi.com',
    url: 'https://os-sports-perform.p.rapidapi.com/v1/tournaments/seasons?tournament_id=1'
  }
];

function extractTeamNames(obj, depth = 0, maxDepth = 4) {
  const teams = new Set();
  if (depth > maxDepth || obj == null) return teams;
  if (typeof obj === 'string') return teams;
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const s = extractTeamNames(it, depth + 1, maxDepth);
      s.forEach(t => teams.add(t));
    }
    return teams;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const kl = String(k).toLowerCase();
      if ((kl.includes('team') || kl.includes('name') || kl.includes('home') || kl.includes('away')) && typeof v === 'string') {
        if (v.length > 1 && v.length < 100) teams.add(v.trim());
      }
      if (typeof v === 'object') {
        const s = extractTeamNames(v, depth + 1, maxDepth);
        s.forEach(t => teams.add(t));
      }
    }
  }
  return teams;
}

function detectOdds(obj) {
  if (!obj) return false;
  const s = JSON.stringify(obj).toLowerCase();
  return s.includes('odds') || s.includes('bookmaker') || s.includes('price') || s.includes('spreads') || s.includes('moneyline');
}

async function callEndpoint(ep) {
  const headers = {
    'X-RapidAPI-Host': ep.host,
    'X-RapidAPI-Key': RAPIDAPI_KEY,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  try {
    const opts = { method: ep.method || 'GET', headers };
    if (ep.method === 'POST') opts.body = JSON.stringify(ep.body || {});
    const res = await fetch(ep.url, opts).catch(e => ({ error: e.message }));
    if (!res || res.error) return { error: res && res.error ? res.error : 'fetch_error' };
    const status = res.status;
    let text = null;
    try { text = await res.text(); } catch (e) { text = null; }
    let body = null;
    try { if (text) body = JSON.parse(text); } catch (e) { body = text; }

    const teams = extractTeamNames(body);
    const hasOdds = detectOdds(body);

    return {
      name: ep.name,
      host: ep.host,
      url: ep.url,
      status,
      hasBody: !!body,
      bodyType: Array.isArray(body) ? 'array' : (body && typeof body === 'object' ? 'object' : typeof body),
      teams: Array.from(teams).slice(0, 10),
      teamsCount: Array.from(teams).length,
      hasOdds
    };
  } catch (err) {
    return { name: ep.name, host: ep.host, error: err.message };
  }
}

async function main() {
  const results = [];
  for (const ep of endpoints) {
    process.stdout.write(`Testing ${ep.name}... `);
    const r = await callEndpoint(ep);
    results.push(r);
    console.log(r.error ? `ERROR` : `done (teams=${r.teamsCount} odds=${r.hasOdds})`);
  }
  fs.writeFileSync('test-provided-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to test-provided-results.json');
}

main().catch(e => console.error(e));

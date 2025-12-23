import fetch from 'node-fetch';
import unifiedAPI from '../src/services/unified-sports-api.js';

// List of working API keys from latest validation
const WORKING = [
  'nfl_teams',
  'premier_league',
  'therundown',
  'football_live_stream',
  'betsapi',
  'free_football_data',
  'sportspage_feeds',
  'sofascore',
  'sports_info',
  'odds_api1',
  'bet365_inplay',
  'pinnacle',
  'free_livescore',
  'football_pro',
  'newsnow'
];

async function callConfig(id) {
  try {
    switch (id) {
      case 'nfl_teams': {
        const teams = await unifiedAPI.getNFLTeams();
        return { id, ok: teams && teams.length > 0, count: teams.length, sample: teams.slice(0,3).map(t=>t.name) };
      }
      case 'premier_league': {
        const data = await unifiedAPI.getPremierLeagueTeam('Liverpool');
        return { id, ok: !!data, count: Array.isArray(data)?data.length: (data?1:0), sample: JSON.stringify(data).substring(0,200) };
      }
      case 'therundown': {
        const data = await unifiedAPI.fetch('therundown');
        return { id, ok: !!data, count: Array.isArray(data)?data.length: (data?1:0), sample: JSON.stringify(data).substring(0,200) };
      }
      case 'football_live_stream': {
        const data = await unifiedAPI.fetch('football_live_stream');
        return { id, ok: !!data, sample: JSON.stringify(data).substring(0,200) };
      }
      case 'betsapi': {
        const data = await unifiedAPI.fetch('betsapi');
        return { id, ok: !!data, sample: Array.isArray(data)?JSON.stringify(data[0]).substring(0,200):JSON.stringify(data).substring(0,200) };
      }
      case 'free_football_data': {
        const data = await unifiedAPI.fetch('free_football_data');
        return { id, ok: !!data, sample: JSON.stringify(data).substring(0,200) };
      }
      case 'sportspage_feeds': {
        const data = await unifiedAPI.fetch('sportspage_feeds');
        return { id, ok: !!data, count: Array.isArray(data)?data.length:0, sample: JSON.stringify(data).substring(0,200) };
      }
      case 'sofascore': {
        const data = await unifiedAPI.fetch('sofascore', { match_id: '8897222' });
        return { id, ok: !!data, sample: JSON.stringify(data).substring(0,200) };
      }
      case 'sports_info': {
        const news = await unifiedAPI.getBasketballNews();
        return { id, ok: Array.isArray(news) && news.length>0, count: news.length, sample: news.slice(0,3).map(n=>n.description||n.title) };
      }
      case 'odds_api1': {
        const data = await unifiedAPI.fetch('odds_api1');
        return { id, ok: !!data, sample: JSON.stringify(data).substring(0,200) };
      }
      case 'bet365_inplay': {
        const data = await unifiedAPI.fetch('bet365_inplay');
        return { id, ok: !!data, sample: JSON.stringify(data).substring(0,200) };
      }
      case 'pinnacle': {
        const data = await unifiedAPI.fetch('pinnacle');
        return { id, ok: !!data, sample: JSON.stringify(data).substring(0,200) };
      }
      case 'free_livescore': {
        const data = await unifiedAPI.fetch('free_livescore');
        return { id, ok: !!data, sample: JSON.stringify(data).substring(0,200) };
      }
      case 'football_pro': {
        const data = await unifiedAPI.fetch('football_pro');
        return { id, ok: !!data, sample: JSON.stringify(data).substring(0,200) };
      }
      case 'newsnow': {
        const data = await unifiedAPI.getTopNews();
        return { id, ok: Array.isArray(data) && data.length>0, count: data.length, sample: JSON.stringify(data[0]).substring(0,200) };
      }
      default:
        return { id, ok: false, error: 'unknown' };
    }
  } catch (err) {
    return { id, ok: false, error: err.message.substring(0,200) };
  }
}

async function run() {
  console.log('\nRe-running verified APIs and validating team/fixture samples:\n');
  const results = [];
  for (const id of WORKING) {
    const res = await callConfig(id);
    results.push(res);
    console.log(`- ${id}: ${res.ok ? 'OK' : 'FAIL'}${res.count?` (${res.count})`:''}${res.sample?` | sample: ${Array.isArray(res.sample)?res.sample.join(', '):res.sample}`:''}${res.error?` | error: ${res.error}`:''}`);
  }

  console.log('\nSummary:\n', results);
  return results;
}

// export run for programmatic invocation
export { run };

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(()=>process.exit(0)).catch(e=>{console.error(e); process.exit(2)});
}

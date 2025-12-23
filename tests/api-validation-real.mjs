/**
 * RapidAPI Sports Endpoints Validation
 * Tests all provided APIs with actual credentials to identify working endpoints
 * Focuses on: Real team names, fixtures, odds data
 */

import fetch from 'node-fetch';

const API_KEY = 'd04027f383msh0b0565415dfbe6dp1fc23bjsn22d9d050080e';

const APIs = [
  {
    id: 'nfl',
    name: 'NFL Team Listing',
    url: 'https://nfl-api-data.p.rapidapi.com/nfl-team-listing/v1/data',
    host: 'nfl-api-data.p.rapidapi.com',
    sport: 'NFL',
    dataType: 'Teams'
  },
  {
    id: 'premier_league',
    name: 'Premier League (Heisenbug)',
    url: 'https://heisenbug-premier-league-live-scores-v1.p.rapidapi.com/api/premierleague/team?name=Liverpool',
    host: 'heisenbug-premier-league-live-scores-v1.p.rapidapi.com',
    sport: 'Soccer',
    dataType: 'Team Details'
  },
  {
    id: 'football_prediction',
    name: 'Football Prediction API',
    url: 'https://football-prediction-api.p.rapidapi.com/api/v2/predictions?market=classic&iso_date=2025-12-25&federation=UEFA',
    host: 'football-prediction-api.p.rapidapi.com',
    sport: 'Soccer',
    dataType: 'Predictions'
  },
  {
    id: 'therundown',
    name: 'TheRundown Sports',
    url: 'https://therundown-therundown-v1.p.rapidapi.com/sports/1/conferences',
    host: 'therundown-therundown-v1.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'Conferences'
  },
  {
    id: 'odds_api',
    name: 'Odds API',
    url: 'https://odds.p.rapidapi.com/v4/sports/upcoming/odds?regions=us&oddsFormat=decimal&markets=h2h%2Cspreads&dateFormat=iso',
    host: 'odds.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'Live Odds'
  },
  {
    id: 'sofascore',
    name: 'SofaScore Matches',
    url: 'https://sofascore.p.rapidapi.com/matches/get-h2h?matchId=8897222',
    host: 'sofascore.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'Match Data'
  },
  {
    id: 'betsapi',
    name: 'BetsAPI (Bet365)',
    url: 'https://betsapi2.p.rapidapi.com/v3/bet365/prematch',
    host: 'betsapi2.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'Matches with Odds'
  },
  {
    id: 'livescore',
    name: 'Free LiveScore API',
    url: 'https://free-livescore-api.p.rapidapi.com/livescore-get-search?sportname=soccer&search=romania',
    host: 'free-livescore-api.p.rapidapi.com',
    sport: 'Soccer',
    dataType: 'Live Scores'
  },
  {
    id: 'sportapi7',
    name: 'SportAPI7 Player Ratings',
    url: 'https://sportapi7.p.rapidapi.com/api/v1/player/817181/unique-tournament/132/season/65360/ratings',
    host: 'sportapi7.p.rapidapi.com',
    sport: 'Soccer',
    dataType: 'Player Ratings'
  },
  {
    id: 'realtimesports',
    name: 'Real-time Sports Data',
    url: 'https://real-time-sports-data.p.rapidapi.com/api/event?eventId=23781550&langId=2',
    host: 'real-time-sports-data.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'Event Data'
  },
  {
    id: 'sofasport',
    name: 'SofaSport Odds',
    url: 'https://sofasport.p.rapidapi.com/v1/events/odds/winning?event_id=10253769&provider_id=1&odds_format=decimal',
    host: 'sofasport.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'Event Odds'
  },
  {
    id: 'bet365_leagues',
    name: 'Bet365 API (InPlay)',
    url: 'https://bet365-api-inplay.p.rapidapi.com/bet365/get_leagues',
    host: 'bet365-api-inplay.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'Leagues'
  },
  {
    id: 'pinnacle',
    name: 'Pinnacle Odds',
    url: 'https://pinnacle-odds.p.rapidapi.com/kit/v1/meta-periods?sport_id=1',
    host: 'pinnacle-odds.p.rapidapi.com',
    sport: 'Multi-Sport',
    dataType: 'Meta Periods'
  }
];

function extractTeamNames(data, depth = 0) {
  if (depth > 3) return [];
  const teams = [];
  
  if (!data) return teams;
  
  if (typeof data !== 'object') return teams;

  // Direct team fields
  if (data.team_name) teams.push(data.team_name);
  if (data.team) teams.push(typeof data.team === 'string' ? data.team : data.team.name || data.team.title);
  if (data.name && depth === 0) teams.push(data.name);
  if (data.teams && Array.isArray(data.teams)) {
    data.teams.forEach(t => {
      if (typeof t === 'string') teams.push(t);
      else if (t.name) teams.push(t.name);
      else if (t.team_name) teams.push(t.team_name);
    });
  }
  
  // Home/Away teams
  if (data.homeTeam) teams.push(data.homeTeam.name || data.homeTeam);
  if (data.awayTeam) teams.push(data.awayTeam.name || data.awayTeam);
  if (data.home_team) teams.push(data.home_team);
  if (data.away_team) teams.push(data.away_team);
  
  // Competitors
  if (data.competitors && Array.isArray(data.competitors)) {
    data.competitors.forEach(c => {
      if (c.name) teams.push(c.name);
    });
  }
  
  return [...new Set(teams)].filter(t => t && typeof t === 'string' && t.length > 2);
}

async function testAPI(api) {
  const start = Date.now();
  try {
    const response = await fetch(api.url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': api.host,
        'x-rapidapi-key': API_KEY,
        'User-Agent': 'BETRIX-Bot/1.0'
      },
      timeout: 8000
    });

    const elapsed = Date.now() - start;
    const status = response.status;
    let data = null;
    let error = null;

    try {
      data = await response.json();
    } catch (e) {
      error = 'JSON parse error';
    }

    const isSuccess = status === 200 && data && typeof data === 'object';
    const dataSize = data ? JSON.stringify(data).length : 0;
    const teams = isSuccess ? extractTeamNames(data) : [];
    const hasRealData = teams.length > 0 || (isSuccess && dataSize > 500);

    return {
      ...api,
      success: isSuccess,
      status,
      elapsed,
      dataSize,
      teams: teams.slice(0, 3),
      teamCount: teams.length,
      hasRealData,
      error: error || (status !== 200 ? `HTTP ${status}` : null),
      dataKeys: isSuccess ? Object.keys(data).slice(0, 5) : []
    };
  } catch (err) {
    return {
      ...api,
      success: false,
      status: 0,
      elapsed: Date.now() - start,
      error: err.message,
      dataSize: 0,
      teams: [],
      teamCount: 0,
      hasRealData: false
    };
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║         BETRIX SPORTS API VALIDATION TEST                           ║');
  console.log('║    Testing RapidAPI endpoints for real team/fixture data           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

  console.log(`Testing ${APIs.length} APIs with real credentials...\n`);

  const results = await Promise.all(APIs.map(testAPI));
  
  const working = results.filter(r => r.success && r.hasRealData);
  const partial = results.filter(r => r.success && !r.hasRealData);
  const failed = results.filter(r => !r.success);

  // Display working APIs
  console.log('\n✅ FULLY WORKING APIs (Returns Real Data):\n');
  working.forEach((r, i) => {
    console.log(`${i+1}. ${r.name} [${r.sport}]`);
    console.log(`   Status: ${r.status} | Speed: ${r.elapsed}ms | Data: ${r.dataSize} bytes`);
    if (r.teams.length > 0) {
      console.log(`   Sample Teams: ${r.teams.join(', ')}`);
    }
    console.log(`   Integration: Ready ✓`);
    console.log('');
  });

  // Display partial APIs
  if (partial.length > 0) {
    console.log('\n⚠️  PARTIAL APIs (Need Params):\n');
    partial.forEach((r, i) => {
      console.log(`${i+1}. ${r.name} [${r.sport}]`);
      console.log(`   Status: ${r.status} | Speed: ${r.elapsed}ms | Data: ${r.dataSize} bytes`);
      console.log(`   Issue: Returns data but no team information. May need params.`);
      console.log('');
    });
  }

  // Display failed APIs
  if (failed.length > 0) {
    console.log('\n❌ FAILED APIs:\n');
    failed.forEach((r, i) => {
      console.log(`${i+1}. ${r.name} [${r.sport}]`);
      console.log(`   Error: ${r.error}`);
      console.log('');
    });
  }

  // Summary and recommendations
  console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
  console.log(`║  SUMMARY: ${working.length} Working | ${partial.length} Partial | ${failed.length} Failed                          ║`);
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

  if (working.length > 0) {
    console.log('📋 INTEGRATION PLAN:\n');
    console.log('The following APIs are ready to integrate into the bot:\n');
    
    working.forEach(api => {
      console.log(`• ${api.name}`);
      console.log(`  - Sport: ${api.sport}`);
      console.log(`  - Data Type: ${api.dataType}`);
      console.log(`  - Teams Available: ${api.teamCount}`);
      console.log('');
    });

    // Generate config for integration
    const config = {
      workingAPIs: working.map(a => ({
        id: a.id,
        name: a.name,
        sport: a.sport,
        host: a.host,
        url: a.url,
        dataType: a.dataType
      }))
    };

    console.log('\n🔧 Configuration for bot integration:');
    console.log(JSON.stringify(config, null, 2));
  }

  return { working, partial, failed, results };
}

export { testAPI, main };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

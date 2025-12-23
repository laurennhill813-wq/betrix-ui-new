#!/usr/bin/env node
/**
 * Test all RapidAPI endpoints to identify which ones work
 * and what data they return for sports fixtures
 */

const RAPIDAPI_KEY = 'd04027f383msh0b0565415dfbe6dp1fc23bjsn22d9d050080e';

const endpoints = [
  {
    name: 'NFL API Data - Teams',
    host: 'nfl-api-data.p.rapidapi.com',
    path: '/nfl-team-listing/v1/data',
    sport: 'nfl',
    expectsData: 'teams'
  },
  {
    name: 'Heisenbug - Premier League Team',
    host: 'heisenbug-premier-league-live-scores-v1.p.rapidapi.com',
    path: '/api/premierleague/team?name=Liverpool',
    sport: 'soccer',
    expectsData: 'fixtures'
  },
  {
    name: 'Football Prediction API',
    host: 'football-prediction-api.p.rapidapi.com',
    path: '/api/v2/predictions?market=classic&iso_date=2025-12-23&federation=UEFA',
    sport: 'soccer',
    expectsData: 'predictions'
  },
  {
    name: 'The Rundown - Sports',
    host: 'therundown-therundown-v1.p.rapidapi.com',
    path: '/sports/1/conferences',
    sport: 'nfl',
    expectsData: 'conferences'
  },
  {
    name: 'Odds API - Upcoming Odds',
    host: 'odds.p.rapidapi.com',
    path: '/v4/sports/upcoming/odds?regions=us&oddsFormat=decimal&markets=h2h,spreads&dateFormat=iso',
    sport: 'multi',
    expectsData: 'fixtures'
  },
  {
    name: 'Football Live Stream',
    host: 'football-live-stream-api.p.rapidapi.com',
    path: '/link/truc-tiep-tran-dau-coquimbo-unido-vs-universidad-de-chile-2674554',
    sport: 'soccer',
    expectsData: 'stream'
  },
  {
    name: 'SportAPI7 - Player Ratings',
    host: 'sportapi7.p.rapidapi.com',
    path: '/api/v1/player/817181/unique-tournament/132/season/65360/ratings',
    sport: 'soccer',
    expectsData: 'player'
  },
  {
    name: 'BetsAPI2 - Prematch',
    host: 'betsapi2.p.rapidapi.com',
    path: '/v3/bet365/prematch',
    sport: 'multi',
    expectsData: 'fixtures'
  },
  {
    name: 'All Sports API 2',
    host: 'allsportsapi2.p.rapidapi.com',
    path: '/api/tv/country/all/event/10974920',
    sport: 'multi',
    expectsData: 'event'
  },
  {
    name: 'Real Time Sports Data',
    host: 'real-time-sports-data.p.rapidapi.com',
    path: '/api/event?eventId=23781550&langId=2',
    sport: 'multi',
    expectsData: 'event'
  },
  {
    name: 'Free Football API - Statistics',
    host: 'free-football-api-data.p.rapidapi.com',
    path: '/football-event-statistics?eventid=12650707',
    sport: 'soccer',
    expectsData: 'statistics'
  },
  {
    name: 'Sportspage Feeds - Rankings',
    host: 'sportspage-feeds.p.rapidapi.com',
    path: '/rankings?league=NCAAF',
    sport: 'nfl',
    expectsData: 'rankings'
  },
  {
    name: 'SofaScore - H2H',
    host: 'sofascore.p.rapidapi.com',
    path: '/matches/get-h2h?matchId=8897222',
    sport: 'multi',
    expectsData: 'matches'
  },
  {
    name: 'Sports Information - MBB News',
    host: 'sports-information.p.rapidapi.com',
    path: '/mbb/news?limit=30',
    sport: 'basketball',
    expectsData: 'news'
  },
  {
    name: 'Odds API 1 - Scores',
    host: 'odds-api1.p.rapidapi.com',
    path: '/scores?fixtureId=id1200255561449537',
    sport: 'multi',
    expectsData: 'scores'
  },
  {
    name: 'SofaSport - Events Odds',
    host: 'sofasport.p.rapidapi.com',
    path: '/v1/events/odds/winning?event_id=10253769&provider_id=1&odds_format=decimal',
    sport: 'multi',
    expectsData: 'odds'
  },
  {
    name: 'Bet365 API - Leagues',
    host: 'bet365-api-inplay.p.rapidapi.com',
    path: '/bet365/get_leagues',
    sport: 'multi',
    expectsData: 'leagues'
  },
  {
    name: 'Pinnacle Odds - Meta Periods',
    host: 'pinnacle-odds.p.rapidapi.com',
    path: '/kit/v1/meta-periods?sport_id=1',
    sport: 'nfl',
    expectsData: 'periods'
  },
  {
    name: 'Free LiveScore - Search',
    host: 'free-livescore-api.p.rapidapi.com',
    path: '/livescore-get-search?sportname=soccer&search=romania',
    sport: 'soccer',
    expectsData: 'search'
  },
  {
    name: 'Free API Live Football - Players',
    host: 'free-api-live-football-data.p.rapidapi.com',
    path: '/football-players-search?search=m',
    sport: 'soccer',
    expectsData: 'players'
  },
  {
    name: 'Real Time Sports News API',
    host: 'real-time-sports-news-api.p.rapidapi.com',
    path: '/sources-by-category?category=sports',
    sport: 'multi',
    expectsData: 'news'
  },
  {
    name: 'Football Pro - Corrections',
    host: 'football-pro.p.rapidapi.com',
    path: '/api/v2.0/corrections/season/17141?tz=Europe%2FAmsterdam',
    sport: 'soccer',
    expectsData: 'corrections'
  },
  {
    name: 'FlashLive Sports - News',
    host: 'flashlive-sports.p.rapidapi.com',
    path: '/v1/news/list?entity_id=1&page=0&category_id=59&locale=en_INT',
    sport: 'multi',
    expectsData: 'news'
  }
];

async function testEndpoint(endpoint) {
  const url = `https://${endpoint.host}${endpoint.path}`;
  const headers = {
    'X-RapidAPI-Host': endpoint.host,
    'X-RapidAPI-Key': RAPIDAPI_KEY,
    'Accept': 'application/json'
  };

  try {
    const response = await fetch(url, { headers, timeout: 10000 });
    const status = response.status;
    let body = null;
    let bodyText = '';

    try {
      bodyText = await response.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch (e) {
      body = { error: 'Failed to parse response as JSON', rawLength: bodyText.length };
    }

    const result = {
      name: endpoint.name,
      host: endpoint.host,
      sport: endpoint.sport,
      status,
      success: status >= 200 && status < 300,
      bodyKeys: body && typeof body === 'object' ? Object.keys(body).slice(0, 5) : [],
      bodyLength: bodyText.length,
      hasArray: Array.isArray(body),
      firstItem: Array.isArray(body) && body.length > 0 ? Object.keys(body[0]).slice(0, 3) : null,
      arrayLength: Array.isArray(body) ? body.length : null
    };

    return result;
  } catch (error) {
    return {
      name: endpoint.name,
      host: endpoint.host,
      sport: endpoint.sport,
      status: 'error',
      success: false,
      error: error.message
    };
  }
}

async function main() {
  console.log('🧪 Testing all RapidAPI endpoints...\n');

  const results = [];
  const startTime = Date.now();

  for (const endpoint of endpoints) {
    process.stdout.write(`Testing ${endpoint.name}... `);
    const result = await testEndpoint(endpoint);
    results.push(result);
    console.log(result.success ? '✅ OK' : '❌ FAIL');
  }

  const elapsed = Date.now() - startTime;

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTS SUMMARY');
  console.log('='.repeat(80));

  const working = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n✅ WORKING (${working.length}/${endpoints.length}):`);
  working.forEach(r => {
    console.log(`  • ${r.name} [${r.sport}]`);
    if (r.bodyKeys && r.bodyKeys.length > 0) {
      console.log(`    Keys: ${r.bodyKeys.join(', ')}`);
    }
    if (r.arrayLength !== null) {
      console.log(`    Items: ${r.arrayLength}`);
    }
  });

  console.log(`\n❌ FAILED (${failed.length}/${endpoints.length}):`);
  failed.forEach(r => {
    console.log(`  • ${r.name} [${r.sport}] - ${r.status} ${r.error ? `(${r.error})` : ''}`);
  });

  // By sport
  console.log('\n📍 BY SPORT:');
  const bySport = {};
  working.forEach(r => {
    if (!bySport[r.sport]) bySport[r.sport] = [];
    bySport[r.sport].push(r.name);
  });

  Object.entries(bySport).forEach(([sport, names]) => {
    console.log(`  ${sport}: ${names.length} working`);
    names.forEach(n => console.log(`    - ${n}`));
  });

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  const multiSport = working.filter(r => r.sport === 'multi');
  const basketball = working.filter(r => r.sport === 'basketball');
  const soccer = working.filter(r => r.sport === 'soccer');
  const nfl = working.filter(r => r.sport === 'nfl');

  if (multiSport.length > 0) {
    console.log(`  • Use these for multi-sport fixtures: ${multiSport.map(r => r.host).join(', ')}`);
  }
  if (basketball.length > 0) {
    console.log(`  • Basketball data: ${basketball.map(r => r.host).join(', ')}`);
  }
  if (soccer.length > 0) {
    console.log(`  • Soccer data: ${soccer.map(r => r.host).join(', ')}`);
  }
  if (nfl.length > 0) {
    console.log(`  • NFL data: ${nfl.map(r => r.host).join(', ')}`);
  }

  console.log(`\nCompleted in ${elapsed}ms`);

  // JSON export
  console.log('\n📄 Full results exported to test-results.json');
  const fs = await import('fs');
  fs.writeFileSync('test-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);

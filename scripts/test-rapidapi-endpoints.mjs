#!/usr/bin/env node
/**
 * Comprehensive RapidAPI Endpoint Tester
 * Tests all configured sports API endpoints and reports connectivity & data quality
 */

import https from 'https';
import http from 'http';

const RAPIDAPI_KEY = 'd04027f383msh0b0565415dfbe6dp1fc23bjsn22d9d050080e';

const endpoints = [
  {
    name: 'NFL API Data - Team Listing',
    method: 'GET',
    host: 'nfl-api-data.p.rapidapi.com',
    path: '/nfl-team-listing/v1/data',
    expectedFields: ['teams', 'data', 'results'],
    category: 'American Football'
  },
  {
    name: 'Premier League Live Scores - Liverpool Team',
    method: 'GET',
    host: 'heisenbug-premier-league-live-scores-v1.p.rapidapi.com',
    path: '/api/premierleague/team?name=Liverpool',
    expectedFields: ['team', 'players', 'fixtures'],
    category: 'Soccer'
  },
  {
    name: 'Football Prediction API - UEFA Predictions',
    method: 'GET',
    host: 'football-prediction-api.p.rapidapi.com',
    path: '/api/v2/predictions?market=classic&iso_date=2018-12-01&federation=UEFA',
    expectedFields: ['predictions', 'data', 'results'],
    category: 'Soccer'
  },
  {
    name: 'TheRundown - Sports Conferences',
    method: 'GET',
    host: 'therundown-therundown-v1.p.rapidapi.com',
    path: '/sports/1/conferences',
    expectedFields: ['conferences', 'data', 'sports'],
    category: 'Multi-Sport'
  },
  {
    name: 'ODDS API - Upcoming Odds',
    method: 'GET',
    host: 'odds.p.rapidapi.com',
    path: '/v4/sports/upcoming/odds?regions=us&oddsFormat=decimal&markets=h2h%2Cspreads&dateFormat=iso',
    expectedFields: ['sports', 'data', 'odds'],
    category: 'Odds'
  },
  {
    name: 'Football Live Stream API',
    method: 'GET',
    host: 'football-live-stream-api.p.rapidapi.com',
    path: '/link/truc-tiep-tran-dau-coquimbo-unido-vs-universidad-de-chile-2674554',
    expectedFields: ['link', 'stream', 'data'],
    category: 'Soccer'
  },
  {
    name: 'TVPRO API - TV Programs',
    method: 'GET',
    host: 'tvpro-api.p.rapidapi.com',
    path: '/apps-oficial.com/apps/views/forms/entretenimiento/api_tv?mod=tv&RapidApi=jlospino',
    expectedFields: ['programs', 'channels', 'data'],
    category: 'Entertainment'
  },
  {
    name: 'SportAPI - Player Ratings',
    method: 'GET',
    host: 'sportapi7.p.rapidapi.com',
    path: '/api/v1/player/817181/unique-tournament/132/season/65360/ratings',
    expectedFields: ['player', 'ratings', 'data'],
    category: 'Soccer'
  },
  {
    name: 'BetsAPI - Bet365 Prematch',
    method: 'GET',
    host: 'betsapi2.p.rapidapi.com',
    path: '/v3/bet365/prematch',
    expectedFields: ['events', 'matches', 'data'],
    category: 'Betting'
  },
  {
    name: 'AllSportsAPI - TV Event',
    method: 'GET',
    host: 'allsportsapi2.p.rapidapi.com',
    path: '/api/tv/country/all/event/10974920',
    expectedFields: ['event', 'match', 'data'],
    category: 'Multi-Sport'
  },
  {
    name: 'Real-Time Sports Data - Event',
    method: 'GET',
    host: 'real-time-sports-data.p.rapidapi.com',
    path: '/api/event?eventId=23781550&langId=2',
    expectedFields: ['event', 'data', 'match'],
    category: 'Multi-Sport'
  },
  {
    name: 'Free Football API - Event Statistics',
    method: 'GET',
    host: 'free-football-api-data.p.rapidapi.com',
    path: '/football-event-statistics?eventid=12650707',
    expectedFields: ['statistics', 'data', 'event'],
    category: 'Soccer'
  },
  {
    name: 'SportsPage Feeds - NCAAF Rankings',
    method: 'GET',
    host: 'sportspage-feeds.p.rapidapi.com',
    path: '/rankings?league=NCAAF',
    expectedFields: ['rankings', 'teams', 'data'],
    category: 'American Football'
  },
  {
    name: 'SofaScore - H2H Matches',
    method: 'GET',
    host: 'sofascore.p.rapidapi.com',
    path: '/matches/get-h2h?matchId=8897222',
    expectedFields: ['h2h', 'matches', 'data'],
    category: 'Soccer'
  },
  {
    name: 'Sports Information - MBB News',
    method: 'GET',
    host: 'sports-information.p.rapidapi.com',
    path: '/mbb/news?limit=30',
    expectedFields: ['news', 'articles', 'data'],
    category: 'Basketball'
  },
  {
    name: 'ODDS API Alt - Fixture Scores',
    method: 'GET',
    host: 'odds-api1.p.rapidapi.com',
    path: '/scores?fixtureId=id1200255561449537',
    expectedFields: ['score', 'match', 'data'],
    category: 'Odds'
  },
  {
    name: 'SofaSport - Winning Odds',
    method: 'GET',
    host: 'sofasport.p.rapidapi.com',
    path: '/v1/events/odds/winning?event_id=10253769&provider_id=1&odds_format=decimal',
    expectedFields: ['odds', 'data', 'event'],
    category: 'Odds'
  },
  {
    name: 'Bet365 API Inplay - Get Leagues',
    method: 'GET',
    host: 'bet365-api-inplay.p.rapidapi.com',
    path: '/bet365/get_leagues',
    expectedFields: ['leagues', 'data', 'sports'],
    category: 'Betting'
  },
  {
    name: 'Pinnacle Odds - Meta Periods',
    method: 'GET',
    host: 'pinnacle-odds.p.rapidapi.com',
    path: '/kit/v1/meta-periods?sport_id=1',
    expectedFields: ['periods', 'data', 'sports'],
    category: 'Odds'
  },
  {
    name: 'Free Livescore API - Soccer Romania',
    method: 'GET',
    host: 'free-livescore-api.p.rapidapi.com',
    path: '/livescore-get-search?sportname=soccer&search=romania',
    expectedFields: ['matches', 'results', 'data'],
    category: 'Soccer'
  },
  {
    name: 'Free API Live Football - Player Search',
    method: 'GET',
    host: 'free-api-live-football-data.p.rapidapi.com',
    path: '/football-players-search?search=m',
    expectedFields: ['players', 'data', 'results'],
    category: 'Soccer'
  },
  {
    name: 'Real-Time Sports News - Sports Category',
    method: 'GET',
    host: 'real-time-sports-news-api.p.rapidapi.com',
    path: '/sources-by-category?category=sports',
    expectedFields: ['sources', 'data', 'news'],
    category: 'News'
  },
  {
    name: 'Football Pro - Season Corrections',
    method: 'GET',
    host: 'football-pro.p.rapidapi.com',
    path: '/api/v2.0/corrections/season/17141?tz=Europe%2FAmsterdam',
    expectedFields: ['corrections', 'data', 'season'],
    category: 'Soccer'
  },
  {
    name: 'FlashLive Sports - News List',
    method: 'GET',
    host: 'flashlive-sports.p.rapidapi.com',
    path: '/v1/news/list?entity_id=1&page=0&category_id=59&locale=en_INT',
    expectedFields: ['news', 'articles', 'data'],
    category: 'Multi-Sport'
  },
  {
    name: 'NewsNow - Top News',
    method: 'POST',
    host: 'newsnow.p.rapidapi.com',
    path: '/newsv2_top_news',
    body: JSON.stringify({ location: 'us', language: 'en', page: 1, time_bounded: false, from_date: '01/02/2021', to_date: '05/06/2021' }),
    expectedFields: ['news', 'articles', 'data'],
    category: 'News'
  }
];

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const options = {
      hostname: endpoint.host,
      path: endpoint.path,
      method: endpoint.method,
      headers: {
        'x-rapidapi-host': endpoint.host,
        'x-rapidapi-key': RAPIDAPI_KEY,
        'Content-Type': 'application/json'
      }
    };

    const protocol = options.hostname.startsWith('https') || endpoint.host.includes('rapidapi') ? https : http;
    const protocolToUse = https; // RapidAPI uses HTTPS

    const req = protocolToUse.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        try {
          const parsed = data ? JSON.parse(data) : {};
          const hasExpectedFields = endpoint.expectedFields.some(field => field in parsed);
          const dataSize = data.length;
          
          resolve({
            name: endpoint.name,
            category: endpoint.category,
            status: res.statusCode,
            statusText: res.statusMessage,
            duration,
            success: res.statusCode >= 200 && res.statusCode < 300,
            dataSize,
            hasData: data.length > 0,
            hasExpectedFields,
            errorMessage: res.statusCode >= 400 ? (parsed.message || res.statusMessage) : null
          });
        } catch (e) {
          resolve({
            name: endpoint.name,
            category: endpoint.category,
            status: res.statusCode,
            statusText: res.statusMessage,
            duration,
            success: res.statusCode >= 200 && res.statusCode < 300,
            dataSize: data.length,
            hasData: data.length > 0,
            hasExpectedFields: false,
            errorMessage: 'Failed to parse JSON response'
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        name: endpoint.name,
        category: endpoint.category,
        status: 0,
        statusText: 'Request Failed',
        duration: Date.now() - startTime,
        success: false,
        dataSize: 0,
        hasData: false,
        hasExpectedFields: false,
        errorMessage: e.message
      });
    });

    if (endpoint.body) {
      req.write(endpoint.body);
    }

    req.end();

    // Timeout after 15 seconds
    setTimeout(() => {
      req.destroy();
      resolve({
        name: endpoint.name,
        category: endpoint.category,
        status: 0,
        statusText: 'Timeout',
        duration: 15000,
        success: false,
        dataSize: 0,
        hasData: false,
        hasExpectedFields: false,
        errorMessage: 'Request timeout (15s)'
      });
    }, 15000);
  });
}

async function runTests() {
  console.log('\n🚀 BETRIX RapidAPI Endpoint Test Suite\n');
  console.log(`Testing ${endpoints.length} endpoints...\n`);
  
  const results = [];
  
  // Test endpoints sequentially with small delay to avoid rate limiting
  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    console.log(`[${i + 1}/${endpoints.length}] Testing: ${endpoint.name}...`);
    
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Report results
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY\n');

  const byCategory = {};
  const byStatus = { success: [], warning: [], error: [] };

  results.forEach(result => {
    // Group by category
    if (!byCategory[result.category]) {
      byCategory[result.category] = [];
    }
    byCategory[result.category].push(result);

    // Group by status
    if (result.success && result.hasData) {
      byStatus.success.push(result);
    } else if (result.success && !result.hasData) {
      byStatus.warning.push(result);
    } else {
      byStatus.error.push(result);
    }
  });

  // Print by category
  Object.keys(byCategory).sort().forEach(category => {
    const categoryResults = byCategory[category];
    const working = categoryResults.filter(r => r.success && r.hasData).length;
    console.log(`\n📱 ${category} (${working}/${categoryResults.length} working)`);
    console.log('-'.repeat(80));
    
    categoryResults.forEach(result => {
      const icon = result.success && result.hasData ? '✅' : result.success ? '⚠️ ' : '❌';
      console.log(`  ${icon} ${result.name}`);
      console.log(`     Status: ${result.status} | Duration: ${result.duration}ms | Size: ${result.dataSize}B`);
      if (result.errorMessage) {
        console.log(`     Error: ${result.errorMessage}`);
      }
    });
  });

  // Overall summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📈 OVERALL SUMMARY\n');
  console.log(`✅ Working APIs:        ${byStatus.success.length}`);
  console.log(`⚠️  Partial (No Data):   ${byStatus.warning.length}`);
  console.log(`❌ Failed APIs:         ${byStatus.error.length}`);
  console.log(`📊 Total Tested:        ${results.length}`);
  console.log(`✨ Success Rate:        ${((byStatus.success.length / results.length) * 100).toFixed(1)}%`);

  // Bot integration recommendations
  console.log('\n' + '='.repeat(80));
  console.log('\n🤖 BOT INTEGRATION RECOMMENDATIONS\n');
  
  const workingApis = byStatus.success.map(r => r.name);
  const failedApis = byStatus.error.map(r => r.name);

  console.log(`✅ READY FOR BOT INTEGRATION (${workingApis.length}):`);
  workingApis.forEach(name => console.log(`   - ${name}`));

  if (failedApis.length > 0) {
    console.log(`\n⚠️  NEEDS INVESTIGATION (${failedApis.length}):`);
    failedApis.forEach(name => console.log(`   - ${name}`));
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

runTests().catch(console.error);

#!/usr/bin/env node
/**
 * Deep validation of working RapidAPI endpoints
 * Verifies they actually return real teams, fixtures, and expected data
 */

const RAPIDAPI_KEY = 'd04027f383msh0b0565415dfbe6dp1fc23bjsn22d9d050080e';

const workingAPIs = [
  {
    name: 'Heisenbug - Premier League',
    host: 'heisenbug-premier-league-live-scores-v1.p.rapidapi.com',
    path: '/api/premierleague?date=12202025',
    sport: 'soccer',
    expectedFields: ['name', 'team', 'fixtures', 'league'],
    expectedDataType: 'object'
  },
  {
    name: 'SofaScore - H2H',
    host: 'sofascore.p.rapidapi.com',
    path: '/matches/get-h2h?matchId=8897222',
    sport: 'multi',
    expectedFields: ['teamDuel', 'managerDuel', 'team', 'match'],
    expectedDataType: 'object'
  },
  {
    name: 'Free LiveScore',
    host: 'free-livescore-api.p.rapidapi.com',
    path: '/livescore-get-search?sportname=soccer&search=league',
    sport: 'soccer',
    expectedFields: ['response', 'results', 'team', 'league'],
    expectedDataType: 'object'
  },
  {
    name: 'The Rundown - NFL',
    host: 'therundown-therundown-v1.p.rapidapi.com',
    path: '/sports/1/conferences',
    sport: 'nfl',
    expectedFields: ['conferences', 'division', 'team', 'teams'],
    expectedDataType: 'object'
  },
  {
    name: 'Sportspage - Rankings',
    host: 'sportspage-feeds.p.rapidapi.com',
    path: '/rankings?league=NCAAF',
    sport: 'nfl',
    expectedFields: ['results', 'teams', 'team_name', 'name', 'status'],
    expectedDataType: 'object'
  },
  {
    name: 'Free Football API',
    host: 'free-football-api-data.p.rapidapi.com',
    path: '/football-event-statistics?eventid=12650707',
    sport: 'soccer',
    expectedFields: ['response', 'status', 'team', 'statistics'],
    expectedDataType: 'object'
  },
  {
    name: 'SofaSport - Odds',
    host: 'sofasport.p.rapidapi.com',
    path: '/v1/events/odds/winning?event_id=10253769&provider_id=1&odds_format=decimal',
    sport: 'multi',
    expectedFields: ['data', 'event', 'team', 'odds'],
    expectedDataType: 'object'
  },
  {
    name: 'Pinnacle Odds - NFL',
    host: 'pinnacle-odds.p.rapidapi.com',
    path: '/kit/v1/meta-periods?sport_id=1',
    sport: 'nfl',
    expectedFields: ['periods', 'sport', 'period', 'league'],
    expectedDataType: 'object'
  },
  {
    name: 'Football Pro',
    host: 'football-pro.p.rapidapi.com',
    path: '/api/v2.0/corrections/season/17141?tz=Europe%2FAmsterdam',
    sport: 'soccer',
    expectedFields: ['data', 'correction', 'fixture', 'team'],
    expectedDataType: 'object'
  },
  {
    name: 'FlashLive Sports',
    host: 'flashlive-sports.p.rapidapi.com',
    path: '/v1/news/list?entity_id=1&page=0&category_id=59&locale=en_INT',
    sport: 'multi',
    expectedFields: ['DATA', 'news', 'team', 'event'],
    expectedDataType: 'object'
  },
  {
    name: 'Sports Information - MBB',
    host: 'sports-information.p.rapidapi.com',
    path: '/mbb/news?limit=5',
    sport: 'basketball',
    expectedFields: ['title', 'description', 'published', 'content'],
    expectedDataType: 'array'
  }
];

function extractTeamNames(obj, depth = 0, maxDepth = 3) {
  const teams = new Set();
  if (depth > maxDepth) return teams;

  if (typeof obj !== 'object' || obj === null) return teams;

  if (Array.isArray(obj)) {
    obj.forEach(item => {
      const subTeams = extractTeamNames(item, depth + 1, maxDepth);
      subTeams.forEach(t => teams.add(t));
    });
  } else {
    Object.entries(obj).forEach(([key, value]) => {
      // Look for team-related fields
      const keyLower = key.toLowerCase();
      if (keyLower.includes('team') || keyLower.includes('name') || keyLower.includes('team_name')) {
        if (typeof value === 'string' && value.length > 0 && value.length < 100) {
          teams.add(value);
        }
      }
      // Recursively search nested objects
      if (typeof value === 'object' && value !== null) {
        const subTeams = extractTeamNames(value, depth + 1, maxDepth);
        subTeams.forEach(t => teams.add(t));
      }
    });
  }
  return teams;
}

function analyzeResponse(api, response) {
  const analysis = {
    name: api.name,
    host: api.host,
    sport: api.sport,
    statusCode: response.status,
    success: response.status >= 200 && response.status < 300,
    bodyLength: response.bodyText?.length || 0,
    bodyKeys: [],
    topLevelKeys: [],
    hasExpectedFields: [],
    missingExpectedFields: [],
    teamNamesFound: [],
    dataStructure: 'unknown',
    hasRealData: false,
    sampleData: null
  };

  if (!response.body) {
    analysis.hasRealData = false;
    return analysis;
  }

  // Analyze structure
  if (Array.isArray(response.body)) {
    analysis.dataStructure = 'array';
    analysis.topLevelKeys = response.body.length > 0 ? Object.keys(response.body[0]).slice(0, 5) : [];
    if (response.body.length > 0) {
      analysis.sampleData = JSON.stringify(response.body[0]).slice(0, 200);
    }
  } else if (typeof response.body === 'object') {
    analysis.dataStructure = 'object';
    analysis.topLevelKeys = Object.keys(response.body).slice(0, 10);
  }

  // Check expected fields
  const bodyStr = JSON.stringify(response.body).toLowerCase();
  api.expectedFields.forEach(field => {
    if (bodyStr.includes(field.toLowerCase())) {
      analysis.hasExpectedFields.push(field);
    } else {
      analysis.missingExpectedFields.push(field);
    }
  });

  // Extract team names
  const teams = extractTeamNames(response.body);
  analysis.teamNamesFound = Array.from(teams).filter(t => t.length > 1 && t.length < 50).slice(0, 10);

  // Determine if has real data
  analysis.hasRealData = 
    analysis.hasExpectedFields.length >= 1 ||
    analysis.teamNamesFound.length > 0 ||
    analysis.bodyLength > 100;

  return analysis;
}

async function testAPI(api) {
  const url = `https://${api.host}${api.path}`;
  const headers = {
    'X-RapidAPI-Host': api.host,
    'X-RapidAPI-Key': RAPIDAPI_KEY,
    'Accept': 'application/json'
  };

  try {
    const response = await fetch(url, { headers, timeout: 10000 });
    const status = response.status;
    let bodyText = '';
    let body = null;

    try {
      bodyText = await response.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch (e) {
      body = null;
    }

    const analysis = analyzeResponse(api, { status, body, bodyText });
    return analysis;
  } catch (error) {
    return {
      name: api.name,
      host: api.host,
      sport: api.sport,
      success: false,
      error: error.message,
      hasRealData: false
    };
  }
}

async function main() {
  console.log('🔍 Deep validation of working RapidAPI endpoints\n');
  console.log('Testing for real data: team names, fixtures, match data...\n');

  const results = [];
  const startTime = Date.now();

  for (const api of workingAPIs) {
    process.stdout.write(`Testing ${api.name}... `);
    const result = await testAPI(api);
    results.push(result);
    console.log(result.hasRealData ? '✅' : '⚠️');
  }

  const elapsed = Date.now() - startTime;

  // Summary
  console.log('\n' + '='.repeat(100));
  console.log('📊 DETAILED VALIDATION RESULTS');
  console.log('='.repeat(100));

  const withRealData = results.filter(r => r.hasRealData);
  const withoutRealData = results.filter(r => !r.hasRealData);

  console.log(`\n✅ APIS WITH REAL DATA (${withRealData.length}/${results.length}):\n`);
  
  withRealData.forEach(r => {
    console.log(`📌 ${r.name} [${r.sport}]`);
    console.log(`   Status: ${r.statusCode}`);
    console.log(`   Structure: ${r.dataStructure} (${r.bodyLength} bytes)`);
    if (r.topLevelKeys.length > 0) {
      console.log(`   Keys: ${r.topLevelKeys.join(', ')}`);
    }
    if (r.hasExpectedFields.length > 0) {
      console.log(`   ✓ Found fields: ${r.hasExpectedFields.join(', ')}`);
    }
    if (r.teamNamesFound.length > 0) {
      console.log(`   👥 Teams/Names found: ${r.teamNamesFound.slice(0, 5).join(', ')}${r.teamNamesFound.length > 5 ? '...' : ''}`);
    }
    if (r.sampleData) {
      console.log(`   Sample: ${r.sampleData}...`);
    }
    console.log();
  });

  if (withoutRealData.length > 0) {
    console.log(`\n⚠️ APIS WITHOUT REAL DATA (${withoutRealData.length}/${results.length}):\n`);
    
    withoutRealData.forEach(r => {
      console.log(`📌 ${r.name} [${r.sport}]`);
      if (r.error) {
        console.log(`   Error: ${r.error}`);
      } else {
        console.log(`   Status: ${r.statusCode}`);
        console.log(`   Structure: ${r.dataStructure || 'unknown'}`);
        if (r.topLevelKeys.length > 0) {
          console.log(`   Keys: ${r.topLevelKeys.join(', ')}`);
        }
        if (r.missingExpectedFields.length > 0) {
          console.log(`   Missing: ${r.missingExpectedFields.join(', ')}`);
        }
      }
      console.log();
    });
  }

  // Recommendations by sport
  console.log('='.repeat(100));
  console.log('🎯 RECOMMENDATIONS BY SPORT');
  console.log('='.repeat(100));

  const bySport = {};
  withRealData.forEach(r => {
    if (!bySport[r.sport]) bySport[r.sport] = [];
    bySport[r.sport].push(r);
  });

  Object.entries(bySport).sort((a, b) => b[1].length - a[1].length).forEach(([sport, apis]) => {
    console.log(`\n${sport.toUpperCase()} (${apis.length} working):`);
    apis.forEach(api => {
      const dataType = api.teamNamesFound.length > 0 ? 'Teams/Fixtures' : 'Other Data';
      console.log(`  ✅ ${api.name} - ${dataType} (${api.bodyLength} bytes)`);
    });
  });

  console.log('\n' + '='.repeat(100));
  console.log('📋 RAW DATA FOR INTEGRATION');
  console.log('='.repeat(100));
  
  console.log('\nAPIs that can provide fixture/team data:\n');
  withRealData.filter(r => r.teamNamesFound.length > 0).forEach(r => {
    console.log(`${r.name}:`);
    console.log(`  Endpoint: https://${r.host}${''}`);
    console.log(`  Returns: ${r.dataStructure.toUpperCase()}`);
    console.log(`  Sample data: ${r.sampleData}`);
    console.log();
  });

  console.log(`\nCompleted in ${elapsed}ms`);
}

main().catch(console.error);

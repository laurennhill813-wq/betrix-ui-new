/**
 * API Validation Test - Verifies all RapidAPI endpoints return real team/sport data
 * Tests each API to determine which ones are working and returning valid data
 */

import fetch from 'node-fetch';

const API_KEY = process.env.RAPIDAPI_KEY;

const APIs = {
  nfl: {
    name: 'NFL Team Listing',
    url: 'https://nfl-api-data.p.rapidapi.com/nfl-team-listing/v1/data',
    host: 'nfl-api-data.p.rapidapi.com',
    expectedFields: ['teams', 'team_name', 'conference'],
    sport: 'NFL'
  },
  premierleague: {
    name: 'Premier League (Heisenbug)',
    url: 'https://heisenbug-premier-league-live-scores-v1.p.rapidapi.com/api/premierleague/team?name=Liverpool',
    host: 'heisenbug-premier-league-live-scores-v1.p.rapidapi.com',
    expectedFields: ['team', 'name', 'id'],
    sport: 'Soccer'
  },
  football_prediction: {
    name: 'Football Prediction API',
    url: 'https://football-prediction-api.p.rapidapi.com/api/v2/predictions?market=classic&iso_date=2025-12-25&federation=UEFA',
    host: 'football-prediction-api.p.rapidapi.com',
    expectedFields: ['predictions', 'match'],
    sport: 'Soccer'
  },
  therundown: {
    name: 'TheRundown Sports',
    url: 'https://therundown-therundown-v1.p.rapidapi.com/sports/1/conferences',
    host: 'therundown-therundown-v1.p.rapidapi.com',
    expectedFields: ['conferences', 'conference_name'],
    sport: 'Multi-Sport'
  },
  odds: {
    name: 'Odds API',
    url: 'https://odds.p.rapidapi.com/v4/sports/upcoming/odds?regions=us&oddsFormat=decimal&markets=h2h%2Cspreads&dateFormat=iso',
    host: 'odds.p.rapidapi.com',
    expectedFields: ['data', 'sport_title', 'teams'],
    sport: 'Multi-Sport'
  },
  sofascore: {
    name: 'SofaScore Matches',
    url: 'https://sofascore.p.rapidapi.com/matches/get-h2h?matchId=8897222',
    host: 'sofascore.p.rapidapi.com',
    expectedFields: ['homeTeam', 'awayTeam', 'sport'],
    sport: 'Multi-Sport'
  },
  betsapi: {
    name: 'BetsAPI',
    url: 'https://betsapi2.p.rapidapi.com/v3/bet365/prematch',
    host: 'betsapi2.p.rapidapi.com',
    expectedFields: ['success', 'results', 'home_id', 'away_id'],
    sport: 'Multi-Sport'
  },
  livescore: {
    name: 'Free LiveScore API',
    url: 'https://free-livescore-api.p.rapidapi.com/livescore-get-search?sportname=soccer&search=romania',
    host: 'free-livescore-api.p.rapidapi.com',
    expectedFields: ['results', 'team', 'match'],
    sport: 'Soccer'
  },
  sportapi7: {
    name: 'SportAPI7 (Players)',
    url: 'https://sportapi7.p.rapidapi.com/api/v1/player/817181/unique-tournament/132/season/65360/ratings',
    host: 'sportapi7.p.rapidapi.com',
    expectedFields: ['player', 'ratings'],
    sport: 'Soccer'
  },
  realtimesports: {
    name: 'Real-time Sports Data',
    url: 'https://real-time-sports-data.p.rapidapi.com/api/event?eventId=23781550&langId=2',
    host: 'real-time-sports-data.p.rapidapi.com',
    expectedFields: ['event', 'teams', 'sport'],
    sport: 'Multi-Sport'
  }
};

async function testAPI(key, apiConfig) {
  try {
    const response = await fetch(apiConfig.url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': apiConfig.host,
        'x-rapidapi-key': API_KEY || 'test-key'
      },
      timeout: 10000
    });

    const status = response.status;
    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    // Determine if API is working
    const isWorking = status === 200;
    const hasData = data && Object.keys(data).length > 0;
    
    // Check for required fields (case-insensitive)
    let hasRequiredFields = false;
    if (hasData) {
      const dataStr = JSON.stringify(data).toLowerCase();
      hasRequiredFields = apiConfig.expectedFields.some(field => 
        dataStr.includes(field.toLowerCase())
      );
    }

    // Extract team names if possible
    let teamCount = 0;
    let sampleTeams = [];
    
    if (hasData) {
      const jsonStr = JSON.stringify(data);
      
      // Look for team names in various possible locations
      if (data.teams) {
        teamCount = Array.isArray(data.teams) ? data.teams.length : 0;
        if (Array.isArray(data.teams) && data.teams.length > 0) {
          sampleTeams = data.teams.slice(0, 3).map(t => 
            typeof t === 'string' ? t : (t.name || t.team_name || JSON.stringify(t).substring(0, 30))
          );
        }
      }
      
      // Check for homeTeam/awayTeam pattern
      if (data.homeTeam && data.awayTeam) {
        sampleTeams = [
          (data.homeTeam.name || data.homeTeam),
          (data.awayTeam.name || data.awayTeam)
        ];
        teamCount = 2;
      }
      
      // Check for data array with match info
      if (Array.isArray(data.data) && data.data.length > 0) {
        teamCount = data.data.length;
        sampleTeams = data.data.slice(0, 2).map(d => 
          d.sport_title || d.teams || d.home_team || JSON.stringify(d).substring(0, 30)
        );
      }
    }

    return {
      key,
      name: apiConfig.name,
      sport: apiConfig.sport,
      status,
      working: isWorking && hasData,
      hasData,
      hasRequiredFields,
      teamCount,
      sampleTeams: sampleTeams.filter(t => t),
      error: !isWorking ? `HTTP ${status}` : null,
      dataPreview: hasData ? JSON.stringify(data).substring(0, 100) : null
    };
  } catch (err) {
    return {
      key,
      name: apiConfig.name,
      sport: apiConfig.sport,
      status: 0,
      working: false,
      hasData: false,
      teamCount: 0,
      error: err.message,
      sampleTeams: []
    };
  }
}

// Run all tests
export async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  API VALIDATION TEST - RapidAPI Sports Endpoints                 ║');
  console.log('║  Testing all sports APIs for valid team data                     ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  if (!API_KEY) {
    console.warn('⚠️  RAPIDAPI_KEY not set. Tests may fail. Using placeholder.');
  }

  const results = [];
  const promises = Object.entries(APIs).map(([key, config]) => testAPI(key, config));
  
  const allResults = await Promise.all(promises);
  results.push(...allResults);

  // Sort by working status
  const working = results.filter(r => r.working);
  const failing = results.filter(r => !r.working);

  // Display results
  console.log('✅ WORKING APIs:\n');
  working.forEach(r => {
    console.log(`   ${r.name} (${r.sport})`);
    console.log(`      Status: ${r.status} | Teams/Events: ${r.teamCount}`);
    if (r.sampleTeams.length > 0) {
      console.log(`      Sample: ${r.sampleTeams.join(', ')}`);
    }
    console.log('');
  });

  console.log('\n❌ FAILING APIs:\n');
  failing.forEach(r => {
    console.log(`   ${r.name} (${r.sport})`);
    console.log(`      Error: ${r.error}`);
    console.log('');
  });

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log(`║  Summary: ${working.length}/${results.length} APIs working`);
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  // Export working APIs for integration
  const workingAPIs = {};
  working.forEach(r => {
    workingAPIs[r.key] = {
      name: r.name,
      sport: r.sport,
      config: APIs[r.key]
    };
  });

  console.log('\n📊 Working APIs Summary:');
  console.log(JSON.stringify(workingAPIs, null, 2));

  return { working, failing, allResults };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

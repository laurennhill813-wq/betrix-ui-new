/**
 * Comprehensive API Testing - Tests all RapidAPI endpoints with real API key
 * Uses the provided RAPIDAPI_KEY to verify which endpoints work and return team data
 */

import fetch from 'node-fetch';

// API Key provided by user - DO NOT commit to git
const API_KEY = 'd04027f383msh0b0565415dfbe6dp1fc23bjsn22d9d050080e';

const APIs = [
  {
    id: 'nfl',
    name: 'NFL Team Listing',
    url: 'https://nfl-api-data.p.rapidapi.com/nfl-team-listing/v1/data',
    host: 'nfl-api-data.p.rapidapi.com',
    sport: 'NFL',
    expectedFields: ['teams', 'team_name']
  },
  {
    id: 'premier_league',
    name: 'Premier League',
    url: 'https://heisenbug-premier-league-live-scores-v1.p.rapidapi.com/api/premierleague/team?name=Liverpool',
    host: 'heisenbug-premier-league-live-scores-v1.p.rapidapi.com',
    sport: 'Soccer',
    expectedFields: ['team', 'name']
  },
  {
    id: 'football_prediction',
    name: 'Football Prediction API',
    url: 'https://football-prediction-api.p.rapidapi.com/api/v2/predictions?market=classic&iso_date=2025-12-25&federation=UEFA',
    host: 'football-prediction-api.p.rapidapi.com',
    sport: 'Soccer',
    expectedFields: ['predictions', 'match']
  },
  {
    id: 'therundown',
    name: 'TheRundown Sports',
    url: 'https://therundown-therundown-v1.p.rapidapi.com/sports/1/conferences',
    host: 'therundown-therundown-v1.p.rapidapi.com',
    sport: 'Multi-Sport',
    expectedFields: ['conferences']
  },
  {
    id: 'odds',
    name: 'Odds API (Primary)',
    url: 'https://odds.p.rapidapi.com/v4/sports/upcoming/odds?regions=us&oddsFormat=decimal&markets=h2h',
    host: 'odds.p.rapidapi.com',
    sport: 'Multi-Sport',
    expectedFields: ['data', 'sport_title']
  },
  {
    id: 'football_live_stream',
    name: 'Football Live Stream',
    url: 'https://football-live-stream-api.p.rapidapi.com/link/truc-tiep-tran-dau-coquimbo-unido-vs-universidad-de-chile-2674554',
    host: 'football-live-stream-api.p.rapidapi.com',
    sport: 'Soccer',
    expectedFields: ['link', 'stream']
  },
  {
    id: 'tvpro',
    name: 'TVPro API',
    url: 'https://tvpro-api.p.rapidapi.com/apps-oficial.com/apps/views/forms/entretenimiento/api_tv?mod=tv',
    host: 'tvpro-api.p.rapidapi.com',
    sport: 'Multi-Sport',
    expectedFields: ['data', 'channel']
  },
  {
    id: 'sportapi7',
    name: 'SportAPI7 (Player Stats)',
    url: 'https://sportapi7.p.rapidapi.com/api/v1/player/817181/unique-tournament/132/season/65360/ratings',
    host: 'sportapi7.p.rapidapi.com',
    sport: 'Soccer',
    expectedFields: ['player', 'ratings']
  },
  {
    id: 'betsapi',
    name: 'BetsAPI',
    url: 'https://betsapi2.p.rapidapi.com/v3/bet365/prematch',
    host: 'betsapi2.p.rapidapi.com',
    sport: 'Multi-Sport',
    expectedFields: ['success', 'results']
  },
  {
    id: 'allsportsapi',
    name: 'AllSportsAPI',
    url: 'https://allsportsapi2.p.rapidapi.com/api/tv/country/all/event/10974920',
    host: 'allsportsapi2.p.rapidapi.com',
    sport: 'Multi-Sport',
    expectedFields: ['data', 'event']
  },
  {
    id: 'realtimesports',
    name: 'Real-time Sports Data',
    url: 'https://real-time-sports-data.p.rapidapi.com/api/event?eventId=23781550&langId=2',
    host: 'real-time-sports-data.p.rapidapi.com',
    sport: 'Multi-Sport',
    expectedFields: ['event', 'teams']
  },
  {
    id: 'free_football_data',
    name: 'Free Football Data',
    url: 'https://free-football-api-data.p.rapidapi.com/football-event-statistics?eventid=12650707',
    host: 'free-football-api-data.p.rapidapi.com',
    sport: 'Soccer',
    expectedFields: ['statistics', 'team']
  },
  {
    id: 'sportspage_feeds',
    name: 'SportsPage Feeds',
    url: 'https://sportspage-feeds.p.rapidapi.com/rankings?league=NCAAF',
    host: 'sportspage-feeds.p.rapidapi.com',
    sport: 'Football',
    expectedFields: ['rankings', 'team']
  },
  {
    id: 'sofascore',
    name: 'SofaScore',
    url: 'https://sofascore.p.rapidapi.com/matches/get-h2h?matchId=8897222',
    host: 'sofascore.p.rapidapi.com',
    sport: 'Multi-Sport',
    expectedFields: ['homeTeam', 'awayTeam']
  },
  {
    id: 'sports_information',
    name: 'Sports Information',
    url: 'https://sports-information.p.rapidapi.com/mbb/news?limit=30',
    host: 'sports-information.p.rapidapi.com',
    sport: 'Basketball',
    expectedFields: ['news', 'title']
  },
  {
    id: 'odds_api1',
    name: 'Odds API 1',
    url: 'https://odds-api1.p.rapidapi.com/scores?fixtureId=id1200255561449537',
    host: 'odds-api1.p.rapidapi.com',
    sport: 'Multi-Sport',
    expectedFields: ['score', 'fixture']
  },
  {
    id: 'sofasport',
    name: 'SofaSport',
    url: 'https://sofasport.p.rapidapi.com/v1/events/odds/winning?event_id=10253769&provider_id=1',
    host: 'sofasport.p.rapidapi.com',
    sport: 'Multi-Sport',
    expectedFields: ['events', 'odds']
  },
  {
    id: 'bet365_inplay',
    name: 'Bet365 InPlay API',
    url: 'https://bet365-api-inplay.p.rapidapi.com/bet365/get_leagues',
    host: 'bet365-api-inplay.p.rapidapi.com',
    sport: 'Multi-Sport',
    expectedFields: ['leagues', 'league']
  },
  {
    id: 'pinnacle_odds',
    name: 'Pinnacle Odds',
    url: 'https://pinnacle-odds.p.rapidapi.com/kit/v1/meta-periods?sport_id=1',
    host: 'pinnacle-odds.p.rapidapi.com',
    sport: 'Multi-Sport',
    expectedFields: ['periods', 'period']
  },
  {
    id: 'free_livescore',
    name: 'Free LiveScore API',
    url: 'https://free-livescore-api.p.rapidapi.com/livescore-get-search?sportname=soccer&search=romania',
    host: 'free-livescore-api.p.rapidapi.com',
    sport: 'Soccer',
    expectedFields: ['results', 'match']
  },
  {
    id: 'free_live_football',
    name: 'Free Live Football Data',
    url: 'https://free-api-live-football-data.p.rapidapi.com/football-players-search?search=m',
    host: 'free-api-live-football-data.p.rapidapi.com',
    sport: 'Soccer',
    expectedFields: ['players', 'player']
  },
  {
    id: 'realtimesports_news',
    name: 'Real-time Sports News',
    url: 'https://real-time-sports-news-api.p.rapidapi.com/sources-by-category?category=sports',
    host: 'real-time-sports-news-api.p.rapidapi.com',
    sport: 'Multi-Sport',
    expectedFields: ['sources', 'news']
  },
  {
    id: 'football_pro',
    name: 'Football Pro',
    url: 'https://football-pro.p.rapidapi.com/api/v2.0/corrections/season/17141?tz=Europe%2FAmsterdam',
    host: 'football-pro.p.rapidapi.com',
    sport: 'Soccer',
    expectedFields: ['corrections', 'match']
  },
  {
    id: 'flashlive',
    name: 'FlashLive Sports',
    url: 'https://flashlive-sports.p.rapidapi.com/v1/news/list?entity_id=1&page=0&category_id=59',
    host: 'flashlive-sports.p.rapidapi.com',
    sport: 'Multi-Sport',
    expectedFields: ['news', 'data']
  },
  {
    id: 'newsnow',
    name: 'NewsNow',
    url: 'https://newsnow.p.rapidapi.com/newsv2_top_news',
    host: 'newsnow.p.rapidapi.com',
    sport: 'News',
    expectedFields: ['news', 'articles'],
    method: 'POST',
    body: JSON.stringify({location:"us",language:"en",page:1,time_bounded:false})
  }
];

async function testAPI(config) {
  try {
    const response = await fetch(config.url, {
      method: config.method || 'GET',
      headers: {
        'x-rapidapi-host': config.host,
        'x-rapidapi-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: config.body,
      timeout: 8000
    });

    const status = response.status;
    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      // Not JSON response
    }

    const isWorking = status === 200 && data && Object.keys(data).length > 0;
    
    // Check for required fields
    let hasRequiredFields = false;
    if (data) {
      const jsonStr = JSON.stringify(data).toLowerCase();
      hasRequiredFields = config.expectedFields.some(field => 
        jsonStr.includes(field.toLowerCase())
      );
    }

    // Extract team/event count
    let itemCount = 0;
    let sampleItems = [];
    
    if (data) {
      if (Array.isArray(data)) {
        itemCount = data.length;
        sampleItems = data.slice(0, 2).map(d => typeof d === 'string' ? d : (d.name || d.title || JSON.stringify(d).substring(0, 40)));
      } else if (data.teams && Array.isArray(data.teams)) {
        itemCount = data.teams.length;
        sampleItems = data.teams.slice(0, 2).map(t => t.name || t.team_name || t);
      } else if (data.data && Array.isArray(data.data)) {
        itemCount = data.data.length;
        sampleItems = data.data.slice(0, 2).map(d => d.name || d.title || d.sport_title || JSON.stringify(d).substring(0, 40));
      } else if (data.results && Array.isArray(data.results)) {
        itemCount = data.results.length;
        sampleItems = data.results.slice(0, 2).map(r => r.name || r.title || JSON.stringify(r).substring(0, 40));
      }
    }

    return {
      id: config.id,
      name: config.name,
      sport: config.sport,
      status,
      working: isWorking,
      hasRequiredFields,
      itemCount,
      sampleItems: sampleItems.filter(s => s && typeof s === 'string').slice(0, 2),
      dataSize: data ? JSON.stringify(data).length : 0,
      error: !isWorking ? `HTTP ${status}` : null
    };
  } catch (err) {
    return {
      id: config.id,
      name: config.name,
      sport: config.sport,
      status: 0,
      working: false,
      hasRequiredFields: false,
      itemCount: 0,
      error: err.message.substring(0, 80),
      sampleItems: []
    };
  }
}

export async function runAllTests() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║     COMPREHENSIVE API TEST - ALL RAPIDAPI ENDPOINTS VALIDATED      ║');
  console.log('║     Testing 25+ sports APIs for real team/fixture data             ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

  const results = [];
  const promises = APIs.map(api => testAPI(api));
  
  const allResults = await Promise.all(promises);
  results.push(...allResults);

  const working = results.filter(r => r.working);
  const failing = results.filter(r => !r.working);

  // Display working APIs
  console.log('✅ WORKING APIs:\n');
  working.forEach(r => {
    console.log(`   📊 ${r.name} (${r.sport})`);
    console.log(`      Status: ${r.status} | Items: ${r.itemCount}`);
    if (r.sampleItems.length > 0) {
      console.log(`      Sample: ${r.sampleItems.join(', ')}`);
    }
    console.log('');
  });

  // Display failing APIs
  console.log('\n❌ FAILING APIs:\n');
  failing.forEach(r => {
    console.log(`   ${r.name} (${r.sport})`);
    console.log(`      Error: ${r.error}`);
    console.log('');
  });

  // Summary box
  console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
  console.log(`║  SUCCESS RATE: ${working.length}/${results.length} APIs working (${Math.round(working.length/results.length*100)}%)`);
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

  // Export config for bot integration
  const botIntegration = {
    validAPIs: {},
    sports: {},
    totalWorking: working.length,
    testedAt: new Date().toISOString()
  };

  working.forEach(r => {
    botIntegration.validAPIs[r.id] = {
      name: r.name,
      sport: r.sport,
      url: APIs.find(a => a.id === r.id).url,
      host: APIs.find(a => a.id === r.id).host,
      itemCount: r.itemCount
    };

    if (!botIntegration.sports[r.sport]) {
      botIntegration.sports[r.sport] = [];
    }
    botIntegration.sports[r.sport].push(r.id);
  });

  console.log('📋 Configuration for Bot Integration:');
  console.log(JSON.stringify(botIntegration, null, 2));

  return { working, failing, allResults, botIntegration };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

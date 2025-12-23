#!/usr/bin/env node
/**
 * Extract and display actual raw data from working APIs
 * Shows real teams, fixtures, and data structures
 */

const RAPIDAPI_KEY = 'd04027f383msh0b0565415dfbe6dp1fc23bjsn22d9d050080e';

const testAPIs = [
  {
    name: 'Free LiveScore',
    host: 'free-livescore-api.p.rapidapi.com',
    path: '/livescore-get-search?sportname=soccer&search=premier',
    sport: 'soccer'
  },
  {
    name: 'The Rundown - NFL',
    host: 'therundown-therundown-v1.p.rapidapi.com',
    path: '/sports/1/conferences',
    sport: 'nfl'
  },
  {
    name: 'Sportspage - NCAAF',
    host: 'sportspage-feeds.p.rapidapi.com',
    path: '/rankings?league=NCAAF&limit=5',
    sport: 'nfl'
  },
  {
    name: 'SofaScore - Match',
    host: 'sofascore.p.rapidapi.com',
    path: '/matches/get-h2h?matchId=8897222',
    sport: 'multi'
  },
  {
    name: 'Pinnacle Odds',
    host: 'pinnacle-odds.p.rapidapi.com',
    path: '/kit/v1/meta-periods?sport_id=1',
    sport: 'nfl'
  }
];

async function fetchAPI(api) {
  const url = `https://${api.host}${api.path}`;
  const headers = {
    'X-RapidAPI-Host': api.host,
    'X-RapidAPI-Key': RAPIDAPI_KEY,
    'Accept': 'application/json'
  };

  try {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`🔍 ${api.name} [${api.sport}]`);
    console.log(`${'='.repeat(100)}`);
    console.log(`URL: ${url}`);
    console.log();

    const response = await fetch(url, { headers, timeout: 10000 });
    const text = await response.text();

    if (!text) {
      console.log('❌ Empty response');
      return;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.log('❌ Invalid JSON:', e.message);
      console.log('Raw text:', text.slice(0, 500));
      return;
    }

    console.log(`✅ Status: ${response.status}`);
    console.log(`📦 Response size: ${text.length} bytes`);
    console.log();

    // Show structure
    if (Array.isArray(data)) {
      console.log(`📋 STRUCTURE: Array with ${data.length} items`);
      if (data.length > 0) {
        console.log(`\n🔹 First item keys: ${Object.keys(data[0]).join(', ')}`);
        console.log(`\n🔹 First item (sample):`);
        console.log(JSON.stringify(data[0], null, 2).split('\n').slice(0, 30).join('\n'));
        if (data.length > 1) {
          console.log(`\n... and ${data.length - 1} more items`);
        }
      }
    } else if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      console.log(`📋 STRUCTURE: Object with ${keys.length} keys`);
      console.log(`\n🔹 Top-level keys: ${keys.slice(0, 10).join(', ')}`);
      
      // Show nested structure
      console.log('\n🔹 Data sample:');
      const str = JSON.stringify(data, null, 2);
      const lines = str.split('\n').slice(0, 40);
      console.log(lines.join('\n'));
      
      if (str.split('\n').length > 40) {
        console.log(`\n... (${str.split('\n').length - 40} more lines)`);
      }

      // Extract teams/leagues
      const teamMatches = str.match(/"([\w\s\-&''\.]+)":/g) || [];
      const potentialTeams = [...new Set(teamMatches.map(m => m.slice(1, -2)))].slice(0, 10);
      if (potentialTeams.length > 0) {
        console.log(`\n👥 Potential teams/leagues: ${potentialTeams.join(', ')}`);
      }
    } else {
      console.log(`📋 STRUCTURE: ${typeof data}`);
      console.log(JSON.stringify(data, null, 2).slice(0, 500));
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log('🧪 EXTRACTING RAW DATA FROM WORKING APIS');
  console.log('Showing actual team names, fixtures, and data structures\n');

  for (const api of testAPIs) {
    await fetchAPI(api);
  }

  console.log(`\n${'='.repeat(100)}`);
  console.log('✅ EXTRACTION COMPLETE');
  console.log(`${'='.repeat(100)}\n`);
}

main().catch(console.error);

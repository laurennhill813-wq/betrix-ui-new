#!/usr/bin/env node

/**
 * API Keys Verification for Betrix Bot
 * 
 * Checks configuration status of SportMonks and Football-Data APIs.
 * StatPal, SofaScore, and API-Football have been removed.
 */

import { CONFIG } from './src/config.js';
// Logger not required for this quick check script

console.log('\n🔐 API KEYS CHECK (SPORTSGAMEODDS + FOOTBALL-DATA)\n');
console.log('='.repeat(60));

const status = {
  sportsgameodds: {
    configured: Boolean(CONFIG.SPORTSGAMEODDS && CONFIG.SPORTSGAMEODDS.KEY),
    endpoint: CONFIG.SPORTSGAMEODDS?.BASE || 'https://api.sportsgameodds.com/v2',
    envs: ['SPORTSGAMEODDS_API_KEY']
  },
  footballdata: {
    configured: Boolean(CONFIG.FOOTBALLDATA && CONFIG.FOOTBALLDATA.KEY),
    endpoint: CONFIG.FOOTBALLDATA?.BASE || 'https://api.football-data.org/v4',
    envs: ['FOOTBALLDATA_API_KEY', 'FOOTBALL_DATA_API']
  }
};

console.log('Provider Status:');
console.log(`  SportGameOdds: ${status.sportsgameodds.configured ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`);
console.log(`  Football-Data: ${status.footballdata.configured ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`);

console.log('\nEndpoints:');
console.log(`  SportMonks:    ${status.sportmonks.endpoint}`);
console.log(`  Football-Data: ${status.footballdata.endpoint}`);

console.log('\nEnvironment Variables to Set:');
console.log('  SportGameOdds:');
status.sportsgameodds.envs.forEach(env => console.log(`    - ${env}`));
console.log('  Football-Data:');
status.footballdata.envs.forEach(env => console.log(`    - ${env}`));

console.log('\n🔒 Keys are not printed for security reasons.');
console.log('='.repeat(60));

// Exit with error if no providers configured
if (!status.sportmonks.configured && !status.footballdata.configured) {
  console.error('\n❌ ERROR: No data providers configured!');
  console.error('Please set SPORTSMONKS_API and FOOTBALL_DATA_API environment variables.');
  process.exit(1);
}

console.log('\n✅ API configuration check complete.\n');
process.exit(0);


/**
 * End-to-End Integration Test
 * 
 * Tests the complete flow:
 * 1. Fetch sports data from RapidAPI
 * 2. Parse and normalize data
 * 3. Build bot menus
 * 4. Simulate user interactions
 * 5. Verify prefetch system
 */

import assert from 'assert';
import SportsDataAggregator from '../src/services/sports-data-aggregator.js';
import * as menus from '../src/menus/sports-menus.js';
import * as prefetch from '../src/services/prefetch-system.js';

const logger = {
  section: (title) => console.log(`\n${'═'.repeat(70)}\n  ${title}\n${'═'.repeat(70)}`),
  test: (desc) => console.log(`  ✓ ${desc}`),
  info: (msg) => console.log(`    ${msg}`),
  success: (msg) => console.log(`  ✅ ${msg}`),
  error: (msg) => console.log(`  ❌ ${msg}`)
};

async function testAPIDataFetching() {
  logger.section('TEST 1: API Data Fetching');

  try {
    logger.test('Fetching NFL Teams');
    const nfl = await SportsDataAggregator.getNFLTeams();
    assert.strictEqual(nfl.success, true, 'NFL Teams fetch failed');
    assert(Array.isArray(nfl.data), 'NFL data is not an array');
    assert(nfl.count > 0, 'No NFL teams returned');
    logger.info(`  Teams: ${nfl.count}`);
    logger.success('NFL Teams fetched successfully');

    logger.test('Fetching Premier League Teams');
    const pl = await SportsDataAggregator.getPremierLeagueTeams();
    assert.strictEqual(pl.success, true, 'Premier League fetch failed');
    assert(Array.isArray(pl.data), 'PL data is not an array');
    logger.info(`  Teams: ${pl.count}`);
    logger.success('Premier League Teams fetched successfully');

    logger.test('Fetching Fixtures');
    const fixtures = await SportsDataAggregator.getFixtures();
    assert.strictEqual(fixtures.success, true, 'Fixtures fetch failed');
    logger.info(`  Fixtures: ${fixtures.count}`);
    logger.success('Fixtures fetched successfully');

    logger.test('Fetching Leagues');
    const leagues = await SportsDataAggregator.getBet365Leagues();
    assert.strictEqual(leagues.success, true, 'Leagues fetch failed');
    logger.info(`  Leagues: ${leagues.count}`);
    logger.success('Leagues fetched successfully');

    logger.test('Caching - Second call should use cache');
    const nfl2 = await SportsDataAggregator.getNFLTeams();
    assert.strictEqual(nfl2.success, true, 'Cached fetch failed');
    assert.deepStrictEqual(nfl.data, nfl2.data, 'Cached data differs from original');
    logger.success('Cache working correctly');

    return { success: true, dataPoints: 4 };
  } catch (err) {
    logger.error(`Data fetching test failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function testDataFormatting() {
  logger.section('TEST 2: Data Formatting for Bot Menus');

  try {
    logger.test('Formatting Teams for Menu Display');
    const teams = await SportsDataAggregator.getNFLTeams();
    const formatted = SportsDataAggregator.formatTeamsForMenu(teams, 'NFL');
    assert(Array.isArray(formatted), 'Formatted teams is not an array');
    assert(formatted.length > 0, 'No formatted teams');
    logger.info(`  Formatted teams: ${formatted.length}`);
    logger.success('Teams formatted correctly for menu');

    logger.test('Formatting Fixtures for Menu Display');
    const fixtures = await SportsDataAggregator.getFixtures();
    const fmtFixtures = SportsDataAggregator.formatFixturesForMenu(fixtures);
    assert(Array.isArray(fmtFixtures), 'Formatted fixtures is not an array');
    logger.info(`  Formatted fixtures: ${fmtFixtures.length}`);
    logger.success('Fixtures formatted correctly for menu');

    logger.test('Available APIs Info');
    const apis = SportsDataAggregator.getAvailableAPIs();
    assert(Array.isArray(apis), 'APIs list is not an array');
    assert(apis.length > 0, 'No APIs available');
    logger.info(`  Available APIs: ${apis.length}`);
    apis.forEach(api => {
      logger.info(`    - ${api.name} (${api.sport})`);
    });
    logger.success('API information available');

    return { success: true, formatTests: 3 };
  } catch (err) {
    logger.error(`Formatting test failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function testMenuBuilding() {
  logger.section('TEST 3: Menu Building');

  try {
    logger.test('Building Teams Menu');
    const teamsMenu = await menus.buildTeamsMenu();
    assert(teamsMenu.text, 'Teams menu has no text');
    assert(teamsMenu.inline_keyboard, 'Teams menu has no buttons');
    assert(Array.isArray(teamsMenu.inline_keyboard), 'Menu buttons not an array');
    logger.info(`  Buttons: ${teamsMenu.inline_keyboard.length}`);
    logger.success('Teams menu built successfully');

    logger.test('Building NFL Teams Menu');
    const nflMenu = await menus.buildNFLTeamsMenu();
    assert(nflMenu.text, 'NFL menu has no text');
    assert(Array.isArray(nflMenu.inline_keyboard), 'NFL menu buttons not an array');
    logger.info(`  Buttons: ${nflMenu.inline_keyboard.length}`);
    logger.success('NFL menu built successfully');

    logger.test('Building Soccer Teams Menu');
    const soccerMenu = await menus.buildSoccerTeamsMenu();
    assert(soccerMenu.text, 'Soccer menu has no text');
    logger.info(`  Buttons: ${soccerMenu.inline_keyboard.length}`);
    logger.success('Soccer menu built successfully');

    logger.test('Building Fixtures Menu');
    const fixturesMenu = await menus.buildFixturesMenu();
    assert(fixturesMenu.text, 'Fixtures menu has no text');
    logger.info(`  Fixtures shown: ${fixturesMenu.inline_keyboard.length}`);
    logger.success('Fixtures menu built successfully');

    logger.test('Building Odds Menu');
    const oddsMenu = await menus.buildOddsMainMenu();
    assert(oddsMenu.text, 'Odds menu has no text');
    logger.success('Odds menu built successfully');

    logger.test('Building Leagues Menu');
    const leaguesMenu = await menus.buildLeaguesMenu();
    assert(leaguesMenu.text, 'Leagues menu has no text');
    logger.info(`  Leagues: ${leaguesMenu.inline_keyboard.length}`);
    logger.success('Leagues menu built successfully');

    return { success: true, menuTests: 6 };
  } catch (err) {
    logger.error(`Menu building test failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function testPrefetchSystem() {
  logger.section('TEST 4: Prefetch System');

  try {
    logger.test('Checking prefetch status');
    const initialStatus = prefetch.getPrefetchStatus();
    logger.info(`  Status: ${initialStatus.status}`);
    logger.success('Status check passed');

    logger.test('Running prefetch all');
    const result = await prefetch.prefetchAllSportsData();
    assert.strictEqual(result.success, true, 'Prefetch failed');
    logger.info(`  NFL Teams: ${result.dataLoaded.nflTeams}`);
    logger.info(`  PL Teams: ${result.dataLoaded.plTeams}`);
    logger.info(`  Fixtures: ${result.dataLoaded.fixtures}`);
    logger.info(`  Leagues: ${result.dataLoaded.leagues}`);
    logger.success('Full prefetch completed');

    logger.test('Getting updated status');
    const status = prefetch.getPrefetchStatus();
    assert(status.lastUpdate, 'No last update time');
    assert(status.dataLoaded, 'No data loaded info');
    logger.info(`  Age: ${status.ageSeconds} seconds`);
    logger.success('Status retrieved');

    logger.test('Health check');
    const health = prefetch.getHealthCheck();
    logger.info(`  Healthy: ${health.healthy}`);
    logger.info(`  Passing checks: ${health.passing}/${health.total}`);
    Object.entries(health.checks).forEach(([check, result]) => {
      logger.info(`    ${result ? '✓' : '✗'} ${check}`);
    });
    logger.success('Health check completed');

    logger.test('Manual refresh');
    const refreshResult = await prefetch.refreshSpecificData('nfl');
    assert.strictEqual(refreshResult.success, true, 'Refresh failed');
    logger.success('Manual refresh passed');

    logger.test('Clear cache');
    SportsDataAggregator.clearCache();
    logger.success('Cache cleared');

    return { success: true, prefetchTests: 6 };
  } catch (err) {
    logger.error(`Prefetch test failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function testBotMenuHandlers() {
  logger.section('TEST 5: Bot Menu Handlers');

  try {
    const userId = 12345;
    const chatId = 67890;

    logger.test('Teams menu handler');
    const teamsResult = await menus.menuHandlers.handleTeamsMenu(userId, chatId);
    assert(teamsResult.text, 'No text from handler');
    logger.success('Teams handler works');

    logger.test('NFL menu handler');
    const nflResult = await menus.menuHandlers.handleNFLMenu(userId, chatId);
    assert(nflResult.text, 'No text from handler');
    logger.success('NFL handler works');

    logger.test('Soccer menu handler');
    const soccerResult = await menus.menuHandlers.handleSoccerMenu(userId, chatId);
    assert(soccerResult.text, 'No text from handler');
    logger.success('Soccer handler works');

    logger.test('Fixtures menu handler');
    const fixturesResult = await menus.menuHandlers.handleFixturesMenu(userId, chatId);
    assert(fixturesResult.text, 'No text from handler');
    logger.success('Fixtures handler works');

    logger.test('Odds menu handler');
    const oddsResult = await menus.menuHandlers.handleOddsMenu(userId, chatId);
    assert(oddsResult.text, 'No text from handler');
    logger.success('Odds handler works');

    logger.test('Leagues menu handler');
    const leaguesResult = await menus.menuHandlers.handleLeaguesMenu(userId, chatId);
    assert(leaguesResult.text, 'No text from handler');
    logger.success('Leagues handler works');

    return { success: true, handlerTests: 6 };
  } catch (err) {
    logger.error(`Handler test failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ============================================
// MAIN TEST SUITE
// ============================================

async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║   BETRIX SPORTS API - END-TO-END INTEGRATION TEST SUITE          ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  const results = [];
  const startTime = Date.now();

  try {
    results.push(await testAPIDataFetching());
    results.push(await testDataFormatting());
    results.push(await testMenuBuilding());
    results.push(await testPrefetchSystem());
    results.push(await testBotMenuHandlers());
  } catch (err) {
    logger.error(`Unexpected error: ${err.message}`);
  }

  const elapsed = Date.now() - startTime;
  const successful = results.filter(r => r.success).length;
  const total = results.length;

  // Summary
  logger.section('TEST SUMMARY');
  logger.info(`Total test suites: ${total}`);
  logger.info(`Passed: ${successful}/${total}`);
  logger.info(`Failed: ${total - successful}/${total}`);
  logger.info(`Duration: ${elapsed}ms`);

  if (successful === total) {
    logger.success(`\nAll tests passed! ✅`);
    logger.info('✓ API data fetching working');
    logger.info('✓ Data formatting for menus working');
    logger.info('✓ Menu building working');
    logger.info('✓ Prefetch system working');
    logger.info('✓ Bot menu handlers working');
    logger.info('\n🚀 BETRIX Sports API integration is production-ready!');
  } else {
    logger.error(`\nSome tests failed! ❌`);
    results.forEach((r, i) => {
      if (!r.success) {
        logger.error(`  Test ${i + 1}: ${r.error}`);
      }
    });
  }

  return successful === total;
}

// Run tests
const passed = await runAllTests();
process.exit(passed ? 0 : 1);

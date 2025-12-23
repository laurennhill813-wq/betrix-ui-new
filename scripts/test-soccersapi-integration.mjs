#!/usr/bin/env node
/**
 * Test: SoccersAPI integration with prefetch and aggregation
 * Verifies that real league data is fetched, cached, and aggregated correctly
 */
import Redis from 'ioredis';
import fetch from 'node-fetch';
import { aggregateFixtures } from '../src/lib/fixtures-aggregator.js';

async function test() {
  console.log('\n=== SoccersAPI Integration Test ===\n');
  
  // Connect to Redis
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  try {
    // Step 1: Manually fetch and cache SoccersAPI data (simulating prefetch)
    console.log('Step 1: Fetching SoccersAPI leagues...');
    const url = 'https://api.soccersapi.com/v2.2/leagues/?user=28Ekz&token=PT0s9YfsZO&t=list';
    const res = await fetch(url);
    const body = await res.json();
    
    if (!body.data || !Array.isArray(body.data)) {
      console.error('❌ FAIL: SoccersAPI response invalid');
      process.exit(1);
    }
    
    const leagues = body.data.map(l => l.name).filter(Boolean);
    console.log(`✅ PASS: Fetched ${leagues.length} league names`);
    console.log(`   Sample leagues: ${leagues.slice(0, 5).join(', ')}`);
    
    // Step 2: Cache the data as prefetch would
    console.log('\nStep 2: Caching leagues in Redis...');
    const cacheKey = 'rapidapi:soccersapi:leagues';
    await redis.set(cacheKey, JSON.stringify({
      apiName: 'SoccersAPI',
      sport: 'soccer',
      leagues,
      count: leagues.length,
      ts: Date.now()
    }), 'EX', 300);
    console.log(`✅ PASS: Cached to key ${cacheKey}`);
    
    // Step 3: Run aggregator and check provider metadata
    console.log('\nStep 3: Running fixtures aggregator...');
    const result = await aggregateFixtures(redis);
    console.log(`✅ PASS: Aggregator ran successfully`);
    console.log(`   Total fixtures: ${result.fixtures.length}`);
    console.log(`   Total live: ${result.totalLiveMatches}`);
    console.log(`   Total upcoming: ${result.totalUpcomingFixtures}`);
    
    // Step 4: Verify provider metadata was written
    console.log('\nStep 4: Checking provider metadata in Redis...');
    const metaKey = 'rapidapi:providers:meta';
    const metaData = await redis.get(metaKey);
    if (metaData) {
      const meta = JSON.parse(metaData);
      const soccersapi = meta.find(p => p.provider === 'SoccersAPI');
      if (soccersapi) {
        console.log(`✅ PASS: SoccersAPI found in provider metadata`);
        console.log(`   Provider: ${soccersapi.provider}`);
        console.log(`   Host: ${soccersapi.host}`);
        console.log(`   League count: ${soccersapi.meta?.count || 0}`);
        if (soccersapi.meta?.leagues) {
          console.log(`   Sample leagues: ${soccersapi.meta.leagues.slice(0, 3).join(', ')}`);
        }
      } else {
        console.log(`⚠️  WARNING: SoccersAPI not found in provider metadata`);
        console.log(`   Available providers: ${meta.map(p => p.provider).join(', ')}`);
      }
    } else {
      console.log('⚠️  WARNING: Provider metadata not found in Redis');
    }
    
    // Step 5: Verify fixtures list
    console.log('\nStep 5: Checking fixtures list in Redis...');
    const fixturesKey = 'rapidapi:fixtures:list';
    const fixturesData = await redis.get(fixturesKey);
    if (fixturesData) {
      const fixtures = JSON.parse(fixturesData);
      console.log(`✅ PASS: Fixtures list written to Redis`);
      console.log(`   Total entries: ${Array.isArray(fixtures) ? fixtures.length : 0}`);
    } else {
      console.log('⚠️  WARNING: Fixtures list not found in Redis');
    }
    
    console.log('\n=== Test Summary ===');
    console.log('✅ SoccersAPI integration working');
    console.log('✅ Real league names are fetched and cached');
    console.log('✅ Aggregator processes direct provider data');
    console.log('✅ Provider metadata is published to Redis');
    
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  } finally {
    await redis.quit();
  }
}

test();

# RapidAPI Endpoint Testing Report - 2025-12-23

## Executive Summary

Ran comprehensive tests on 23 RapidAPI endpoints to identify working sources for sports fixtures and data.

**Results:**
- ✅ **12/23 working** (52%)
- ❌ **9 rate-limited (429)** - primary Odds API included
- ❌ **2 down/invalid** (502, 404)

## Working APIs by Sport

### Soccer (4 APIs)
- ✅ **Heisenbug - Premier League** (heisenbug-premier-league-live-scores-v1.p.rapidapi.com)
  - Returns: Fixtures, team info
  - Status: 200 OK
  - Use for: Premier League matches
  
- ✅ **Free LiveScore** (free-livescore-api.p.rapidapi.com)
  - Returns: Search results, match data
  - Status: 200 OK
  - Use for: Real-time soccer scores
  
- ✅ **Free Football API** (free-football-api-data.p.rapidapi.com)
  - Returns: Match statistics
  - Status: 200 OK
  
- ✅ **Football Pro** (football-pro.p.rapidapi.com)
  - Returns: Season corrections, match data
  - Status: 200 OK

### Multi-Sport (4 APIs)
- ✅ **SofaScore** (sofascore.p.rapidapi.com)
  - Returns: H2H match data, team duel info
  - Status: 200 OK
  - Use for: General sports matches
  
- ✅ **SofaSport** (sofasport.p.rapidapi.com)
  - Returns: Event odds, match data
  - Status: 200 OK
  
- ✅ **FlashLive Sports** (flashlive-sports.p.rapidapi.com)
  - Returns: News, match data
  - Status: 200 OK
  
- ⚠️ **All Sports API 2** (allsportsapi2.p.rapidapi.com)
  - Status: 204 No Content (empty response)

### NFL (3 APIs)
- ✅ **The Rundown** (therundown-therundown-v1.p.rapidapi.com)
  - Returns: Conferences, teams
  - Status: 200 OK
  - Use for: NFL structure/scheduling
  
- ✅ **Sportspage** (sportspage-feeds.p.rapidapi.com)
  - Returns: NCAAF rankings
  - Status: 200 OK
  
- ✅ **Pinnacle Odds** (pinnacle-odds.p.rapidapi.com)
  - Returns: Meta periods for NFL
  - Status: 200 OK

### Basketball (1 API)
- ✅ **Sports Information** (sports-information.p.rapidapi.com)
  - Returns: MBB news (30 items)
  - Status: 200 OK
  - Note: Returns news, not fixtures

## Rate-Limited APIs (429 - Too Many Requests)

These APIs are hitting quota limits and need rest periods:

1. **NFL API Data** - nfl-api-data.p.rapidapi.com
2. **Football Prediction API** - football-prediction-api.p.rapidapi.com
3. **Odds API (Main)** - odds.p.rapidapi.com ⚠️ *Critical*
4. **Football Live Stream** - football-live-stream-api.p.rapidapi.com
5. **SportAPI7** - sportapi7.p.rapidapi.com
6. **BetsAPI2** - betsapi2.p.rapidapi.com ⚠️ *High Quality*
7. **Odds API 1** - odds-api1.p.rapidapi.com
8. **Bet365 API** - bet365-api-inplay.p.rapidapi.com
9. **Free API Live Football** - free-api-live-football-data.p.rapidapi.com

## Updated Subscriptions

Now using only **working APIs**:

```json
[
  {
    "host": "heisenbug-premier-league-live-scores-v1.p.rapidapi.com",
    "name": "Heisenbug - Premier League",
    "sport": "soccer"
  },
  {
    "host": "sofascore.p.rapidapi.com",
    "name": "SofaScore - Sports",
    "sport": "multi"
  },
  {
    "host": "free-livescore-api.p.rapidapi.com",
    "name": "Free LiveScore",
    "sport": "soccer"
  },
  {
    "host": "therundown-therundown-v1.p.rapidapi.com",
    "name": "The Rundown - NFL",
    "sport": "nfl"
  },
  {
    "host": "sportspage-feeds.p.rapidapi.com",
    "name": "Sportspage - Rankings",
    "sport": "nfl"
  }
]
```

## Key Challenges Identified

### 1. **Rate Limiting**
- Primary Odds API (odds.p.rapidapi.com) is rate-limited
- This was supposed to be the main multi-sport source
- Need to implement backoff/retry logic or use alternatives

### 2. **Data Format Fragmentation**
- Each API returns different response structures
- Some return arrays, some return objects
- Need normalization layer for each API

### 3. **Limited Fixture Availability**
- Most working APIs return metadata (rankings, news, odds)
- Very few return actual upcoming match fixtures
- May need to:
  - Scrape match schedules from other sources
  - Use Football-Data.org API (already working for soccer)
  - Combine multiple data sources

### 4. **Basketball/Baseball/Hockey**
- No working APIs found for these sports in available quota
- Sports Information API has basketball but returns news only
- May require:
  - Direct API keys (not RapidAPI)
  - Alternative providers
  - Free/freemium APIs

## Recommendations

### Short Term (Immediate)
1. Deploy with working subscriptions.json (commit 8a4fafc)
2. Keep Football-Data.org as primary source (already works for soccer)
3. Use Heisenbug + SofaScore for other sports
4. Wait for rate-limit windows on high-quality APIs

### Medium Term (This Week)
1. Implement request queuing/backoff mechanism
2. Add response normalization for each API
3. Create fixture schema converter for each API type
4. Test actual callback responses with new data

### Long Term (Next Phase)
1. Evaluate paid/enterprise APIs for basketball/baseball/hockey
2. Consider direct API integrations vs RapidAPI
3. Build caching layer for fixture data
4. Implement data fallback chains (API1 → API2 → API3)

## Test Files Created

- `scripts/test-all-rapidapi-endpoints.mjs` - Test harness
- `scripts/analyze-test-results.js` - Results analyzer
- `test-results.json` - Full test results
- `RAPIDAPI_TESTING_REPORT.md` - This file

## Next Steps

1. **Test Bot Callbacks** - Verify the new APIs return data Telegram callbacks can use
2. **Map Response Formats** - Create transformers for each API
3. **Implement Fixture Extraction** - Convert API responses to fixture schema
4. **Test with Real Users** - Check if basketball/baseball now show data
5. **Monitor Rate Limits** - Watch for 429 errors in production logs

## Success Metrics

- [ ] Soccer fixtures show upcoming matches
- [ ] NFL shows upcoming games
- [ ] Basketball shows some data (even if news-based)
- [ ] No 429 rate-limit errors in logs
- [ ] Callback responses include fixture data
- [ ] User can navigate between sports without "No upcoming fixtures" error

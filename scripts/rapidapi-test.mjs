#!/usr/bin/env node
import { setTimeout as delay } from 'timers/promises'

const KEY = process.env.RAPIDAPI_KEY
if (!KEY) {
  console.error('RAPIDAPI_KEY not set in environment')
  process.exit(2)
}

const endpoints = [
  { url: 'https://nfl-api-data.p.rapidapi.com/nfl-team-listing/v1/data', host: 'nfl-api-data.p.rapidapi.com' },
  { url: "https://heisenbug-premier-league-live-scores-v1.p.rapidapi.com/api/premierleague/team?name=Liverpool", host: 'heisenbug-premier-league-live-scores-v1.p.rapidapi.com' },
  { url: "https://football-prediction-api.p.rapidapi.com/api/v2/predictions?market=classic&iso_date=2018-12-01&federation=UEFA", host: 'football-prediction-api.p.rapidapi.com' },
  { url: 'https://therundown-therundown-v1.p.rapidapi.com/sports/1/conferences', host: 'therundown-therundown-v1.p.rapidapi.com' },
  { url: 'https://odds.p.rapidapi.com/v4/sports/upcoming/odds?regions=us&oddsFormat=decimal&markets=h2h,spreads&dateFormat=iso', host: 'odds.p.rapidapi.com' },
  { url: 'https://football-live-stream-api.p.rapidapi.com/link/truc-tiep-tran-dau-coquimbo-unido-vs-universidad-de-chile-2674554', host: 'football-live-stream-api.p.rapidapi.com' },
  { url: "https://tvpro-api.p.rapidapi.com/apps-oficial.com/apps/views/forms/entretenimiento/api_tv?mod=tv&RapidApi=jlospino", host: 'tvpro-api.p.rapidapi.com' },
  { url: 'https://sportapi7.p.rapidapi.com/api/v1/player/817181/unique-tournament/132/season/65360/ratings', host: 'sportapi7.p.rapidapi.com' },
  { url: 'https://betsapi2.p.rapidapi.com/v3/bet365/prematch', host: 'betsapi2.p.rapidapi.com' },
  { url: 'https://allsportsapi2.p.rapidapi.com/api/tv/country/all/event/10974920', host: 'allsportsapi2.p.rapidapi.com' },
  { url: "https://real-time-sports-data.p.rapidapi.com/api/event?eventId=23781550&langId=2", host: 'real-time-sports-data.p.rapidapi.com' },
  { url: 'https://free-football-api-data.p.rapidapi.com/football-event-statistics?eventid=12650707', host: 'free-football-api-data.p.rapidapi.com' },
  { url: 'https://sportspage-feeds.p.rapidapi.com/rankings?league=NCAAF', host: 'sportspage-feeds.p.rapidapi.com' },
  { url: 'https://sofascore.p.rapidapi.com/matches/get-h2h?matchId=8897222', host: 'sofascore.p.rapidapi.com' },
  { url: 'https://sports-information.p.rapidapi.com/mbb/news?limit=30', host: 'sports-information.p.rapidapi.com' },
  { url: 'https://odds-api1.p.rapidapi.com/scores?fixtureId=id1200255561449537', host: 'odds-api1.p.rapidapi.com' },
  { url: 'https://sofasport.p.rapidapi.com/v1/events/odds/winning?event_id=10253769&provider_id=1&odds_format=decimal', host: 'sofasport.p.rapidapi.com' },
  { url: 'https://bet365-api-inplay.p.rapidapi.com/bet365/get_leagues', host: 'bet365-api-inplay.p.rapidapi.com' },
  { url: 'https://pinnacle-odds.p.rapidapi.com/kit/v1/meta-periods?sport_id=1', host: 'pinnacle-odds.p.rapidapi.com' },
  { url: 'https://free-livescore-api.p.rapidapi.com/livescore-get-search?sportname=soccer&search=romania', host: 'free-livescore-api.p.rapidapi.com' },
  { url: 'https://free-api-live-football-data.p.rapidapi.com/football-players-search?search=m', host: 'free-api-live-football-data.p.rapidapi.com' },
  { url: 'https://real-time-sports-news-api.p.rapidapi.com/sources-by-category?category=sports', host: 'real-time-sports-news-api.p.rapidapi.com' },
  { url: 'https://football-pro.p.rapidapi.com/api/v2.0/corrections/season/17141?tz=Europe%2FAmsterdam', host: 'football-pro.p.rapidapi.com' },
  { url: 'https://flashlive-sports.p.rapidapi.com/v1/news/list?entity_id=1&page=0&category_id=59&locale=en_INT', host: 'flashlive-sports.p.rapidapi.com' },
  { url: 'https://newsnow.p.rapidapi.com/newsv2_top_news', host: 'newsnow.p.rapidapi.com', method: 'POST', body: { location:'us', language:'en', page:1, time_bounded:false, from_date:'01/02/2021', to_date:'05/06/2021' } },
  { url: 'https://allsportsapi.p.rapidapi.com/api/v1/tv/country/all/event/10974920', host: 'allsportsapi.p.rapidapi.com' }
]

async function run() {
  for (const ep of endpoints) {
    console.log('\n---');
    console.log(`${ep.method||'GET'} ${ep.url}`);
    const headers = {
      'x-rapidapi-host': ep.host,
      'x-rapidapi-key': KEY,
      'accept': 'application/json'
    }
    const opts = { method: ep.method || 'GET', headers }
    if (ep.body) {
      opts.body = JSON.stringify(ep.body)
      opts.headers['content-type'] = 'application/json'
    }
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(ep.url, { ...opts, signal: controller.signal })
      clearTimeout(timeout)
      console.log('status=', res.status)
      const text = await res.text()
      let parsed
      try { parsed = JSON.parse(text) } catch (e) { parsed = text }
      const preview = typeof parsed === 'string' ? parsed.slice(0, 500) : JSON.stringify(parsed, null, 2).slice(0, 1000)
      console.log('preview:', preview)
    } catch (err) {
      console.error('error:', err.message || err)
    }
    // small pause to avoid rate bursts
    await delay(250)
  }
  console.log('\nAll tests complete')
}

run().catch(e => { console.error(e); process.exit(1) })

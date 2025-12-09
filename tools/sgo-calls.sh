#!/usr/bin/env bash
# tools/sgo-calls.sh
# Run direct API calls to SportGameOdds. Replace <KEY> with your key or set SPORTSGAMEODDS_API_KEY env.

KEY=${SPORTSGAMEODDS_API_KEY:-"d95d85bced0f6106cd1b2e5e6fcd8c85"}
BASE=https://api.sportsgameodds.com/v2

# Metadata
curl -s -H "X-Api-Key: $KEY" "$BASE/sports/metadata" | jq '.'

# Sports
curl -s -H "X-Api-Key: $KEY" "$BASE/sports" | jq '.'

# Leagues
curl -s -H "X-Api-Key: $KEY" "$BASE/leagues" | jq '.'

# NBA teams
curl -s -H "X-Api-Key: $KEY" "$BASE/teams?league=nba" | jq '.'

# NBA events
curl -s -H "X-Api-Key: $KEY" "$BASE/events?league=nba" | jq '.'

# Odds for latest NBA event (first event id)
eventId=$(curl -s -H "X-Api-Key: $KEY" "$BASE/events?league=nba" | jq -r '.[0].id // .[0].eventId')
if [ -n "$eventId" ] && [ "$eventId" != "null" ]; then
  echo "Fetching odds for event $eventId"
  curl -s -H "X-Api-Key: $KEY" "$BASE/odds?league=nba&eventId=$eventId" | jq '.'
fi

# Live scores sample
curl -s -H "X-Api-Key: $KEY" "$BASE/live?league=nba" | jq '.'

# Bookmakers
curl -s -H "X-Api-Key: $KEY" "$BASE/bookmakers" | jq '.'

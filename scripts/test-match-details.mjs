import menu from '../src/handlers/menu-handler-complete.js';

const testMatches = [
  // minimal raw payload that previously produced "Home vs Away"
  {
    id: 537952,
    raw: {
      teams: [ { name: 'Newcastle United' }, { name: 'Chelsea' } ],
      competition: { name: 'Premier League' },
      venue: 'St James Park'
    },
    homeShots: 0,
    awayShots: 0,
    homePossession: 52,
    awayPossession: 48,
    homeCards: 1,
    awayCards: 2,
    homeOdds: '2.10',
    drawOdds: '3.40',
    awayOdds: '3.30'
  },
  // fallback case with flat fields
  {
    fixtureId: 'demo-2',
    home: 'Brighton & Hove',
    away: 'Fulham',
    league: 'EPL',
    time: '2025-12-20 16:00',
    venue: 'Amex Stadium'
  }
];

for (const m of testMatches) {
  const out = menu.buildMatchDetailsMenu(m);
  console.log('--- MATCH OUTPUT ---');
  console.log(out.text);
  console.log('REPLY MARKUP:', JSON.stringify(out.reply_markup, null, 2));
}

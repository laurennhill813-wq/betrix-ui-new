import { selectBestImageForEventCombined } from '../src/media/imageSelector.js';

(async () => {
  const ev = {
    sport: 'soccer',
    league: 'UEFA Champions League',
    home: 'FC Bayern München',
    away: 'Chelsea FC',
  };
  try {
    const res = await selectBestImageForEventCombined(ev);
    console.log('SELECTED IMAGE:', res);
  } catch (e) {
    console.error('ERROR running selector', e);
  }
  process.exit(0);
})();

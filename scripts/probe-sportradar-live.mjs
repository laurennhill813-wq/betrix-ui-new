import { fetchAndNormalizeTeams, fetchAndNormalizeFixtures } from "../src/services/sportradar-client.js";
import { SPORTRADAR_SPORTS } from "../src/config/sportradar-sports.js";

(async () => {
  try {
    if (!process.env.SPORTRADAR_KEY && process.argv[2]) process.env.SPORTRADAR_KEY = process.argv[2];
    if (!process.env.SPORTRADAR_KEY) {
      console.error("SPORTRADAR_KEY not set. Pass as env or first arg.");
      process.exit(2);
    }

    for (const s of SPORTRADAR_SPORTS) {
      const sport = s.id;
      console.log(`\n=== SPORT: ${sport} ===`);
      try {
        const teams = await fetchAndNormalizeTeams(sport, {});
        console.log("teams meta:", { httpStatus: teams.httpStatus, pathUsed: teams.pathUsed, errorReason: teams.errorReason, count: (teams.items || []).length });
      } catch (e) {
        console.error("teams fetch error", e?.message || e);
      }
      try {
        const fixtures = await fetchAndNormalizeFixtures(sport, { date: new Date().toISOString().slice(0,10) }, {});
        console.log("fixtures meta:", { httpStatus: fixtures.httpStatus, pathUsed: fixtures.pathUsed, errorReason: fixtures.errorReason, count: (fixtures.items || []).length });
      } catch (e) {
        console.error("fixtures fetch error", e?.message || e);
      }
    }
    process.exit(0);
  } catch (e) {
    console.error("probe failed", e && e.message ? e.message : e);
    process.exit(1);
  }
})();

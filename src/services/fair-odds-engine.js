import {
  americanToImpliedProb,
  impliedProbToAmerican,
  removeVig,
} from "./odds-math.js";

export function computeConsensusForEvent(records) {
  if (!records || !Array.isArray(records) || records.length === 0) return null;

  const valid = records
    .map((r) => {
      const homeOdds = Number(r.markets?.moneyline?.home);
      const awayOdds = Number(r.markets?.moneyline?.away);
      return {
        bookmaker: r.bookmaker,
        homeOdds: Number.isFinite(homeOdds) ? homeOdds : null,
        awayOdds: Number.isFinite(awayOdds) ? awayOdds : null,
        pHome: americanToImpliedProb(homeOdds),
        pAway: americanToImpliedProb(awayOdds),
      };
    })
    .filter((x) => x.pHome != null && x.pAway != null);

  if (!valid.length) return null;

  const avgHome = valid.reduce((s, x) => s + x.pHome, 0) / valid.length;
  const avgAway = valid.reduce((s, x) => s + x.pAway, 0) / valid.length;

  const { fairHome, fairAway } = removeVig(avgHome, avgAway);

  const fairHomeOdds = impliedProbToAmerican(fairHome);
  const fairAwayOdds = impliedProbToAmerican(fairAway);

  const bestHome = valid.reduce(
    (best, x) => (x.homeOdds > (best.homeOdds || -Infinity) ? x : best),
    valid[0],
  );
  const bestAway = valid.reduce(
    (best, x) => (x.awayOdds > (best.awayOdds || -Infinity) ? x : best),
    valid[0],
  );

  return {
    consensus: { homeProb: avgHome, awayProb: avgAway },
    fair: {
      homeProb: fairHome,
      awayProb: fairAway,
      homeOdds: fairHomeOdds,
      awayOdds: fairAwayOdds,
    },
    bestOffers: { home: bestHome, away: bestAway },
  };
}

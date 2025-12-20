import fs from "fs";
import path from "path";

describe("RapidAPI subscription hosts are expected values", () => {
  test("contains known hosts", () => {
    const p = path.join(process.cwd(), "src", "rapidapi", "subscriptions.json");
    const raw = fs.readFileSync(p, "utf8");
    const arr = JSON.parse(raw);
    const hosts = arr.map((a) => a.host).sort();
    const expected = [
      "allsportsapi.p.rapidapi.com",
      "betsapi2.p.rapidapi.com",
      "bet365-api-inplay.p.rapidapi.com",
      "football-live-stream-api.p.rapidapi.com",
      "football-pro.p.rapidapi.com",
      "football-prediction-api.p.rapidapi.com",
      "flashlive-sports.p.rapidapi.com",
      "free-api-live-football-data.p.rapidapi.com",
      "free-livescore-api.p.rapidapi.com",
      "heisenbug-premier-league-live-scores-v1.p.rapidapi.com",
      "newsnow.p.rapidapi.com",
      "odds-api1.p.rapidapi.com",
      "odds.p.rapidapi.com",
      "pinnacle-odds.p.rapidapi.com",
      "rapidsportapi.p.rapidapi.com",
      "sportapi7.p.rapidapi.com",
      "sportspage-feeds.p.rapidapi.com",
      "sofascore.p.rapidapi.com",
      "sports-information.p.rapidapi.com",
      "therundown-therundown-v1.p.rapidapi.com",
      "tvpro-api.p.rapidapi.com"
    ].sort();
    expect(hosts).toEqual(expected);
  });
});

import { formatMatchShort, formatMatchDetail } from "../src/bot/football.js";

const samples = [
  {
    id: 1,
    home: { name: "US Lecce" },
    away: { name: "AC Pisa 1909" },
    competition: { name: "Serie A" },
    kickoff: "2025-12-12T19:45:00Z",
    status: "SCHEDULED",
  },
  {
    id: 2,
    home: "Team A",
    away: "Team B",
    competition: "Friendly Cup",
    kickoff: "2025-12-13T17:00:00Z",
    score: { fullTime: { home: 2, away: 1 } },
    status: "FINISHED",
  },
  {
    id: 3,
    home: { teamName: "FC Object" },
    away: { fullName: "Real Example" },
    competition: { code: "CUP" },
    kickoff: null,
    status: "TBD",
  },
];

for (const s of samples) {
  console.log("SHORT:", formatMatchShort(s));
  console.log("DETAIL:", formatMatchDetail(s));
  console.log("---");
}

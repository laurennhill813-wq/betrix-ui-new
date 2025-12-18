import fs from "fs";
const p = new URL("../.env.local", import.meta.url);
const s = fs.readFileSync(p, "utf8");
const lines = s.split(/\r?\n/);
lines.forEach((l, i) => console.log(`${i + 1}: ${JSON.stringify(l)}`));

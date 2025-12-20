import fs from "fs";
import path from "path";

describe("RapidAPI subscriptions file", () => {
  test("contains 21 entries and each has host + sampleEndpoints", async () => {
    const p = path.join(process.cwd(), "src", "rapidapi", "subscriptions.json");
    const raw = fs.readFileSync(p, "utf8");
    const arr = JSON.parse(raw);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBe(21);
    for (const it of arr) {
      expect(typeof it.name).toBe("string");
      expect(it.name.length).toBeGreaterThan(0);
      expect(typeof it.host).toBe("string");
      expect(it.host.length).toBeGreaterThan(0);
      expect(Array.isArray(it.sampleEndpoints)).toBe(true);
      expect(it.sampleEndpoints.length).toBeGreaterThan(0);
    }
  });
});

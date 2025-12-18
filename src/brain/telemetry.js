import { incrWithTTL, getRaw } from "../lib/redis-cache.js";

const DEFAULT_TTL = Number(
  process.env.BETRIX_TELEMETRY_TTL_SECONDS || 60 * 60 * 24 * 30,
); // 30 days

export async function incCounter(name, by = 1) {
  try {
    const key = `betrix:metrics:${name}`;
    // use incrWithTTL; it returns new value
    let val = await incrWithTTL(key, DEFAULT_TTL);
    // incrWithTTL increments by 1 only; if 'by' >1, call multiple times (simple)
    for (let i = 1; i < by; i++) {
      val = await incrWithTTL(key, DEFAULT_TTL);
    }
    return Number(val || 0);
  } catch (e) {
    return 0;
  }
}

export async function getCounter(name) {
  try {
    const key = `betrix:metrics:${name}`;
    const raw = await getRaw(key);
    return raw ? Number(raw) : 0;
  } catch (e) {
    return 0;
  }
}

export default { incCounter, getCounter };

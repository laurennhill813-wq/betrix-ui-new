import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function verifyPrefetch(req, res) {
  try {
    const keys = await redis.keys('*:*:*');
    res.json({ ok: true, keys });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}

export default class MockRedis {
  constructor() {
    this.store = new Map();
  }
  async get(k) {
    return this.store.get(k) || null;
  }
  async set(k, v) {
    this.store.set(k, String(v));
    return "OK";
  }
  async del(k) {
    this.store.delete(k);
    return 1;
  }
  async expire(k, t) {
    return 1;
  }
  async hgetall(k) {
    const raw = this.store.get(k) || null;
    try {
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return raw || {};
    }
  }
  async hset(k, f, v) {
    const ex = this.store.get(k) || "{}";
    let obj;
    try {
      obj = JSON.parse(ex);
    } catch (e) {
      obj = {};
    }
    obj[f] = String(v);
    this.store.set(k, JSON.stringify(obj));
    return 1;
  }
}

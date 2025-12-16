// SportMonks removed — provide a single minimal stub implementation
// to preserve imports for any remaining callers.

export default class SportMonksService {
  constructor(redis = null) {
    this.redis = redis;
  }

  async getLeagues() { return []; }
  async getLivescores() { return []; }
  async getFixtures() { return []; }
  async getOdds() { return []; }
  async fetch() { return null; }
}

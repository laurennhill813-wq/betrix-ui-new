// Compatibility re-export for environments where code is resolved under src/src/*
import createRedisAdapter from '../../utils/redis-adapter.js';

export default createRedisAdapter;
export * from '../../utils/redis-adapter.js';

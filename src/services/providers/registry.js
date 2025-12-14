export const PROVIDERS = {
  // Sportradar provider entry
  sportradar: {
    id: 'sportradar',
    name: 'Sportradar',
    keyEnv: 'SPORTRADAR_KEY',
    sports: ['soccer', 'tennis', 'basketball', 'americanfootball'],
    base: 'https://api.sportradar.com',
    handler: null, // to be assigned to adapter function
    auth: {
      method: 'query', // 'query' or 'header'
      queryParam: 'api_key',
      headerName: 'Api-Key'
    }
  }
};

export function registerProvider(id, handlerFn) {
  if (!PROVIDERS[id]) {
    throw new Error(`Provider ${id} not declared in registry`);
  }
  PROVIDERS[id].handler = handlerFn;
}

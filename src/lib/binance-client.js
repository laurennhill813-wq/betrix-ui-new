// Minimal Binance client stub to satisfy imports in tests and handlers.
// This provides lightweight implementations used by unit tests.

const binanceClient = {
  // Example stub: generate a mock payment payload
  generatePayment: async (opts = {}) => {
    return {
      id: "mock-payment-1",
      amount: opts.amount || 0,
      currency: opts.currency || "USD",
      status: "created",
      meta: opts,
    };
  },

  // Example stub: get order/status
  getOrder: async (id) => ({ id, status: "mock", filled: 0 }),
};

export default binanceClient;

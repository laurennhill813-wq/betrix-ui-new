import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const aiRequests = new client.Counter({
  name: "betrix_ai_requests_total",
  help: "Total AI requests",
  labelNames: ["provider"],
});
const aiErrors = new client.Counter({
  name: "betrix_ai_errors_total",
  help: "Total AI errors",
  labelNames: ["provider"],
});
const aiLatency = new client.Histogram({
  name: "betrix_ai_latency_ms",
  help: "AI latency in ms",
  labelNames: ["provider"],
  buckets: [50, 100, 200, 500, 1000, 2000, 5000],
});
const aiTokens = new client.Counter({
  name: "betrix_ai_tokens_total",
  help: "AI tokens used",
  labelNames: ["provider", "type"],
});

register.registerMetric(aiRequests);
register.registerMetric(aiErrors);
register.registerMetric(aiLatency);
register.registerMetric(aiTokens);

export function incRequest(provider = "azure") {
  aiRequests.inc({ provider });
}
export function incError(provider = "azure") {
  aiErrors.inc({ provider });
}
export function observeLatency(provider = "azure", ms = 0) {
  aiLatency.observe({ provider }, Number(ms));
}
export function addTokens(provider = "azure", type = "completion", n = 0) {
  aiTokens.inc({ provider, type }, Number(n));
}
export { register };

export default { incRequest, incError, observeLatency, addTokens, register };

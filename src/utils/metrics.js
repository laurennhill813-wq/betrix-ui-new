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

// Lipana reconciliation metrics
const lipanaRuns = new client.Counter({
  name: "betrix_lipana_reconciliation_runs_total",
  help: "Total Lipana reconciliation runs",
});
const lipanaFailures = new client.Counter({
  name: "betrix_lipana_reconciliation_failures_total",
  help: "Total Lipana reconciliation failures",
});
const lipanaSuccess = new client.Counter({
  name: "betrix_lipana_reconciliation_success_total",
  help: "Total Lipana reconciliation successes",
});

register.registerMetric(aiRequests);
register.registerMetric(aiErrors);
register.registerMetric(aiLatency);
register.registerMetric(aiTokens);
register.registerMetric(lipanaRuns);
register.registerMetric(lipanaFailures);
register.registerMetric(lipanaSuccess);

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

export function incLipanaRun(n = 1) {
  lipanaRuns.inc(Number(n));
}
export function incLipanaFailure(n = 1) {
  lipanaFailures.inc(Number(n));
}
export function incLipanaSuccess(n = 1) {
  lipanaSuccess.inc(Number(n));
}

export { register };

export default {
  incRequest,
  incError,
  observeLatency,
  addTokens,
  incLipanaRun,
  incLipanaFailure,
  incLipanaSuccess,
  register,
};

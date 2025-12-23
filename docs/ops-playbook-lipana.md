# Lipana Reconciliation — Ops Playbook

Symptoms
- Alert: `LipanaReconciliationFailures` firing (severity=warning).
- `betrix_lipana_reconciliation_failures_total` > 0 over a recent 15m window.

Immediate checks
- Check worker logs for lines containing `Lipana reconciliation` and errors. Look for stack traces or SQL errors.
- Confirm Prometheus metric increments: query `increase(betrix_lipana_reconciliation_failures_total[15m])` in Prometheus.
- Check Redis startup/scheduler markers (e.g., `rapidapi:startup:registered` for related startup checks) and any Lipana-specific markers if present.
- Verify environment variables used by the scheduler:
  - `RECONCILE_INTERVAL_MINUTES` — scheduling interval in minutes.
  - `RECONCILE_THRESHOLD_MINUTES` — age threshold for pending payments.

Common root causes
- Malformed interval values (e.g., concatenated strings or invalid numeric input) causing SQL `interval` parse errors.
- Provider (Lipana) API outage or transient network errors.
- Database connectivity issues (Postgres host unreachable) — reconciliation may fallback or fail.

Resolution steps
1. Validate env values:
   - Ensure `RECONCILE_INTERVAL_MINUTES` and `RECONCILE_THRESHOLD_MINUTES` are numeric (integers). If you want to disable scheduling, set `RECONCILE_INTERVAL_MINUTES=0`.
2. If malformed values are found, update the Render/host environment with corrected values and redeploy the worker.
3. If provider outage: wait for provider to recover; consider re-run reconciliation manually (see below).
4. Confirm success: tail worker logs for `Lipana reconciliation complete` and verify `betrix_lipana_reconciliation_failures_total` stops increasing.

Manual run (if needed)
- SSH / run a one-off worker or invoke the reconciliation task with a short interval to validate behavior.
- Example (run in node REPL or container):
  - `node -e "require('./src/tasks/reconcile-lipana.js').reconcileWithLipana({ pool, telegram, thresholdMinutes:5, limit:200 })"`

Escalation
- If failures persist for more than 3 scheduled cycles (monitor `betrix_lipana_reconciliation_failures_total`), notify the ops lead and provide:
  - Worker logs (last 1000 lines)
  - Current env vars and deploy metadata
  - Recent Prometheus query results for the failure metric

Notes
- The application includes defensive parsing for interval inputs; prefer numeric minutes values. Disabling scheduling (0) will prevent automatic runs but allow manual reconciliation.

Grafana Integration
- Dashboard file: `dashboards/lipana-reconciliation.json` (import into Grafana). Dashboard UID: `lipana-reconciliation`.
- Panels:
  * **Reconciliation Runs**: counter showing `betrix_lipana_reconciliation_runs_total` (rate over time).
  * **Reconciliation Successes**: counter showing `betrix_lipana_reconciliation_success_total`.
  * **Reconciliation Failures**: counter showing `betrix_lipana_reconciliation_failures_total` — thresholded and highlighted red when > 0.
  * **Success vs Failures (stacked)**: stacked graph showing recent increases for success vs failures to help spot regressions.
- Alert annotation links to dashboard: the alert includes a `dashboard` annotation that should point to your Grafana instance (example: `https://grafana.example.com/d/lipana-reconciliation/lipana-reconciliation`).
- Interpretation:
  * If **Runs** are steady but **Failures** spike, investigate provider or DB errors.
  * If **Runs** drop to zero, check scheduler configuration (`RECONCILE_INTERVAL_MINUTES`) and worker health.
- To import: in Grafana, go to "Dashboards → Manage → Import" and upload `dashboards/lipana-reconciliation.json`. After import, edit datasource to your Prometheus instance if necessary.


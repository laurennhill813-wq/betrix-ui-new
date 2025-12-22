Grafana Provisioning — Lipana Reconciliation

This document explains how to provision the `lipana-reconciliation` dashboard into Grafana using the files in this repo.

Files in this repo
- `grafana/provisioning/dashboards/lipana-reconciliation.yml` — provisioning provider pointing at `dashboards/lipana-reconciliation.json`.
- `dashboards/lipana-reconciliation.json` — Grafana dashboard JSON to import.

Recommended setup (Docker Compose)

1. Mount the provisioning and dashboards folders into the Grafana container. Example `docker-compose.yml` snippet:

```yaml
services:
  grafana:
    image: grafana/grafana:9.0.0
    ports:
      - "3000:3000"
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./dashboards:/var/lib/grafana/dashboards
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=false
      - GF_SECURITY_ADMIN_PASSWORD=secret
```

2. Ensure the provisioning provider references the correct path. Our provider uses `options.path: dashboards/lipana-reconciliation.json` which resolves relative to the mounted provisioning dir; the mounted `dashboards` folder should be reachable from Grafana. Some setups prefer `options.path: /var/lib/grafana/dashboards` — adjust if needed.

Grafana `grafana.ini` (optional)
- If you don't use Docker Compose, ensure Grafana's provisioning folders include the mounted files. Example relevant settings (usually default):

```
[paths]
provisioning = /etc/grafana/provisioning
dashboards = /var/lib/grafana/dashboards
```

Reload / Restart Grafana
- After mounting, restart the Grafana container to trigger provisioning. Example:

```bash
docker compose up -d grafana
docker compose restart grafana
```

Verify import
- In Grafana UI: Dashboards → Manage → search for "Lipana Reconciliation".
- Imported dashboard UID: `lipana-reconciliation`. Folder: `Ops` (as configured in provider file).

Validation script
- There's a small helper script `scripts/validate-grafana-import.sh` which calls the Grafana search API to verify the dashboard is present.
- Usage:

```bash
# Check local Grafana
GRAFANA_HOST="http://localhost:3000" ./scripts/validate-grafana-import.sh

# Check remote Grafana with API key
GRAFANA_HOST="https://grafana.your-domain.com" GRAFANA_API_KEY="<api-key>" ./scripts/validate-grafana-import.sh
```

The script exits `0` when the dashboard is found, `1` when not found, and `2` on network/HTTP errors. It prints diagnostic output and any matching dashboard titles/UIDs.

Alert & Runbook links
- The Prometheus alert `alerts/lipana-failures.rules.yml` includes `dashboard` and `runbook` annotations. Update the `dashboard` annotation to point at your Grafana host, for example:

```
https://grafana.your-domain.com/d/lipana-reconciliation/lipana-reconciliation
```

How to verify alert links
1. After importing the dashboard, open the dashboard and copy its URL.
2. Replace the `dashboard` annotation value in `alerts/lipana-failures.rules.yml` with the real URL.
3. Reload Prometheus rules (or restart Prometheus) and trigger/acknowledge an alert to test the link.

Troubleshooting
- If dashboard doesn't appear: check Grafana logs (`docker compose logs grafana`) for provisioning errors.
- If provider reports wrong path: adjust `grafana/provisioning/dashboards/lipana-reconciliation.yml` `options.path` to the absolute path inside the container.

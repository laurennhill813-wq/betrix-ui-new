const key = process.env.RENDER_API_KEY;
const serviceId = process.argv[2] || 'srv-d4pih78gjchc7383520g';
const repo = process.argv[3] || 'https://github.com/elijahjessy311-afk/betrix-ui-new';
const branch = process.argv[4] || 'main';
if (!key) { console.error('No RENDER_API_KEY in env'); process.exit(2); }

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const txt = await res.text();
  try { return JSON.parse(txt); } catch (e) { return txt; }
}

(async () => {
  try {
    console.log('Fetching current service...');
    const svcResp = await fetchJson(`https://api.render.com/v1/services/${serviceId}`, { headers: { Authorization: `Bearer ${key}` } });
    console.log('Current service fetched.');
    // normalize: some API responses wrap service under `service`, others return the object directly
    const svc = svcResp && svcResp.service ? svcResp.service : svcResp;
    const currentDetails = svc.serviceDetails || {};
    // Build updated payload: set repo/branch and switch to node env with build/start commands
    const updated = {
      service: {
        repo,
        branch,
        serviceDetails: Object.assign({}, currentDetails, {
          env: 'node',
          envSpecificDetails: Object.assign({}, currentDetails.envSpecificDetails || {}, {
            buildCommand: 'npm install',
            startCommand: 'npm start'
          })
        })
      }
    };

    console.log('Applying update to service (this may take a moment)...');
    const patch = await fetchJson(`https://api.render.com/v1/services/${serviceId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });

    console.log('Update response:');
    console.log(JSON.stringify(patch, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Render API update error:', err && err.message ? err.message : err);
    process.exit(3);
  }
})();

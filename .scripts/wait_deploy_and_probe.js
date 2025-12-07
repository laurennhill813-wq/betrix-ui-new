const key = process.env.RENDER_API_KEY;
const serviceId = process.argv[2] || 'srv-d4pih78gjchc7383520g';
const probeUrl = process.argv[3] || 'https://betrix-ui-new-latest.onrender.com/health/azure-ai';
if (!key) { console.error('No RENDER_API_KEY in env'); process.exit(2); }

async function getLatestDeploy() {
  const res = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, { headers: { Authorization: `Bearer ${key}` } });
  const arr = await res.json();
  return arr && arr[0] && arr[0].deploy ? arr[0].deploy : null;
}

async function callProbe() {
  try {
    const r = await fetch(probeUrl, { method: 'GET' });
    const text = await r.text();
    console.log('PROBE STATUS:', r.status);
    console.log(text);
    return r.status;
  } catch (e) {
    console.error('Probe call error:', e && e.message ? e.message : e);
    return null;
  }
}

(async () => {
  console.log('Waiting for deploy to reach live state (polling every 8s, 15 attempts)...');
  for (let i = 0; i < 15; i++) {
    const d = await getLatestDeploy();
    if (!d) { console.log('No deploy found'); }
    else { console.log(new Date().toISOString(), 'deploy', d.id, 'status=', d.status); }
    if (d && d.status === 'live') {
      console.log('Deploy is live — calling probe now');
      const status = await callProbe();
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, 8000));
  }
  console.error('Timeout waiting for deploy to become live');
  process.exit(3);
})();

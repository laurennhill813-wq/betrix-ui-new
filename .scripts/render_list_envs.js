const key = process.env.RENDER_API_KEY;
const serviceId = process.argv[2] || 'srv-d4qna3ur433s738bjmi0';
if (!key) { console.error('No RENDER_API_KEY in env'); process.exit(2); }
(async () => {
  try {
    const res = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, { headers: { Authorization: `Bearer ${key}` } });
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Render API error:', err && err.message ? err.message : err);
    process.exit(3);
  }
})();

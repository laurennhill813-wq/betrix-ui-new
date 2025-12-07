const url = process.argv[2] || 'https://betrix-ui-new-latest.onrender.com/health/azure-ai';
(async () => {
  try {
    const res = await fetch(url, { method: 'GET' });
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('HEADERS:', Object.fromEntries(res.headers.entries()));
    console.log('BODY:\n', text);
    process.exit(0);
  } catch (err) {
    console.error('ERROR calling probe:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();

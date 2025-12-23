import fetch from 'node-fetch';
const attempt = process.argv[2] || '1';
const payload = {
  update_id: 6000000 + Number(attempt),
  callback_query: {
    id: `post-callback-${attempt}`,
    from: { id: 99999, is_bot: false, first_name: 'Poster' },
    message: { message_id: 500 + Number(attempt), chat: { id: 99999, type: 'private' } },
    data: 'sport:basketball:upcoming',
  },
};
(async () => {
  try {
    const res = await fetch('http://localhost:5000/webhook/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 5000,
    });
    const text = await res.text();
    console.log(JSON.stringify({ status: res.status, body: text }));
    process.exit(0);
  } catch (e) {
    console.error(JSON.stringify({ error: String(e) }));
    process.exit(2);
  }
})();

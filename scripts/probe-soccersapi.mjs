#!/usr/bin/env node
import fetch from 'node-fetch';

const url = 'https://api.soccersapi.com/v2.2/leagues/?user=28Ekz&token=PT0s9YfsZO&t=list';

async function probe() {
  try {
    console.log('Probing SoccersAPI endpoint...');
    const res = await fetch(url);
    console.log(`Status: ${res.status}`);
    const body = await res.json().catch(() => res.text());
    console.log('Response type:', typeof body);
    if (typeof body === 'object') {
      console.log(JSON.stringify(body, null, 2).slice(0, 1000));
    } else {
      console.log(String(body).slice(0, 500));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

probe();

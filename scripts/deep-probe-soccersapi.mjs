#!/usr/bin/env node
import fetch from 'node-fetch';

const url = 'https://api.soccersapi.com/v2.2/leagues/?user=28Ekz&token=PT0s9YfsZO&t=list';

async function probe() {
  try {
    console.log('Probing SoccersAPI endpoint in detail...\n');
    const res = await fetch(url);
    const body = await res.json();
    
    console.log('Response structure:');
    console.log('- Status:', res.status);
    console.log('- Top-level keys:', Object.keys(body).join(', '));
    console.log('- Data is array:', Array.isArray(body.data));
    console.log('- Data length:', body.data?.length || 0);
    
    if (body.data && body.data.length > 0) {
      console.log('\nFirst 5 leagues:');
      body.data.slice(0, 5).forEach((league, i) => {
        console.log(`  ${i+1}. ${league.name} (id=${league.id}, country=${league.country_name})`);
      });
      
      console.log('\nSample league object:');
      console.log(JSON.stringify(body.data[0], null, 2));
      
      // Extract all unique countries
      const countries = [...new Set(body.data.map(l => l.country_name).filter(Boolean))];
      console.log(`\nUnique countries (${countries.length}):`);
      console.log(countries.slice(0, 10).join(', ') + (countries.length > 10 ? '...' : ''));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

probe();

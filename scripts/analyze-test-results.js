import fs from 'fs';
const results = JSON.parse(fs.readFileSync('test-results.json'));

console.log('\n='.repeat(80));
console.log('🎯 WORKING APIS WITH ARRAY DATA (Likely Fixture Sources)');
console.log('='.repeat(80));

const withArrays = results.filter(r => r.success && r.arrayLength !== null && r.arrayLength > 0);

console.log(`Found ${withArrays.length} APIs with array data:\n`);

withArrays.forEach(r => {
  console.log(`• ${r.name}`);
  console.log(`  Host: ${r.host}`);
  console.log(`  Sport: ${r.sport}`);
  console.log(`  Items: ${r.arrayLength}`);
  if (r.firstItem) {
    console.log(`  Sample keys: ${r.firstItem.join(', ')}`);
  }
  console.log();
});

// Success by status code
console.log('\n' + '='.repeat(80));
console.log('📊 WORKING APIS BY RESPONSE CODE');
console.log('='.repeat(80));

const byStatus = {};
results.filter(r => r.success).forEach(r => {
  if (!byStatus[r.status]) byStatus[r.status] = [];
  byStatus[r.status].push(r);
});

Object.entries(byStatus).forEach(([status, apis]) => {
  console.log(`\nStatus ${status}: ${apis.length} APIs`);
  apis.forEach(a => console.log(`  • ${a.name} [${a.sport}]`));
});

// By sport capability
console.log('\n' + '='.repeat(80));
console.log('🏆 SPORT COVERAGE (Working APIs)');
console.log('='.repeat(80));

const workingBysSport = {};
results.filter(r => r.success).forEach(r => {
  if (!workingBysSport[r.sport]) workingBysSport[r.sport] = [];
  workingBysSport[r.sport].push(r.name);
});

Object.entries(workingBysSport).sort((a,b) => b[1].length - a[1].length).forEach(([sport, names]) => {
  console.log(`\n${sport.toUpperCase()} (${names.length} APIs):`);
  names.forEach(n => console.log(`  ✓ ${n}`));
});

// Failure analysis
console.log('\n' + '='.repeat(80));
console.log('⚠️ FAILED APIS (Rate limited or unavailable)');
console.log('='.repeat(80));

const byFailReason = {};
results.filter(r => !r.success).forEach(r => {
  const reason = r.status || r.error || 'unknown';
  if (!byFailReason[reason]) byFailReason[reason] = [];
  byFailReason[reason].push(r.name);
});

Object.entries(byFailReason).forEach(([reason, names]) => {
  console.log(`\n${reason}: ${names.length} APIs`);
  names.forEach(n => console.log(`  ✗ ${n}`));
});

console.log('\n' + '='.repeat(80));
console.log('💡 KEY FINDINGS');
console.log('='.repeat(80));
console.log(`
✓ ${results.filter(r => r.success).length}/${results.length} APIs are working
✓ ${withArrays.length} APIs return array data (fixtures/matches)
✗ ${results.filter(r => r.status === 429).length} APIs are rate-limited (429)
✗ ${results.filter(r => r.status === 502).length} APIs are down (502)

PRIMARY RECOMMENDATIONS:
1. Keep odds.p.rapidapi.com as primary (currently 429, but best for multi-sport)
2. Add SofaScore (sofascore.p.rapidapi.com) for general sports data
3. Add Free LiveScore for real-time soccer
4. Use Sportspage for NFL
5. Sports Information for basketball news (limited fixture data)

NOTE: Many high-quality APIs (BetsAPI2, Odds API main) are rate-limited.
Consider spacing requests or using working alternatives.
`);

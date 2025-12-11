import assert from 'assert';
import persona from '../src/ai/persona.js';

function run() {
  console.log('\n🧪 ai-persona.test.js');
  const p = persona.getSystemPrompt();
  assert(p.includes('Do NOT correct'), 'persona must instruct not to correct typos');
  const short = persona.getSystemPrompt({ short: true });
  assert(short.includes('BETRIX'), 'short persona must mention BETRIX');
  console.log('✅ persona module basic checks passed');
}

// Run immediately when executed as an ES module
run();

export default run;

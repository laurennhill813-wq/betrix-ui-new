// Minimal AI client stub for caption generation.
// Replace with real LLM calls (OpenAI / Anthropic / Azure) when API keys are available.
export async function generateCaption(postContext = {}) {
  const { league, teams, status, score, provider } = postContext || {};
  const teamsText = teams && teams.home && teams.away ? `${teams.home} vs ${teams.away}` : '';
  const scoreText = score && typeof score.home === 'number' && typeof score.away === 'number' ? `${score.home}-${score.away}` : '';
  const simple = [];
  if (status === 'live') simple.push('Live action — keep an eye on the momentum.');
  else if (status === 'prematch') simple.push(`Preview: ${teamsText}`);
  else if (status === 'final') simple.push(`Final: ${teamsText} ${scoreText}`);
  else simple.push(teamsText || `Update from ${provider || 'provider'}`);

  simple.push('#BETRIX');
  simple.push('Powered by BETRIX');

  return simple.join('\n');
}

export default { generateCaption };

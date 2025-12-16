import { fetchSportradarEventAssets } from './providers/sportradarImages.js';
import { fetchApEventAssets } from './providers/apImages.js';
import { fetchReutersEventAssets } from './providers/reutersImages.js';
import signerClient from './services/signerClient.js';
import imageFetcher from './services/imageFetcher.js';
import telegramUploader from './telegramUploader.js';
import aiClient from './services/aiClient.js';

// Minimal provider router - extendable
const providers = {
  sportradar: fetchSportradarEventAssets,
  ap: fetchApEventAssets,
  reuters: fetchReutersEventAssets,
};

// Runs the full pipeline for a provider/eventId
export async function runPipeline(providerName, eventId, caption = '') {
  const provider = providers[providerName];
  if (!provider) throw new Error(`Unknown provider: ${providerName}`);

  const { bestUrl } = await provider(eventId);
  if (!bestUrl) throw new Error('No bestUrl returned from provider');

  // Request signed URL
  const signed = await signerClient.signUrl(bestUrl);
  const signedUrl = (typeof signed === 'string') ? signed : (signed && signed.signedUrl) ? signed.signedUrl : null;
  if (!signedUrl) throw new Error('Signer did not return a signedUrl');

  // Download to temp file
  const filePath = await imageFetcher.downloadToTempFile(signedUrl, providerName);

  // Upload to Telegram and cleanup is handled by uploader
  const result = await telegramUploader.sendPhotoToTelegram(filePath, caption);
  return result;
}

// High-level orchestrator: pick an image via provider, generate AI caption, post to Telegram
export async function postBestImageWithAI(providerName, eventId, mode = 'live') {
  const provider = providers[providerName];
  if (!provider) throw new Error(`Unknown provider: ${providerName}`);

  const { bestUrl, raw } = await provider(eventId);
  if (!bestUrl) throw new Error('No bestUrl returned from provider');

  // Minimal postContext build; adapters may expand this with richer data
  const postContext = {
    provider: providerName,
    league: raw && raw.league || undefined,
    eventId,
    teams: raw && raw.teams || undefined,
    score: raw && raw.score || undefined,
    status: mode,
    imageMeta: raw,
  };

  const caption = await aiClient.generateCaption(postContext).catch(() => 'Powered by BETRIX');
  return await runPipeline(providerName, eventId, caption);
}

export default { runPipeline };

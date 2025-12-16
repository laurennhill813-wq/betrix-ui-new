import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import fetch from 'node-fetch';

const TEMP_DIR = process.env.IMAGE_TEMP_DIR ? path.resolve(process.env.IMAGE_TEMP_DIR) : path.join(os.tmpdir(), 'betrix_images');

async function ensureTempDir() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

export async function downloadToTempFile(url, label = 'asset') {
  if (!url) throw new Error('downloadToTempFile called with empty URL');
  await ensureTempDir();
  const ext = (new URL(url).pathname.split('.').pop() || 'jpg').split('?')[0] || 'jpg';
  const filename = `${label}-${Date.now()}.${ext}`;
  const filePath = path.join(TEMP_DIR, filename);

  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to fetch URL ${res.status}: ${txt.slice ? txt.slice(0,200) : txt}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(arrayBuffer));
  return filePath;
}

export default { downloadToTempFile };

import { jest } from '@jest/globals';
import { selectBestSportradarAsset } from '../src/media/imageSelector.js';

describe('Sportradar signing pipeline', () => {
  test('always selects original.jpg and calls signer', async () => {
    // Mock the signer module dynamically for ESM compatibility
    const mock = {
      signUrl: jest.fn().mockResolvedValue({ signedUrl: 'http://localhost:8081/_signer_local/test.jpg' })
    };
    await jest.unstable_mockModule('../src/services/signerClient.js', () => mock);
    const { signUrl } = await import('../src/services/signerClient.js');

    const assets = [
      'https://api.sportradar.com/nfl-images-t3/ap/actionshots/events/2024/10/15/abc123/small.jpg',
      'https://api.sportradar.com/nfl-images-t3/ap/actionshots/events/2024/10/15/abc123/original.jpg'
    ];

    const selected = selectBestSportradarAsset(assets);
    expect(selected).toContain('original.jpg');

    const result = await signUrl(selected);
    expect(result.signedUrl).toMatch(/_signer_local/);
    expect(signUrl).toHaveBeenCalledWith(selected);
  });
});

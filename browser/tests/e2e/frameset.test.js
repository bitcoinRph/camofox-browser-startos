import { createClient } from '../helpers/client.js';
import { getSharedEnv } from './sharedEnv.js';

describe.each([
  ['flat', '/frameset'],
  ['nested', '/frameset-nested'],
])('%s frameset', (label, path) => {
  test('local frameset exposes both child frames and resolves a frame link ref', async () => {
    const { serverUrl, testSiteUrl } = getSharedEnv();
    const client = createClient(serverUrl);
    try {
      const { tabId } = await client.createTab(`${testSiteUrl}${path}`);
      const snapshot = await client.getSnapshot(tabId);
      expect(snapshot.snapshot).toContain('Welcome to Page A');
      expect(snapshot.snapshot).toContain('Typing Test Page');
      const link = snapshot.snapshot.match(/link "Go to Page B" \[(e\d+)\]/);
      expect(link).not.toBeNull();
      await client.click(tabId, { ref: link[1] });
      const after = await client.getSnapshot(tabId);
      expect(after.snapshot).toContain('Welcome to Page B');
      expect(after.snapshot).toContain('Typing Test Page');
    } finally {
      await client.cleanup();
    }
  });
});

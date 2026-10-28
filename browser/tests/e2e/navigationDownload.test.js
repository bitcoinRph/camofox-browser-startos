import { createClient } from '../helpers/client.js';
import { getSharedEnv } from './sharedEnv.js';

const pause = () => new Promise(resolve => setTimeout(resolve, 100));

describe.each(['create', 'navigate', 'legacy', 'legacy-open'])('direct attachment %s', route => {
  test('returns a download-start outcome and captures the real attachment', async () => {
    const { serverUrl, testSiteUrl } = getSharedEnv();
    const client = createClient(serverUrl);
    try {
      const url = `${testSiteUrl}/download-file`;
      let tabId;
      let result;
      if (route === 'create') {
        result = await client.createTab(url, { retries: 0 });
        tabId = result.tabId;
      } else if (route === 'legacy-open') {
        result = await client.request('POST', '/tabs/open', { userId: client.userId, url });
        tabId = result.tabId;
        if (tabId) client.tabs.push(tabId);
        expect(result.ok).toBe(true);
      } else {
        ({ tabId } = await client.createTab(`${testSiteUrl}/pageA`));
        result = await client.request('POST', route === 'legacy' ? '/navigate' : `/tabs/${tabId}/navigate`, {
          userId: client.userId, targetId: tabId, url,
        });
      }
      expect(result.downloadStarted).toBe(true);
      if (route !== 'create' && route !== 'legacy-open') expect(result.ok).toBe(true);
      let downloads = [];
      for (let i = 0; i < 50; i++) {
        ({ downloads } = await client.getDownloads(tabId, { includeData: true }));
        if (downloads.length) break;
        await pause();
      }
      expect(downloads).toHaveLength(1);
      expect(downloads[0]).toMatchObject({ suggestedFilename: 'hello.txt', failure: null });
      expect(Buffer.from(downloads[0].dataBase64, 'base64').toString()).toBe('hello from camofox test download\n');
      // A completed download must not mask the next navigation's real failure.
      if (route === 'navigate') {
        await expect(client.navigate(tabId, `${testSiteUrl}/unavailable`)).rejects.toMatchObject({ status: 502 });
      }
      await client.navigate(tabId, `${testSiteUrl}/pageB`);
      expect((await client.getSnapshot(tabId)).snapshot).toContain('Welcome to Page B');
    } finally {
      await client.cleanup();
    }
  });
});

import { createClient } from '../helpers/client.js';
import { getSharedEnv } from './sharedEnv.js';

const invalidUrls = [null, false, true, 0, 123, [], ['https://example.com/'], {}, '', 'not a URL', 'ftp://example.com/'];

test('invalid navigation URLs are HTTP 400 and leave the existing tab usable', async () => {
  const { serverUrl, testSiteUrl } = getSharedEnv();
  const client = createClient(serverUrl);
  try {
    const { tabId } = await client.createTab(`${testSiteUrl}/pageA`);
    for (const url of invalidUrls) {
      for (const path of ['/tabs', `/tabs/${tabId}/navigate`, '/navigate', '/tabs/open']) {
        await expect(client.request('POST', path, {
          userId: client.userId, sessionKey: client.sessionKey, targetId: tabId, url,
        })).rejects.toMatchObject({ status: 400 });
      }
    }
    const tabs = await client.request('GET', `/tabs?userId=${client.userId}`);
    expect(tabs.tabs.map(tab => tab.tabId)).toEqual([tabId]);
    const snapshot = await client.getSnapshot(tabId);
    expect(snapshot.snapshot).toContain('Welcome to Page A');
    await client.navigate(tabId, `${testSiteUrl}/pageB`);
    expect((await client.getSnapshot(tabId)).snapshot).toContain('Welcome to Page B');
  } finally {
    await client.cleanup();
  }
});

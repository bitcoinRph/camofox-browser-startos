import assert from 'node:assert/strict';
import { startServer, stopServer, getServerUrl } from '../tests/helpers/startServer.js';
import { startTestSite, stopTestSite, getTestSiteUrl } from '../tests/helpers/testSite.js';
import { createClient } from '../tests/helpers/client.js';

let client;
try {
  await startTestSite();
  await startServer(0, { CAMOFOX_BIND_HOST: '127.0.0.1', CAMOFOX_CRASH_REPORT_ENABLED: 'false' });
  client = createClient(getServerUrl());
  const { tabId } = await client.createTab(`${getTestSiteUrl()}/pageA`, { retries: 0 });
  assert.ok(tabId);
  assert.match((await client.getSnapshot(tabId)).snapshot, /Welcome to Page A/);
  await client.navigate(tabId, `${getTestSiteUrl()}/pageB`);
  assert.match((await client.getSnapshot(tabId)).snapshot, /Welcome to Page B/);
  const image = Buffer.from(await client.screenshot(tabId));
  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  console.log('Server smoke passed: create, snapshot, navigate, PNG screenshot');
} finally {
  try {
    if (client) await client.cleanup();
  } finally {
    await stopServer();
    await stopTestSite();
  }
}

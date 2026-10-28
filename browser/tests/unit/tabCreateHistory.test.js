import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../server.js', import.meta.url), 'utf8');
const start = source.indexOf("app.post('/tabs',");
const end = source.indexOf('\n});', start) + '\n});'.length;

function routeHarness({ downloadStarted, retry }) {
  const page = { url: () => 'about:blank' };
  const session = { tabGroups: new Map() };
  const group = new Map();
  session.tabGroups.set('group', group);
  const states = [];
  const navigatePage = jest.fn();
  if (retry) navigatePage.mockRejectedValueOnce(new Error('proxy failure'));
  navigatePage.mockResolvedValue(downloadStarted ? { downloadStarted: true } : { status: () => 200 });
  const context = {
    sessions: new Map([['owner', session]]),
    normalizeUserId: id => String(id),
    validateUrl: () => null,
    FLY_MACHINE_ID: '',
    MAX_TABS_PER_SESSION: 10,
    MAX_TABS_GLOBAL: 100,
    getTotalTabCount: () => 0,
    getSession: async () => session,
    createPageWithRecoveryForUser: async () => ({ session, page, lease: {} }),
    createLeasedPage: async () => ({ page, lease: {} }),
    getTabGroup: () => group,
    fly: { makeTabId: () => 'tab' },
    createTabState: () => {
      const state = { page, visitedUrls: new Set(), lastNavigationHttpStatus: null };
      states.push(state);
      return state;
    },
    attachDownloadListener: () => {},
    releasePageLease: () => {},
    attachPopupHandler: () => {},
    refreshActiveTabsGauge: () => {},
    pluginEvents: { emit: jest.fn() },
    log: () => {},
    withTimeout: promise => promise,
    tabCreateRequestTimeoutMs: () => 30000,
    withPageLoadDuration: (name, fn) => fn(),
    navigatePage,
    recordNavSuccess: jest.fn(),
    isProxyError: () => retry,
    proxyPool: { canRotateSessions: true },
    browserRestartsTotal: { labels: () => ({ inc: () => {} }) },
    closeSession: jest.fn(),
    app: { post: (path, handler) => { context.handler = handler; } },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  const res = { json: jest.fn() };
  return { context, res, states, navigatePage };
}

describe.each([false, true])('POST /tabs visited documents (proxy retry: %s)', retry => {
  test('does not record a download URL as a visited document', async () => {
    const { context, res, states, navigatePage } = routeHarness({ downloadStarted: true, retry });
    const url = 'https://example.com/attachment';
    await context.handler({ body: { userId: 'owner', sessionKey: 'group', url } }, res);
    expect(states.at(-1).visitedUrls.has(url)).toBe(false);
    expect(navigatePage).toHaveBeenCalledTimes(retry ? 2 : 1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ tabId: 'tab', downloadStarted: true, httpStatus: null }));
  });

  test('still records a successful document URL', async () => {
    const { context, res, states, navigatePage } = routeHarness({ downloadStarted: false, retry });
    const url = 'https://example.com/document';
    await context.handler({ body: { userId: 'owner', sessionKey: 'group', url } }, res);
    expect(states.at(-1).visitedUrls.has(url)).toBe(true);
    expect(navigatePage).toHaveBeenCalledTimes(retry ? 2 : 1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ tabId: 'tab', httpStatus: 200 }));
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('downloadStarted');
  });
});

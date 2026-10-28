import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../server.js', import.meta.url), 'utf8');

// Exercise the actual route callbacks without launching a browser. The browser
// and session boundaries must never be reached for an invalid raw JSON URL.
function routeHarness(path) {
  const tabState = { toolCalls: 0 };
  const session = { lastAccess: 1 };
  const effects = {
    getSession: jest.fn(() => { throw new Error('unexpected session creation'); }),
    ensureBrowser: jest.fn(),
    findTab: jest.fn(() => ({ tabState, listItemId: 'group' })),
    withUserLimit: jest.fn((userId, fn) => fn()),
  };
  const context = {
    ...effects, URL, AbortController,
    ALLOWED_URL_SCHEMES: ['http:', 'https:'],
    sessions: new Map([['owner', session]]),
    normalizeUserId: id => String(id),
    FLY_MACHINE_ID: '',
    withTimeout: promise => promise,
    tabCreateRequestTimeoutMs: () => 30000,
    navigationRequestTimeoutMs: () => 35000,
    expandMacro: () => 'https://example.com/',
    getSearchFallbacks: () => [],
    log: () => {},
    safeError: err => err.message,
    handleRouteError: (err, req, res) => res.status(err.statusCode || 500).json({ error: err.message }),
    recordNavFailure: () => false,
    tabNotFoundResponse: res => res.status(404).json({ error: 'Tab not found' }),
    app: { post: (path, handler) => { context.handler = handler; } },
  };
  vm.createContext(context);
  const validator = source.slice(source.indexOf('function validateUrl('), source.indexOf('// isLoopbackAddress'));
  const start = source.indexOf(`app.post('${path}'`);
  const end = source.indexOf('\n});', start) + '\n});'.length;
  vm.runInContext(validator + '\n' + source.slice(start, end), context);
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json: jest.fn() };
  return { context, effects, tabState, session, res };
}

const invalidUrls = [null, false, true, 0, 123, [], ['https://example.com/'], {}, { href: 'https://example.com/' }, '', 'not a URL', 'ftp://example.com/'];

describe.each(['/tabs', '/tabs/:tabId/navigate', '/navigate', '/tabs/open'])('%s URL preflight', path => {
  test.each(invalidUrls.map(url => [JSON.stringify(url), url]))('rejects raw JSON URL %s before side effects', async (label, url) => {
    const { context, effects, tabState, session, res } = routeHarness(path);
    const body = JSON.parse(JSON.stringify({ userId: 'owner', sessionKey: 'group', targetId: 'tab', url }));
    await context.handler({ body, params: { tabId: 'tab' } }, res);
    expect(effects.getSession).not.toHaveBeenCalled();
    expect(effects.ensureBrowser).not.toHaveBeenCalled();
    expect(effects.findTab).not.toHaveBeenCalled();
    expect(effects.withUserLimit).not.toHaveBeenCalled();
    expect(tabState.toolCalls).toBe(0);
    expect(session.lastAccess).toBe(1);
    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(String) });
  });
});

test('a valid macro cannot hide a non-string raw URL', async () => {
  const { context, effects, res } = routeHarness('/tabs/:tabId/navigate');
  await context.handler({ body: { userId: 'owner', url: ['https://example.com/'], macro: '@google_search', query: 'test' }, params: { tabId: 'tab' } }, res);
  expect(effects.ensureBrowser).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(400);
});

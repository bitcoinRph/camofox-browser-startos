import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTs, stubsFor } from './helpers/startos.mjs';
import { loadGatewayConfig, validateGatewayConfig } from '../gateway/lib/config.mjs';
import { SessionRegistry } from '../gateway/lib/sessions.mjs';
import { z } from '@start9labs/start-sdk';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

function runtime(browser = {}) {
  const daemons = {};
  const chain = {
    addOneshot() { return this; },
    addDaemon(name, config) { daemons[name] = config; return this; },
    addHealthCheck() { return this; },
  };
  const stubs = stubsFor({
    'startos/sdk.ts': { sdk: {
      setupMain: (fn) => fn,
      SubContainer: { of() {} },
      Mounts: { of: () => ({ mountVolume() {} }) },
      Daemons: { of: () => chain },
    } },
    'startos/fileModels/store.json.ts': { storeJson: {
      read: (fn) => ({ const: async () => fn({ apiKey: 'test', browser, proxy: {}, interactive: {} }) }),
    } },
    'startos/i18n.ts': { i18n: (s) => s },
    'startos/utils.ts': { apiPort: 9377, mcpPort: 9378, novncPort: 6080, checkHttpOk() {} },
  });
  return { main: loadTs('startos/main.ts', stubs).main, daemons };
}

test('StartOS rejects malformed persisted idle settings before daemon configuration', async () => {
  for (const key of ['tabInactivityMinutes', 'mcpSessionIdleMinutes']) {
    for (const value of [null, 0, -1, 1.5, 1441, NaN, Infinity, '30', '30oops', false, [], {}]) {
      const h = runtime({ [key]: value });
      await assert.rejects(h.main({ effects: {} }), /whole number.*1.*1440/);
      assert.deepEqual(h.daemons, {});
    }
  }
});

function actionHarness(browser = {}) {
  const writes = [];
  const sdk = {
    InputSpec: { of: (s) => s },
    Value: Object.fromEntries(['text', 'number', 'toggle'].map((key) => [key, (v) => v])),
    Action: { withInput: (...args) => ({ spec: args[2], prefill: args[3], execute: args[4] }) },
  };
  const stubs = stubsFor({
    'startos/sdk.ts': { sdk },
    'startos/fileModels/store.json.ts': { storeJson: { merge: async (...args) => writes.push(args), read: (fn) => ({ once: async () => fn({ browser }) }) } },
    'startos/i18n.ts': { i18n: (s) => s },
  });
  return { ...loadTs('startos/actions/browserSettings.ts', stubs).browserSettings, writes };
}

test('Browser Settings can open and repair malformed stored idle settings', async () => {
  const h = actionHarness({ tabInactivityMinutes: 'invalid', mcpSessionIdleMinutes: 37, locale: 'en-US', timezone: 'UTC' });
  const prefill = await h.prefill();
  assert.equal(prefill.tabInactivityMinutes, 5);
  assert.equal(prefill.mcpSessionIdleMinutes, 37);
  assert.equal(prefill.locale, 'en-US');
  assert.equal(h.writes.length, 0, 'opening a repair form never silently rewrites the store');
  await h.execute({ effects: {}, input: { ...prefill, tabInactivityMinutes: 23 } });
  assert.equal(h.writes[0][1].browser.tabInactivityMinutes, 23);
});

test('Browser Settings exposes independent tab and MCP defaults and enforces them before writes', async () => {
  const h = actionHarness();
  assert.equal(h.spec.tabInactivityMinutes?.default, 5);
  assert.equal(h.spec.mcpSessionIdleMinutes?.default, 30);
  for (const key of ['tabInactivityMinutes', 'mcpSessionIdleMinutes']) {
    for (const value of [null, 0, -1, 1.5, 1441, '30', false, []]) {
      await assert.rejects(h.execute({ effects: {}, input: { [key]: value } }), /whole number.*1.*1440/);
      assert.equal(h.writes.length, 0);
    }
  }
  await h.execute({ effects: {}, input: { tabInactivityMinutes: 23, mcpSessionIdleMinutes: 37 } });
  const persisted = h.writes[0][1].browser;
  assert.equal(persisted.tabInactivityMinutes, 23);
  assert.equal(persisted.mcpSessionIdleMinutes, 37);
  const r = runtime(persisted);
  await r.main({ effects: {} });
  assert.equal(r.daemons.camofox.exec.env.TAB_INACTIVITY_MS, '1380000');
  assert.equal(r.daemons['mcp-gateway'].exec.env.MCP_SESSION_IDLE_MS, '2220000');
});

test('gateway idle environment values cannot silently fall back or truncate', () => {
  for (const value of ['', '0', '-1', '1.5', '30000oops', 'NaN', 'Infinity', ' 30000 ', '30000\n', '86400001']) {
    const config = loadGatewayConfig({ MCP_AUTH_TOKEN: 'test', MCP_SESSION_IDLE_MS: value });
    assert.ok(validateGatewayConfig(config).some((p) => p.includes('MCP_SESSION_IDLE_MS')), value);
  }
  assert.equal(loadGatewayConfig({}).idleTimeoutMs, 1800000);
  const config = loadGatewayConfig({ MCP_AUTH_TOKEN: 'test', MCP_SESSION_IDLE_MS: '2220000' });
  assert.equal(config.idleTimeoutMs, 2220000);
  assert.deepEqual(validateGatewayConfig(config), []);
});

test('StartOS forwards independent tab and MCP idle timeout settings to their owners', async () => {
  const h = runtime({ sessionTimeoutMinutes: 41, browserIdleTimeoutMinutes: 17, tabInactivityMinutes: 23, mcpSessionIdleMinutes: 37 });
  await h.main({ effects: {} });
  const browserEnv = h.daemons.camofox.exec.env;
  const gatewayEnv = h.daemons['mcp-gateway'].exec.env;
  assert.equal(browserEnv.TAB_INACTIVITY_MS, '1380000');
  assert.equal(gatewayEnv.MCP_SESSION_IDLE_MS, '2220000');
  assert.equal(browserEnv.SESSION_TIMEOUT_MS, '2460000');
  assert.equal(browserEnv.BROWSER_IDLE_TIMEOUT_MS, '1020000');
  assert.equal(browserEnv.MCP_SESSION_IDLE_MS, undefined);
  assert.equal(gatewayEnv.TAB_INACTIVITY_MS, undefined);
});

test('MCP registry expiry respects active requests and the configured idle interval', async () => {
  const closed = [];
  const config = loadGatewayConfig({ MCP_SESSION_IDLE_MS: '2220000' });
  const registry = new SessionRegistry({ idleTimeoutMs: config.idleTimeoutMs, onClose: (entry) => closed.push(entry.id) });
  const entry = { id: 'session', lastSeen: Date.now(), inflight: 0, server: { async close() {} }, transport: { async close() {} } };
  registry.add(entry);
  const end = registry.begin(entry);
  registry.sweep(entry.lastSeen + config.idleTimeoutMs + 1);
  assert.equal(registry.size, 1, 'active POST cannot expire');
  end();
  registry.sweep(entry.lastSeen + config.idleTimeoutMs);
  assert.equal(registry.size, 1);
  registry.sweep(entry.lastSeen + config.idleTimeoutMs + 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(registry.size, 0);
  assert.deepEqual(closed, ['session']);
});

test('pinned upstream parser accepts the forwarded tab timeout without changing other defaults', () => {
  const source = "import { loadConfig } from './tests/fixtures/upstream/config.mjs'; const c = loadConfig(); console.log(JSON.stringify([c.tabInactivityMs, c.sessionTimeoutMs, c.browserIdleTimeoutMs]));";
  const values = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: new URL('..', import.meta.url), env: { TAB_INACTIVITY_MS: '1380000' }, encoding: 'utf8',
  }));
  assert.deepEqual(values, [1380000, 600000, 300000]);
});

test('store schema preserves additive settings and malformed values for runtime rejection', async () => {
  const stubs = {
    ...stubsFor({
      'startos/sdk.ts': { sdk: { volumes: { startos: {} } } },
      'startos/utils.ts': { defaultResolution: '1280x720' },
    }),
    '@start9labs/start-sdk': { z, FileHelper: { json: (_file, schema) => schema } },
  };
  const schema = loadTs('startos/fileModels/store.json.ts', stubs).storeJson;
  for (const value of [23, '30oops', null]) {
    const store = schema.parse(JSON.parse(JSON.stringify({ browser: { tabInactivityMinutes: value, mcpSessionIdleMinutes: value, locale: 'en-US', timezone: 'UTC' }, unrelated: 'retain' })));
    assert.equal(store.browser.tabInactivityMinutes, value);
    assert.equal(store.browser.mcpSessionIdleMinutes, value);
    assert.equal(store.browser.locale, 'en-US');
    assert.equal(store.unrelated, 'retain');
    if (typeof value !== 'number') {
      const h = runtime(store.browser);
      await assert.rejects(h.main({ effects: {} }), /whole number/);
      assert.deepEqual(h.daemons, {});
    }
  }
});

test('shipped timeout instructions distinguish browser sessions, tabs, and MCP expiry', async () => {
  for (const path of ['README.md', 'instructions.md', 'skills/camofox-login-handoff/SKILL.md']) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.match(source, /Tab Inactivity Timeout/, path);
    assert.match(source, /Browser Session Timeout/, path);
    assert.match(source, /MCP Session Idle Timeout/, path);
  }
});

test('existing stores preserve all timeout defaults', async () => {
  const h = runtime();
  await h.main({ effects: {} });
  assert.equal(h.daemons.camofox.exec.env.SESSION_TIMEOUT_MS, '600000');
  assert.equal(h.daemons.camofox.exec.env.BROWSER_IDLE_TIMEOUT_MS, '300000');
  assert.equal(h.daemons.camofox.exec.env.TAB_INACTIVITY_MS, '300000');
  assert.equal(h.daemons['mcp-gateway'].exec.env.MCP_SESSION_IDLE_MS, '1800000');
});

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

process.env.CAMOFOX_CONTRACTS_DIR = fileURLToPath(new URL('./fixtures/upstream/', import.meta.url));
const { createApp } = await import('../gateway/lib/app.mjs');
const { loadGatewayConfig } = await import('../gateway/lib/config.mjs');

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

async function harness(t, stateful, ownsSessionKey = false, protocolVersion = '2025-06-18') {
  const calls = [];
  const upstream = createServer((req, res) => {
    calls.push({ method: req.method, url: req.url });
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'browser unavailable' }));
  });
  const baseUrl = await listen(upstream);
  const config = { ...loadGatewayConfig({ MCP_AUTH_TOKEN: 'test-token' }), baseUrl };
  const { app, registry } = createApp({ config, skills: [], version: 'test', log() {} });
  const server = createServer(app);
  const url = `${await listen(server)}/mcp`;
  t.after(async () => {
    await registry.closeAll();
    await Promise.all([server, upstream].map((s) => new Promise((resolve) => s.close(resolve))));
  });
  const headers = {
    authorization: 'Bearer test-token',
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': protocolVersion,
    'x-camofox-session': 'shared-test',
  };
  if (ownsSessionKey) delete headers['x-camofox-session'];
  async function post(body, raw = false) {
    const res = await fetch(url, { method: 'POST', headers, body: raw ? body : JSON.stringify(body) });
    const text = await res.text();
    const events = text.startsWith('event:') || text.startsWith('data:')
      ? text.split('\n').filter((line) => line.startsWith('data:')).map((line) => JSON.parse(line.slice(5)))
      : undefined;
    const data = events
      ? events.length === 1 ? events[0] : events
      : text ? JSON.parse(text) : undefined;
    return { status: res.status, data, text, headers: res.headers };
  }
  if (stateful) {
    const init = await post({ jsonrpc: '2.0', id: 'init', method: 'initialize', params: {
      protocolVersion, capabilities: {}, clientInfo: { name: 'test', version: '1' },
    } });
    assert.equal(init.data.result.protocolVersion, protocolVersion);
    headers['mcp-session-id'] = init.headers.get('mcp-session-id');
    assert.ok(headers['mcp-session-id']);
    assert.equal((await post({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);
  }
  let dispatches = 0;
  const original = StreamableHTTPServerTransport.prototype.handleRequest;
  StreamableHTTPServerTransport.prototype.handleRequest = function (...args) {
    dispatches++;
    return original.apply(this, args);
  };
  t.after(() => { StreamableHTTPServerTransport.prototype.handleRequest = original; });
  return { post, calls, registry, headers, dispatches: () => dispatches };
}

for (const stateful of [false, true]) {
  const mode = stateful ? 'stateful' : 'stateless';
  test(`${mode}: rejected notification envelopes return HTTP 400 without RPC replies`, async (t) => {
    const h = await harness(t, stateful);
    for (const body of [
      { jsonrpc: '2.0', method: 'notifications/example', params: 'bad' },
      { jsonrpc: '2.0', method: 'example', result: {} },
    ]) {
      const reply = await h.post(body);
      assert.equal(reply.status, 400);
      assert.equal(reply.text, '');
      assert.equal(h.dispatches(), 0);
      assert.equal(h.calls.length, 0);
    }
  });
  test(`${mode}: valid MCP 2025-03-26 batches retain legacy SDK behavior`, async (t) => {
    const h = await harness(t, stateful, false, '2025-03-26');
    if (!stateful) delete h.headers['mcp-protocol-version'];
    const reply = await h.post([{ jsonrpc: '2.0', id: 'legacy', method: 'tools/list' }]);
    const result = Array.isArray(reply.data) ? reply.data[0] : reply.data;
    assert.ok(result?.result?.tools, JSON.stringify(reply.data));
    assert.equal(result.id, 'legacy');
    assert.equal(h.calls.length, 0);
    assert.equal(h.dispatches(), 1);
  });
  test(`${mode}: legacy batches reject unknown tools and schema-invalid arguments without REST dispatch`, async (t) => {
    const h = await harness(t, stateful, false, '2025-03-26');
    if (!stateful) delete h.headers['mcp-protocol-version'];
    const reply = await h.post([
      { jsonrpc: '2.0', id: 'unknown', method: 'tools/call', params: { name: 'no_such_tool' } },
      { jsonrpc: '2.0', id: 'invalid', method: 'tools/call', params: {
        name: 'camofox_snapshot', arguments: { tabId: 'tab-1', offset: '12' },
      } },
    ]);
    assert.equal(reply.status, 200);
    assert.ok(Array.isArray(reply.data), JSON.stringify(reply.data));
    assert.equal(reply.data.length, 2);
    const replies = new Map(reply.data.map((item) => [item.id, item]));
    for (const id of ['unknown', 'invalid']) {
      assert.equal(replies.get(id)?.error?.code, -32602, id);
      assert.equal(replies.get(id)?.result, undefined);
    }
    assert.equal(h.calls.length, 0);
    assert.equal(h.dispatches(), 1, 'legacy batches remain SDK-owned');
  });
  if (stateful) test('negotiated MCP 2025-06-18 does not allow a forged legacy batch header', async (t) => {
    const h = await harness(t, true);
    h.headers['mcp-protocol-version'] = '2025-03-26';
    const reply = await h.post([{ jsonrpc: '2.0', id: 'batch', method: 'tools/list' }]);
    assert.equal(reply.data?.error?.code, -32600);
    assert.equal(h.dispatches(), 0);
    assert.equal(h.calls.length, 0);
  });
  test(`${mode}: malformed JSON is a parse error and valid discovery still works`, async (t) => {
    const h = await harness(t, stateful);
    const invalid = await h.post('{"jsonrpc":', true);
    assert.equal(invalid.data.error.code, -32700);
    assert.equal(invalid.data.id, null);
    assert.equal(h.dispatches(), 0);
    assert.equal(h.calls.length, 0);
    const valid = await h.post({ jsonrpc: '2.0', id: 'list', method: 'tools/list' });
    assert.ok(valid.data.result.tools.some((tool) => tool.name === 'camofox_create_tab'));
    assert.equal(valid.data.id, 'list');
    assert.equal(h.calls.length, 0);
  });
  test(`${mode}: tool notifications never execute tools or produce RPC responses`, async (t) => {
    const h = await harness(t, stateful);
    for (const params of [
      { name: 'camofox_create_tab', arguments: { url: 'https://example.com' } },
      { name: 'camofox_create_tab', arguments: {} },
      { name: 'unknown_tool', arguments: {} },
    ]) {
      const reply = await h.post({ jsonrpc: '2.0', method: 'tools/call', params });
      assert.equal(reply.text, '');
      assert.equal(reply.status, 202);
      assert.equal(h.calls.length, 0);
    }
  });
  test(`${mode}: session lookup errors preserve request IDs and never answer notifications`, async (t) => {
    const h = await harness(t, stateful);
    h.headers['mcp-session-id'] = 'missing-session';
    const reply = await h.post({ jsonrpc: '2.0', id: 0, method: 'tools/list' });
    assert.equal(reply.data.id, 0);
    assert.equal(reply.data.error.code, -32001);
    assert.equal(reply.status, 404);
    const notification = await h.post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    assert.equal(notification.text, '');
    assert.equal(notification.status, 404);
    assert.equal(h.calls.length, 0);
    assert.equal(h.dispatches(), 0);
  });
  test(`${mode}: ambiguous request/response envelopes are invalid requests`, async (t) => {
    const h = await harness(t, stateful);
    for (const extra of [{ result: {} }, { error: { code: -1, message: 'bad' } }]) {
      const reply = await h.post({ jsonrpc: '2.0', id: 'ambiguous', method: 'tools/list', ...extra });
      assert.equal(reply.data?.error?.code, -32600);
      assert.equal(reply.data.id, 'ambiguous');
      assert.equal(h.calls.length, 0);
      assert.equal(h.dispatches(), 0);
    }
  });
  test(`${mode}: unknown tools are typed protocol errors with no REST dispatch`, async (t) => {
    const h = await harness(t, stateful);
    const reply = await h.post({ jsonrpc: '2.0', id: 'unknown', method: 'tools/call', params: { name: 'no_such_tool' } });
    assert.equal(reply.data?.error?.code, -32602);
    assert.equal(reply.data.id, 'unknown');
    assert.equal(h.calls.length, 0);
  });
  test(`${mode}: schema-invalid arguments are typed protocol errors with no REST dispatch`, async (t) => {
    const h = await harness(t, stateful);
    for (const [name, args] of [
      ['camofox_create_tab', {}],
      ['camofox_create_tab', { url: 12 }],
      ['camofox_snapshot', { tabId: 'tab-1', offset: '12' }],
      ['camofox_snapshot', { tabId: 'tab-1', includeScreenshot: 'true' }],
      ['camofox_snapshot', { tabId: 'tab-1', offset: null }],
      ['camofox_extract', { tabId: 'tab-1', schema: '{}' }],
      ['camofox_scroll', { tabId: 'tab-1', direction: 'diagonal' }],
    ]) {
      const reply = await h.post({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name, arguments: args } });
      assert.equal(reply.data?.error?.code, -32602, name);
      assert.equal(reply.data.id, 7);
      assert.equal(h.calls.length, 0);
    }
  });
  test(`${mode}: navigate without URL or macro is InvalidParams without REST dispatch`, async (t) => {
    const h = await harness(t, stateful);
    const reply = await h.post({ jsonrpc: '2.0', id: 'navigate-target', method: 'tools/call', params: {
      name: 'camofox_navigate', arguments: { tabId: 'tab-1' },
    } });
    assert.equal(reply.data?.error?.code, -32602);
    assert.equal(reply.data.id, 'navigate-target');
    assert.equal(reply.data.result, undefined);
    assert.equal(h.calls.length, 0);
  });
  test(`${mode}: select without ref or selector is InvalidParams without REST dispatch`, async (t) => {
    const h = await harness(t, stateful);
    const reply = await h.post({ jsonrpc: '2.0', id: 'select-target', method: 'tools/call', params: {
      name: 'camofox_select', arguments: { tabId: 'tab-1', option: 'value' },
    } });
    assert.equal(reply.data?.error?.code, -32602);
    assert.equal(reply.data.id, 'select-target');
    assert.equal(reply.data.result, undefined);
    assert.equal(h.calls.length, 0);
  });
  test(`${mode}: execution failures remain result.isError after real REST dispatch`, async (t) => {
    const h = await harness(t, stateful);
    for (const [name, args, path] of [
      ['camofox_create_tab', { url: 'https://example.com' }, '/tabs'],
      ['camofox_navigate', { tabId: 'tab-1', url: 'https://example.com' }, '/tabs/tab-1/navigate'],
      ['camofox_navigate', { tabId: 'tab-1', macro: '@google_search', query: 'test' }, '/tabs/tab-1/navigate'],
      ['camofox_select', { tabId: 'tab-1', ref: 'e1', option: 'value' }, '/tabs/tab-1/select'],
      ['camofox_select', { tabId: 'tab-1', selector: 'select', option: 'value' }, '/tabs/tab-1/select'],
    ]) {
      const before = h.calls.length;
      const reply = await h.post({ jsonrpc: '2.0', id: 'execution', method: 'tools/call', params: { name, arguments: args } });
      assert.equal(reply.data.error, undefined);
      assert.equal(reply.data.result.isError, true);
      assert.equal(reply.data.id, 'execution');
      assert.equal(h.calls.length, before + 1);
      assert.equal(h.calls[before].url, path);
    }
  });
  test(`${mode}: malformed tools/call params never reach the SDK or REST`, async (t) => {
    const h = await harness(t, stateful);
    for (const params of [undefined, null, [], 'bad', {}, { name: 9 }, { name: 'camofox_list_tabs', arguments: [] }]) {
      for (const id of [0, '', 'params']) {
        const reply = await h.post({ jsonrpc: '2.0', id, method: 'tools/call', params });
        assert.equal(reply.data?.error?.code, -32602, String(JSON.stringify(params)));
        assert.equal(reply.data.id, id);
        assert.equal(h.calls.length, 0);
        assert.equal(h.dispatches(), 0);
      }
    }
  });
  test(`${mode}: invalid call notifications have no JSON-RPC response`, async (t) => {
    const h = await harness(t, stateful);
    const reply = await h.post({ jsonrpc: '2.0', method: 'tools/call' });
    assert.equal(reply.text, '');
    assert.equal(reply.status, 400);
    assert.equal(h.dispatches(), 0);
    assert.equal(h.calls.length, 0);
  });
  test(`${mode}: invalid envelopes are classified before SDK dispatch`, async (t) => {
    const h = await harness(t, stateful);
    for (const body of [
      { id: 'bad-version', jsonrpc: '1.0', method: 'tools/list' },
      { id: 0, jsonrpc: '2.0', method: 123 },
      { id: false, jsonrpc: '2.0', method: 'tools/list' },
      { id: null, jsonrpc: '2.0', method: 'tools/list' },
      { id: 1.5, jsonrpc: '2.0', method: 'tools/list' },
      [], null, 12, 'message',
    ]) {
      const reply = await h.post(body);
      assert.equal(reply.data?.error?.code, -32600, JSON.stringify(body));
      assert.equal(reply.data.id, typeof body?.id === 'string' || Number.isInteger(body?.id) ? body.id : null);
      assert.equal(h.calls.length, 0);
      assert.equal(h.dispatches(), 0, 'invalid envelope must not reach SDK');
    }
  });
}

for (const ownsSessionKey of [false, true]) {
  test(`MCP expiry ${ownsSessionKey ? 'cleans gateway-owned' : 'preserves explicit'} tab groups`, async (t) => {
    const h = await harness(t, true, ownsSessionKey);
    const sid = h.headers['mcp-session-id'];
    const entry = h.registry.get(sid);
    h.registry.sweep(entry.lastSeen + h.registry.idleTimeoutMs + 1);
    // close() awaits server/transport cleanup before the upstream hook.
    for (let i = 0; i < 30 && h.calls.length < (ownsSessionKey ? 1 : 0); i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(h.registry.size, 0);
    assert.equal(h.calls.length, ownsSessionKey ? 1 : 0);
    if (ownsSessionKey) {
      assert.equal(h.calls[0].method, 'DELETE');
      assert.match(h.calls[0].url, /^\/tabs\/group\/mcp-[a-f0-9]+\?userId=agent$/);
    }
    const expired = await h.post({ jsonrpc: '2.0', id: 'expired', method: 'tools/list' });
    assert.equal(expired.status, 404);
    assert.equal(expired.data.id, 'expired');
  });
}

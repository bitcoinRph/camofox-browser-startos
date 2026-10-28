import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker, request, env, trialForm, submission, base } from './harness.mjs';

test('server verifies a real-shaped token only at siteverify and returns bounded correlated success', async () => {
  assert.equal(typeof createWorker, 'function', 'Worker accepts an offline-only transport seam');
  const calls = [];
  let redirect;
  let form;
  const app = createWorker({ fetch: async (url, options) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(options.method, 'POST');
    redirect = options.redirect;
    assert.ok(options.signal instanceof AbortSignal);
    const body = new URLSearchParams(options.body);
    assert.deepEqual([...body.keys()].sort(), ['response', 'secret']);
    assert.equal(body.get('secret'), env.TURNSTILE_SECRET);
    assert.equal(body.get('response'), 'test-widget-token');
    calls.push(url);
    return Response.json({ success: true, hostname: env.TURNSTILE_HOSTNAME, action: 'botlab', cdata: form.nonce, challenge_ts: new Date().toISOString() });
  }});
  form = await trialForm(app);
  const response = await app.fetch(submission(form), env);
  assert.equal(redirect, 'manual', 'siteverify must use the Workers-supported no-follow mode');
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(await response.json(), { trial: form.trial, verified: true });
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('x-botlab-trial'), form.trial);
});

test('widget document preserves same-origin POST provenance without exposing cross-origin referrers', async () => {
  let nonce;
  let calls = 0;
  const app = createWorker({ fetch: async () => {
    calls++;
    return Response.json({ success: true, hostname: env.TURNSTILE_HOSTNAME, action: 'botlab', cdata: nonce, challenge_ts: new Date().toISOString() });
  }});
  const trial = crypto.randomUUID();
  const path = '/turnstile?trial=' + trial;
  for (const method of ['GET', 'HEAD']) {
    const document = await app.fetch(request(path, { method }), env);
    assert.equal(document.status, 200);
    assert.equal(document.headers.get('referrer-policy'), 'same-origin', method + ': no-referrer can turn a browser form POST Origin into null');
    if (method === 'HEAD') { assert.equal(await document.text(), ''); continue; }
    const html = await document.text();
    const action = html.match(/<form method="post" action="([^"]+)"/)?.[1];
    nonce = html.match(/name="nonce" value="([^"]+)"/)?.[1];
    assert.equal(action, '/turnstile/verify?trial=' + trial);
    assert.ok(nonce);
    const response = await app.fetch(request(action, {
      method: 'POST', headers: { origin: base, referer: base + path, 'sec-fetch-site': 'same-origin', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ nonce, 'cf-turnstile-response': 'test-widget-token' }),
    }), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { trial, verified: true });
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer', 'only the widget document needs the exception');
  }
  assert.equal(calls, 1);
  for (const other of ['/', '/echo', '/diag', '/challenge', '/missing']) {
    assert.equal((await app.fetch(request(other), env)).headers.get('referrer-policy'), 'no-referrer', other);
  }
  assert.equal((await app.fetch(request(path), {})).headers.get('referrer-policy'), 'no-referrer', 'unavailable widget has no exception');
});

test('siteverify transport failures fail closed without exposing upstream bodies or exceptions', async () => {
  const cases = [
    async () => { throw new Error('private-token-and-secret'); },
    async () => { throw new DOMException('private timeout', 'TimeoutError'); },
    async () => new Response('private upstream failure', { status: 500 }),
    async () => new Response('{invalid private json', { headers: { 'content-type': 'application/json' } }),
    async () => new Response('x'.repeat(16385), { headers: { 'content-type': 'application/json' } }),
    async () => Response.json(null),
    async () => Response.json([]),
    async () => new Response('{}', { headers: { 'content-type': 'text/plain' } }),
  ];
  for (const transport of cases) {
    const app = createWorker({ fetch: transport });
    const form = await trialForm(app);
    const response = await app.fetch(submission(form), env);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { trial: form.trial, verified: false });
  }
});

test('siteverify rejects every non-200 Response status including redirects without following Location', async () => {
  let form;
  let status;
  let upstream;
  const calls = [];
  const app = createWorker({ fetch: async (url, options) => {
    calls.push({ url, redirect: options.redirect });
    if (status === 0) return upstream = Response.error();
    const body = [204, 205, 304].includes(status) ? null : JSON.stringify({
      success: true, hostname: env.TURNSTILE_HOSTNAME, action: 'botlab', cdata: form.nonce, challenge_ts: new Date().toISOString(),
    });
    upstream = new Response(body, { status, headers: {
      'content-type': 'application/json',
      location: status % 2 ? 'https://evil.example/private-secret' : 'https://challenges.cloudflare.com/private-secret',
    }});
    return upstream;
  }});
  form = await trialForm(app);
  // Every constructible non-200 HTTP status, plus a Fetch network-error response.
  for (status of [0, ...Array.from({ length: 399 }, (_, i) => i + 201)]) {
    calls.length = 0;
    upstream = undefined;
    const response = await app.fetch(submission(form), env);
    assert.ok(upstream instanceof Response, 'transport must return a response, not throw for ' + status);
    assert.equal(upstream.status, status);
    assert.equal(upstream.bodyUsed, false, 'non-200 bodies are not parsed');
    assert.equal(response.status, 502, 'upstream status ' + status);
    assert.deepEqual(await response.json(), { trial: form.trial, verified: false });
    assert.equal(response.headers.get('location'), null);
    assert.deepEqual(calls, [{ url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify', redirect: 'manual' }], 'no retry or redirect hop for ' + status);
  }
});

test('siteverify accepts only fresh successful hostname action and cData matches and handles replay rejection', async () => {
  let form;
  let override = {};
  const app = createWorker({ fetch: async () => Response.json({ success: true, hostname: env.TURNSTILE_HOSTNAME, action: 'botlab', cdata: form.nonce, challenge_ts: new Date().toISOString(), ...override }) });
  form = await trialForm(app);
  const mutations = [
    { challenge_ts: new Date(Date.now() - 301000).toISOString() },
    { challenge_ts: new Date(Date.now() + 60000).toISOString() },
    { challenge_ts: null }, { challenge_ts: 123 }, { challenge_ts: 'bad' },
    { success: false, 'error-codes': ['timeout-or-duplicate', 'private-error'] },
    { success: 'true' }, { success: 1 }, { success: null },
    { hostname: 'evil.example' }, { hostname: null }, { hostname: env.TURNSTILE_HOSTNAME + '.evil.example' },
    { action: 'different-action' }, { action: null }, { cdata: 'wrong-trial' }, { cdata: null },
  ];
  for (const mutation of mutations) {
    override = mutation;
    const response = await app.fetch(submission(form), env);
    assert.equal(response.status, 403, JSON.stringify(mutation));
    assert.deepEqual(await response.json(), { trial: form.trial, verified: false });
  }
  let count = 0;
  const replay = createWorker({ fetch: async () => Response.json(++count === 1
    ? { success: true, hostname: env.TURNSTILE_HOSTNAME, action: 'botlab', cdata: form.nonce, challenge_ts: new Date().toISOString() }
    : { success: false, 'error-codes': ['timeout-or-duplicate'] }) });
  assert.equal((await replay.fetch(submission(form), env)).status, 200);
  assert.equal((await replay.fetch(submission(form), env)).status, 403);
});

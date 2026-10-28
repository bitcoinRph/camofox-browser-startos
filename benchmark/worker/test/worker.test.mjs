import test from 'node:test';
import assert from 'node:assert/strict';

import { worker, request, base } from './harness.mjs';
const trialPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('control is harmless HTML with fresh trial correlation and security headers', async () => {
  const response = await worker.fetch(request('/'), {});
  assert.equal(response.status, 200, 'control route exists');
  const html = await response.text();
  assert.match(html, /Control/);
  assert.match(response.headers.get('x-botlab-trial'), trialPattern);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.doesNotMatch(html, /<script|<form|<iframe/);
  assert.notEqual(response.headers.get('x-botlab-trial'), (await worker.fetch(request('/'), {})).headers.get('x-botlab-trial'));
});

test('router restricts methods, paths, and malformed trial correlation', async () => {
  assert.equal((await worker.fetch(request('/unknown'), {})).status, 404);
  for (const path of ['/', '/echo', '/diag', '/challenge', '/turnstile']) {
    const response = await worker.fetch(request(path, { method: 'POST' }), {});
    assert.equal(response.status, 405, path);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
  }
  assert.equal((await worker.fetch(request('/turnstile/verify'), {})).status, 405);
  const head = await worker.fetch(request('/', { method: 'HEAD' }), {});
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  for (const suffix of ['?trial=<script>', '?trial=', '?trial=a&trial=b']) {
    assert.equal((await worker.fetch(request('/' + suffix), {})).status, 400);
  }
  const trial = crypto.randomUUID();
  assert.equal((await worker.fetch(request('/?trial=' + trial), {})).headers.get('x-botlab-trial'), trial);
});

test('echo only exposes bounded allowlisted metadata and explicitly absent optional fields', async () => {
  const req = request('/echo?trial=' + crypto.randomUUID(), { headers: {
    'cf-connecting-ip': '198.51.100.1', cookie: 'secret-cookie', authorization: 'Bearer hidden', 'user-agent': 'private-agent',
  }});
  Object.defineProperty(req, 'cf', { value: {
    colo: 'DFW', country: 'US', httpProtocol: 'HTTP/2', tlsVersion: 'TLSv1.3', asn: 13335,
    city: 'private-city', latitude: '1.2', longitude: '3.4', postalCode: 'secret-postcode',
    botManagement: { score: 13, verifiedBot: false, ja3Hash: 'private-hash', detectionIds: [123] },
  }});
  const response = await worker.fetch(req, {});
  assert.match(response.headers.get('content-type'), /application\/json/);
  const data = await response.json();
  assert.deepEqual(data.cf, { colo: 'DFW', country: 'US', httpProtocol: 'HTTP/2', tlsVersion: 'TLSv1.3', asn: 13335, botManagement: { score: 13, verifiedBot: false } });
  assert.equal(data.trial, response.headers.get('x-botlab-trial'));
  const serialized = JSON.stringify(data);
  for (const secret of ['198.51.100.1', 'secret-cookie', 'hidden', 'private-', 'secret-postcode']) assert.ok(!serialized.includes(secret));
  const missing = await (await worker.fetch(request('/echo'), {})).json();
  assert.deepEqual(missing.cf, {});
  assert.equal(missing.botManagementAvailable, false);
  const malformed = request('/echo');
  Object.defineProperty(malformed, 'cf', { value: { colo: 'x'.repeat(10000), asn: -1, country: { secret: true }, botManagement: { score: 100000, verifiedBot: 'true' } } });
  assert.deepEqual((await (await worker.fetch(malformed, {})).json()).cf, {});
});

test('diagnostics execute locally under a nonce CSP without sending fingerprint data', async () => {
  const { runInNewContext } = await import('node:vm');
  const trial = crypto.randomUUID();
  const response = await worker.fetch(request('/diag?trial=' + trial), {});
  const html = await response.text();
  assert.match(html, /Browser diagnostics/);
  const script = html.match(/<script nonce="([^"]+)">([\s\S]*?)<\/script>/);
  assert.ok(script, 'diagnostics include nonce-protected script');
  assert.ok(response.headers.get('content-security-policy').includes("script-src 'nonce-" + script[1] + "'"));
  const out = {};
  runInNewContext(script[2], {
    navigator: { userAgent: 'fake-agent', platform: 'Linux', languages: ['en-US'], webdriver: true, hardwareConcurrency: 4, maxTouchPoints: 0 },
    screen: { width: 1920, height: 1080, colorDepth: 24 }, devicePixelRatio: 1, Intl,
    document: { getElementById: () => out },
  });
  const data = JSON.parse(out.textContent);
  assert.equal(data.trial, trial);
  assert.equal(data.webdriver, true);
  assert.equal(data.userAgent, 'fake-agent');
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|canvas|<script[^>]+src=/);
  assert.match(html, new RegExp('/echo\\?trial=' + trial));
});

test('challenge is a static marker and makes no claim to perform a Cloudflare challenge', async () => {
  const response = await worker.fetch(request('/challenge'), {});
  const html = await response.text();
  assert.match(html, /Challenge target/);
  assert.match(html, /WAF Managed Challenge/);
  assert.match(html, /does not prove/);
  assert.doesNotMatch(html, /<script|<iframe|<form/);
});

test('Turnstile is unavailable without every required binding and never emits a fake widget', async () => {
  const configured = { TURNSTILE_SITEKEY: '0x4AAAA-test-sitekey', TURNSTILE_SECRET: 'test-secret', TRIAL_NONCE_SECRET: 'n'.repeat(32), TURNSTILE_HOSTNAME: 'botlab.example.com' };
  for (const key of Object.keys(configured)) {
    const env = { ...configured }; delete env[key];
    for (const path of ['/turnstile', '/turnstile/verify']) {
      const options = path.endsWith('verify') ? { method: 'POST' } : undefined;
      const response = await worker.fetch(request(path, options), env);
      assert.equal(response.status, 503, key + ':' + path);
      assert.doesNotMatch(await response.text(), /cf-turnstile|api\.js|test-secret/);
    }
  }
  for (const value of ['', ' ', 'x'.repeat(1000), '<script>']) {
    assert.equal((await worker.fetch(request('/turnstile'), { ...configured, TURNSTILE_SITEKEY: value })).status, 503);
  }
});

test('configured Turnstile renders the real widget with an authenticated expiring per-trial cData nonce', async () => {
  const env = { TURNSTILE_SITEKEY: '0x4AAAA-test-sitekey', TURNSTILE_SECRET: 'test-secret', TRIAL_NONCE_SECRET: 'n'.repeat(32), TURNSTILE_HOSTNAME: 'botlab.example.com' };
  const trial = crypto.randomUUID();
  const response = await worker.fetch(request('/turnstile?trial=' + trial), env);
  const html = await response.text();
  assert.match(html, /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  assert.match(html, /class="cf-turnstile"/);
  assert.match(html, /data-sitekey="0x4AAAA-test-sitekey"/);
  assert.match(html, /data-action="botlab"/);
  assert.match(html, new RegExp('action="/turnstile/verify\\?trial=' + trial + '"'));
  assert.match(html, /method="post"/);
  const nonce = html.match(/data-cdata="([^"]+)"/)?.[1];
  assert.ok(nonce, 'real widget cData binds this browser trial');
  const parts = nonce.split('_');
  assert.equal(parts[0], trial);
  assert.ok(Number(parts[1]) > Date.now() / 1000);
  assert.ok(Number(parts[1]) <= Date.now() / 1000 + 601);
  const signature = nonce.slice(trial.length + 1 + parts[1].length + 1);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.TRIAL_NONCE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify('HMAC', key, Buffer.from(signature, 'base64url'), new TextEncoder().encode(trial + '_' + parts[1])));
  assert.match(html, new RegExp('name="nonce" value="' + nonce.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"'));
  assert.doesNotMatch(html, /test-secret|nnnnnnnnnn/);
  const policy = response.headers.get('content-security-policy');
  assert.match(policy, /script-src 'nonce-[^']+' https:\/\/challenges\.cloudflare\.com/);
  assert.match(policy, /frame-src https:\/\/challenges\.cloudflare\.com/);
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval|\*/);
});

export { worker, request, base };

test('all routes and rejection responses retain security headers and HEAD has no body', async () => {
  for (const path of ['/', '/echo', '/diag', '/challenge', '/turnstile', '/missing', '/?trial=invalid']) {
    for (const method of ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']) {
      const response = await worker.fetch(request(path, { method }), {});
      assert.equal(response.headers.get('cache-control'), 'no-store', path);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.match(response.headers.get('strict-transport-security'), /max-age=/);
      assert.match(response.headers.get('permissions-policy'), /camera=\(\)/);
      assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
      assert.equal(response.headers.get('set-cookie'), null);
      assert.match(response.headers.get('x-botlab-trial'), trialPattern);
      if (method === 'HEAD') assert.equal(await response.text(), '');
    }
  }
});

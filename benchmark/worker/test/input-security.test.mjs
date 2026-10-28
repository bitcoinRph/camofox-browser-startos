import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker, env, request, trialForm, submission, base } from './harness.mjs';

function refusingTransport() {
  const calls = [];
  const app = createWorker({ fetch: async (...args) => { calls.push(args); return Response.json({ success: false }); } });
  return { app, calls };
}

test('verification rejects cross-origin and unexpected-host submissions before siteverify', async () => {
  const { app, calls } = refusingTransport();
  const form = await trialForm(app);
  for (const origin of ['https://evil.example', 'https://sibling.example.com', 'null', '', base + '.evil.example', base + '/', base + ':8443', 'http://botlab.example.com', base + ', https://evil.example']) {
    assert.equal((await app.fetch(submission(form, {}, { origin, referer: base + '/turnstile', 'sec-fetch-site': 'same-origin' }), env)).status, 403, origin);
  }
  const noOrigin = submission(form, {}, { referer: base + '/turnstile', 'sec-fetch-site': 'same-origin' }); noOrigin.headers.delete('origin');
  assert.equal((await app.fetch(noOrigin, env)).status, 403);
  const alternate = new Request('https://other.example/turnstile/verify?trial=' + form.trial, submission(form));
  assert.equal((await app.fetch(alternate, env)).status, 403);
  const insecure = new Request('http://botlab.example.com/turnstile/verify?trial=' + form.trial, submission(form, {}, { origin: 'http://botlab.example.com' }));
  assert.equal((await app.fetch(insecure, env)).status, 403);
  assert.equal(calls.length, 0);
});

test('verification bounds actual streamed body bytes rather than trusting Content-Length', async () => {
  const { app, calls } = refusingTransport();
  const form = await trialForm(app);
  const options = { method: 'POST', headers: { origin: base, 'content-type': 'application/x-www-form-urlencoded' } };
  const path = '/turnstile/verify?trial=' + form.trial;
  const huge = request(path, { ...options, body: 'x'.repeat(4097) });
  assert.equal((await app.fetch(huge, env)).status, 413);
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(1024))); },
    cancel() { cancelled = true; },
  });
  const chunked = request(path, { ...options, body: stream, duplex: 'half' });
  assert.equal((await app.fetch(chunked, env)).status, 413);
  assert.equal(cancelled, true);
  const lengthOnly = submission(form, {}, { 'content-length': '5000' });
  assert.equal((await app.fetch(lengthOnly, env)).status, 413);
  const deceptive = request(path, { ...options, headers: { ...options.headers, 'content-length': '1' }, body: 'x'.repeat(5000) });
  assert.equal((await app.fetch(deceptive, env)).status, 413);
  const unreadable = new ReadableStream({ start(c) { c.error(new Error('private body error')); } });
  const bad = request(path, { ...options, body: unreadable, duplex: 'half' });
  assert.equal((await app.fetch(bad, env)).status, 400);
  assert.equal(calls.length, 0);
});

test('verification rejects malformed forms and oversized or empty tokens without outbound calls', async () => {
  const { app, calls } = refusingTransport();
  const form = await trialForm(app);
  assert.equal((await app.fetch(submission(form, {}, { 'content-type': 'application/json' }), env)).status, 415);
  for (const overrides of [{ 'cf-turnstile-response': '' }, { 'cf-turnstile-response': 'x'.repeat(2049) }, { 'cf-turnstile-response': 'bad\nvalue' }, { nonce: '' }]) {
    assert.equal((await app.fetch(submission(form, overrides), env)).status, 400);
  }
  for (const suffix of ['&nonce=duplicate', '&cf-turnstile-response=duplicate', '&extra=ignored']) {
    const req = submission(form);
    const body = await req.text();
    assert.equal((await app.fetch(request(new URL(req.url).pathname + new URL(req.url).search, { method: 'POST', headers: req.headers, body: body + suffix }), env)).status, 400);
  }
  const missingTrial = new Request(base + '/turnstile/verify', submission(form));
  assert.equal((await app.fetch(missingTrial, env)).status, 400);
  assert.equal(calls.length, 0);
});

test('verification authenticates nonce signature expiry and query-trial binding before siteverify', async () => {
  const { app, calls } = refusingTransport();
  const form = await trialForm(app);
  const forged = form.nonce.slice(0, -2) + (form.nonce.at(-2) === 'A' ? 'B' : 'A') + form.nonce.at(-1);
  assert.equal((await app.fetch(submission(form, { nonce: forged }), env)).status, 403);
  assert.equal((await app.fetch(submission({ ...form, trial: crypto.randomUUID() }), env)).status, 403);
  for (const offset of [-60, 3600]) {
    const payload = `${form.trial}_${Math.floor(Date.now() / 1000) + offset}`;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.TRIAL_NONCE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))).toString('base64url');
    assert.equal((await app.fetch(submission(form, { nonce: payload + '_' + signature }), env)).status, 403);
  }
  assert.equal(calls.length, 0);
});

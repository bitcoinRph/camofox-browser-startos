import assert from 'node:assert/strict';

// Never let a missing stub accidentally reach Cloudflare (or any other host).
// No browser, wrangler, npm download, DNS lookup, server, or socket is needed.
export const forbiddenOutbound = [];
globalThis.fetch = async (...args) => {
  forbiddenOutbound.push(args[0]);
  throw new Error('Offline test harness forbids real fetch');
};
let implementation = { default: { fetch: async () => new Response('Not implemented', { status: 501 }) } };
try { implementation = await import('../src/index.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
export const worker = implementation.default;
export const createWorker = implementation.createWorker;
export const base = 'https://botlab.example.com';
export const request = (path = '/', options) => new Request(base + path, options);
export const env = Object.freeze({
  TURNSTILE_SITEKEY: '0x4AAAA-test-sitekey',
  TURNSTILE_SECRET: 'test-secret',
  TRIAL_NONCE_SECRET: 'n'.repeat(32),
  TURNSTILE_HOSTNAME: 'botlab.example.com',
});
export async function trialForm(app = worker) {
  const trial = crypto.randomUUID();
  const html = await (await app.fetch(request('/turnstile?trial=' + trial), env)).text();
  const nonce = html.match(/name="nonce" value="([^"]+)"/)?.[1];
  assert.ok(nonce, 'widget emitted nonce');
  return { trial, nonce };
}
export function submission({ trial, nonce }, overrides = {}, headers = {}) {
  return request('/turnstile/verify?trial=' + trial, {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams({ nonce, 'cf-turnstile-response': 'test-widget-token', ...overrides }),
  });
}

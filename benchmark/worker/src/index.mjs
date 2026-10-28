const TRIAL = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function respond(body, status, trial, type = 'text/html; charset=utf-8', policy = '') {
  return new Response(body, { status, headers: {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Content-Security-Policy': `default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; ${policy}`,
    'X-Botlab-Trial': trial,
  }});
}
function page(title, content) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body><h1>${title}</h1>${content}</body></html>`;
}
async function nonceKey(secret, usage) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}
async function issueNonce(trial, secret) {
  const payload = `${trial}_${Math.floor(Date.now() / 1000) + 600}`;
  const signature = await crypto.subtle.sign('HMAC', await nonceKey(secret, 'sign'), new TextEncoder().encode(payload));
  const encoded = btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return `${payload}_${encoded}`;
}
async function readBounded(body, limit) {
  const reader = body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw Object.assign(new Error('Body limit exceeded'), { status: 413 });
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
async function verifyNonce(nonce, trial, secret) {
  const match = /^([0-9a-f-]{36})_([0-9]{10})_([A-Za-z0-9_-]{43})$/.exec(nonce);
  const now = Math.floor(Date.now() / 1000);
  if (!match || match[1] !== trial || +match[2] <= now || +match[2] > now + 600) return false;
  const signature = Uint8Array.from(atob(match[3].replaceAll('-', '+').replaceAll('_', '/') + '='), c => c.charCodeAt(0));
  return crypto.subtle.verify('HMAC', await nonceKey(secret, 'verify'), signature, new TextEncoder().encode(`${trial}_${match[2]}`));
}
export function createWorker({ fetch: outbound = (...args) => globalThis.fetch(...args) } = {}) {
return {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    const supplied = url.searchParams.getAll('trial');
    const trial = supplied.length === 1 && TRIAL.test(supplied[0]) ? supplied[0] : crypto.randomUUID();
    const finish = (body, status = 200, type, policy) => respond(request.method === 'HEAD' ? null : body, status, trial, type, policy);
    if (supplied.length && (supplied.length !== 1 || !TRIAL.test(supplied[0]))) return finish('Invalid trial', 400);
    const routes = ['/', '/echo', '/diag', '/challenge', '/turnstile', '/turnstile/verify'];
    if (!routes.includes(url.pathname)) return finish('Not found', 404);
    const allowed = url.pathname === '/turnstile/verify' ? ['POST'] : ['GET', 'HEAD'];
    if (!allowed.includes(request.method)) {
      const response = finish('Method not allowed', 405);
      response.headers.set('Allow', allowed.join(', '));
      return response;
    }
    if (url.pathname.startsWith('/turnstile')) {
      const configured = typeof env.TURNSTILE_SITEKEY === 'string' && /^[A-Za-z0-9_-]{10,100}$/.test(env.TURNSTILE_SITEKEY)
        && typeof env.TURNSTILE_SECRET === 'string' && /^[A-Za-z0-9_-]{10,256}$/.test(env.TURNSTILE_SECRET)
        && typeof env.TRIAL_NONCE_SECRET === 'string' && env.TRIAL_NONCE_SECRET.length >= 32 && env.TRIAL_NONCE_SECRET.length <= 256
        && typeof env.TURNSTILE_HOSTNAME === 'string' && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(env.TURNSTILE_HOSTNAME);
      if (!configured) return finish('Turnstile unavailable: required configuration absent or invalid', 503);
      if (url.pathname === '/turnstile') {
        const nonce = await issueNonce(trial, env.TRIAL_NONCE_SECRET);
        // Turnstile's vendor-managed api.js changes in place; a fixed SRI hash
        // would disable updates. Only the exact HTTPS vendor origin is allowed.
        const scriptNonce = crypto.randomUUID();
        // Keep same-origin form POST Origin intact; disclose no cross-origin referrer.
        const response = finish(page('Turnstile', `<p>This real widget contacts Cloudflare. Tokens are verified server-side, not logged or persisted.</p><p>Trial: ${trial}</p><form method="post" action="/turnstile/verify?trial=${trial}"><input type="hidden" name="nonce" value="${nonce}"><div class="cf-turnstile" data-sitekey="${env.TURNSTILE_SITEKEY}" data-action="botlab" data-cdata="${nonce}"></div><button type="submit">Verify trial</button></form><script nonce="${scriptNonce}" src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`), 200, undefined, `script-src 'nonce-${scriptNonce}' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com;`);
        response.headers.set('Referrer-Policy', 'same-origin');
        return response;
      }
    }
    if (url.pathname === '/turnstile/verify') {
      if (url.protocol !== 'https:' || url.hostname !== env.TURNSTILE_HOSTNAME || request.headers.get('origin') !== url.origin) return finish('Forbidden origin', 403);
      if (supplied.length !== 1) return finish('Trial required', 400);
      if (!/^application\/x-www-form-urlencoded(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') || '')) return finish('Unsupported media type', 415);
      const length = request.headers.get('content-length');
      if (length !== null && !/^[0-9]+$/.test(length)) return finish('Invalid length', 400);
      if (length !== null && Number(length) > 4096) return finish('Body too large', 413);
      let form;
      try { form = new URLSearchParams(await readBounded(request.body, 4096)); }
      catch (error) { return finish('Invalid body', error.status === 413 ? 413 : 400); }
      if (Array.from(form.keys()).length !== 2 || form.getAll('nonce').length !== 1 || form.getAll('cf-turnstile-response').length !== 1) return finish('Invalid fields', 400);
      const token = form.get('cf-turnstile-response');
      const nonce = form.get('nonce');
      if (!token || token.length > 2048 || !/^[\x21-\x7e]+$/.test(token) || !nonce || nonce.length > 160) return finish('Invalid fields', 400);
      if (!await verifyNonce(nonce, trial, env.TRIAL_NONCE_SECRET)) return finish('Invalid nonce', 403);
      try {
        // One fixed-origin subrequest, no client IP, cookies, nonce, or headers.
        // Workers supports manual, not error; the exact-200 check rejects all 3xx.
        const upstream = await outbound('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(5000),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token }),
        });
        if (upstream.status !== 200 || !/^application\/json(?:\s*;|$)/i.test(upstream.headers.get('content-type') || '')) throw new Error('Invalid upstream');
        const result = JSON.parse(await readBounded(upstream.body, 16384));
        if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid upstream');
        const timestamp = typeof result.challenge_ts === 'string' ? Date.parse(result.challenge_ts) : NaN;
        const age = Date.now() - timestamp;
        const verified = result.success === true && result.hostname === env.TURNSTILE_HOSTNAME
          && result.action === 'botlab' && result.cdata === nonce && Number.isFinite(age) && age >= -30000 && age <= 300000;
        return finish(JSON.stringify({ trial, verified }), verified ? 200 : 403, 'application/json; charset=utf-8');
      } catch {
        // Never echo tokens, secrets, upstream error strings, or stack traces.
        return finish(JSON.stringify({ trial, verified: false }), 502, 'application/json; charset=utf-8');
      }
    }
    if (url.pathname === '/echo') {
      const raw = request.cf || {};
      const cf = {};
      for (const key of ['colo', 'country', 'httpProtocol', 'tlsVersion']) {
        if (typeof raw[key] === 'string' && /^[A-Za-z0-9./_-]{1,32}$/.test(raw[key])) cf[key] = raw[key];
      }
      if (Number.isSafeInteger(raw.asn) && raw.asn > 0 && raw.asn <= 4294967295) cf.asn = raw.asn;
      const bot = {};
      if (Number.isInteger(raw.botManagement?.score) && raw.botManagement.score >= 1 && raw.botManagement.score <= 99) bot.score = raw.botManagement.score;
      if (typeof raw.botManagement?.verifiedBot === 'boolean') bot.verifiedBot = raw.botManagement.verifiedBot;
      if (Object.keys(bot).length) cf.botManagement = bot;
      return finish(JSON.stringify({ trial, cf, botManagementAvailable: !!cf.botManagement }), 200, 'application/json; charset=utf-8');
    }
    if (url.pathname === '/diag') {
      const nonce = crypto.randomUUID();
      const script = `const limit = (value, max = 256) => typeof value === 'string' ? value.slice(0, max) : null;
const number = value => Number.isFinite(value) && value >= 0 && value <= 100000 ? value : null;
document.getElementById('diagnostics').textContent = JSON.stringify({
  trial: '${trial}', userAgent: limit(navigator.userAgent), platform: limit(navigator.platform),
  languages: Array.from(navigator.languages || []).slice(0, 8).map(v => limit(v, 32)),
  webdriver: typeof navigator.webdriver === 'boolean' ? navigator.webdriver : null,
  hardwareConcurrency: number(navigator.hardwareConcurrency), maxTouchPoints: number(navigator.maxTouchPoints),
  screen: { width: number(screen.width), height: number(screen.height), colorDepth: number(screen.colorDepth) },
  devicePixelRatio: number(globalThis.devicePixelRatio), timeZone: limit(Intl.DateTimeFormat().resolvedOptions().timeZone, 64)
}, null, 2);`;
      return finish(page('Browser diagnostics', `<p>Local display only. No fingerprint is submitted or persisted. No graphics, fonts, plugins, or device enumeration.</p><p>Trial: ${trial}</p><p><a href="/echo?trial=${trial}">Edge metadata for this trial</a></p><pre id="diagnostics">JavaScript not executed</pre><script nonce="${nonce}">${script}</script>`), 200, undefined, `script-src 'nonce-${nonce}';`);
    }
    if (url.pathname === '/challenge') {
      return finish(page('Challenge target', `<p>Static origin marker for a separately configured, hostname/path-scoped WAF Managed Challenge.</p><p>Seeing this page does not prove a challenge was issued or solved. Check approved edge rule readback and browser evidence.</p><p>Trial: ${trial}</p>`));
    }
    return finish(page('Control', '<p>Harmless botlab control page. No scripts, forms, cookies, or external resources.</p>'));
  },
};
}
export default createWorker();

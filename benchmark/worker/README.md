# Camofox bot-lab Worker fixture

**Offline fixture only. Nothing here authorizes deployment or a Cloudflare change.**
The deployment manifest intentionally has no account, routes, custom domain, or
secrets. Both workers.dev and preview URLs are disabled. `/turnstile` is unavailable
until all required configuration is provided.

## Offline checks

Requires Node 26+ for the network-denying permission sandbox used by the tests;
the full suite and package entry points were verified with **Node v26.12.1**.
The `engines.node` requirement is for the local test sandbox, not the Workers
runtime. Check `node --version` and select an installed Node 26+ on `PATH` before
running either entry point. Older Node releases may run the handler but do not
qualify for offline acceptance: an unknown `process.permission.has('net')` scope
can also return false. The suite checks both the engine and `--allow-net` support
before asserting denial. No packages need to be installed; there are no
dependencies or lockfile.

From the repository root, the canonical Worker suite is:

```sh
node --permission --allow-fs-read=. --test-isolation=none --test worker/test/*.test.mjs
```

Equivalent package entry points:

```sh
npm --prefix worker test
npm --prefix worker run check
```

The harness executes the real module's `fetch` handler with Web `Request`,
`Response`, streams, and Web Crypto. It injects `request.cf` and substitutes only
the siteverify transport. Real `fetch` is forbidden, and Node is not granted
network or child-process permission. The suite checks those permissions without
opening a socket or doing DNS. The diagnostics script is also executed in a
minimal DOM VM, not merely string-matched.

**Not proven offline:** workerd-specific behavior, current Cloudflare plan quotas
or rule entitlement, browser rendering, real widget solvability, TLS, WAF rule
execution/order, public hostname routing, or production CPU consumption. There
are no captured live benchmark results. A successful stubbed siteverify response
is a test fixture, never evidence that Cloudflare accepted a real token.

## Endpoints

| Path | Methods | Behavior |
| --- | --- | --- |
| `/` | GET, HEAD | Static harmless control; no scripts, forms, or external assets. |
| `/echo` | GET, HEAD | JSON allowlist of bounded `request.cf` fields, no inbound header dump. |
| `/diag` | GET, HEAD | Browser fingerprint diagnostics displayed locally, never uploaded or stored. |
| `/challenge` | GET, HEAD | Static marker for an independently approved WAF Managed Challenge. |
| `/turnstile` | GET, HEAD | Real Cloudflare widget, or HTTP 503 when any configuration is missing/invalid. |
| `/turnstile/verify` | POST | Same-origin, bounded form; authenticated trial nonce and server-side siteverify. |

Other paths return 404; wrong methods return 405 with `Allow`. HEAD returns the
same status/security headers without a response body. There is no CORS allowlist,
OPTIONS shortcut, arbitrary proxy, redirect endpoint, storage, or scheduled job.

Every response has `X-Botlab-Trial`: a random UUIDv4, or the exact validated
`?trial=<lowercase-UUIDv4>` supplied by the caller. Supply the same trial on all
paths in one experiment; generate a new UUID per independent trial. Invalid or
duplicate trial parameters fail with 400. JSON includes `trial`; HTML diagnostics,
challenge, and widget display it. This identifier is correlation, **not identity,
authorization, or proof of a challenge**. Do not put PII in trial labels.

### Privacy boundary

`/echo` returns only present, valid `colo`, `country`, `httpProtocol`, `tlsVersion`,
`asn`, and optional `botManagement.score` / `verifiedBot`. Absent metadata is not
fabricated; `botManagementAvailable: false` explicitly covers plans/requests that
lack those fields. This code does not require Bot Management or a paid plan.
Do not interpret missing scores as a pass or a bot score of zero.

It never returns IPs, city, precise location, postal code, request headers,
cookies, auth values, tokens, Ray IDs, JA3/JA4, or detection IDs. Diagnostic browser
fields are UA, platform, up to eight languages, webdriver, hardware concurrency,
touch count, screen dimensions/depth, pixel ratio, and timezone. Strings/numbers
are bounded. No canvas, WebGL, font/plugin probing, device enumeration, persistent
storage, or diagnostic network upload is performed. The echo link is navigation,
not an automatic fingerprint upload.

The Worker has **no application logging** and disables Worker observability in
the baseline manifest. Never enable `wrangler tail`, request-body logging,
analytics bindings, or logging middleware for a real trial. Cloudflare's edge,
Turnstile, browsers, and an operator's proxy may still process IPs, tokens,
cookies, and URLs. The real widget necessarily communicates with Cloudflare.
Application code cannot promise zero provider-side processing or logging. Use
approved isolated browser profiles and redact HARs, screenshots, console/network
captures, or support exports before retaining them.

### Turnstile contract

Required bindings:

- `TURNSTILE_SITEKEY`: actual widget public key; baseline is empty.
- `TURNSTILE_SECRET`: actual widget secret; secret binding only.
- `TRIAL_NONCE_SECRET`: independent high-entropy secret, 32–256 characters;
  secret binding only. Generate outside the repository with an approved tool.
- `TURNSTILE_HOSTNAME`: exact expected hostname, baseline `botlab.example.com`.

No defaults or demo success are substituted. The real script is loaded from
`https://challenges.cloudflare.com/turnstile/v0/api.js`. CSP permits that origin
only on the widget page, with a per-response script nonce and its frame/connect
origins. Vendor-managed script updates prevent fixed SRI pinning.

The form posts `nonce` and `cf-turnstile-response` to
`/turnstile/verify?trial=<uuid>`. The signed HMAC-SHA256 nonce binds the trial and a
10-minute expiry and is sent as widget `cData`; action is `botlab`. A valid nonce
must match the query trial before any outbound call. This stateless nonce is not
single-use; token replay rejection is delegated to siteverify, which is called
on **every** submission. No local success cache or in-memory replay cache is used.

Only the configured widget document (GET/HEAD `/turnstile`) uses
`Referrer-Policy: same-origin`: same-origin native form POSTs retain their Origin,
while requests to the cross-origin widget vendor disclose no Referer. Using
`no-referrer` on this document can make a browser send `Origin: null` for the POST.
All other responses retain `no-referrer`. This is not an origin-check exception:
missing/null/cross-origin Origin still fails, even with a same-origin Referer or
Fetch Metadata header. The offline form test supplies headers explicitly; only
the future real-browser/workerd or edge acceptance can prove browser generation.

Verification requires HTTPS, the configured hostname, exact same-origin Origin,
URL-encoded form data, exactly those two fields, a <=4,096-byte streamed body,
and a nonempty <=2,048-character printable ASCII token. Request headers/IP are
never forwarded. There is one fixed siteverify request containing only `secret`
and `response`, with Workers-compatible `redirect: 'manual'` and a 5-second abort
signal. Every non-200 upstream status, including all 3xx and other 2xx statuses,
fails closed with 502. Location is never followed or relayed; no token/secret is
sent to a redirect target. The upstream JSON body is bounded to 16,384 bytes.

Success requires literal `success: true`, exact hostname/action/cData, and a
challenge timestamp no older than 5 minutes or more than 30 seconds in the
future. Success is `{ "trial": "...", "verified": true }`; rejection is false
with 403. Transport, malformed response, and upstream failures return bounded
false with 502; input errors use 400/403/413/415. Missing configuration is 503.
No exception strings, provider errors, token, secret, or request body are echoed.

### Security and scope

All responses have no-store, nosniff, DENY framing, HSTS, restrictive
Permissions Policy, and CSP (`default-src 'none'`, no base, no ancestors,
same-origin form action). No cookies are set by application code. Edge Managed
Challenge/Turnstile may set their own clearance cookies; do not misattribute them.
Referrer Policy is `no-referrer` except for the configured widget document's
`same-origin` policy described above.

The fixture uses only core Worker Web APIs and one optional external subrequest;
it requires no paid bindings, KV, D1, Durable Objects, Queues, Analytics Engine,
or Bot Management. **Free-plan compatibility is a design target, not a verified
current account entitlement or a promise that quotas cannot be exceeded.**
Check current rules/quota availability before an approved live phase. HMAC,
serialization and body bounds are deliberately small; live CPU accounting remains
unmeasured.

Deployment, exact-target readback, rollback, and teardown gates are in
[`RUNBOOK.md`](RUNBOOK.md). No runbook action has been performed.

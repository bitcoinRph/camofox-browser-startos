# Patch ledger

## Scope and release state

- Wrapper baseline: `3e5a5c33b4c4663cac0afa78e5272f10eae13b7e`.
- Prepared wrapper revision: `1.18.1:2`. This is not an installed release.
- Upstream source reference: `jo-inc/camofox-browser`, tag `v1.18.1`.
- Upstream image: `ghcr.io/jo-inc/camofox-browser:1.18.1`.
- Unchanged index digest: `sha256:cff2c1432b609bde9c9d0b91e5b924dae0799d3c7bc9d468c0bc949325beaf2a`.
- No upstream engine patch is included. No image, package, or live service was built, installed, or restarted for this work.

## Patch records

Each record must state ownership, affected files, reason, tests, upstream disposition, removal criteria, and rollback implications.

### P1-GATEWAY — wrapper-owned

- **Files:** `gateway/lib/app.mjs`, `preflight.mjs`, `tools.mjs`, `args.mjs`.
- **Reason:** The SDK can classify decoded invalid envelopes as parse errors and missing `tools/call` params as internal errors.
- **Behavior:** Preflight rejects malformed envelopes with `-32600` and malformed call params with `-32602`, before SDK dispatch. Invalid JSON remains `-32700`. Valid request IDs, including `0` and `""`, survive. Notifications receive no JSON-RPC response. Rejected notifications return HTTP 400 with an empty body, not 202 Accepted. Batches are invalid under MCP 2025-06-18 and later. Legacy batches use the existing SDK path. Stateful preflight uses the negotiated version, not a caller-overridden protocol header. Headerless stateless calls retain the SDK default version.
- **Tool boundary:** Unknown tools and schema-invalid arguments throw typed `McpError(-32602)`. Schema values are not coerced from strings. Explicit null is invalid when the advertised schema excludes it. Two cross-field rules absent from the schema also throw `McpError(-32602)` before dispatch: navigate needs `url` or `macro`, and select needs `ref` or `selector`. Cookie source selection intentionally remains an execution-level error. Upstream failures and tool business-logic failures remain `result.isError`.
- **Compatibility:** Regression transport negotiation explicitly uses MCP `2025-06-18`. Recheck error contracts before advertising newer protocol behavior. No SDK dependency in the runtime image is replaced.
- **Tests:** `tests/gateway-runtime.test.mjs`. Real HTTP, real SDK, and pinned upstream request builders/dispatcher. A local REST server counts dispatches. Both stateful and stateless modes are covered.
- **Upstream disposition:** Wrapper only. This does not alter upstream REST routes or the stdio adapter.
- **Removal criteria:** Replace only when the pinned SDK and wrapper handlers pass the same boundary tests without the patch.
- **Rollback:** Previous gateway behavior returns. No durable data changes.

### P1-TIMEOUTS — wrapper-owned

- **Files:** Browser Settings action, store schema, `startos/timeoutSettings.ts`, `startos/main.ts`, gateway config, and documentation.
- **Reason:** Browser-session, tab, process, and MCP-session expiry are independent. Raising only browser-session expiry does not prevent tab reaping.
- **Behavior:** Expose `tabInactivityMinutes` and `mcpSessionIdleMinutes`. Forward `TAB_INACTIVITY_MS` to the direct `node server.js` daemon, and `MCP_SESSION_IDLE_MS` only to the gateway. The pinned upstream parser supports the former. No supervisor forwarding patch is needed in this topology.
- **Validation:** Whole numeric minutes, 1–1440, before action persistence and daemon construction. Only absent settings use defaults. Raw new store values remain available for validation rather than silently resetting. The action prefill offers valid defaults for malformed fields without writing them, so the owner can repair an invalid store. Startup and action submission remain strict. Gateway environment validation rejects malformed, truncated, zero, or excessive idle milliseconds.
- **Defaults:** Browser session 10 minutes, tab inactivity 5 minutes, browser process idle 5 minutes, stateful MCP idle 30 minutes. None changed.
- **Tests:** `tests/timeout-settings.test.mjs`, plus owned/explicit tab-group expiry tests in the gateway suite.
- **Upstream disposition:** No engine changes. Active-operation expiry and page leases remain upstream concerns.
- **Removal criteria:** Keep while StartOS manages these settings. Revalidate environment support on every image bump.
- **Rollback:** Optional additive store keys remain. The previous loose schema retains unknown keys, but ignores these settings. Downgrade restores its 5-minute tab and 30-minute MCP defaults.

## Migration and rollback preparation

`startos/versions/previous.ts` preserves `1.18.1:1`. The version graph includes it. The `1.18.1:2` up/down functions do not write profiles, credentials, or settings. Only StartOS data-version metadata changes through the SDK. Tests exercise actual SDK upgrade and downgrade paths.

Before an authorized release, retain the last known-good `.s9pk` and a backup of both volumes. A rollback to `1.18.1:1` requires no settings deletion or profile conversion. New settings survive for a later re-upgrade. Open sessions and tabs are volatile and close during a package restart.

## Upstream-image patch lane — blocked pending verification

Do not change the Docker `FROM` tag or digest to imply engine fixes. A later image change requires:

1. An exact upstream/fork source commit and a reviewed engine patch ledger.
2. Browser-launch, unit, transport, active-operation expiry, and real browser regression evidence.
3. A published image with verified amd64 and arm64 manifests and a measured index digest.
4. A separate wrapper image-pin change and version/migration review.
5. Package build verification, approved installation, fresh runtime probes, and a tested rollback artifact.

No step above is satisfied merely by these wrapper tests. This branch intentionally leaves the image pin unchanged.

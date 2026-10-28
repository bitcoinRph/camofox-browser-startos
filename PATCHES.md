# Patch ledger

## Scope and release state

- Wrapper baseline: `3e5a5c33b4c4663cac0afa78e5272f10eae13b7e`.
- Installed and accepted wrapper revision: `1.18.1:2`.
- Prepared consolidation wrapper revision: `1.18.1:3`.
- Runtime-image source snapshot: commit `ea40b5168a1a652ca097ae36ec0c934bca04d004`, based on upstream `v1.18.1` (`39c82094013480b373df6600d44c7f036f58356e`). The `browser/` tree starts from that snapshot and contains additional consolidation-only telemetry and metadata changes not present in the published image.
- Runtime image: `ghcr.io/bitcoinrph/camofox-browser:1.18.1-startos.1`.
- Immutable index digest: `sha256:e545da36937765eaf2480e07e81aeaf97c13589d7531ea77152b723319b0daaf`.
- Image manifests: linux/amd64 `sha256:ff235b2cd9264603c54152b9ed18e25a0496ec860fd9af5a49f2cc171b290824`; linux/arm64 `sha256:d9fc7feed9faae07108f919e2f34cbe4956b549ddcda155f3fc3293e3bf564fc`.
- Hosted browser/MCP/smoke run: `40592434682` passed. Image build run: `40593375805` passed. The OCI index contains per-architecture attestation manifests.

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

`startos/versions/v1_18_1_2.ts` preserves `1.18.1:2`, and `startos/versions/previous.ts` preserves `1.18.1:1`. The version graph includes both entries. The `1.18.1:3` up/down functions do not write profiles, credentials, or settings. Only StartOS data-version metadata changes through the SDK. Tests exercise the exact `1.18.1:2` to `1.18.1:3` upgrade and downgrade paths.

The `1.18.1:3` package keeps `ghcr.io/bitcoinrph/camofox-browser:1.18.1-startos.1` pinned at index digest `sha256:e545da36937765eaf2480e07e81aeaf97c13589d7531ea77152b723319b0daaf`. The additional telemetry-default and repository-consolidation changes in `browser/` are not yet in that runtime image.

Before an authorized release, retain the last known-good `.s9pk` and a backup of both volumes. A rollback from `1.18.1:3` to `1.18.1:2` requires no settings deletion or profile conversion. Open sessions and tabs are volatile and close during a package restart.

## Upstream-image patch lane — verified image and package

The image lane satisfied its pre-package gates:

1. The reviewed browser snapshot is retained under `browser/`; exact provenance is recorded in `docs/SOURCES.md`.
2. Hosted GTK/Xvfb unit, E2E, plugin, MCP, and real-browser smoke tests passed in run `40592434682`.
3. A public amd64/arm64 image was published in run `40593375805`, with the immutable index and architecture digests recorded above.
4. The wrapper pins that exact index and retains reversible `1.18.1:2` migrations.
5. Build run `40596886984` passed for x86_64 and aarch64. The accepted x86_64 artifact has SHA-256 `613f590d02ca444a68157881427bbf3b0e01fde71987f26c89c8cac0d7cae4d0`.
6. The installed package passed 34/34 post-install checks, including authentication, repaired navigation contracts, eight-tab bounded concurrency, MCP invalid-parameter handling, noVNC-disabled state, and restart readiness in 9.423 seconds.

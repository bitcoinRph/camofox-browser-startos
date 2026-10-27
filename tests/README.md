# Wrapper regression tests

## Scope

Canonical suite: `node --test tests/*.test.mjs` (`npm test` is the same command).
Static checks: `npm run check` (TypeScript `--noEmit` and SDK lint). Neither command builds an image or `.s9pk`.

The HTTP suite uses the real Express and MCP SDK transports, pinned upstream REST builders, and a counting local HTTP server. It never launches Firefox or contacts the live service. Tests assert zero upstream REST dispatch for invalid inputs, and zero SDK dispatch for preflight failures. Valid calls reach the local REST server, whose intentional 503 response must remain `result.isError`.

Stateful tests negotiate `2025-06-18`, initialize a real session, and decode SSE responses. Legacy batch controls negotiate `2025-03-26`, and verify that a forged legacy header cannot bypass a newer session contract. Stateless tests use JSON responses. The TypeScript harness executes trusted repository functions with stubbed StartOS effects. It captures daemon configuration and store writes without starting daemons. The version tests use the actual SDK version graph.

## Dependencies

Use the repository lockfile for StartOS SDK and TypeScript. Gateway dependencies come from the upstream runtime image, not this package manifest. For host-side tests, provide these exact upstream `v1.18.1` lockfile versions:

- `express@5.2.1`
- `@modelcontextprotocol/sdk@1.30.0`

A clean host can prepare optional test dependencies after `npm ci`:

```sh
npm install --no-save --ignore-scripts --package-lock=false express@5.2.1 @modelcontextprotocol/sdk@1.30.0
npm test
npm run check
```

These setup commands are instructions only. For this task, existing local dependencies were reused through ignored `node_modules` symlinks. No dependency installation was run. Tests ran with Node `v26.12.1`, TypeScript `6.0.3`, StartOS SDK `3.1.1`, Express `5.2.1`, and MCP SDK `1.30.0`.

## Pinned fixtures

`fixtures/upstream/` contains unmodified files downloaded from `jo-inc/camofox-browser` tag `v1.18.1`. The upstream MIT license is retained. Only filenames changed:

| Local file | Upstream path | SHA256 |
| --- | --- | --- |
| `tool-contracts.mjs` | `mcp/lib/tool-contracts.mjs` | `3177875a9e41eeec147980d45dcc630b00ba5c1e5cd39ca1866ddbd9034f5d5a` |
| `cookies.mjs` | `mcp/lib/cookies.mjs` | `c1ff7bfa6530b5e2053d2df466bfbd9b0644986f5ce3a0a657027ebc2913fe20` |
| `config.mjs` | `lib/config.js` | `f31795b0391febb181c8195e13ab4dde60da383c63f92c0a4b69c23d1d8721bf` |
| `LICENSE` | `LICENSE` | `3b2341f964d5b16d4c53cd8f516b73134944ea28f89d397e2c0167aa5a4b630e` |

The `config.mjs` test executes the upstream parser with only the tab timeout environment value. It verifies independent browser-session and browser-process defaults. Refresh fixtures deliberately when updating the image. Do not replace them with permissive fakes.

## TDD evidence

All behavior changes followed test-first execution. Commands ran from this repository. These are observed results, not a reconstructed acceptance run:

| Slice | RED command | Observed missing behavior | Subsequent GREEN |
| --- | --- | --- | --- |
| Envelope classification, both transports | `node --test tests/gateway-runtime.test.mjs` | 2 failures, SDK returned `-32700` instead of `-32600` | 2 passed, then full suite 7 passed |
| Call params and notifications, both transports | `node --test --test-name-pattern='params\|notifications' tests/gateway-runtime.test.mjs` | 4 failures, missing params returned `-32603`, notification reached SDK | Full suite 11 passed |
| Unknown tools and argument schemas | `node --test --test-name-pattern='unknown tools\|schema-invalid\|execution failures' tests/gateway-runtime.test.mjs` | 4 failures, missing typed errors. Execution controls already passed | Full suite 17 passed |
| Strict argument types | Same focused command after typed-error implementation | 2 remaining failures, string number was dispatched instead of rejected | Full suite 17 passed |
| Timeout forwarding | `node --test tests/timeout-settings.test.mjs` | Forwarded tab environment was absent. Default-preservation control passed | Full suite 19 passed |
| Runtime, action, environment validation | Same timeout command | 3 failures, missing rejection, absent action field, silent environment fallback | Full suite 22 passed |
| Version and rollback preparation | `node --test tests/release-preparation.test.mjs` | 2 failures, revision still `:1`, downgrade was `IMPOSSIBLE`. Image invariant passed | Full suite 25 passed |
| Session-error IDs and notifications | `node --test --test-name-pattern='session lookup\|ambiguous' tests/gateway-runtime.test.mjs` | 2 failures, IDs replaced with null. Ambiguous-envelope controls already passed | Full suite passed after ID-preserving rejection |
| Shipped timeout guidance | `node --test --test-name-pattern='shipped timeout' tests/timeout-settings.test.mjs` | 1 failure, README lacked independent timeout labels | Full suite 39 passed |

The first params run exposed an assertion-message defect (`undefined`). The message was fixed and the same focused set reran RED for the intended failures before production edits. The first static check lacked root `@types/node` resolution. Reusing the existing local type dependencies resolved that setup issue, then real type errors were fixed before acceptance.

Additional existing-contract controls cover valid discovery, syntax errors, non-executing notifications, owned/explicit tab-group expiry, active-request idle protection, and real store-schema preservation. They are not claimed as new failing-first behavior.

## Independent-review repair cycle

A read-only Claude Code review identified three blockers: HTTP 202 on rejected notifications, unconditional batch rejection for legacy clients, and an unopenable repair form for malformed stored timeouts. Before repair, this command ran eight cases: seven failed locally for those mechanisms, while the forged-header rejection control already passed:

```sh
node --test --test-name-pattern='rejected notification|2025-03-26 batches|invalid call notifications|forged legacy|can open and repair' tests/gateway-runtime.test.mjs tests/timeout-settings.test.mjs
```

A separate bounded fix-agent context changed production files only. The same focused command then passed all eight cases. The full suite passed 45 tests and static checks passed. Default-forwarding assertions now require exact environment values without fallback expressions. Rejected notifications retain empty bodies but return HTTP 400. Accepted notifications still return 202. Legacy batches remain SDK-owned, including their existing item-error classification. Single messages and newer-protocol envelopes use wrapper preflight. Repair-form prefill defaults only invalid fields without any persistence. Startup and submit validation still reject malformed values.

## Release boundary

Final local gates: 45 tests passed with zero failures, TypeScript `--noEmit` passed, SDK lint passed, and `git diff --check` passed.

Passing these tests does not prove browser-engine correctness, image contents, package installation, or live-service health. Those remain separate approval and verification gates in `PATCHES.md`.

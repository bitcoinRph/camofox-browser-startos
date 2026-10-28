# Local verification record

Scope: `worker/` only. Initial repository had no commits or application files;
the isolated feature worktree was based on an empty-tree initialization commit.
No baseline test framework or canonical command existed. The source and harness
were built locally without dependencies or external requests.

## Observed test-first checkpoints

The initial focused/full command was `node --test worker/test/*.test.mjs`.
For an absent module, the first test used an empty 501-response handler, ensuring
the failure was the missing route contract rather than import/collection failure.
Each checkpoint below was run and observed before implementing that slice:

| Slice | RED observation | GREEN after implementation |
| --- | --- | --- |
| Harmless control + security headers | 501 rather than 200 | 1/1 tests |
| Routing, method restrictions, trial validation | unknown path returned 200 rather than 404 | 2/2 |
| Privacy-bounded echo | HTML rather than JSON | 3/3 |
| Diagnostic/browser and static challenge pages | both returned control HTML | 5/5 |
| Missing Turnstile bindings fail closed | 200 rather than 503 | 6/6 |
| Genuine widget with signed trial cData | widget script absent | 7/7 |
| Server-side verification transport | handler transport seam absent | 8/8 |
| Origin, streamed byte bounds, form limits, nonce authentication | forbidden requests reached transport; missing 413/415 limits | 12/12 |
| Upstream failures + freshness/result binding | thrown transport error escaped; stale timestamp accepted | 14/14 |
| Unrouted deployment manifest | manifest absent | 17/17 including configuration/privacy/sandbox regression checks |

The sandboxed command replaced the original command as the canonical suite once
its explicit network/child-process denial checks were added:

```sh
node --permission --allow-fs-read=. --test-isolation=none --test worker/test/*.test.mjs
```

Additional existing-behavior regression coverage checks common security headers
and empty HEAD bodies across routes/errors. Initial suite: **18 tests**. Test nonce
expiry fixtures deliberately use comfortably expired/future timestamps to avoid
second-boundary flakiness.

Other checks exercised: package test/check entry points, `node --check`, Python
`tomllib` parsing of the safe manifest, and `git diff --check`.

Optional Node coverage instrumentation could not initialize under the restrictive
filesystem permission model; it exited nonzero despite passing assertions. No
coverage percentage is claimed. The canonical suite (without instrumentation)
was rerun successfully. Coverage files are ignored and are not deliverables.

Independent model review was not invoked: the task forbids external calls and no
local independent reviewer was provided. This is locally verified implementation,
not an independent-review signoff, real-edge validation, or deployment approval.
See README limitations and the separately gated runbook before any live use.

## Runtime-compatibility review follow-up

The follow-up addresses the review blockers without uploading or deploying the
Worker, changing routes/secrets, or sending traffic to a live fixture. Official
Cloudflare runtime/configuration docs and the Fetch Standard were consulted
read-only; all executable fixture verification remains offline.

Observed test-first checkpoints under **Node v26.12.1**:

| Slice | Focused RED observation (exit 1) | GREEN |
| --- | --- | --- |
| Workers-compatible siteverify redirect mode | `server verifies a real-shaped token only at siteverify and returns bounded correlated success`: actual `error`, expected `manual` | Same test and full affected module pass with manual/no-follow mode |
| Widget document's native-POST provenance policy | `widget document preserves same-origin POST provenance without exposing cross-origin referrers`: actual `no-referrer`, expected `same-origin` | Configured GET/HEAD policy, emitted form submission, and default-policy boundaries pass |

Both focused commands used the canonical sandbox flags and
`worker/test/turnstile.test.mjs`, with `--test-name-pattern` respectively set to
`server verifies a real-shaped token` and `widget document preserves`.

Additional regressions exercise every status 201–599 plus a Fetch status-0
network-error Response. All return bounded false/502, never parse the upstream
body or relay Location, and make exactly one fixed siteverify call using manual
redirect mode. Redirect targets cover both vendor-origin and foreign URLs.
Origin negatives now include same-site sibling hosts, missing/null values,
scheme/port differences, malformed/list origins, and misleading same-origin
Referer/Fetch Metadata, with zero outbound calls. The positive form test parses
the actual emitted action/nonce but supplies browser-shaped headers itself;
it does not execute a browser or prove browser-generated headers.

The shell's default Node was **v24.22.1**, not the declared engine. The original
permission assertion could pass there because an unknown `net` permission scope
also returns false. The strengthened sandbox test rejects v24.22.1 (observed
exit 1) and checks both Node 26+ and implemented `--allow-net` support. No engine
requirement was lowered. An already installed v26.12.1 was selected using
`PATH=/usr/local/bin:$PATH`; no runtime/package download was needed.

Final checks, with that Node selected on PATH, from the repository root:

```sh
node --version
node --permission --allow-fs-read=. --test-isolation=none --test worker/test/*.test.mjs
npm --prefix worker test
npm --prefix worker run check
git diff --check
```

The canonical suite and package suite each pass **20 tests**, with no failures,
skips or cancellations. Syntax and whitespace checks pass. The safe manifest is
unchanged. Wrangler, workerd, and real-browser/edge acceptance were **not run**;
the runbook now explicitly requires visible widget render and a real native form
POST with an exact non-null Origin on an approved workerd/edge HTTPS target.
It also distinguishes local vars from deployed bindings, dashboard overwrite and
named-environment behavior, and immediate versus staged secret-version changes.

Official references consulted for this compatibility/configuration follow-up
(re-check against the approved runtime/CLI before any live phase):

```text
https://developers.cloudflare.com/workers/runtime-apis/request/
https://fetch.spec.whatwg.org/#append-a-request-origin-header
https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth
https://developers.cloudflare.com/workers/configuration/secrets/
```

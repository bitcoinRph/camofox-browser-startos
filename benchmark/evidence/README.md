# Verification evidence

These files are captured from real local executions, not a browser study.
Before public import, machine-specific absolute paths were replaced with
`<repo>/benchmark` or `<python>` and owned deployment hostnames were replaced
with reserved example domains. Test outcomes and synthetic measurements were
not changed; see `SANITIZATION.md`.

## v1.2 final readiness/schema/CLI review (current)

- `09-final-tests.txt`: actual canonical full suite, 39 tests, OK, exit 0.
- `09-readiness-red.txt`, `09-binary-red.txt`, `09-calibration-red.txt`,
  `09-schema-red.txt`, `09-arm-identity-red.txt`: captured pre-fix runs for each
  behavior slice. The binary-path positive case initially failed because the CLI
  flag was absent; negative hash/path cases then passed after implementation.
  The arm-ID RED exposes six duplicated IDs collapsing the required path map.
  Logs retain real failures, not reconstructed transcripts; trailing whitespace
  in unittest progress lines was removed for Git hygiene. Tests subsequently
  gained independent CLI regression coverage; historical line numbers can differ.
- `09-focused-green.txt`: earlier 10-test focused checkpoint, superseded by the
  final 39-test full suite (including the subsequent arm-ID-collapse regression).
- `synthetic-v3-pins-stdout.json`: actual demo CLI output for the newly versioned
  v3 synthetic packet; visits and analysis-output schemas are now 1.1, while
  manifest/calibration stay 1.1 and schedule stays 1.0.
- `synthetic-v3-analysis.json` / `synthetic-v3-analysis-cli.json`: canonical API
  and actual CLI bytes. `09-replay-checks.json` records byte equality, repeat CLI
  determinism, verified packet counts/hashes and unchanged older-packet bytes.
- `09-environment.json`: observed runtime/dependency versions and test-file hashes.
- `09-secret-scan.txt`: actual canonical full-tree scanner output; empty, exit 0.

Only dummy local hash fixtures exercise binary-path checks. No browser launch,
new external acquisition or statistical decision rule was added. Checked-in arm
templates remain unchanged and replay-only. Matching bytes are a point-in-time
freeze prerequisite, not persisted runtime provenance or P2 collection authority.

## v1.1 hardening evidence (historical)

- `08-hardening-tests.txt`: current canonical full suite, 28 tests, OK, exit 0.
- `08-detector-hardening-red.txt`: actual pre-fix detector regression run, exit 1;
  demonstrates the old 56-example/90% gate accepting unsafe binary outcomes.
  One unittest progress-line trailing space was trimmed for Git whitespace hygiene;
  test identifiers, failure text and results are unchanged.
- `synthetic-v2-pins-stdout.json`: actual demo CLI output for the new, separately
  versioned `fixtures/synthetic-v2/` packet (manifest/calibration schema 1.1).
- `synthetic-v2-analysis.json` / `synthetic-v2-analysis-cli.json`: API / real CLI
  output; equality verified. 12 fixture targets, 192 visits, 63 synthetic held-out
  snapshots / 126 synthetic ratings, 96 A/A rows; C-A = 0, no browser inference.
- `08-environment.json`: observed runtime/dependency versions, exact test hashes,
  old/new packet pins and verified actual packet counts.
- `08-secret-scan.txt`: current full-tree scanner output (empty, exit 0).

The accepted Opus summary is now supplied and reconciled (DEVIATIONS D006).
Version pins are recorded and frozen, but distribution/binary hashes and hermetic
build verification remain absent. No external/manual evidence was manufactured.
Earlier RED executions for root/placeholder/minimum/A-A hardening were observed
directly in the tool session; no reconstructed RED transcripts are claimed here.
Local verification is not a new independent model-review verdict.

## Historical v1.0 evidence (unchanged files below)

The following describes the original foundation at b1130f1. Its packets and pins
are intentionally preserved; they do not validate the changed v1.1 source tree.

- `01-*` through `07-*`: successive actual RED/GREEN full-suite logs. The canonical
  command was `python -m unittest discover -s tests -p 'test_*.py' -v`. RED logs
  exited 1; GREEN logs exited 0. 07-workflow-red-v2 supersedes the first workflow
  RED after splitting the schedule CLI assertion into an independent test.
- `final-tests.txt`: original foundation final run, **14 tests, OK**; also includes many
  per-outcome, route, mutation and unsafe-input subtests.
- `environment.json`: actual Python/platform/jsonschema version and final test-byte
  SHA-256 inventory. No environment variable values or credentials captured.
- `demo-pins-stdout.json`: actual `python -m bench.demo --output fixtures/synthetic`
  stdout. Exact frozen packet and pins live under fixtures/synthetic/.
- `synthetic-analysis.json`: actual analysis API output for that packet.
- `synthetic-analysis-cli.json`: actual `python -m bench.analysis` stdout using the
  same pins; equality with the API output was verified.
- `local-http-smoke.json`: actual local HTTP observations across twelve routes on
  an ephemeral loopback server. Labels were checked against expected outcomes.
  This is a transport/source-parser test, NOT a browser or engine comparison.
- `secret-scan.txt`: captured scanner output; empty output with exit 0 means no
  matched patterns. The scanner and its limitations are documented in RETENTION.

Observed synthetic packet totals: 12 targets, 192 scheduled primary visits,
56 synthetic heldout snapshots, 112 synthetic ratings, 96 synthetic A/A rows.
All primary arms receive identical synthetic observations. C-A = 0 with [0,0]
synthetic percentile interval is intentional software test data, not real browser
equivalence. `live_readiness` remains false. No human labeling or browser A/A was
performed, and no internet result was synthesized as though it had been measured.

The exact Opus review/approved arm mapping was absent; DEVIATIONS D001 records the
blocker. Browser versions/binaries and toolchain locking remain future gates.
No inherited Git author identity was configured. The requested local checkpoint
uses a nonpersonal offline role identity (`Hermes Agent <hermes@localhost>`) scoped
to the commit command only; no global or repository Git identity is changed.
No remote access or push is performed. Other-task `.worktrees/` remains untouched
and ignored; only this foundation's explicit paths are staged.

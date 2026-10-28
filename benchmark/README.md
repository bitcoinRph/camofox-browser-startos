# Offline Camofox browser benchmark foundation

Licensed under the MIT License; see [`LICENSE`](LICENSE).

P0/P2 only: preregistration contracts and local software, **not a live browser
benchmark**. No external targets, browsing, DNS operations, credentials, Cloudflare
writes or live Camofox calls are included. No package downloads were performed.
The accepted Opus design summary supplied for hardening is reconciled in
[PROTOCOL.md](PROTOCOL.md); unimplemented external/manual gates remain explicit
in [DEVIATIONS.md](DEVIATIONS.md). Local freeze is not P2 collection authorization.

## Quick start

The exercised toolchain is CPython 3.14.9 with locally installed jsonschema 4.26.0.
`requirements.txt` pins the direct dependency; `requirements.lock` pins all five
runtime packages for that interpreter. `.python-version` and `toolchain.json`
record the toolchain and enter each frozen inventory. These are exact version
pins, not verified distribution hashes or a hermetic build. Other Python versions
are not verified by this revision. Do not fetch dependencies in an offline run.
Run from this repository root:

```sh
python -m unittest discover -s tests -p 'test_*.py' -v
python -m bench.hygiene scan .
```

These are the canonical full-suite and secret-scan commands. Tests start ephemeral
loopback servers, make literal 127.0.0.1 HTTP requests, and exercise actual CLI
processes. They never run a browser. Generated test output lives under ignored
`runs/` and is cleaned by each temporary-directory context.

## Checked-in synthetic evidence

`fixtures/synthetic-v3/` contains a new explicitly synthetic frozen packet: twelve owned
target routes, four blocks, four primary arms, 192 planned/recorded visits;
63 synthetic heldout snapshots and 126 synthetic ratings; 96 synthetic A/A rows.
`evidence/synthetic-v3-analysis.json` is actual executable output over that packet.
The original `fixtures/synthetic/` and `fixtures/synthetic-v2/` packets and their
analysis outputs remain unchanged historical evidence; changed code/contracts
intentionally invalidate their replay. No old pins or study identities are recycled.
The current visits and analysis-output versions are 1.1; manifest/calibration
remain 1.1 and schedule remains 1.0. The study identity advances to v3.
The zero C-A difference tests an implementation invariant, **not equivalence of
real browsers**. All arms intentionally receive identical synthetic observations.

Replay the new synthetic packet with its recorded pins (independently review and
retain those pins before treating them as a trust anchor):

```sh
python -m bench.analysis --manifest fixtures/synthetic-v3/manifest.json \
  --manifest-sha256 <manifest-pin-from-fixtures/synthetic-v3/pins.json> \
  --bundle fixtures/synthetic-v3/bundle.json \
  --bundle-sha256 <bundle-pin-from-fixtures/synthetic-v3/pins.json>
```

Replace the angle-bracket placeholders with literal reviewed SHA-256 values.
The independent trust anchor is a reviewed local Git commit, not co-editable JSON.
A concise executable replay that reads the committed pin record is:

```sh
python -c 'import json; from pathlib import Path; from bench.analysis import analyze; p=json.loads(Path("fixtures/synthetic-v3/pins.json").read_text()); print(json.dumps(analyze(Path.cwd(), **p), indent=2))'
```

To create a separate fresh synthetic run (refuses existing output):

```sh
python -m bench.demo --output runs/my-new-demo
```

`--root` must resolve to the executed `bench.contracts.ROOT`; pointing code at a
different copied tree is refused. To replay a copy, run that copy's own modules.
Any frozen code/schema/protocol/template/toolchain change invalidates packets by
design. Preserve old pins and make a new study revision; do not silently regenerate
a reviewed evidence packet and retain its old provenance claim.

## Owned fixture and actual transport observations

In one terminal:

```sh
python -m bench.fixture --port 8765
```

In another:

```sh
python -m bench.local_probe http://127.0.0.1:8765/usable
python -m bench.local_probe http://127.0.0.1:8765/timeout --timeout 0.05
```

Thirteen routes: `/`, `/usable`, `/challenge`, `/captcha`, `/block`, `/error`,
`/large-dom`, `/iframe`, `/frameset`, `/download`, `/popup`, `/upload`, `/timeout`.
Fake challenge pages are static. Popup opens a same-origin page; download is fixed
plain text; upload is a bounded dummy form whose bytes are discarded. Timeout is
a short transport fixture, not a ten-second browser test. The local probe is
labeled `local-http-probe-not-browser`; it cannot be imported as browser evidence.
Stop the fixture with Ctrl-C. Do not expose it publicly or submit real files.

## Freeze an owned-only preregistration and schedule

Create a schema-valid approved local target array and independently record its
raw-file SHA-256. The following commands never navigate to targets:

```sh
python -m bench.schedule --targets <local-targets.json> --targets-sha256 <sha256>
python -m bench.freeze --targets <local-targets.json> --targets-sha256 <sha256> \
  --output runs/my-new-freeze --mode local-fixture-replay
```

Only literal-loopback owned fixture URLs pass. Freeze requires at least twelve
primary target clusters and pins schemas, code, six arm templates, protocols,
copied targets, regenerated schedule and dependency/toolchain files.
`--phase sensitivity` uses A2/C2 separately for calibration/sensitivity.
Real-mode readiness positively requires concrete `engine_version` and
`tool_version` in ALL six arms: dotted numeric identifiers (optional `v` prefix
and alphanumeric prerelease/build suffix), or full lowercase 40/64-hex commit
identifiers. Bare labels such as `pinned-1` and moving aliases are not versions.
UNRESOLVED/TBD/latest/placeholder/unknown tokens anywhere in an arm, or an invalid/
null binary SHA-256, restrict freeze/analysis to `synthetic` or
`local-fixture-replay` (the CLI default). Current templates remain replay-only.

`bench.freeze` also accepts optional repeated `--binary ARM=PATH` arguments
(API: `binary_paths={"A": "/local/path", ...}`). For `local-observation`, they
are REQUIRED for exactly A/B/C/D/A2/C2, including sensitivity/calibration arms.
After metadata validation, freeze streams each regular local file and compares
SHA-256 to that arm's declared digest, before creating output. Missing, duplicate,
unknown, non-file, symlink or mismatching bindings fail with exit 2 and empty
stdout; relative binary paths are based at the executing root. Replay needs no
binary paths, but supplying them opts into the same complete hash check.
No binary is launched or downloaded. This is a point-in-time local prerequisite,
not a persisted runtime attestation or vendor/executable provenance proof; the
trusted tree and supplied paths must not be concurrently modified. Analysis does
not re-read host binary paths or infer that freeze/collection actually occurred.
Binary checks alone never grant P2 approval or `live_readiness`. All checked-in
templates remain non-executable; there is no real browser runner.

The detector gate now requires >=60 held-out snapshots, >=95% usable/nonusable
binary agreement and zero false usable for challenge/CAPTCHA/block. A/A requires
the exact frozen target population and regenerated masked-side/block/pair-order
fields (calibration schema 1.1). Real human independence and actual dispatch are
manual future gates, not facts established by these synthetic fields.

## Layout

- `PROTOCOL.md`, `DEVIATIONS.md`: question, endpoints, sizing, gates and unresolved authority.
- `docs/`: analysis, blinded labeling, safety, retention and reusable offline workflow.
- `schemas/`: strict JSON Schema 2020-12 for manifests, targets, visits, labels,
  owned snapshots, manual ledger, schedule, arm templates, evidence bundle and A/A.
- `templates/arms/{A,B,C,D,A2,C2}.json`: non-executable package templates for the arm roles.
- `bench/`: fixture/probe, detector/validation, calibration, schedule/freeze, evidence,
  hygiene, synthetic packet builder and target-cluster analysis CLI.
- `tests/`: schema, URL, HTTP route, detector, validation, calibration, counterbalance,
  hash/refusal, retention, CLI and target-cluster regression tests.
- `evidence/`: observed RED/GREEN logs, environment/test-hash inventory, analysis and
  actual local HTTP smoke evidence. No fabricated run logs or human ratings.
- `worker/`: offline-tested owned-zone Worker fixture; no deployment is included or implied.
- `worker-reference/README.md`: historical handoff notes retained for provenance.

## What remains deliberately unfulfilled

Pin and verify browser binaries/interfaces and cryptographic runtime provenance;
implement and verify bounded egress-isolated browser adapters in a separate task;
obtain real independent human labels and real A/A; approve any new target population
and schema revision; complete owner P2 freeze before any external collection.
Accepted external design: about 24 eligible third-party targets plus one owned
zone, target-unit Williams blocks, separate A2/C2 calibration; decisions require
C-A >=15pp, adjusted p<.05 and operational reliability >=98%. The reliability
denominator, adjustment/test procedure and external/manual acquisition remain
blocking specifications. Adjusted p-values, reliability gating and winner decisions
are NOT implemented here. Owned claims must be limited to one zone/IP/dates.
No output supports internet anti-bot claims, a winner or production migration.
This component is published as source and synthetic test material only; it does
not authorize collection, Worker deployment, or claims about live sites.

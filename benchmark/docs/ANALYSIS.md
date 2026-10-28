# Executable analysis contract

Authoritative entry point: `python -m bench.analysis`. Both manifest and evidence
bundle pins are mandatory; no unpinned auto-discovery or override flag exists.
Only owned literal-loopback targets are accepted. No network is used by analysis.

## Refusal order

1. Require root to equal the executed contracts.ROOT (after path resolution), then
   validate the independently supplied manifest SHA-256 against raw file bytes.
2. Validate manifest schema; recompute file hashes; require exact complete frozen
   file inventory (protocols, executed code, schemas, six templates, targets/schedule,
   requirements.txt/requirements.lock/.python-version/toolchain.json).
3. Validate every input schema strictly, including types, unknown keys, finite
   numbers and unique target IDs. Reject duplicate JSON object keys, unsafe paths,
   symlinks, hard-linked files and files over ten MB. Relative paths only.
4. Regenerate and compare the complete seeded schedule exactly. Reject wrong
   phase/arm set/baseline, schedule substitutions, or populations below the manifest
   minimum or the independent hard floor of 12 primary targets. Real mode requires
   positively validated concrete engine/tool versions and valid binary digests in
   all six arms; any unresolved/TBD/latest/placeholder token restricts modes to
   synthetic/local-fixture-replay. Refusal precedes loading observations. Freeze
   additionally checks actual supplied local binary bytes before any real-mode
   preregistration; analysis does not attest host execution. No external URLs.
5. Pin the bundle; require its manifest pin and exactly five distinct payloads,
   each hashed, separate from preregistration files. No evidence omissions.
6. Validate heldout labels/snapshot identities (>=60 snapshots, binary agreement
   >=95%, zero false usable challenge/CAPTCHA/block). A/A must bind the exact frozen
   target set, baseline hash, mandatory explicit expected mode and schema-1.1
   seeded masked side/block/pair order.
   Validate both gates; real local observations
   require genuinely human-source labels and local-observation A/A. Identity fields
   are attestations, not proof that a person or browser performed the work.
7. Validate visit/schedule identities, no duplicates/unplanned/mixed-mode rows,
   canonical snapshot hashes, sanitizer identity, recomputed detector outcomes and
   successful duration <= deadline. Manual abort invalidates performance analysis.

The executable does not execute remotely referenced schemas, resolve names, or
fetch missing assets. JSON Schema `$schema` URIs are identifiers, not network calls.
The trusted local root must not be concurrently modified by an adversary; this is
an offline integrity checker, not a hardened hostile-filesystem ingestion service.
Pins protect integrity only if independently retained; an attacker controlling code
execution and all pins controls the analysis. There is no claim of authenticity.

## Estimands and uncertainty

All scheduled visits count. A missing row is a missing failure, never excluded.
Seven observed outcome counts plus missing are retained. Primary success is usable
within ten seconds. Average binary success over repeats for each target/arm; then
average targets equally. Primary difference is C-A in primary phase only.
A2/C2 are a separate calibration/sensitivity phase with no primary inferential contrast.

Report scheduled/observed/missing and outcomes per arm; target count and target
paired differences; usable rates; penalized latency (success actual elapsed,
all nonusable/missing = 10,000 ms); success-only latency explicitly descriptive.
No timing excludes a failure to make a package look faster.

Seeded target-cluster bootstrap, 2,000 resamples in demo (5,000 recommended default
helper), samples target IDs with replacement, reuses all repeats within a sampled
target, paired across arms. A draw averages target differences. The two-sided 95%
percentile interval uses fixed nearest ranks floor(B×.025)-1 and floor(B×.975)-1,
bounded to [0,B-1]. No visit-level resampling. Repeating every visit tenfold must
not change the interval. Targets, not visits, are the effective N.

Only C-A is the preregistered primary contrast. All other contrasts, latency
contrasts and A2/C2 are descriptive/exploratory, unadjusted, not confirmatory
p-values. No multiple-testing winner selection, no superiority declaration from
a synthetic CI. No p-values implemented; no optional stopping. Report sparse
cells, small-N instability and selection bias of an approved target panel.
No internet generalization from owned fixtures or synthetic target IDs.

The accepted external screening decision requires C-A >=15 percentage points,
multiplicity-adjusted p<.05 and operational reliability >=98%. Adjusted hypothesis
tests, reliability metric/denominator and winner-decision gating are NOT implemented
or fully specified in this offline analyzer: they must be frozen and verified
before P2 approval/external collection. A descriptive CI or a >15pp difference here
cannot satisfy that policy. Any later owned-zone claim is scoped to one tested
zone, egress IP and collection dates; the necessary metadata/acquisition are absent.

## Outputs and provenance

Analysis output schema version is 1.1; visits schema is 1.1 (not inherited from
the unchanged schedule schema 1.0). Manifest/calibration remain 1.1. New packets
use the v3 study identity; both older synthetic packets and pins remain unchanged.

JSON on stdout; refusals go to stderr and exit code 2. Report includes both pins,
phase, fixed screening/synthetic scope, gates and limitations. CLI arguments must
supply SHA-256 pins; no report is created on refusal. Redirect stdout only to a new
file and preserve it with the bundle. `live_readiness` is always false.
`bench.demo` creates an exclusively new output directory; never overwrite a run.
`local-fixture-replay` emits LOCAL-FIXTURE-REPLAY-NO-BROWSER-INFERENCE and may use
explicitly synthetic validation fixtures; it never certifies human/browser evidence.

# Screening preregistration — v1.2 (offline P0/P2 foundation)

**State: local software only; P2 external-collection freeze NOT complete.**
No browser runner, external target list, proxy configuration, DNS client, deployment
or Cloudflare credentials are included. Synthetic and local-fixture replay test
software, not browser performance. Loopback HTTP tests do not exercise a browser.

## Authority and stage gates

The accepted Opus design supplied in the hardening delegation governs this revision:
a screening study of about 24 eligible third-party targets plus one owned zone;
A/B/C/D primary arms and separate A2/C2 calibration; target as principal unit;
Williams blocks; held-out detector validation with at least 60 snapshots, >=95%
binary agreement and zero false-usable challenges/blocks; no external collection
until P2 freeze; decision requirements C-A >=15 percentage points, adjusted p<.05
and reliability >=98%. The owned-zone claim is limited to that zone, IP and dates.
This is reconciliation to the supplied design, not an independent statistical
review or evidence that the unimplemented stages have been approved/executed.

P0 fixes the question, scope, target policy, arm roles and evidence contracts.
P2 requires final executable packages, detector/label validation, real A/A, frozen
eligible targets, acquisition/analysis specifications and owner signoff before any
external collection. This repository implements offline portions only. Calling
`bench.freeze` produces a **local preregistration artifact, not the P2 authorization**.
No external target may be selected by probing, resolved, visited or collected by
this build. A future separately authorized revision must implement those stages;
there is no flag here that enables third-party URLs.

## Question and estimand

On the approved frozen target population, does C improve the probability of a
usable task-relevant normalized snapshot within ten seconds over A? The primary
contrast is **C minus A**, an absolute usable-rate difference: average repeated
visits within target, then weight targets equally. The target is the principal
sampling unit, not each repeat. This compares complete engine/interface packages,
not an isolated causal stealth mechanism. Owned-zone diagnostics and third-party
results are separate strata and must not be pooled into a single efficacy claim.

## Arm roles and executable-package status

| ID | Current template | Role |
|---|---|---|
| A | Chromium, normalized snapshot interface | Baseline |
| B | Firefox, same normalized snapshot interface | Engine-family control |
| C | Camofox, same normalized snapshot interface | Primary treatment |
| D | Camofox, intended production wrapper contract | End-to-end interface diagnostic |
| A2 | A, headful template | Separate calibration/sensitivity baseline |
| C2 | C, headful template | Separate calibration/sensitivity treatment |

The six arm roles are retained; the actual versions, adapters, binary hashes,
user agents and launch arguments still require pre-P2 pinning/verification. The
headful A2/C2 template is not an additional primary comparison or an A/A substitute.
A/A uses two masked copies of the same exact baseline package.

Templates fix en-US, UTC, 1280×800, direct egress, fresh ephemeral context per visit,
no persistent cookies/profile, zero retries, no CAPTCHA solving or outcome-changing
manual actions, ten-second wall deadline, 20,000 extracted characters and 5,000 DOM
nodes. No fingerprint randomization, post-freeze user-agent override, login,
extension or proxy rotation. All templates retain `production_ready: false`.

**Enforced readiness boundary:** all six arms must have concrete dotted numeric
engine/tool versions (optional v prefix and prerelease/build suffix), or full
lowercase 40/64-hex commit identifiers, plus valid binary SHA-256 digests. Placeholder
tokens such as UNRESOLVED, TBD, latest, placeholder and unknown are rejected
anywhere in an arm. Otherwise freeze and analysis permit ONLY explicitly
`synthetic` or `local-fixture-replay` modes. Metadata refusal precedes observation
loading / freeze output creation. Current templates are unchanged and replay-only.
For any `local-observation` freeze, supply exactly six `--binary ARM=PATH` bindings
(API `binary_paths` mapping). Freeze reads local regular, non-symlink files and
checks actual SHA-256 bytes against each arm before output creation. Replay may
optionally request the same check; it never runs a binary. Template IDs must match
filenames, so duplicates cannot collapse the six-arm requirement. This is only a
point-in-time host check, not persisted execution/vendor provenance. Analysis
validates frozen metadata, not host binary paths or proof of collection.
Resolving metadata and matching local bytes never grants P2 approval; external
URLs remain schema-forbidden and `live_readiness` remains false. OS/resource
limits, actual interface/browser versions, launch arguments and egress identity
are still manual/external gates.

## Population and screening allocation

Accepted external scope: about **24 eligible third-party targets plus one owned
zone**. Freeze eligibility, permissions, exclusions, site/target clustering and
exact N before external data. No outcome-driven replacement or favorable target
selection. No external targets have been supplied or collected in this repository.
For an exact 24-target panel, four blocks × four primary arms give 384 visits;
a separate four-block A2/C2 calibration/sensitivity phase gives 192 visits. These
illustrations exclude the separate owned zone. This is practical screening, not
a powered confirmatory trial or population-wide bypass-rate estimate.

Current offline tooling requires **at least 12 primary owned fixture target IDs**
(schema plus analysis hard floor, not reducible by a supplied manifest). The demo
uses 12 routes and four blocks of A/B/C/D: 192 visits. Root `/` is a thirteenth GET
fixture route but not another scheduled target. These local IDs are software
cases, NOT evidence of independent third-party target clusters or a substitute for
24 eligible targets. Demo A/A has four pairs per target: 96 synthetic rows. Demo
held-out validation has 63 synthetic snapshots / 126 synthetic ratings (9/class).
None of these are real browser observations or human judgments.

## Scheduling, state and acquisition

`bench.schedule.generate` uses Williams orders for A/B/C/D (0,1,3,2 and cyclic
shifts). Each target receives all four sequences across four blocks with a seeded
offset and shuffled target order per block: every arm occupies every position and
every ordered adjacency once. Two-arm calibration/sensitivity alternates both
orders. Seed 20261027; complete multiples of four primary blocks. The complete
schedule must exactly regenerate from frozen inputs. No post-outcome reordering.

A future runner must record and check actual dispatch order, resource and binary
metadata; a declared planned order is not evidence of dispatch. Run serially with
one browser/context at a time, empty storage per visit, monotonic elapsed time,
one navigation and one bounded snapshot at settled state or deadline. No reload,
retry, solving, alternate URL, warm reuse, manual intervention or fallback tool.
The future browser adapter must enforce same-origin requests/navigation, response
byte limits and bounded frames. Those browser boundaries are NOT implemented.
The loopback timeout fixture delays 350 ms with a 50 ms HTTP test deadline; it does
not emulate or measure the ten-second browser endpoint.

## Outcomes (detector v1.0)

Precedence: timeout → transport/no-response error → explicit CAPTCHA gate → browser
challenge → explicit block → non-2xx error → incomplete/truncated → usable. Success
requires 2xx, >=40 extracted text characters, a relevant usable marker, no
truncation and completion within ten seconds. Frame-only content is incomplete
unless an approved future adapter extracts relevant child content within bounds.
The source parser does not execute scripts or produce a rendered accessibility
tree. Merely discussing CAPTCHA is not a gate. Downloads are not HTML success.
Popup/upload fixture actions are capability diagnostics, not primary visit actions.

Store sanitized schema-valid observations, canonical SHA-256, detector version,
label, scheduled identity, elapsed time and mode. Every scheduled visit remains in
the denominator: missing is failure; nonusable/missing latency is 10,000 ms.
Duplicate/unplanned visits, wrong hashes/labels, mixed modes and outcome-changing
manual actions invalidate analysis. No favorable retry or complete-case estimate.

## Held-out detector gate

Freeze detector rules after development and before opening held-out labels. Require
**>=60 held-out snapshots**, >=8 per seven classes, >=14 target clusters, two
independent blinded agreeing raters per snapshot. Remove arm/version/order from
labeling exports; raters follow docs/LABELING.md, not model/detector predictions.
Targets/sites must be disjoint between development and held-out sets.

Require **>=95% binary agreement (usable vs nonusable)** and **zero false usable
for challenge, CAPTCHA or block truth**. Multiclass agreement, confusion matrix
and per-class recall are reported diagnostically; the superseded >=90% multiclass
and >=75% recall rules are not substitutes for the accepted binary gate. Rater
disagreement halts the packet; preserve original judgments and adjudicate in a
new blinded frozen packet or use a fresh held-out set. Never tune on held-out
failures and reuse that set as held-out. Software enforces splits, counts,
identities and hashes, not genuine human independence; manual attestation remains
unimplemented. Current fixture raters are explicitly synthetic.

## A/A implementation-noise gate

Use the exact frozen baseline, **the exact frozen primary target population** and
exactly four complete pairs per target (>=12 targets). `bench.calibration.generate_plan`
regenerates schema-v1.1 pair IDs, block, internal left/right, opaque masked x/y
assignment and pair order from sorted frozen targets and manifest seed. Mask
assignment is seeded per target; first side alternates each block. Calibration
checks every field, duplicate/missing sides, frozen control hash and exact mode.
`calibrate` requires explicit keyword-only `expected_mode`; no omitted/None bypass.
Do not export the internal side or mask key to raters. The future acquisition/
blinding workflow must attest actual order and isolation; these fields alone do
not prove it occurred. No blinding export or real A/A acquisition is implemented.

Require absolute target-weighted success difference <=.10 and absolute median
paired relative latency difference <=.20 (denominator max(1 ms, left latency)).
Report signed differences and target count. This screens implementation noise,
not statistical equivalence. Failure blocks reporting; investigate, append a
deviation and freeze a fresh revision before repeating. Synthetic A/A tests code.

## Freeze and provenance

Both manifest and evidence-bundle expected SHA-256 pins are mandatory. `--root`
must resolve to **the executed `bench.contracts.ROOT`**, not a separate copied tree
whose files happen to hash correctly. Run the copied tree's own Python modules to
analyze it. Schemas and executed source are bound to the same root.

The preregistration binds this protocol, deviations, analysis/labeling/safety/
retention contracts, code, schemas, six arms, targets, full schedule and dependency/
toolchain pins. `requirements.lock` pins the locally installed runtime closure;
`.python-version`/`toolchain.json` record the exercised interpreter/toolchain.
These are version pins, NOT verified wheel hashes or a hermetic build. Replay
must use already available packages; do not fetch dependencies. Actual browser binary
pins and a fully verified external runtime remain missing; the optional local
byte checker is exercised only with explicitly non-browser hash fixtures.

A separate bundle binds exactly five distinct payloads: visits, held-out snapshots,
labels, manual ledger and A/A. Recompute raw file and snapshot hashes. Retain pins
independently (e.g. a reviewed local commit), not just beside editable data. The
trusted tree must not be concurrently modified by an adversary. New code or
contract bytes invalidate old packets: preserve old pins and freeze a new revision,
never retroactively relabel the original preregistration.

## Accepted decision policy and current implementation limit

An external screening decision requires ALL: **C-A >=15 percentage points**,
**multiplicity-adjusted p<.05**, **operational reliability >=98%**, and all P2,
detector, A/A and safety gates. These are necessary criteria, not permission to
claim universal bypass or auto-deploy. Before P2, specify/freeze the reliability
metric and denominator, multiplicity family/adjustment and test procedure; these
method details were not included in the supplied design summary and are still
blocking. The current analyzer implements target-cluster percentile intervals
and descriptive contrasts only: **no adjusted p-values, operational-reliability
gate or winner decision is implemented**. It therefore cannot establish the
accepted decision criteria, even if a descriptive difference exceeds 15 points.

Owned-zone conclusions must name **the one tested zone, egress IP and collection
dates** and cannot generalize to Cloudflare, other zones/IPs/dates or third-party
anti-bot systems. Zone setup, egress verification, timestamp capture and review
remain external/manual, unimplemented steps. Current loopback replay makes NO
owned-zone browser efficacy claim. No output authorizes migration or publication.

## Safety stops and deviations

Stop on external request, login prompt, unexpected origin, real upload content,
secret, abuse/rate-limit feedback, intervention, infrastructure mismatch or broken
integrity/validation/calibration. No CAPTCHA solving/access-control evasion. No
early stopping for superiority or adding targets/repeats after outcomes. Record
all cancellations/unattempted visits. Deviations are append-only, linked to old/
new pins, reason, timing, author and data visibility. A new freeze is a new study
revision, not retroactive preregistration. See DEVIATIONS.md for remaining gates.

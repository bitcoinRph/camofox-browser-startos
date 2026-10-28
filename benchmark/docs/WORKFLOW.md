# Reusable offline foundation workflow

1. Stay inside the assigned repository; do not inspect credential stores or run
   authenticated GitHub tooling. No network install, browser, DNS or deployment.
2. Establish the canonical test command before implementation:
   `python -m unittest discover -s tests -p 'test_*.py' -v`.
3. Implement a vertical contract slice at a time: write behavior tests, run and
   retain RED with a feature-local failure, implement, run GREEN and full suite.
   If test bytes change before implementation, rerun RED (workflow-v2 records this).
4. Use JSON Schema at every trust boundary, plus semantic identity/URL checks.
   Never coerce untrusted types to strings to make them validate. No remote refs.
5. Keep preregistration and post-collection evidence separate. Pin raw files and
   canonical snapshots. Refuse absent pins, changed code, unindexed payloads,
   schedule mismatch and favorable exclusion of failures.
6. Test all actual HTTP routes against a real ephemeral loopback server, including
   timeout, frame-only content, large snapshot bounds, discarded dummy uploads,
   harmless download and blocked Host/Origin. No browser performance inference.
7. Test human-label gate integrity with clearly synthetic examples; never call
   software-generated raters human. Require target-disjoint heldout data before
   genuine validation. Likewise synthetic A/A is not a real calibration result.
8. Freeze a new synthetic packet only after final code/protocol changes. Execute
   the actual analysis CLI and retain stdout, pins and a local HTTP smoke report.
9. Scan source/evidence for secrets, run the full suite, inspect the staged diff,
   commit only assigned paths locally and read back the commit/status. Never push.
10. Report the actual gates met and the remaining authority/binary/human-run gaps.

## Freeze-hardening checks

- Bind the caller's root to the path from the executing contracts module before
  reading pins; copied files cannot certify code/schemas executing elsewhere.
- Inspect all arms, including separate calibration arms. Require concrete positive
  engine/tool version identifiers and valid binary digests, rejecting placeholder
  tokens rather than just UNRESOLVED. Current templates remain replay-only.
- For real-mode freeze, require six explicit local binary paths and read/hash the
  actual files before output creation. Test matching dummy bytes and refusals for
  missing/mismatching paths, symlinks, duplicate bindings and template-ID collapse.
  Do not mistake hash-only fixtures for browser execution or persisted provenance.
- Apply the primary-target minimum in both schema and semantic analysis; a caller
  must not lower the safety floor through a newly pinned manifest.
- Rebuild A/A identities from the frozen target set and seed, not an independent
  calibration population. Check masked side, block, pair order, mode and control
  hash and mandatory explicit expected mode, while distinguishing declared
  metadata from actual dispatch evidence. Through the real CLI, re-pin coordinated
  mutations of target/schedule/visit data and uniform A/A masks/control/mode;
  require exit 2 and empty stdout, not only helper exceptions.
- Treat protocol/schema/toolchain changes as a new evidence revision. Keep old
  packets/pins unchanged; generate a fresh packet and execute both API and CLI.
- Reconcile accepted design thresholds explicitly. Label manual/external and
  unimplemented statistical decisions as blockers rather than implying that a
  successful offline freeze authorizes collection or a winner claim.

## TDD evidence interpretation

`evidence/01-*` through `07-*` capture actual test-run stdout/stderr at each slice.
Historical GREEN files have the then-current test count. The first workflow RED
was superseded by workflow-red-v2 after the schedule CLI acceptance assertion was
split into its own behavior-local test; it is retained as historical evidence only.
The final test-byte hashes and toolchain versions are in environment.json. Earlier
RED source line numbers may differ only where explicitly superseded. The exact
command used for all these logs is the canonical command above, redirected to the
named log; failing runs exited nonzero. New tests initially assert missing features
inside executed test bodies rather than failing collection/import.

Do not treat this record as an independent security audit, statistical peer review,
or proof that a human/browser performed the synthetic examples. The offline
fixture/probe is a functional transport smoke test only.

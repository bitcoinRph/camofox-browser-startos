# Blinded human labeling guide

This guide is for a future approved local observation study. The current bundled
labels use `source: synthetic`, visibly named synthetic-r1/r2; they are not actual
raters and cannot pass the real-data gate.

1. Develop rules using development targets only. Freeze detector source and guide
   before export of heldout snapshots. Hold out whole target clusters, not visits.
2. Prepare sanitized snapshots with opaque evidence ID and snapshot SHA-256 only.
   Remove arm, browser/version, timestamps/order, outcome guesses and detector text.
   A separate restricted mapping binds evidence ID to target cluster and split;
   the label import reconstructs complete schema rows after independent rating.
3. Two independent people label each snapshot without seeing each other's work.
   Never copy a detector prediction or use two accounts for one person. Record
   operator attestations in study notes; software cannot establish independence.
4. Classify observed usable content, not status code alone. Timeout if no result
   before deadline; transport error if request/tool failed; CAPTCHA when an actual
   human-interaction gate prevents access; challenge for browser/security waiting
   page; block for explicit access denied; error for server/non-2xx failure;
   incomplete for truncated/empty/frame-only or task-irrelevant extract; usable for
   enough task-relevant extracted content. A discussion of CAPTCHAs is not a gate.
5. Use the fixed detector precedence for overlapping events. A partial article
   with a blocking gate is not success. A link/download is not extracted content.
   Root-frame shells do not count as extracted child content. Text in script or
   CSS is not visible content. Use the supplied canonical sanitized observation,
   not an altered snapshot collected later.
6. A canonical observation hash is over UTF-8 compact sorted-key JSON, no NaN,
   `ensure_ascii=False`. Labels bind both evidence and target identity plus hash.
7. Resolve disagreement outside this packet, preserving original judgments and
   blinded adjudication rationale; create a new label revision. The validator
   rejects any disagreement, duplicate rater/evidence, missing evidence label,
   unmatched hash, target mismatch or development/heldout target leakage.
8. Require >=60 heldout examples, >=8 per class and >=14 heldout target clusters.
   Report class recall, full 7×7 confusion matrix and multiclass/binary agreement.
   Gate: >=95% binary usable/nonusable agreement and zero false usable for truth
   challenge, CAPTCHA or block. Multiclass agreement/recall are diagnostics, not
   the superseded 90%/75% gates. Synthetic validation
   tests software only. A heldout-tuned detector requires a fresh heldout set.

## Offline tools

`bench.validation.validate_detector(owned, labels)` validates schema-valid arrays
and returns counts, agreement, recall, confusion matrix and gate result.
The analysis CLI invokes this automatically and refuses failed gates.
The source field is only an attestation; it does not magically make labels human.
Blinded export, human independence attestations and adjudication workflows remain
manual/unimplemented; the fixture generator produces synthetic ratings only.

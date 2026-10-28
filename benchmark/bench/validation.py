"""Independent, blinded, target-disjoint held-out detector validation."""
from collections import Counter, defaultdict
from .contracts import canonical_hash, validate
from .detector import detect, LABELS


def validate_detector(owned, labels, allow_synthetic=False):
    validate("owned", owned)
    validate("labels", labels)
    snapshots = {}
    for row in owned:
        eid = row["evidence_id"]
        if eid in snapshots or canonical_hash(row["observation"]) != row["snapshot_sha256"]:
            raise ValueError("duplicate evidence or snapshot hash mismatch")
        snapshots[eid] = row
    grouped, splits, seen = defaultdict(list), defaultdict(set), set()
    for row in labels:
        eid = row["evidence_id"]
        if eid not in snapshots:
            raise ValueError("unbound label evidence")
        snap = snapshots[eid]
        if row["target_id"] != snap["target_id"] or row["snapshot_sha256"] != snap["snapshot_sha256"]:
            raise ValueError("label identity or snapshot mismatch")
        if row["source"] != "human" and not allow_synthetic:
            raise ValueError("synthetic labels cannot validate a real detector")
        key = (eid, row["rater"])
        if key in seen:
            raise ValueError("duplicate rater/evidence")
        seen.add(key)
        grouped[eid].append(row)
        splits[row["target_id"]].add(row["split"])
    if any(len(v) != 1 for v in splits.values()):
        raise ValueError("development/heldout target leakage")
    if set(grouped) != set(snapshots):
        raise ValueError("unlabeled snapshots")
    confusion = {truth: {pred: 0 for pred in LABELS} for truth in LABELS}
    counts, matches, binary_matches, false_usable_gates, n = Counter(), 0, 0, 0, 0
    heldout_targets = set()
    for eid, rows in grouped.items():
        if len(rows) != 2 or len({r["label"] for r in rows}) != 1 or len({r["split"] for r in rows}) != 1:
            raise ValueError("exactly two independent agreeing raters required; adjudicate in a new frozen packet")
        if rows[0]["split"] != "heldout":
            continue
        truth = rows[0]["label"]
        pred = detect(snapshots[eid]["observation"])
        counts[truth] += 1
        confusion[truth][pred] += 1
        matches += truth == pred
        binary_matches += (truth == "usable") == (pred == "usable")
        false_usable_gates += truth in {"challenge", "captcha", "block"} and pred == "usable"
        n += 1
        heldout_targets.add(rows[0]["target_id"])
    if n < 60 or any(counts[label] < 8 for label in LABELS) or len(heldout_targets) < 14:
        raise ValueError("heldout minimum: 60 snapshots, 8/class, 14 targets")
    agreement = matches / n
    binary_agreement = binary_matches / n
    recall = {label: confusion[label][label] / counts[label] for label in LABELS}
    return {"n": n, "targets": len(heldout_targets), "agreement": agreement,
            "binary_agreement": binary_agreement, "false_usable_challenges_or_blocks": false_usable_gates,
            "confusion": confusion, "recall": recall, "gate_pass": binary_agreement >= .95 and false_usable_gates == 0,
            "human_validated": all(r["source"] == "human" for r in labels)}

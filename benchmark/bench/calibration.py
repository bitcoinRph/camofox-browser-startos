"""A/A implementation-noise gate, not an equivalence claim."""
from collections import defaultdict
import random
from statistics import mean, median
from .contracts import REPLAY_MODES, validate


def generate_plan(targets, seed=20261027):
    """Frozen internal A/A identities; export only opaque x/y to human raters."""
    ids = sorted(targets)
    if len(ids) < 12 or len(set(ids)) != len(ids):
        raise ValueError("A/A requires >=12 unique frozen targets")
    rng = random.Random(seed)
    rows = []
    for index, target in enumerate(ids):
        mask, offset = rng.randrange(2), rng.randrange(2)
        for block in range(4):
            pair = [{"schema_version": "1.1", "pair_id": f"aa{index}_{block}", "target_id": target,
                     "block": block, "side": side, "masked_side": ["x", "y"][(side_index + mask) % 2],
                     "pair_order": (side_index + block + offset) % 2}
                    for side_index, side in enumerate(["left", "right"])]
            rows.extend(sorted(pair, key=lambda row: row["pair_order"]))
    return rows


def calibrate(rows, expected_control, expected_targets, *, expected_mode, allow_synthetic=False, seed=20261027):
    validate("calibration", rows)
    if {r["target_id"] for r in rows} != set(expected_targets):
        raise ValueError("A/A targets must equal the frozen target population")
    plan = {(r["pair_id"], r["side"]): r for r in generate_plan(expected_targets, seed)}
    modes = {r["mode"] for r in rows}
    if expected_mode not in REPLAY_MODES | {"local-observation"} or modes != {expected_mode}:
        raise ValueError("mixed or misrepresented A/A mode")
    pairs = defaultdict(dict)
    for row in rows:
        expected = plan.get((row["pair_id"], row["side"]))
        if expected is None or any(row[k] != value for k, value in expected.items()):
            raise ValueError("A/A masked side, pair order or identity differs from frozen plan")
        if row["control_sha256"] != expected_control:
            raise ValueError("A/A control differs from frozen baseline")
        if row["mode"] in REPLAY_MODES and not allow_synthetic:
            raise ValueError("synthetic calibration is not real calibration")
        pair = pairs[row["pair_id"]]
        if row["side"] in pair:
            raise ValueError("duplicate A/A side")
        pair[row["side"]] = row
    targets, latency = defaultdict(list), []
    for pair in pairs.values():
        if set(pair) != {"left", "right"} or pair["left"]["target_id"] != pair["right"]["target_id"]:
            raise ValueError("missing or mismatched A/A pair")
        left, right = pair["left"], pair["right"]
        targets[left["target_id"]].append(int(right["label"] == "usable") - int(left["label"] == "usable"))
        latency.append((right["elapsed_ms"] - left["elapsed_ms"]) / max(1, left["elapsed_ms"]))
    if len(targets) < 12 or any(len(values) != 4 for values in targets.values()):
        raise ValueError("A/A requires at least 12 targets and exactly four pairs per target")
    difference = mean(mean(v) for v in targets.values())
    latency_difference = median(latency)
    return {"target_count": len(targets), "pairs": len(pairs), "difference": difference,
            "median_relative_latency_difference": latency_difference,
            "gate_pass": abs(difference) <= .1 and abs(latency_difference) <= .2,
            "real_calibration": all(r["mode"] == "local-observation" for r in rows)}

"""Seeded complete Williams blocks; no network, retries, or target substitution."""
import random
from .contracts import validate


def generate(target_ids, arms, blocks=4, seed=20261027, phase="primary"):
    if not target_ids or len(set(target_ids)) != len(target_ids):
        raise ValueError("nonempty unique targets required")
    allowed = {"primary": ["A", "B", "C", "D"], "sensitivity": ["A2", "C2"]}
    if phase not in allowed or arms != allowed[phase] or type(blocks) is not int or blocks < 4 or blocks % len(arms):
        raise ValueError("only complete four-arm primary or two-arm sensitivity blocks allowed")
    if type(seed) is not int or seed < 0:
        raise ValueError("seed must be a nonnegative integer")
    n = len(arms)
    base = [0, 1, 3, 2] if n == 4 else [0, 1]
    sequences = [[arms[(x + k) % n] for x in base] for k in range(n)]
    rng = random.Random(seed)
    offsets = {t: rng.randrange(n) for t in sorted(target_ids)}
    rows = []
    for block in range(blocks):
        targets = sorted(target_ids)
        rng.shuffle(targets)
        for t in targets:
            sequence = sequences[(offsets[t] + block) % n]
            for position, arm in enumerate(sequence):
                rows.append({"schema_version": "1.0", "visit_id": f"{t}_{block}_{arm}", "target_id": t,
                             "arm": arm, "block": block, "position": position, "order_index": len(rows),
                             "phase": phase, "timeout_ms": 10000})
    validate("schedule", rows)
    return rows


def main():
    import argparse
    import json
    from pathlib import Path
    from .evidence import load_pinned
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--targets", required=True)
    parser.add_argument("--targets-sha256", required=True)
    parser.add_argument("--seed", type=int, default=20261027)
    parser.add_argument("--blocks", type=int, default=4)
    parser.add_argument("--phase", choices=["primary", "sensitivity"], default="primary")
    args = parser.parse_args()
    try:
        targets = validate("targets", load_pinned(args.root, args.targets, args.targets_sha256))
        arms = ["A", "B", "C", "D"] if args.phase == "primary" else ["A2", "C2"]
        rows = generate([t["target_id"] for t in targets if t["primary"]], arms, args.blocks, args.seed, args.phase)
    except (ValueError, OSError) as exc:
        parser.exit(2, f"REFUSED: {exc}\n")
    print(json.dumps(rows, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

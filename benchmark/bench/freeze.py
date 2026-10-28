"""Freeze an owned-only preregistration without collecting any observations."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
from .analysis import frozen_paths
from .contracts import executed_root, require_resolved_arms, validate
from .evidence import file_entries, file_hash, load_pinned
from .schedule import generate


def verify_arm_binaries(root, arms, binary_paths):
    """Read local bytes only; this proves neither execution nor vendor provenance."""
    if not isinstance(binary_paths, dict) or set(binary_paths) != {arm["arm_id"] for arm in arms}:
        raise ValueError("binary paths must bind exactly all six arms, including A2/C2")
    for arm in arms:
        value = binary_paths[arm["arm_id"]]
        if not isinstance(value, (str, Path)) or not str(value):
            raise ValueError("binary path must be a nonempty local path")
        path = Path(value)
        if not path.is_absolute():
            path = root / path
        if any(part.is_symlink() for part in [path, *path.parents]) or not path.is_file():
            raise ValueError("binary path must be a regular file without symlinks")
        with path.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if digest != arm["binary_sha256"]:
            raise ValueError(f"binary hash mismatch for arm {arm['arm_id']}")


def freeze(root, targets_path, targets_sha256, output, mode="local-fixture-replay", phase="primary", seed=20261027, blocks=4, binary_paths=None):
    root = executed_root(root)
    targets = validate("targets", load_pinned(root, targets_path, targets_sha256))
    if len(targets) < 12 or not all(t["primary"] for t in targets):
        raise ValueError("screening freeze requires >=12 primary owned targets")
    configs = []
    for arm in ["A", "B", "C", "D", "A2", "C2"]:
        path = f"templates/arms/{arm}.json"
        config = validate("arms", load_pinned(root, path, file_hash(root, path)))
        if config["arm_id"] != arm:
            raise ValueError("arm template identity mismatch")
        configs.append(config)
    require_resolved_arms(mode, configs)
    if mode == "local-observation" or binary_paths is not None:
        verify_arm_binaries(root, configs, binary_paths)
    if (not isinstance(output, str) or not output or PurePosixPath(output).is_absolute() or "\\" in output
            or any(x in {"", ".", "..", ".git"} for x in output.split("/"))):
        raise ValueError("output must be a new relative directory")
    arms = ["A", "B", "C", "D"] if phase == "primary" else ["A2", "C2"]
    rows = generate([t["target_id"] for t in targets], arms, blocks, seed, phase)
    current = root
    for part in output.split("/"):
        current = current / part
        if current.is_symlink():
            raise ValueError("symlink output")
    if current.exists():
        raise ValueError("freeze output already exists")
    # Validate source inventory before creating an output directory.
    file_entries(root, frozen_paths(root))
    current.mkdir(parents=True)
    def put(name, data):
        (current / name).write_text(json.dumps(data, sort_keys=True, indent=2, allow_nan=False) + "\n")
        return (current / name).relative_to(root).as_posix()
    copied_targets = put("targets.json", targets)
    schedule = put("schedule.json", rows)
    manifest = {"schema_version": "1.1", "study_id": "owned-screening-v3", "status": "offline-foundation-not-live-approved",
                "screening_level": True, "mode": mode, "seed": seed, "blocks": blocks, "phase": phase, "arms": arms,
                "targets_path": copied_targets, "schedule_path": schedule,
                "files": file_entries(root, frozen_paths(root) + [copied_targets, schedule]),
                "analysis": {"baseline": arms[0], "bootstrap_seed": seed, "bootstrap_samples": 2000, "alpha": .05, "timeout_ms": 10000,
                             "cluster": "target_id", "minimum_targets": 12, "planned_primary_contrast": "C-A", "aa_max_abs_difference": .1, "detector_min_agreement": .95}}
    validate("manifest", manifest)
    path = put("manifest.json", manifest)
    return path, file_hash(root, path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--targets", required=True)
    parser.add_argument("--targets-sha256", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--mode", choices=["synthetic", "local-fixture-replay", "local-observation"], default="local-fixture-replay")
    parser.add_argument("--phase", choices=["primary", "sensitivity"], default="primary")
    parser.add_argument("--binary", action="append", metavar="ARM=PATH",
                        help="repeat for all six arms; local-byte hash check required for local-observation")
    args = parser.parse_args()
    try:
        binary_paths = None
        if args.binary is not None:
            binary_paths = {}
            for binding in args.binary:
                arm, separator, path = binding.partition("=")
                if not separator or not path or arm in binary_paths:
                    raise ValueError("binary bindings must be unique ARM=PATH values")
                binary_paths[arm] = path
        path, pin = freeze(args.root, args.targets, args.targets_sha256, args.output, mode=args.mode, phase=args.phase,
                           binary_paths=binary_paths)
    except (ValueError, OSError) as exc:
        parser.exit(2, f"REFUSED: {exc}\n")
    print(json.dumps({"manifest_path": path, "manifest_sha256": pin}, indent=2))


if __name__ == "__main__":
    main()

"""Create deterministic synthetic evidence only. Does not start a browser or contact a server."""
import argparse
import json
from pathlib import Path, PurePosixPath
from .analysis import frozen_paths
from .contracts import canonical_hash, executed_root, validate
from .detector import detect
from .evidence import file_entries, file_hash
from .fixture import extract_snapshot, route
from .schedule import generate
from .calibration import generate_plan

ROUTES = ["usable", "challenge", "captcha", "block", "error", "large-dom", "iframe", "frameset", "download", "popup", "upload", "timeout"]


def build_demo(root, output="runs/demo"):
    root = executed_root(root)
    if (not isinstance(output, str) or not output or PurePosixPath(output).is_absolute()
            or any(x in {"", ".", "..", ".git"} for x in output.split("/")) or "\\" in output):
        raise ValueError("output must be a new repository-relative directory")
    current = root
    for part in output.split("/"):
        current = current / part
        if current.is_symlink():
            raise ValueError("symlink output")
    if current.exists():
        raise ValueError("refusing to overwrite evidence")
    current.mkdir(parents=True)
    def put(name, value):
        path = current / name
        path.write_text(json.dumps(value, sort_keys=True, indent=2, allow_nan=False) + "\n")
        return path.relative_to(root).as_posix()
    targets = [{"schema_version": "1.0", "target_id": name, "url": "http://127.0.0.1:8765/" + name,
                "kind": "owned", "permission": "local-fixture", "primary": True} for name in ROUTES]
    validate("targets", targets)
    targets_path = put("targets.json", targets)
    schedule = generate(ROUTES, ["A", "B", "C", "D"], blocks=4, seed=20261027)
    schedule_path = put("schedule.json", schedule)
    manifest = {"schema_version": "1.1", "study_id": "offline-screening-v3", "status": "offline-foundation-not-live-approved",
                "screening_level": True, "mode": "synthetic", "seed": 20261027, "blocks": 4, "phase": "primary", "arms": ["A", "B", "C", "D"],
                "targets_path": targets_path, "schedule_path": schedule_path,
                "files": file_entries(root, frozen_paths(root) + [targets_path, schedule_path]),
                "analysis": {"baseline": "A", "bootstrap_seed": 20261027, "bootstrap_samples": 2000, "alpha": .05, "timeout_ms": 10000,
                             "cluster": "target_id", "minimum_targets": 12, "planned_primary_contrast": "C-A", "aa_max_abs_difference": .1, "detector_min_agreement": .95}}
    validate("manifest", manifest)
    manifest_path = put("manifest.json", manifest)
    manifest_sha256 = file_hash(root, manifest_path)
    observations = {}
    for name in ROUTES:
        status, html = route("/" + name)
        obs = extract_snapshot(html, status)
        if name == "timeout":
            obs.update(http_status=None, title="", text="", usable_marker=False, tool_error="timeout")
        observations[name] = obs
    visits = []
    for plan in schedule:
        obs = observations[plan["target_id"]]
        visits.append({k: plan[k] for k in ["visit_id", "target_id", "arm", "block", "position"]} |
                      {"schema_version": "1.1", "mode": "synthetic", "elapsed_ms": 100 if detect(obs) == "usable" else 10000,
                       "observation": obs, "label": detect(obs), "detector_version": "1.0", "evidence_sha256": canonical_hash(obs)})
    visits_path = put("visits.json", visits)
    # These are deterministic software fixtures, NEVER represented as actual human labels.
    cases = {label: obs for obs in observations.values() for label in [detect(obs)]}
    owned, labels = [], []
    for label, obs in sorted(cases.items()):
        for index in range(9):
            eid = label + str(index)
            owned.append({"schema_version": "1.0", "evidence_id": eid, "target_id": eid, "observation": obs, "snapshot_sha256": canonical_hash(obs)})
            for rater in ["synthetic-r1", "synthetic-r2"]:
                labels.append({"schema_version": "1.0", "evidence_id": eid, "target_id": eid, "split": "heldout", "rater": rater,
                               "label": label, "source": "synthetic", "snapshot_sha256": canonical_hash(obs)})
    owned_path = put("owned.json", owned)
    labels_path = put("labels.json", labels)
    manual_path = put("manual.json", [])
    control = file_hash(root, "templates/arms/A.json")
    calibration = [plan | {"control_sha256": control, "label": detect(observations[plan["target_id"]]),
                           "elapsed_ms": 100, "mode": "synthetic"} for plan in generate_plan(ROUTES)]
    calibration_path = put("calibration.json", calibration)
    bundle = {"schema_version": "1.0", "manifest_sha256": manifest_sha256, "visits_path": visits_path, "labels_path": labels_path,
              "owned_path": owned_path, "manual_path": manual_path, "calibration_path": calibration_path,
              "files": file_entries(root, [visits_path, labels_path, owned_path, manual_path, calibration_path])}
    validate("bundle", bundle)
    bundle_path = put("bundle.json", bundle)
    pins = {"manifest_path": manifest_path, "manifest_sha256": manifest_sha256,
            "bundle_path": bundle_path, "bundle_sha256": file_hash(root, bundle_path)}
    put("pins.json", pins)
    return pins


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--output", default="runs/demo")
    args = parser.parse_args()
    try:
        pins = build_demo(args.root, args.output)
    except (ValueError, OSError) as exc:
        parser.exit(2, f"REFUSED: {exc}\n")
    print(json.dumps(pins, indent=2))


if __name__ == "__main__":
    main()

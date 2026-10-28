"""Pinned offline analysis: target is the independent sampling unit."""
import argparse
import json
import random
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean

from .contracts import REPLAY_MODES, canonical_hash, executed_root, require_resolved_arms, validate
from .evidence import load_pinned, verify_entries
from .schedule import generate
from .calibration import calibrate
from .validation import validate_detector
from .detector import detect
from .hygiene import sanitize

FROZEN_DOCS = ["PROTOCOL.md", "DEVIATIONS.md", "docs/ANALYSIS.md", "docs/LABELING.md", "docs/SAFETY.md", "docs/RETENTION.md"]


def frozen_paths(root):
    root = Path(root)
    paths = list(FROZEN_DOCS) + ["requirements.txt", "requirements.lock", "toolchain.json", ".python-version"]
    paths += [p.relative_to(root).as_posix() for group in ["schemas/*.json", "bench/*.py", "templates/arms/*.json"] for p in sorted(root.glob(group))]
    return sorted(paths)


def cluster_contrast(baseline, treatment, seed=20261027, samples=5000):
    if set(baseline) != set(treatment) or len(baseline) < 2 or samples < 1000:
        raise ValueError("paired target clusters and >=1000 bootstrap draws required")
    targets = sorted(baseline)
    deltas = [mean(treatment[t]) - mean(baseline[t]) for t in targets]
    rng = random.Random(seed)
    draws = sorted(mean(rng.choices(deltas, k=len(deltas))) for _ in range(samples))
    # Fixed nearest-rank percentile interval; no visit-level resampling.
    lo = draws[max(0, int(samples * .025) - 1)]
    hi = draws[min(samples - 1, int(samples * .975) - 1)]
    return {"difference": mean(deltas), "ci95": [lo, hi], "target_differences": dict(zip(targets, deltas))}


def analyze(root, manifest_path, manifest_sha256, bundle_path, bundle_sha256):
    root = executed_root(root)
    manifest = load_pinned(root, manifest_path, manifest_sha256)
    validate("manifest", manifest)
    verify_entries(root, manifest["files"])
    frozen = {f["path"]: f["sha256"] for f in manifest["files"]}
    required = set(frozen_paths(root)) | {manifest["targets_path"], manifest["schedule_path"]}
    if set(frozen) != required:
        raise ValueError("manifest must bind all protocol, code, schemas, arms, targets and schedule")
    def frozen_load(path, schema):
        return validate(schema, load_pinned(root, path, frozen[path]))
    targets = frozen_load(manifest["targets_path"], "targets")
    schedule = frozen_load(manifest["schedule_path"], "schedule")
    target_ids = [t["target_id"] for t in targets if t["primary"]]
    if len(target_ids) < max(12, manifest["analysis"]["minimum_targets"]) or len(target_ids) != len(targets):
        raise ValueError("packet must contain exactly the preregistered primary target population")
    expected = generate(target_ids, manifest["arms"], manifest["blocks"], manifest["seed"], manifest["phase"])
    if schedule != expected:
        raise ValueError("schedule does not match frozen counterbalance/seed")
    arm_configs = {}
    for arm in ["A", "B", "C", "D", "A2", "C2"]:
        path = f"templates/arms/{arm}.json"
        arm_configs[arm] = frozen_load(path, "arms")
        if arm_configs[arm]["arm_id"] != arm:
            raise ValueError("arm template identity mismatch")
    require_resolved_arms(manifest["mode"], arm_configs.values())
    baseline = manifest["analysis"]["baseline"]
    if baseline != ("A" if manifest["phase"] == "primary" else "A2"):
        raise ValueError("wrong baseline for phase")
    bundle = load_pinned(root, bundle_path, bundle_sha256)
    validate("bundle", bundle)
    if bundle["manifest_sha256"] != manifest_sha256:
        raise ValueError("bundle binds a different manifest")
    verify_entries(root, bundle["files"])
    index = {f["path"]: f["sha256"] for f in bundle["files"]}
    fields = {"visits": "visits_path", "labels": "labels_path", "owned": "owned_path", "manual": "manual_path", "calibration": "calibration_path"}
    payload_paths = [bundle[field] for field in fields.values()]
    if len(set(payload_paths)) != len(payload_paths) or set(index) != set(payload_paths) or set(index) & set(frozen):
        raise ValueError("evidence index must bind exactly five distinct payloads, separate from preregistration")
    payload = {schema: validate(schema, load_pinned(root, bundle[field], index[bundle[field]])) for schema, field in fields.items()}
    synthetic = manifest["mode"] == "synthetic"
    replay = manifest["mode"] in REPLAY_MODES
    detector = validate_detector(payload["owned"], payload["labels"], allow_synthetic=replay)
    aa = calibrate(payload["calibration"], expected_control=frozen[f"templates/arms/{baseline}.json"],
                   expected_targets=target_ids, allow_synthetic=replay, seed=manifest["seed"], expected_mode=manifest["mode"])
    if not replay and (not detector["human_validated"] or not aa["real_calibration"]):
        raise ValueError("real observations require human validation and real A/A")
    if not detector["gate_pass"] or not aa["gate_pass"]:
        raise ValueError("detector or A/A gate failed; freeze a deviation, do not report performance")
    planned = {r["visit_id"]: r for r in schedule}
    interventions = set()
    for row in payload["manual"]:
        if row["visit_id"] not in planned or row["visit_id"] in interventions:
            raise ValueError("duplicate or unknown manual record")
        interventions.add(row["visit_id"])
        if row["action"] not in {"none", "inspect-only"}:
            raise ValueError("safety-aborted packet cannot produce performance claims")
    observed = {}
    for row in payload["visits"]:
        vid = row["visit_id"]
        if vid not in planned or vid in observed:
            raise ValueError("unplanned or duplicate visit")
        plan = planned[vid]
        if any(row[k] != plan[k] for k in ["target_id", "arm", "block", "position"]):
            raise ValueError("visit identity does not match schedule")
        if row["mode"] != manifest["mode"]:
            raise ValueError("mixed or misrepresented observation mode")
        o = row["observation"]
        if canonical_hash(o) != row["evidence_sha256"] or detect(o) != row["label"]:
            raise ValueError("snapshot hash or detector label mismatch")
        if any(sanitize(o[k]) != o[k] for k in ["title", "text"]):
            raise ValueError("unsanitized observation")
        if row["label"] == "usable" and row["elapsed_ms"] > 10000:
            raise ValueError("usable observation exceeds frozen deadline")
        observed[vid] = row
    summaries, clusters, latencies = {}, {}, {}
    for arm in manifest["arms"]:
        counts, success, penalized = Counter(), defaultdict(list), defaultdict(list)
        n_observed, elapsed_success = 0, []
        for plan in schedule:
            if plan["arm"] != arm:
                continue
            row = observed.get(plan["visit_id"])
            label = row["label"] if row else "missing"
            counts[label] += 1
            n_observed += row is not None
            ok = label == "usable"
            success[plan["target_id"]].append(int(ok))
            duration = row["elapsed_ms"] if ok else 10000
            penalized[plan["target_id"]].append(duration)
            if ok:
                elapsed_success.append(duration)
        clusters[arm], latencies[arm] = dict(success), dict(penalized)
        summaries[arm] = {"scheduled": sum(counts.values()), "observed": n_observed,
                          "missing": counts["missing"], "outcomes": dict(sorted(counts.items())),
                          "usable_rate": mean(mean(v) for v in success.values()),
                          "penalized_elapsed_ms": mean(mean(v) for v in penalized.values()),
                          "success_only_elapsed_ms_descriptive": mean(elapsed_success) if elapsed_success else None}
    treatment = "C" if manifest["phase"] == "primary" else "C2"
    contrast = cluster_contrast(clusters[baseline], clusters[treatment], manifest["analysis"]["bootstrap_seed"], manifest["analysis"]["bootstrap_samples"])
    contrast["name"] = f"{treatment}-{baseline}"
    secondary = {}
    for arm in manifest["arms"]:
        if arm != baseline:
            secondary[f"{arm}-{baseline}"] = {"usable": cluster_contrast(clusters[baseline], clusters[arm], manifest["analysis"]["bootstrap_seed"], manifest["analysis"]["bootstrap_samples"]),
                                               "penalized_latency": cluster_contrast(latencies[baseline], latencies[arm], manifest["analysis"]["bootstrap_seed"], manifest["analysis"]["bootstrap_samples"])}
    status = ("SYNTHETIC-ONLY-NO-BROWSER-INFERENCE" if synthetic else
              "LOCAL-FIXTURE-REPLAY-NO-BROWSER-INFERENCE" if replay else "OWNED-LOCAL-ONLY-SCREENING")
    return {"schema_version": "1.1", "status": status,
            "live_readiness": False, "manifest_sha256": manifest_sha256, "bundle_sha256": bundle_sha256,
            "phase": manifest["phase"], "target_count": len(target_ids), "scheduled_visits": len(schedule),
            "arms": summaries, "primary_contrast": contrast if manifest["phase"] == "primary" else None,
            "sensitivity_contrast": contrast if manifest["phase"] == "sensitivity" else None,
            "exploratory_contrasts_unadjusted": secondary, "detector_validation": detector, "aa_calibration": aa,
            "limitations": ["Screening-level; target-cluster percentile intervals are unstable at small N.",
                            "Repeated visits are not independent targets.", "Owned fixtures cannot establish internet anti-bot performance.",
                            "No browser binary or adapter was exercised by synthetic mode; no winner or deployment recommendation."]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--manifest-sha256", required=True)
    parser.add_argument("--bundle", required=True)
    parser.add_argument("--bundle-sha256", required=True)
    args = parser.parse_args()
    try:
        result = analyze(args.root, args.manifest, args.manifest_sha256, args.bundle, args.bundle_sha256)
    except (ValueError, OSError, KeyError) as exc:
        parser.exit(2, f"REFUSED: {exc}\n")
    print(json.dumps(result, sort_keys=True, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()

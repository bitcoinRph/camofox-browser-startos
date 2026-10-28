"""Strict local schemas and URL rules. No DNS resolution or remote refs."""
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]


def executed_root(root):
    root = Path(root).resolve()
    if root != ROOT:
        raise ValueError("root must match the executed contracts.ROOT; run code from that exact tree")
    return root


REPLAY_MODES = {"synthetic", "local-fixture-replay"}


def require_resolved_arms(mode, arms):
    if mode not in REPLAY_MODES | {"local-observation"}:
        raise ValueError("unsupported observation mode")
    if mode in REPLAY_MODES:
        return
    # Positive, offline syntax validation is not vendor/runtime provenance.
    version = re.compile(r"(?:v?\d+(?:\.\d+)+(?:[-+][0-9A-Za-z.-]+)*|[a-f0-9]{40}|[a-f0-9]{64})", re.ASCII)
    placeholder = re.compile(r"unresolved|(?:^|[^a-z0-9])(?:tbd|todo|latest|placeholder|unknown|unpinned|test-double)(?:$|[^a-z0-9])", re.IGNORECASE)
    def unresolved(value):
        if isinstance(value, str):
            return bool(placeholder.search(value))
        if isinstance(value, dict):
            return any(unresolved(v) for v in value.values())
        if isinstance(value, list):
            return any(unresolved(v) for v in value)
        return False
    for arm in arms:
        if unresolved(arm):
            raise ValueError("UNRESOLVED/placeholder arm values permit only synthetic/local-fixture replay")
        for field in ["engine_version", "tool_version"]:
            value = arm.get(field)
            if not isinstance(value, str) or not version.fullmatch(value):
                raise ValueError(f"concrete {field} required: dotted numeric version or full lowercase commit digest")
        digest = arm.get("binary_sha256")
        if not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest):
            raise ValueError("valid binary SHA-256 required for local observations")


def canonical_bytes(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()


def canonical_hash(value):
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def safe_url(url):
    if not isinstance(url, str) or any(c.isspace() or ord(c) < 32 for c in url):
        raise ValueError("URL must be a literal loopback fixture URL")
    try:
        p = urlsplit(url)
        port = p.port
    except ValueError as exc:
        raise ValueError("invalid URL") from exc
    routes = {"/usable", "/challenge", "/captcha", "/block", "/error", "/large-dom", "/iframe", "/frameset", "/download", "/popup", "/upload", "/timeout", "/"}
    if (p.scheme != "http" or p.hostname != "127.0.0.1" or p.username is not None
            or p.password is not None or p.query or p.fragment or p.path not in routes
            or port == 0 or p.netloc not in {"127.0.0.1", f"127.0.0.1:{port}"}):
        raise ValueError("only exact 127.0.0.1 owned fixture routes allowed; no queries, credentials, or fragments")
    return url


def validate(name, value):
    if name not in {"manifest", "targets", "visits", "labels", "owned", "manual", "schedule", "arms", "bundle", "calibration"}:
        raise ValueError("unknown schema")
    schema = json.loads((ROOT / "schemas" / f"{name}.schema.json").read_text())
    Draft202012Validator.check_schema(schema)
    errors = list(Draft202012Validator(schema).iter_errors(value))
    if errors:
        raise ValueError(f"{name} schema refused at {list(errors[0].absolute_path)}: {errors[0].message}")
    canonical_bytes(value)  # Reject NaN/Infinity even when a numeric validator accepts them.
    if name == "targets":
        ids = [r["target_id"] for r in value]
        if len(set(ids)) != len(ids):
            raise ValueError("duplicate target_id")
        for row in value:
            safe_url(row["url"])
    return value

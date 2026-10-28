"""Pinned file indexes. Roots are trusted local directories, not attacker-writable shares."""
import hashlib
import json
import re
import stat
from pathlib import Path, PurePosixPath

MAX_FILE_BYTES = 10_000_000


def safe_path(root, relative):
    if not isinstance(relative, str) or not relative or "\\" in relative:
        raise ValueError("invalid evidence path")
    path = PurePosixPath(relative)
    if path.is_absolute() or any(p in {"", ".", "..", ".git"} for p in relative.split("/")):
        raise ValueError("unsafe evidence path")
    root = Path(root)
    if root.is_symlink():
        raise ValueError("symlink root")
    current = root
    for part in path.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError("symlink evidence")
    if not current.is_file() or current.stat().st_nlink != 1:
        raise ValueError("evidence must be a single-link regular file")
    return current


def read_bytes(root, relative):
    path = safe_path(root, relative)
    info = path.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_FILE_BYTES:
        raise ValueError("oversized or nonregular evidence")
    data = path.read_bytes()
    after = path.stat()
    if len(data) > MAX_FILE_BYTES or (info.st_ino, info.st_size, info.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns):
        raise ValueError("evidence changed during read")
    return data


def file_hash(root, relative):
    return hashlib.sha256(read_bytes(root, relative)).hexdigest()


def file_entries(root, paths):
    if len(paths) != len(set(paths)):
        raise ValueError("duplicate index paths")
    return [{"path": p, "sha256": file_hash(root, p)} for p in sorted(paths)]


def verify_entries(root, entries):
    paths = [e["path"] for e in entries]
    if len(paths) != len(set(paths)):
        raise ValueError("duplicate index paths")
    for entry in entries:
        if not re.fullmatch(r"[a-f0-9]{64}", entry["sha256"]) or file_hash(root, entry["path"]) != entry["sha256"]:
            raise ValueError("evidence hash mismatch: " + entry["path"])


def strict_json(data):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("duplicate JSON key")
            result[key] = value
        return result

    def nonfinite(value):
        raise ValueError("nonfinite JSON value")

    try:
        return json.loads(data, object_pairs_hook=pairs, parse_constant=nonfinite)
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("invalid evidence JSON") from exc


def load_pinned(root, relative, expected):
    if not isinstance(expected, str) or not re.fullmatch(r"[a-f0-9]{64}", expected):
        raise ValueError("an independent SHA-256 pin is mandatory")
    data = read_bytes(root, relative)
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError("pinned artifact hash mismatch")
    return strict_json(data)

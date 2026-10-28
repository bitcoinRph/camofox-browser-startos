"""Conservative text scrubbing and explicit local retention; not DLP certification."""
import argparse
import re
import time
from pathlib import Path

SECRET_PATTERNS = [
    r"gh[pousr]_[A-Za-z0-9]{30,}", r"github_pat_[A-Za-z0-9_]{30,}",
    r"AKIA[A-Z0-9]{16}", r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    r"(?i)Bearer\s+[A-Za-z0-9_.~+/-]{20,}",
    r"(?i)(?:password|api_key|client_secret)\s*[:=]\s*['\"]?[A-Za-z0-9_./+-]{12,}",
]
SECRET_RE = re.compile("|".join("(?:" + p.replace("(?i)", "") + ")" for p in SECRET_PATTERNS), re.IGNORECASE)
EMAIL_RE = re.compile(r"[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
URL_TAIL_RE = re.compile(r"(https?://[^\s?#<>]+)[?#][^\s<>]*")


def sanitize(text):
    if not isinstance(text, str):
        raise ValueError("sanitize requires text")
    text = URL_TAIL_RE.sub(r"\1[REDACTED-URL-TAIL]", text)
    text = EMAIL_RE.sub("[REDACTED-EMAIL]", text)
    return SECRET_RE.sub("[REDACTED-SECRET]", text)


def scan_tree(root):
    root = Path(root)
    findings = []
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root)
        if any(p in {".git", ".venv", "__pycache__"} for p in rel.parts):
            continue
        if path.is_symlink():
            raise ValueError("scanner refuses symlinks")
        if not path.is_file():
            continue
        if path.stat().st_size > 10_000_000:
            raise ValueError("scanner refuses oversized file")
        data = path.read_bytes()
        # Decode every byte without dropping ASCII secret markers in binary files.
        if SECRET_RE.search(data.decode("utf-8", errors="replace")):
            findings.append(rel.as_posix())
    return findings


def purge(root, now=None, execute=False):
    root = Path(root)
    if root.name != "private-evidence" or root.is_symlink() or not root.is_dir():
        raise ValueError("retention root must be an explicit real private-evidence directory")
    now = time.time() if now is None else now
    expired = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError("retention refuses symlinks")
        if not path.is_file():
            continue
        rel = path.relative_to(root)
        if rel.parts[0] not in {"raw", "sanitized"}:
            raise ValueError("unknown retention class")
        days = 7 if rel.parts[0] == "raw" else 30
        if now - path.stat().st_mtime >= days * 86400:
            expired.append(rel.as_posix())
    # Validate every path before deleting any.
    if execute:
        for rel in expired:
            (root / rel).unlink()
    return expired


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    scan = sub.add_parser("scan"); scan.add_argument("root")
    retention = sub.add_parser("purge"); retention.add_argument("root"); retention.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    if args.command == "scan":
        findings = scan_tree(args.root)
        for path in findings:
            print(path)  # Never print matched values.
        raise SystemExit(bool(findings))
    for path in purge(args.root, execute=args.execute):
        print(path)


if __name__ == "__main__":
    main()

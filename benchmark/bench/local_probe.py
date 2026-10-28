"""Bounded literal-loopback HTTP transport probe. Not a browser adapter or study visit."""
import argparse
import json
import time
from http.client import HTTPConnection, HTTPException
from urllib.parse import urlsplit
from .contracts import canonical_hash, safe_url
from .detector import detect
from .fixture import extract_snapshot
from .hygiene import sanitize


def probe(url, timeout=1):
    safe_url(url)  # Performed before creating any socket; never resolves a hostname.
    if not isinstance(timeout, (int, float)) or not .01 <= timeout <= 10:
        raise ValueError("probe timeout must be 0.01..10 seconds")
    p = urlsplit(url)
    connection = HTTPConnection("127.0.0.1", p.port or 80, timeout=timeout)
    start = time.monotonic()
    observation = {"http_status": None, "title": "", "text": "", "usable_marker": False,
                   "truncated": False, "frame_state": "none", "tool_error": "none"}
    try:
        connection.request("GET", p.path or "/")
        response = connection.getresponse()
        # No redirect following, proxies, cookies, credentials or automatic retries.
        deadline = start + timeout
        pieces, size = [], 0
        while size <= 1_000_000:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("probe deadline")
            if connection.sock is not None:
                connection.sock.settimeout(remaining)
            piece = response.read1(min(16384, 1_000_001 - size))
            if not piece:
                break
            pieces.append(piece)
            size += len(piece)
        body = b"".join(pieces)
        observation = extract_snapshot(body.decode("utf-8", errors="replace"), response.status)
        if len(body) > 1_000_000:
            observation["truncated"] = True
        if "attachment" in response.getheader("Content-Disposition", ""):
            observation["usable_marker"] = False
        if time.monotonic() > deadline:
            raise TimeoutError("probe deadline")
    except TimeoutError:
        observation.update(http_status=None, title="", text="", usable_marker=False, tool_error="timeout")
    except (OSError, HTTPException):
        observation.update(http_status=None, title="", text="", usable_marker=False, tool_error="transport")
    finally:
        connection.close()
    for key in ["title", "text"]:
        observation[key] = sanitize(observation[key])
    return {"mode": "local-http-probe-not-browser", "elapsed_ms": (time.monotonic() - start) * 1000,
            "observation": observation, "label": detect(observation), "evidence_sha256": canonical_hash(observation)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("--timeout", type=float, default=1)
    args = parser.parse_args()
    try:
        report = probe(args.url, args.timeout)
    except ValueError as exc:
        parser.exit(2, f"REFUSED: {exc}\n")
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

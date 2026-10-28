"""Frozen v1.0 conservative snapshot classifier; not a bot-detection oracle."""
import re
from .contracts import validate

VERSION = "1.0"
LABELS = ("usable", "challenge", "captcha", "block", "error", "timeout", "incomplete")


def detect(observation):
    # Reuse the full observation schema at every trust boundary.
    validate("owned", [{"schema_version": "1.0", "evidence_id": "check", "target_id": "check",
                        "observation": observation, "snapshot_sha256": "0" * 64}])
    o = observation
    text = (o["title"] + " " + o["text"]).lower()
    if o["tool_error"] == "timeout":
        return "timeout"
    if o["tool_error"] == "transport" or o["http_status"] is None:
        return "error"
    if re.search(r"complete (?:the |this )?captcha|verify (?:that )?you are human|i.m not a robot", text):
        return "captcha"
    if re.search(r"checking your browser|just a moment|performing security verification|verify your browser", text):
        return "challenge"
    if re.search(r"access denied|you have been blocked|request blocked", text):
        return "block"
    if o["http_status"] >= 400 or o["http_status"] < 200 or o["http_status"] >= 300:
        return "error"
    if o["truncated"] or not o["usable_marker"] or len(o["text"].strip()) < 40:
        return "incomplete"
    return "usable"

"""Owned loopback fixtures. Static fake gates, not vendor challenge implementations."""
import argparse
import time
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ARTICLE = "A useful owned article with enough content to inspect and extract a stable fact. The fixture code is ORCHARD-42."


def page(body, title="Fixture article"):
    return f'<!doctype html><html><head><title>{title}</title></head><body>{body}</body></html>'


def route(path):
    usable = '<main data-benchmark-usable="true">' + ARTICLE + '</main>'
    routes = {
        "/": (200, page(usable)), "/usable": (200, page(usable)),
        "/challenge": (503, page("<h1>Checking your browser</h1>", "Just a moment...")),
        "/captcha": (200, page('<h1>Complete the CAPTCHA to continue</h1><input type="checkbox" disabled>')),
        "/block": (403, page("<h1>Access denied</h1>")),
        "/error": (500, page("<h1>Fixture server error</h1>")),
        "/large-dom": (200, page(usable + "<section>" + "<span>large owned DOM node</span>" * 10000 + "</section>")),
        "/iframe": (200, page('<iframe src="/usable" title="owned child"></iframe>')),
        "/frameset": (200, '<html><head><title>Owned frames</title></head><frameset cols="100%"><frame src="/usable"></frameset></html>'),
        "/popup": (200, page(usable + "<button onclick=\"window.open('/usable','ownedFixture')\">Open owned popup</button>")),
        "/upload": (200, page(usable + '<form action="/upload" method="post" enctype="multipart/form-data"><input type="file" name="dummy"><button>Upload dummy fixture only</button></form>')),
        "/download": (200, "fixture-only,never-real-data\n"),
        "/timeout": (200, page(usable)),
    }
    return routes.get(path, (404, page("<h1>Fixture not found</h1>")))


class Handler(BaseHTTPRequestHandler):
    server_version = "OwnedFixture/1.0"
    sys_version = ""

    def log_message(self, *args):
        pass  # No URLs, client identifiers, or uploaded data in logs.

    def permitted(self):
        port = self.server.server_address[1]
        host = f"127.0.0.1:{port}"
        return self.headers.get("Host") == host and self.headers.get("Origin", f"http://{host}") == f"http://{host}"

    def reply(self, status, body, download=False):
        payload = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8" if download else "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; frame-src 'self'; form-action 'self'; base-uri 'none'")
        if download:
            self.send_header("Content-Disposition", 'attachment; filename="fixture-only.txt"')
        self.end_headers()
        try:
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if not self.permitted():
            return self.reply(403, "Access denied")
        if self.path == "/timeout":
            time.sleep(.35)  # Short transport-test delay; adapters use a deliberately shorter deadline.
        status, body = route(self.path)
        self.reply(status, body, self.path == "/download")

    def do_POST(self):
        if not self.permitted():
            return self.reply(403, "Access denied")
        if self.path != "/upload":
            return self.reply(405, "Unsupported fixture operation")
        try:
            size = int(self.headers.get("Content-Length", "-1"))
        except ValueError:
            size = -1
        if self.headers.get("Transfer-Encoding") or size < 0 or size > 4096:
            return self.reply(413, "Dummy upload limit exceeded")
        self.connection.settimeout(1)
        try:
            received = self.rfile.read(size)
        except TimeoutError:
            return self.reply(408, "Incomplete upload")
        if len(received) != size:
            return self.reply(400, "Incomplete upload")
        del received  # Never persist, parse, execute, or reflect uploaded bytes.
        self.reply(200, page("Dummy upload accepted and discarded."))


def make_server(host="127.0.0.1", port=8765):
    if host != "127.0.0.1":
        raise ValueError("fixture must bind literal loopback only")
    server = ThreadingHTTPServer((host, port), Handler)
    server.daemon_threads = True
    return server


class SnapshotParser(HTMLParser):
    def __init__(self, max_chars, max_nodes):
        super().__init__(convert_charrefs=True)
        self.max_chars, self.max_nodes = max_chars, max_nodes
        self.nodes, self.chars = 0, 0
        self.parts, self.title_parts = [], []
        self.in_title, self.hidden = False, 0
        self.usable, self.truncated, self.frame = False, False, "none"

    def handle_starttag(self, tag, attrs):
        self.nodes += 1
        if self.nodes > self.max_nodes:
            self.truncated = True
        if tag == "title":
            self.in_title = True
        if tag in {"script", "style"}:
            self.hidden += 1
        if tag in {"frame", "frameset"}:
            self.frame = "frameset"
        elif tag == "iframe" and self.frame == "none":
            self.frame = "iframe"
        if self.nodes <= self.max_nodes and ("data-benchmark-usable", "true") in attrs:
            self.usable = True

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag in {"script", "style"}:
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, data):
        if self.hidden:
            return
        if self.in_title:
            self.title_parts.append(data[:200])
            return
        if self.nodes > self.max_nodes:
            self.truncated = True
            return
        piece = data.strip()
        if not piece:
            return
        room = max(0, self.max_chars - self.chars - bool(self.parts))
        if len(piece) > room:
            self.truncated = True
        piece = piece[:room]
        if piece:
            self.parts.append(piece)
            self.chars += len(piece) + (len(self.parts) > 1)


def extract_snapshot(html, status=200, max_chars=20000, max_nodes=5000):
    if not isinstance(html, str) or not 1 <= max_chars <= 20000 or not 1 <= max_nodes <= 5000:
        raise ValueError("invalid bounded snapshot input")
    parser = SnapshotParser(max_chars, max_nodes)
    parser.feed(html[:1000000])
    return {"http_status": status, "title": " ".join(parser.title_parts)[:200], "text": " ".join(parser.parts),
            "usable_marker": parser.usable, "truncated": parser.truncated or len(html) > 1000000,
            "frame_state": parser.frame, "tool_error": "none"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    with make_server(port=args.port) as server:
        print(f"Owned fixture listening on 127.0.0.1:{server.server_address[1]}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()

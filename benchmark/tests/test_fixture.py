import importlib.util
import socket
import threading
import unittest
from http.client import HTTPConnection


class FixtureTests(unittest.TestCase):
    def test_owned_routes_are_local_bounded_and_do_not_store_uploads(self):
        self.assertIsNotNone(importlib.util.find_spec('bench.fixture'), 'missing loopback owned fixture server')
        from bench.fixture import make_server, extract_snapshot
        from bench.detector import detect
        with self.assertRaises(ValueError):
            make_server(host='0.0.0.0')
        server = make_server(port=0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        port = server.server_address[1]
        try:
            cases = [('/usable', 200, 'usable'), ('/challenge', 503, 'challenge'), ('/captcha', 200, 'captcha'),
                     ('/block', 403, 'block'), ('/error', 500, 'error'), ('/large-dom', 200, 'incomplete'),
                     ('/iframe', 200, 'incomplete'), ('/frameset', 200, 'incomplete'),
                     ('/download', 200, None), ('/popup', 200, 'usable'), ('/upload', 200, 'usable'),
                     ('/missing', 404, 'error'), ('/', 200, 'usable')]
            for path, status, label in cases:
                with self.subTest(path=path):
                    conn = HTTPConnection('127.0.0.1', port, timeout=2)
                    conn.request('GET', path)
                    response = conn.getresponse()
                    body = response.read().decode()
                    self.assertEqual(response.status, status)
                    self.assertIn("default-src 'none'", response.getheader('Content-Security-Policy'))
                    self.assertIsNone(response.getheader('Set-Cookie'))
                    if label:
                        snapshot = extract_snapshot(body, response.status)
                        self.assertEqual(detect(snapshot), label)
                        self.assertLessEqual(len(snapshot['text']), 20000)
                    else:
                        self.assertIn('attachment;', response.getheader('Content-Disposition'))
                        self.assertEqual(body, 'fixture-only,never-real-data\n')
                    conn.close()
            conn = HTTPConnection('127.0.0.1', port, timeout=2)
            conn.request('POST', '/upload', body=b'dummy-fixture-only', headers={'Content-Type': 'text/plain'})
            response = conn.getresponse()
            self.assertEqual(response.status, 200)
            self.assertNotIn('dummy-fixture-only', response.read().decode())
            conn.close()
            conn = HTTPConnection('127.0.0.1', port, timeout=2)
            conn.request('POST', '/upload', body=b'x' * 4097)
            response = conn.getresponse(); self.assertEqual(response.status, 413); response.read(); conn.close()
            for headers in [{'Host': 'evil.invalid'}, {'Origin': 'https://evil.invalid'}]:
                conn = HTTPConnection('127.0.0.1', port, timeout=2)
                conn.request('POST', '/upload', body=b'dummy', headers=headers)
                response = conn.getresponse(); self.assertEqual(response.status, 403); response.read(); conn.close()
            conn = HTTPConnection('127.0.0.1', port, timeout=.05)
            conn.request('GET', '/timeout')
            with self.assertRaises((TimeoutError, socket.timeout)):
                conn.getresponse()
            conn.close()
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=2)

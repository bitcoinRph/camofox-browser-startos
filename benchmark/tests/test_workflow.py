import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]


class WorkflowTests(unittest.TestCase):
    def test_offline_freeze_and_pinned_schedule_cli(self):
        self.assertIsNotNone(importlib.util.find_spec('bench.freeze'), 'missing non-synthetic preregistration freeze tool')
        from bench.freeze import freeze
        from bench.evidence import file_hash
        (ROOT / 'runs').mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ROOT / 'runs') as temp:
            relative = Path(temp).relative_to(ROOT).as_posix()
            targets_path = relative + '/input.json'
            target = dict(schema_version='1.0', target_id='local', url='http://127.0.0.1:8765/usable', kind='owned', permission='local-fixture', primary=True)
            (ROOT / targets_path).write_text(json.dumps([dict(target, target_id='local' + str(i)) for i in range(12)]))
            digest = file_hash(ROOT, targets_path)
            manifest_path, pin = freeze(ROOT, targets_path, digest, relative + '/freeze', mode='local-fixture-replay')
            self.assertEqual(file_hash(ROOT, manifest_path), pin)
            manifest = json.loads((ROOT / manifest_path).read_text())
            self.assertEqual(manifest['mode'], 'local-fixture-replay')
            self.assertEqual(manifest['status'], 'offline-foundation-not-live-approved')
            with self.assertRaises(ValueError):
                freeze(ROOT, targets_path, digest, relative + '/freeze', mode='local-fixture-replay')
            with self.assertRaises(ValueError):
                freeze(ROOT, targets_path, '0' * 64, relative + '/bad', mode='local-fixture-replay')

    def test_pinned_schedule_cli_emits_valid_json(self):
        from bench.evidence import file_hash
        (ROOT / 'runs').mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ROOT / 'runs') as temp:
            relative = Path(temp).relative_to(ROOT).as_posix() + '/targets.json'
            rows = [dict(schema_version='1.0', target_id='t' + str(i), url='http://127.0.0.1:8765/usable', kind='owned', permission='local-fixture', primary=True) for i in range(12)]
            (ROOT / relative).write_text(json.dumps(rows))
            command = [sys.executable, '-m', 'bench.schedule', '--root', str(ROOT), '--targets', relative,
                       '--targets-sha256', file_hash(ROOT, relative), '--seed', '20261027', '--blocks', '4']
            proc = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
            self.assertTrue(proc.stdout.strip(), 'schedule CLI must emit planned visits as JSON')
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertEqual(len(json.loads(proc.stdout)), 192)
            bad = command.copy(); bad[bad.index('--targets-sha256') + 1] = '0' * 64
            self.assertNotEqual(subprocess.run(bad, cwd=ROOT, capture_output=True).returncode, 0)

    def test_local_probe_captures_real_fixture_without_redirects_or_proxy(self):
        self.assertIsNotNone(importlib.util.find_spec('bench.local_probe'), 'missing loopback-only bounded transport probe')
        from bench.local_probe import probe
        from bench.fixture import make_server
        from bench.detector import detect
        server = make_server(port=0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        port = server.server_address[1]
        try:
            report = probe(f'http://127.0.0.1:{port}/usable')
            self.assertEqual(report['mode'], 'local-http-probe-not-browser')
            self.assertEqual(report['label'], 'usable')
            self.assertIn('ORCHARD-42', report['observation']['text'])
            self.assertGreater(report['elapsed_ms'], 0)
            self.assertEqual(probe(f'http://127.0.0.1:{port}/timeout', timeout=.05)['label'], 'timeout')
            self.assertEqual(probe(f'http://127.0.0.1:{port}/large-dom')['label'], 'incomplete')
            self.assertEqual(probe(f'http://127.0.0.1:{port}/download')['label'], 'incomplete')
            with self.assertRaises(ValueError): probe('https://example.invalid/')
            with self.assertRaises(ValueError): probe(f'http://127.0.0.1:{port}/usable', timeout=100)
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=2)

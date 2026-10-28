import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]


class EvidenceTests(unittest.TestCase):
    def test_hash_index_refuses_tampering_unsafe_paths_and_symlinks(self):
        self.assertIsNotNone(importlib.util.find_spec('bench.evidence'), 'missing content-addressed evidence verifier')
        from bench.evidence import file_entries, verify_entries, load_pinned
        (ROOT / 'runs').mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ROOT / 'runs') as tmp:
            root = Path(tmp)
            (root / 'x.json').write_text('{"ok":true}\n')
            entries = file_entries(root, ['x.json'])
            verify_entries(root, entries)
            pin = entries[0]['sha256']
            self.assertEqual(load_pinned(root, 'x.json', pin), {'ok': True})
            (root / 'x.json').write_text('{"ok":false}\n')
            with self.assertRaises(ValueError): verify_entries(root, entries)
            for bad in ['../x', '/x', './x', 'a/../x', '.git/config', '']:
                with self.subTest(path=bad), self.assertRaises(ValueError): file_entries(root, [bad])
            (root / 'link').symlink_to(root / 'x.json')
            with self.assertRaises(ValueError): file_entries(root, ['link'])
            with self.assertRaises(ValueError): verify_entries(root, entries + entries)
            (root / 'dup.json').write_text('{"a":1,"a":2}')
            digest = hashlib.sha256((root / 'dup.json').read_bytes()).hexdigest()
            with self.assertRaises(ValueError): load_pinned(root, 'dup.json', digest)
            (root / 'nan.json').write_text('{"a":NaN}')
            digest = hashlib.sha256((root / 'nan.json').read_bytes()).hexdigest()
            with self.assertRaises(ValueError): load_pinned(root, 'nan.json', digest)

    def test_sanitization_scanning_and_explicit_retention(self):
        self.assertIsNotNone(importlib.util.find_spec('bench.hygiene'), 'missing sanitization retention and secret scanner')
        from bench.hygiene import sanitize, scan_tree, purge
        token = 'gh' + 'p_' + 'a' * 36
        text = 'Contact dummy' + '@' + 'example.invalid https://127.0.0.1/path?credential=abc#s ' + token + ' Bearer ' + 'x' * 30
        clean = sanitize(text)
        for sensitive in [token, 'dummy@example.invalid', 'credential=abc', 'x' * 30]:
            self.assertNotIn(sensitive, clean)
        (ROOT / 'runs').mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ROOT / 'runs') as tmp:
            root = Path(tmp)
            (root / 'dirty.txt').write_text(token)
            self.assertEqual(scan_tree(root), ['dirty.txt'])
            (root / 'dirty.txt').write_text(clean)
            self.assertEqual(scan_tree(root), [])
            raw = root / 'private-evidence' / 'raw'
            raw.mkdir(parents=True)
            old = raw / 'old.txt'; old.write_text('dummy')
            new = raw / 'new.txt'; new.write_text('dummy')
            now = time.time()
            os.utime(old, (now - 8 * 86400, now - 8 * 86400))
            self.assertEqual(purge(raw.parent, now=now, execute=False), ['raw/old.txt'])
            self.assertTrue(old.exists())
            self.assertEqual(purge(raw.parent, now=now, execute=True), ['raw/old.txt'])
            self.assertFalse(old.exists()); self.assertTrue(new.exists())
            with self.assertRaises(ValueError): purge(root, now=now, execute=True)
            (raw / 'link').symlink_to(new)
            with self.assertRaises(ValueError): purge(raw.parent, now=now)

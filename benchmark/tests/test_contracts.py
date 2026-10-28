import copy
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ContractTests(unittest.TestCase):
    def test_strict_schema_roundtrip_and_local_target_policy(self):
        self.assertIsNotNone(importlib.util.find_spec('bench'), 'missing strict offline contract implementation')
        from bench.contracts import validate, safe_url, canonical_hash
        target = {'schema_version': '1.0', 'target_id': 't1', 'url': 'http://127.0.0.1:8765/usable',
                  'kind': 'owned', 'permission': 'local-fixture', 'primary': True}
        validate('targets', [target])
        self.assertEqual(canonical_hash(target), canonical_hash(json.loads(json.dumps(target, sort_keys=True))))
        for bad in ['https://example.invalid/', 'http://localhost/', 'http://127.0.0.1.evil/',
                    'file:///etc/passwd', 'http://u:p@127.0.0.1/', 'http://127.0.0.1/?token=x',
                    'http://2130706433/', 'http://127.0.0.2/', 'http://[::1]/',
                    'http://127.0.0.1/%2e%2e/secret', 'http://127.0.0.1:0/usable']:
            with self.subTest(url=bad), self.assertRaises(ValueError):
                safe_url(bad)
        self.assertEqual(safe_url(target['url']), target['url'])
        for key, value in [('url', 123), ('primary', 'true'), ('kind', 'external')]:
            bad = copy.deepcopy(target)
            bad[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate('targets', [bad])
        bad = dict(target, surprise=True)
        with self.assertRaises(ValueError):
            validate('targets', [bad])
        for name in ['manifest', 'targets', 'visits', 'labels', 'owned', 'manual', 'schedule', 'arms', 'bundle', 'calibration']:
            schema = json.loads((ROOT / 'schemas' / f'{name}.schema.json').read_text())
            self.assertEqual(schema['$schema'], 'https://json-schema.org/draft/2020-12/schema')


if __name__ == '__main__':
    unittest.main()

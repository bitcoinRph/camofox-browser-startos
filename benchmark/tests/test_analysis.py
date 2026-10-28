import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class AnalysisTests(unittest.TestCase):
    def test_offline_demo_cli_and_target_cluster_analysis_keep_failures(self):
        self.assertIsNotNone(importlib.util.find_spec('bench.demo'), 'missing reproducible explicitly synthetic evidence packet')
        from bench.demo import build_demo
        from bench.analysis import analyze
        from bench.evidence import file_entries, file_hash
        (ROOT / 'runs').mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ROOT / 'runs') as temp:
            relative = Path(temp).relative_to(ROOT).as_posix() + '/packet'
            pins = build_demo(ROOT, relative)
            report = analyze(ROOT, **pins)
            self.assertEqual(report['status'], 'SYNTHETIC-ONLY-NO-BROWSER-INFERENCE')
            self.assertEqual(report['target_count'], 12)
            self.assertEqual(report['scheduled_visits'], 192)
            self.assertEqual(sum(x['scheduled'] for x in report['arms'].values()), 192)
            self.assertEqual(report['primary_contrast']['name'], 'C-A')
            self.assertEqual(report['primary_contrast']['difference'], 0)
            self.assertEqual(report['primary_contrast']['ci95'], [0, 0])
            self.assertFalse(report['live_readiness'])
            self.assertEqual(report, analyze(ROOT, **pins))
            cmd = [sys.executable, '-m', 'bench.analysis', '--root', str(ROOT), '--manifest', pins['manifest_path'],
                   '--manifest-sha256', pins['manifest_sha256'], '--bundle', pins['bundle_path'], '--bundle-sha256', pins['bundle_sha256']]
            process = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(process.returncode, 0, process.stderr)
            self.assertEqual(json.loads(process.stdout)['scheduled_visits'], 192)
            self.assertNotEqual(subprocess.run(cmd[:-2], cwd=ROOT, capture_output=True).returncode, 0)
            bundle = json.loads((ROOT / pins['bundle_path']).read_text())
            path = bundle['visits_path']
            visits = json.loads((ROOT / path).read_text())
            visits = [v for v in visits if v['arm'] != 'A']
            (ROOT / path).write_text(json.dumps(visits))
            bundle['files'] = file_entries(ROOT, [f['path'] for f in bundle['files']])
            (ROOT / pins['bundle_path']).write_text(json.dumps(bundle))
            pins['bundle_sha256'] = file_hash(ROOT, pins['bundle_path'])
            missing = analyze(ROOT, **pins)
            self.assertEqual(missing['arms']['A']['missing'], 48)
            self.assertEqual(missing['arms']['A']['usable_rate'], 0)
            self.assertEqual(missing['arms']['A']['penalized_elapsed_ms'], 10000)
            self.assertEqual(missing['arms']['A']['observed'], 0)
            self.assertEqual(missing['arms']['A']['scheduled'], 48)
            self.assertGreater(missing['primary_contrast']['difference'], 0)

    def test_analysis_refuses_hash_schema_schedule_label_and_gate_mutations(self):
        self.assertIsNotNone(importlib.util.find_spec('bench.analysis'), 'missing fail-closed analysis entrypoint')
        from bench.analysis import analyze
        from bench.demo import build_demo
        from bench.evidence import file_entries, file_hash
        (ROOT / 'runs').mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ROOT / 'runs') as temp:
            pins = build_demo(ROOT, Path(temp).relative_to(ROOT).as_posix() + '/packet')
            bundle_path = ROOT / pins['bundle_path']
            original_bundle = bundle_path.read_bytes()
            bundle = json.loads(original_bundle)
            visit_path = ROOT / bundle['visits_path']
            original_visits = visit_path.read_bytes()
            for kind in ['hash', 'schema', 'duplicate', 'unknown-visit', 'label', 'snapshot-hash', 'mixed-mode', 'arm', 'manual', 'gate', 'index-omission']:
                data = json.loads(original_visits)
                b = json.loads(original_bundle)
                modified = []
                if kind == 'hash': data[0]['elapsed_ms'] += 1
                if kind == 'schema': data[0]['elapsed_ms'] = '100'
                if kind == 'duplicate': data.append(data[0])
                if kind == 'unknown-visit': data[0]['visit_id'] = 'not-planned'
                if kind == 'label': data[0]['label'] = 'timeout' if data[0]['label'] != 'timeout' else 'usable'
                if kind == 'snapshot-hash': data[0]['evidence_sha256'] = '0' * 64
                if kind == 'mixed-mode': data[0]['mode'] = 'local-observation'
                if kind == 'arm': data[0]['arm'] = 'A2'
                if kind == 'manual':
                    p = ROOT / b['manual_path']; modified.append((p, p.read_bytes()))
                    p.write_text(json.dumps([dict(schema_version='1.0', visit_id=data[0]['visit_id'], action='abort', reason='safety-stop', operator_id='operator', changed_outcome=False)]))
                if kind == 'gate':
                    p = ROOT / b['calibration_path']; modified.append((p, p.read_bytes()))
                    rows = json.loads(p.read_text())
                    for r in rows:
                        if r['side'] == 'right': r['label'] = 'block'
                    p.write_text(json.dumps(rows))
                visit_path.write_text(json.dumps(data))
                if kind != 'hash':
                    b['files'] = file_entries(ROOT, [e['path'] for e in b['files']])
                if kind == 'index-omission': b['files'] = b['files'][1:]
                bundle_path.write_text(json.dumps(b))
                p = dict(pins, bundle_sha256=file_hash(ROOT, pins['bundle_path']))
                with self.subTest(kind=kind), self.assertRaises(ValueError):
                    analyze(ROOT, **p)
                for path, content in modified: path.write_bytes(content)
                visit_path.write_bytes(original_visits)
                bundle_path.write_bytes(original_bundle)
            with self.assertRaises(ValueError):
                analyze(ROOT, **dict(pins, manifest_sha256='0' * 64))

    def test_cluster_bootstrap_uses_targets_not_individual_visits(self):
        self.assertIsNotNone(importlib.util.find_spec('bench.analysis'), 'missing target-cluster interval calculation')
        from bench.analysis import cluster_contrast
        contrast = cluster_contrast({'t1': [0] * 4, 't2': [0] * 4}, {'t1': [1] * 4, 't2': [0] * 4}, seed=1, samples=2000)
        self.assertEqual(contrast['difference'], .5)
        self.assertEqual(contrast['ci95'], [0, 1])
        duplicated = cluster_contrast({'t1': [0] * 40, 't2': [0] * 40}, {'t1': [1] * 40, 't2': [0] * 40}, seed=1, samples=2000)
        self.assertEqual(contrast, duplicated)

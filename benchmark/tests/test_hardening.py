"""Regression tests for freeze/analysis authority boundaries (offline only)."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from bench.analysis import analyze
from bench.demo import build_demo
from bench.evidence import file_entries, file_hash

ROOT = Path(__file__).resolve().parents[1]


class HardeningTests(unittest.TestCase):
    def setUp(self):
        (ROOT / 'runs').mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / 'runs')
        self.addCleanup(self.temp.cleanup)
        self.relative = Path(self.temp.name).relative_to(ROOT).as_posix()
        self.pins = build_demo(ROOT, self.relative + '/packet')

    def test_analysis_root_must_be_the_executed_contracts_root(self):
        other = Path(self.temp.name) / 'substituted'
        other.mkdir()
        manifest = json.loads((ROOT / self.pins['manifest_path']).read_text())
        bundle = json.loads((ROOT / self.pins['bundle_path']).read_text())
        paths = [e['path'] for e in manifest['files'] + bundle['files']]
        paths += [self.pins['manifest_path'], self.pins['bundle_path']]
        for relative in paths:
            destination = other / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, destination)
        command = [sys.executable, '-m', 'bench.analysis', '--root', str(other),
                   '--manifest', self.pins['manifest_path'], '--manifest-sha256', self.pins['manifest_sha256'],
                   '--bundle', self.pins['bundle_path'], '--bundle-sha256', self.pins['bundle_sha256']]
        result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
        self.assertEqual(result.returncode, 2, 'a copied tree must not certify code executing elsewhere')
        self.assertIn('executed', result.stderr)
        self.assertEqual(result.stdout, '')
        with self.assertRaisesRegex(ValueError, 'executed'):
            analyze(other, **self.pins)

    def test_freeze_rejects_unresolved_arms_before_creating_output(self):
        from bench.freeze import freeze
        target_path = self.relative + '/packet/targets.json'
        output = self.relative + '/forbidden-freeze'
        with self.assertRaisesRegex(ValueError, 'UNRESOLVED|binary'):
            freeze(ROOT, target_path, file_hash(ROOT, target_path), output, mode='local-observation')
        self.assertFalse((ROOT / output).exists())
        result = subprocess.run([sys.executable, '-m', 'bench.freeze', '--root', str(ROOT),
                                 '--targets', target_path, '--targets-sha256', file_hash(ROOT, target_path),
                                 '--output', output, '--mode', 'local-observation'],
                                cwd=ROOT, text=True, capture_output=True)
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn('UNRESOLVED', result.stderr)
        self.assertEqual(result.stdout, '')
        self.assertFalse((ROOT / output).exists())

    def test_analysis_rejects_unresolved_arms_before_loading_observations(self):
        path = ROOT / self.pins['manifest_path']
        manifest = json.loads(path.read_text())
        manifest['mode'] = 'local-observation'
        path.write_text(json.dumps(manifest))
        self.pins['manifest_sha256'] = file_hash(ROOT, self.pins['manifest_path'])
        with self.assertRaisesRegex(ValueError, 'UNRESOLVED|binary'):
            analyze(ROOT, **self.pins)

    def test_manifest_cannot_lower_primary_target_floor(self):
        from bench.contracts import validate
        manifest = json.loads((ROOT / self.pins['manifest_path']).read_text())
        for minimum in range(2, 12):
            manifest['analysis']['minimum_targets'] = minimum
            with self.subTest(minimum=minimum), self.assertRaises(ValueError):
                validate('manifest', manifest)

    def test_new_contracts_do_not_reuse_the_original_manifest_identity(self):
        manifest = json.loads((ROOT / self.pins['manifest_path']).read_text())
        self.assertEqual(manifest['schema_version'], '1.1')
        self.assertEqual(manifest['study_id'], 'offline-screening-v3')

    def test_shrunk_population_is_refused_by_freeze_and_analysis(self):
        from bench.freeze import freeze
        manifest_path = ROOT / self.pins['manifest_path']
        manifest = json.loads(manifest_path.read_text())
        target_path = ROOT / manifest['targets_path']
        targets = json.loads(target_path.read_text())[:11]
        target_path.write_text(json.dumps(targets))
        output = self.relative + '/too-small'
        with self.assertRaisesRegex(ValueError, '12'):
            freeze(ROOT, manifest['targets_path'], file_hash(ROOT, manifest['targets_path']), output)
        self.assertFalse((ROOT / output).exists())
        manifest['files'] = file_entries(ROOT, [e['path'] for e in manifest['files']])
        manifest_path.write_text(json.dumps(manifest))
        self.pins['manifest_sha256'] = file_hash(ROOT, self.pins['manifest_path'])
        with self.assertRaisesRegex(ValueError, 'population'):
            analyze(ROOT, **self.pins)

    def test_freeze_binds_dependency_and_toolchain_pins(self):
        from bench.analysis import frozen_paths
        required = {'requirements.txt', 'requirements.lock', 'toolchain.json', '.python-version'}
        self.assertTrue(required <= set(frozen_paths(ROOT)))

    def test_every_arm_placeholder_and_null_binary_independently_blocks_real_mode(self):
        from bench.contracts import require_resolved_arms
        arms = [json.loads((ROOT / f'templates/arms/{arm}.json').read_text()) for arm in ['A', 'B', 'C', 'D', 'A2', 'C2']]
        for arm in arms:
            arm.update(engine_version='130.0.1', tool_version='1.2.3', user_agent='pinned-agent', binary_sha256='a' * 64)
        require_resolved_arms('local-observation', arms)
        for index in range(6):
            for field in ['engine_version', 'tool_version', 'user_agent', 'binary_sha256']:
                bad = json.loads(json.dumps(arms))
                bad[index][field] = None if field == 'binary_sha256' else 'UNRESOLVED'
                with self.subTest(arm=index, field=field), self.assertRaisesRegex(ValueError, 'UNRESOLVED|binary'):
                    require_resolved_arms('local-observation', bad)
                for mode in ['synthetic', 'local-fixture-replay']:
                    require_resolved_arms(mode, bad)

    def test_explicit_local_fixture_replay_keeps_no_browser_scope(self):
        manifest_path = ROOT / self.pins['manifest_path']
        manifest = json.loads(manifest_path.read_text())
        manifest['mode'] = 'local-fixture-replay'
        manifest_path.write_text(json.dumps(manifest))
        self.pins['manifest_sha256'] = file_hash(ROOT, self.pins['manifest_path'])
        bundle_path = ROOT / self.pins['bundle_path']
        bundle = json.loads(bundle_path.read_text())
        bundle['manifest_sha256'] = self.pins['manifest_sha256']
        for field in ['visits_path', 'calibration_path']:
            path = ROOT / bundle[field]
            rows = json.loads(path.read_text())
            for row in rows:
                row['mode'] = 'local-fixture-replay'
            path.write_text(json.dumps(rows))
        bundle['files'] = file_entries(ROOT, [e['path'] for e in bundle['files']])
        bundle_path.write_text(json.dumps(bundle))
        self.pins['bundle_sha256'] = file_hash(ROOT, self.pins['bundle_path'])
        result = analyze(ROOT, **self.pins)
        self.assertEqual(result['status'], 'LOCAL-FIXTURE-REPLAY-NO-BROWSER-INFERENCE')
        self.assertFalse(result['live_readiness'])
        self.assertFalse(result['aa_calibration']['real_calibration'])
        self.assertFalse(result['detector_validation']['human_validated'])

    def test_aa_population_cannot_be_replaced_with_unrelated_targets(self):
        bundle_path = ROOT / self.pins['bundle_path']
        bundle = json.loads(bundle_path.read_text())
        path = ROOT / bundle['calibration_path']
        rows = json.loads(path.read_text())
        for row in rows:
            row['target_id'] = 'unrelated-' + row['target_id']
        path.write_text(json.dumps(rows))
        bundle['files'] = file_entries(ROOT, [e['path'] for e in bundle['files']])
        bundle_path.write_text(json.dumps(bundle))
        self.pins['bundle_sha256'] = file_hash(ROOT, self.pins['bundle_path'])
        with self.assertRaisesRegex(ValueError, 'population'):
            analyze(ROOT, **self.pins)

    def test_aa_mask_and_pair_order_are_required_and_frozen(self):
        from bench.calibration import calibrate
        bundle = json.loads((ROOT / self.pins['bundle_path']).read_text())
        rows = json.loads((ROOT / bundle['calibration_path']).read_text())
        fields = {'masked_side', 'pair_order', 'block'}
        self.assertTrue(fields <= rows[0].keys(), 'A/A must record masked side and actual within-pair order')
        targets = [r['target_id'] for r in json.loads((ROOT / (self.relative + '/packet/targets.json')).read_text())]
        control = file_hash(ROOT, 'templates/arms/A.json')
        self.assertTrue(calibrate(rows, control, targets, allow_synthetic=True, expected_mode='synthetic')['gate_pass'])
        for field in fields | {'pair_id', 'mode'}:
            for mutation in ['missing', 'changed']:
                bad = json.loads(json.dumps(rows))
                if mutation == 'missing':
                    bad[0].pop(field)
                elif field == 'masked_side':
                    bad[0][field] = 'y' if bad[0][field] == 'x' else 'x'
                elif field in {'pair_order', 'block'}:
                    bad[0][field] = 1 - bad[0][field]
                elif field == 'mode':
                    bad[0][field] = 'local-fixture-replay'
                else:
                    bad[0][field] = 'substituted-pair'
                with self.subTest(field=field, mutation=mutation), self.assertRaises(ValueError):
                    calibrate(bad, control, targets, allow_synthetic=True, expected_mode='synthetic')

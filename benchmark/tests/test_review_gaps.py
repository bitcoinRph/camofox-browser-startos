"""Final offline readiness and machine-readable CLI regressions."""
import copy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from bench.analysis import frozen_paths

from bench.contracts import require_resolved_arms

ROOT = Path(__file__).resolve().parents[1]
ARMS = ['A', 'B', 'C', 'D', 'A2', 'C2']


def resolved_arms():
    rows = [json.loads((ROOT / f'templates/arms/{arm}.json').read_text()) for arm in ARMS]
    for row in rows:
        row.update(engine_version='130.0.1', tool_version='v1.2.3-rc.1',
                   user_agent='OfflineFixture/130.0.1', binary_sha256='a' * 64)
    return rows


class ReadinessTests(unittest.TestCase):
    def test_concrete_versions_are_required_in_every_arm(self):
        rows = resolved_arms()
        require_resolved_arms('local-observation', rows)
        for index in range(len(rows)):
            for field in ['engine_version', 'tool_version']:
                for value in ['TBD', 'latest', 'placeholder', 'pinned-1', '130', '1.2-latest',
                              'v1.2-placeholder', 'unknown', '', ' 1.2.3 ', 130, None]:
                    bad = copy.deepcopy(rows)
                    bad[index][field] = value
                    with self.subTest(arm=index, field=field, value=value), self.assertRaises(ValueError):
                        require_resolved_arms('local-observation', bad)
        for version in ['1.2', 'v130.0.1', '1.2.3-rc.1+build.4', 'a' * 40]:
            good = copy.deepcopy(rows)
            for row in good:
                row.update(engine_version=version, tool_version=version)
            require_resolved_arms('local-observation', good)

    def test_placeholder_tokens_anywhere_and_invalid_binary_hash_fail_closed(self):
        rows = resolved_arms()
        for index in range(len(rows)):
            for field in ['engine', 'interface', 'user_agent', 'locale', 'timezone']:
                for value in ['TBD', 'latest', 'placeholder', 'unknown', 'UNRESOLVED', 'pin-TBD-before-run']:
                    bad = copy.deepcopy(rows)
                    bad[index][field] = value
                    with self.subTest(arm=index, field=field, value=value), self.assertRaises(ValueError):
                        require_resolved_arms('local-observation', bad)
                    for mode in ['synthetic', 'local-fixture-replay']:
                        require_resolved_arms(mode, bad)
            for value in [None, '', 'placeholder', 'a' * 63, 123, 'A' * 64]:
                bad = copy.deepcopy(rows)
                bad[index]['binary_sha256'] = value
                with self.subTest(arm=index, binary=value), self.assertRaises(ValueError):
                    require_resolved_arms('local-observation', bad)


class CalibrationContractTests(unittest.TestCase):
    def test_expected_mode_is_a_required_explicit_contract(self):
        from bench.calibration import calibrate, generate_plan
        ids = [f't{i}' for i in range(12)]
        rows = [plan | dict(control_sha256='a' * 64, label='usable', elapsed_ms=10, mode='synthetic')
                for plan in generate_plan(ids)]
        with self.assertRaises(TypeError):
            calibrate(rows, 'a' * 64, ids, allow_synthetic=True)
        for expected in [None, '', 'unsupported', 'local-observation', 'local-fixture-replay']:
            with self.subTest(expected_mode=expected), self.assertRaises(ValueError):
                calibrate(rows, 'a' * 64, ids, expected_mode=expected, allow_synthetic=True)
        self.assertTrue(calibrate(rows, 'a' * 64, ids, expected_mode='synthetic', allow_synthetic=True)['gate_pass'])


class BinaryFreezeTests(unittest.TestCase):
    def setUp(self):
        (ROOT / 'runs').mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / 'runs')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        # Execute the copied code: never mutate real templates or fake ROOT.
        for relative in frozen_paths(ROOT):
            dest = self.root / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, dest)
        self.binary = self.root / 'dummy-hash-fixture'
        self.binary.write_bytes(b'Hash-only software fixture; not a browser executable.\n')
        digest = hashlib.sha256(self.binary.read_bytes()).hexdigest()
        for arm in resolved_arms():
            arm['binary_sha256'] = digest
            (self.root / f"templates/arms/{arm['arm_id']}.json").write_text(json.dumps(arm))
        targets = [dict(schema_version='1.0', target_id=f't{i}', url='http://127.0.0.1:8765/usable',
                        kind='owned', permission='local-fixture', primary=True) for i in range(12)]
        path = self.root / 'targets.json'
        path.write_text(json.dumps(targets))
        self.command = [sys.executable, '-m', 'bench.freeze', '--targets', 'targets.json',
                        '--targets-sha256', hashlib.sha256(path.read_bytes()).hexdigest(),
                        '--output', 'frozen', '--mode', 'local-observation']

    def run_freeze(self, bindings=()):
        return subprocess.run(self.command + [arg for binding in bindings for arg in ['--binary', binding]],
                              cwd=self.root, text=True, capture_output=True)

    def test_concrete_metadata_alone_cannot_authorize_local_observation_freeze(self):
        result = self.run_freeze()
        self.assertEqual(result.returncode, 2, 'a declared hash without local bytes must not freeze')
        self.assertEqual(result.stdout, '')
        self.assertIn('binary', result.stderr.lower())
        self.assertFalse((self.root / 'frozen').exists())

    def test_matching_binary_bytes_for_all_six_arms_allow_only_offline_freeze(self):
        result = self.run_freeze([f'{arm}={self.binary}' for arm in ARMS])
        self.assertEqual(result.returncode, 0, result.stderr)
        pins = json.loads(result.stdout)
        manifest = json.loads((self.root / pins['manifest_path']).read_text())
        self.assertEqual(manifest['status'], 'offline-foundation-not-live-approved')
        self.assertEqual(manifest['mode'], 'local-observation')
        self.assertEqual(hashlib.sha256((self.root / pins['manifest_path']).read_bytes()).hexdigest(),
                         pins['manifest_sha256'])

    def test_template_identity_cannot_reduce_six_arm_binary_coverage(self):
        for arm in ARMS:
            path = self.root / f'templates/arms/{arm}.json'
            row = json.loads(path.read_text())
            row['arm_id'] = 'A'
            path.write_text(json.dumps(row))
        result = self.run_freeze([f'A={self.binary}'])
        self.assertEqual(result.returncode, 2, 'duplicate template identities must not collapse binary coverage')
        self.assertEqual(result.stdout, '')
        self.assertIn('identity', result.stderr)
        self.assertFalse((self.root / 'frozen').exists())

    def test_bad_binary_bindings_refuse_without_output_or_directory(self):
        valid = [f'{arm}={self.binary}' for arm in ARMS]
        wrong = self.root / 'wrong-bytes'
        wrong.write_bytes(b'Different hash-only fixture.')
        symlink = self.root / 'symlink'
        symlink.symlink_to(self.binary)
        linked_dir = self.root / 'linked-dir'
        linked_dir.symlink_to(self.root, target_is_directory=True)
        variants = [valid[:-1], valid + [valid[0]], valid + [f'unknown={self.binary}'], ['malformed']]
        for index in range(len(ARMS)):
            for path in [wrong, self.root / 'missing', self.root, symlink, linked_dir / self.binary.name]:
                bad = valid.copy()
                bad[index] = f'{ARMS[index]}={path}'
                variants.append(bad)
        for bindings in variants:
            with self.subTest(bindings=bindings):
                result = self.run_freeze(bindings)
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertEqual(result.stdout, '')
                self.assertIn('REFUSED:', result.stderr)
                self.assertFalse((self.root / 'frozen').exists())


class PacketCLIReviewTests(unittest.TestCase):
    def setUp(self):
        from bench.demo import build_demo
        (ROOT / 'runs').mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / 'runs')
        self.addCleanup(self.temp.cleanup)
        relative = Path(self.temp.name).relative_to(ROOT).as_posix() + '/packet'
        self.pins = build_demo(ROOT, relative)
        self.manifest_path = ROOT / self.pins['manifest_path']
        self.bundle_path = ROOT / self.pins['bundle_path']
        manifest = json.loads(self.manifest_path.read_text())
        bundle = json.loads(self.bundle_path.read_text())
        paths = [self.manifest_path, self.bundle_path, ROOT / manifest['targets_path'], ROOT / manifest['schedule_path']]
        paths += [ROOT / row['path'] for row in bundle['files']]
        self.original = {path: path.read_bytes() for path in paths}

    def reset(self):
        for path, data in self.original.items():
            path.write_bytes(data)

    def repin(self):
        from bench.evidence import file_entries, file_hash
        manifest = json.loads(self.manifest_path.read_text())
        manifest['files'] = file_entries(ROOT, [row['path'] for row in manifest['files']])
        self.manifest_path.write_text(json.dumps(manifest, sort_keys=True))
        self.pins['manifest_sha256'] = file_hash(ROOT, self.pins['manifest_path'])
        bundle = json.loads(self.bundle_path.read_text())
        bundle['manifest_sha256'] = self.pins['manifest_sha256']
        bundle['files'] = file_entries(ROOT, [row['path'] for row in bundle['files']])
        self.bundle_path.write_text(json.dumps(bundle, sort_keys=True))
        self.pins['bundle_sha256'] = file_hash(ROOT, self.pins['bundle_path'])

    def cli(self):
        command = [sys.executable, '-m', 'bench.analysis', '--root', str(ROOT)]
        for key, flag in [('manifest_path', '--manifest'), ('manifest_sha256', '--manifest-sha256'),
                          ('bundle_path', '--bundle'), ('bundle_sha256', '--bundle-sha256')]:
            command.extend([flag, self.pins[key]])
        return subprocess.run(command, cwd=ROOT, text=True, capture_output=True)

    def assert_refused(self, reason):
        result = self.cli()
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertEqual(result.stdout, '')
        self.assertIn('REFUSED:', result.stderr)
        self.assertIn(reason, result.stderr)

    def test_changed_visit_schema_and_emitter_have_new_versions(self):
        from bench.contracts import validate
        bundle = json.loads(self.bundle_path.read_text())
        visits = json.loads((ROOT / bundle['visits_path']).read_text())
        self.assertEqual({row['schema_version'] for row in visits}, {'1.1'})
        validate('visits', visits)
        for row in visits:
            row['schema_version'] = '1.0'
        with self.assertRaises(ValueError):
            validate('visits', visits)

    def test_changed_analysis_output_has_new_version_in_api_and_cli(self):
        from bench.analysis import analyze
        self.assertEqual(analyze(ROOT, **self.pins)['schema_version'], '1.1')
        result = self.cli()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['schema_version'], '1.1')

    def test_coordinated_analysis_mutations_refuse_at_cli_with_empty_stdout(self):
        from bench.schedule import generate
        for kind, reason in [('lower-floor', 'schema refused'), ('shrink-population', 'population'),
                             ('schedule-and-visits', 'schedule'), ('relabel-real', 'UNRESOLVED'),
                             ('baseline-and-control', 'baseline')]:
            with self.subTest(kind=kind):
                self.reset()
                manifest = json.loads(self.manifest_path.read_text())
                bundle = json.loads(self.bundle_path.read_text())
                targets_path = ROOT / manifest['targets_path']
                schedule_path = ROOT / manifest['schedule_path']
                visits_path = ROOT / bundle['visits_path']
                calibration_path = ROOT / bundle['calibration_path']
                targets = json.loads(targets_path.read_text())
                visits = json.loads(visits_path.read_text())
                calibration = json.loads(calibration_path.read_text())
                if kind in ['lower-floor', 'shrink-population']:
                    targets = targets[:-1]
                    ids = [t['target_id'] for t in targets]
                    targets_path.write_text(json.dumps(targets))
                    schedule_path.write_text(json.dumps(generate(ids, manifest['arms'], manifest['blocks'], manifest['seed'])))
                    visits = [row for row in visits if row['target_id'] in ids]
                    calibration = [row for row in calibration if row['target_id'] in ids]
                    if kind == 'lower-floor':
                        manifest['analysis']['minimum_targets'] = 11
                elif kind == 'schedule-and-visits':
                    schedule = json.loads(schedule_path.read_text())
                    schedule[0]['position'] = (schedule[0]['position'] + 1) % 4
                    visits[0]['position'] = schedule[0]['position']
                    schedule_path.write_text(json.dumps(schedule))
                elif kind == 'relabel-real':
                    manifest['mode'] = 'local-observation'
                    for row in visits + calibration:
                        row['mode'] = 'local-observation'
                else:
                    from bench.evidence import file_hash
                    manifest['analysis']['baseline'] = 'B'
                    for row in calibration:
                        row['control_sha256'] = file_hash(ROOT, 'templates/arms/B.json')
                visits_path.write_text(json.dumps(visits))
                calibration_path.write_text(json.dumps(calibration))
                self.manifest_path.write_text(json.dumps(manifest))
                self.repin()  # All transport/self hashes agree; test semantic authority, not stale pins.
                self.assert_refused(reason)

    def test_coordinated_aa_substitutions_refuse_at_cli_with_empty_stdout(self):
        for field, reason in [('masked_side', 'frozen plan'), ('pair_order', 'frozen plan'),
                              ('pair_id', 'frozen plan'), ('block', 'frozen plan'),
                              ('target_id', 'population'), ('control_sha256', 'baseline'), ('mode', 'mode')]:
            with self.subTest(field=field):
                self.reset()
                bundle = json.loads(self.bundle_path.read_text())
                path = ROOT / bundle['calibration_path']
                rows = json.loads(path.read_text())
                for row in rows:
                    if field == 'masked_side': row[field] = 'y' if row[field] == 'x' else 'x'
                    elif field == 'pair_order': row[field] = 1 - row[field]
                    elif field == 'block': row[field] = (row[field] + 1) % 4
                    elif field == 'pair_id': row[field] = 'substituted-' + row[field]
                    elif field == 'target_id': row[field] = 'other-' + row[field]
                    elif field == 'control_sha256': row[field] = 'b' * 64
                    else: row[field] = 'local-fixture-replay'  # Uniform, not merely mixed-mode.
                path.write_text(json.dumps(rows))
                self.repin()
                self.assert_refused(reason)

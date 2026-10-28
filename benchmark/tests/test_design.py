import copy
import importlib.util
import unittest
from collections import Counter, defaultdict


class DesignTests(unittest.TestCase):
    def test_blocked_williams_schedule_is_reproducible_and_balanced(self):
        self.assertIsNotNone(importlib.util.find_spec('bench.schedule'), 'missing counterbalanced schedule generator')
        from bench.schedule import generate
        from bench.contracts import validate
        ids = ['t' + str(i) for i in range(12)]
        rows = generate(ids, ['A', 'B', 'C', 'D'], blocks=4, seed=42)
        validate('schedule', rows)
        self.assertEqual(rows, generate(ids, ['A', 'B', 'C', 'D'], blocks=4, seed=42))
        self.assertNotEqual(rows, generate(ids, ['A', 'B', 'C', 'D'], blocks=4, seed=43))
        self.assertEqual(len(rows), 192)
        self.assertEqual(len({r['visit_id'] for r in rows}), 192)
        self.assertEqual([r['order_index'] for r in rows], list(range(192)))
        for target in ids:
            position = Counter((r['arm'], r['position']) for r in rows if r['target_id'] == target)
            self.assertEqual(set(position.values()), {1})
            pairs = Counter()
            for block in range(4):
                arms = [r['arm'] for r in rows if r['target_id'] == target and r['block'] == block]
                pairs.update(zip(arms, arms[1:]))
            self.assertEqual(len(pairs), 12)
            self.assertEqual(set(pairs.values()), {1})
        sensitivity = generate(ids, ['A2', 'C2'], blocks=4, seed=42, phase='sensitivity')
        self.assertEqual(len(sensitivity), 96)
        for args in [(ids, ['A', 'A'], 4, 'primary'), (ids + ['t0'], ['A', 'B', 'C', 'D'], 4, 'primary'),
                     (ids, ['A', 'B', 'C', 'D'], 3, 'primary'), (ids, ['A2', 'C2'], 4, 'primary')]:
            with self.subTest(args=args), self.assertRaises(ValueError):
                generate(args[0], args[1], blocks=args[2], seed=42, phase=args[3])

    def test_aa_calibration_requires_identical_controls_and_complete_pairs(self):
        self.assertIsNotNone(importlib.util.find_spec('bench.calibration'), 'missing A/A calibration tooling')
        from bench.calibration import calibrate, generate_plan
        ids = [f't{t}' for t in range(12)]
        rows = [plan | dict(control_sha256='a' * 64, label='usable', elapsed_ms=10, mode='synthetic')
                for plan in generate_plan(ids)]
        report = calibrate(rows, expected_control='a' * 64, expected_targets=ids, allow_synthetic=True, expected_mode='synthetic')
        self.assertTrue(report['gate_pass'])
        self.assertFalse(report['real_calibration'])
        self.assertEqual(report['target_count'], 12)
        for kind in ['missing', 'duplicate', 'different-control', 'synthetic', 'target-mismatch']:
            bad = copy.deepcopy(rows)
            if kind == 'missing': bad.pop()
            if kind == 'duplicate': bad.append(bad[0])
            if kind == 'different-control': bad[0]['control_sha256'] = 'b' * 64
            if kind == 'target-mismatch': bad[0]['target_id'] = 'wrong'
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                calibrate(bad, expected_control='a' * 64, expected_targets=ids, allow_synthetic=kind != 'synthetic', expected_mode='synthetic')
        bad = copy.deepcopy(rows)
        for r in bad:
            if r['side'] == 'right': r['label'] = 'error'
        self.assertFalse(calibrate(bad, expected_control='a' * 64, expected_targets=ids, allow_synthetic=True, expected_mode='synthetic')['gate_pass'])

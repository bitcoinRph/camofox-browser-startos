import copy
import importlib.util
import unittest


def observation(**changes):
    return dict({'http_status': 200, 'title': 'Fixture article', 'text': 'A useful owned article with enough content to inspect and extract a stable fact.',
                 'usable_marker': True, 'truncated': False, 'frame_state': 'none', 'tool_error': 'none'}, **changes)


def heldout_corpus(per_class=9):
    from bench.contracts import canonical_hash
    owned, labels = [], []
    cases = [('usable', {}), ('captcha', {'text': 'Complete the CAPTCHA'}),
             ('challenge', {'text': 'Checking your browser'}), ('block', {'text': 'Access denied', 'http_status': 403}),
             ('error', {'http_status': 500}), ('timeout', {'tool_error': 'timeout'}), ('incomplete', {'truncated': True})]
    for label, changes in cases:
        for index in range(per_class):
            eid = f'{label}{index}'
            obs = observation(**changes)
            digest = canonical_hash(obs)
            owned.append(dict(schema_version='1.0', evidence_id=eid, target_id=eid, observation=obs, snapshot_sha256=digest))
            for rater in ['r1', 'r2']:
                labels.append(dict(schema_version='1.0', evidence_id=eid, target_id=eid, split='heldout', rater=rater,
                                   label=label, source='human', snapshot_sha256=digest))
    return owned, labels


def replace_observation(owned, labels, evidence_id, obs):
    from bench.contracts import canonical_hash
    digest = canonical_hash(obs)
    for item in owned:
        if item['evidence_id'] == evidence_id:
            item.update(observation=obs, snapshot_sha256=digest)
    for row in labels:
        if row['evidence_id'] == evidence_id:
            row['snapshot_sha256'] = digest


class DetectorTests(unittest.TestCase):
    def test_heldout_requires_at_least_sixty_snapshots(self):
        from bench.validation import validate_detector
        with self.assertRaisesRegex(ValueError, '60'):
            validate_detector(*heldout_corpus(8))

    def test_binary_agreement_below_95_percent_blocks_validation(self):
        from bench.validation import validate_detector
        owned, labels = heldout_corpus()
        for index in range(2):
            replace_observation(owned, labels, f'usable{index}', observation(truncated=True))
            replace_observation(owned, labels, f'error{index}', observation())
        self.assertFalse(validate_detector(owned, labels)['gate_pass'])

    def test_challenge_captcha_or_block_can_never_be_false_usable(self):
        from bench.validation import validate_detector
        for truth in ['challenge', 'captcha', 'block']:
            owned, labels = heldout_corpus()
            replace_observation(owned, labels, truth + '0', observation())
            with self.subTest(truth=truth):
                self.assertFalse(validate_detector(owned, labels)['gate_pass'])

    def test_deterministic_outcomes_and_precedence(self):
        self.assertIsNotNone(importlib.util.find_spec('bench.detector'), 'missing deterministic detector')
        from bench.detector import detect
        examples = [('usable', {}), ('captcha', {'text': 'Complete the CAPTCHA to continue'}),
                    ('challenge', {'title': 'Just a moment...', 'text': 'Checking your browser before accessing this page'}),
                    ('block', {'http_status': 403, 'text': 'Access denied'}),
                    ('error', {'http_status': 503}), ('timeout', {'tool_error': 'timeout'}),
                    ('error', {'tool_error': 'transport'}), ('incomplete', {'truncated': True}),
                    ('incomplete', {'frame_state': 'iframe', 'usable_marker': False}),
                    ('incomplete', {'frame_state': 'frameset', 'usable_marker': False}),
                    ('incomplete', {'text': 'tiny'}), ('incomplete', {'usable_marker': False}),
                    ('error', {'http_status': None}),
                    ('usable', {'text': 'This article discusses CAPTCHA research as a historical topic. It is not a verification gate.'}),
                    ('captcha', {'text': 'Complete the CAPTCHA', 'truncated': True}),
                    ('timeout', {'text': 'Complete the CAPTCHA', 'tool_error': 'timeout'})]
        for label, changes in examples:
            with self.subTest(label=label, changes=changes):
                row = observation(**changes)
                original = copy.deepcopy(row)
                self.assertEqual(detect(row), label)
                self.assertEqual(detect(row), label)
                self.assertEqual(row, original)
        for field in ['http_status', 'title', 'text', 'tool_error']:
            with self.subTest(field=field), self.assertRaises(ValueError):
                detect(observation(**{field: []}))

    def test_heldout_human_validation_refuses_leakage_and_disagreement(self):
        self.assertIsNotNone(importlib.util.find_spec('bench.validation'), 'missing heldout human-label validation')
        from bench.contracts import canonical_hash
        from bench.validation import validate_detector
        owned, labels = [], []
        cases = [('usable', {}), ('captcha', {'text': 'Complete the CAPTCHA'}),
                 ('challenge', {'text': 'Checking your browser'}), ('block', {'text': 'Access denied', 'http_status': 403}),
                 ('error', {'http_status': 500}), ('timeout', {'tool_error': 'timeout'}), ('incomplete', {'truncated': True})]
        for expected, changes in cases:
            for n in range(9):
                eid = expected + str(n)
                obs = observation(**changes)
                digest = canonical_hash(obs)
                owned.append(dict(schema_version='1.0', evidence_id=eid, target_id=eid, observation=obs, snapshot_sha256=digest))
                for rater in ['r1', 'r2']:
                    labels.append(dict(schema_version='1.0', evidence_id=eid, target_id=eid, split='heldout', rater=rater,
                                       label=expected, source='human', snapshot_sha256=digest))
        result = validate_detector(owned, labels, allow_synthetic=False)
        self.assertTrue(result['gate_pass'])
        self.assertEqual(result['n'], 63)
        self.assertEqual(result['agreement'], 1)
        for mutation in ['disagreement', 'leakage', 'hash', 'duplicate', 'synthetic', 'low-count', 'unbound']:
            rows, items = copy.deepcopy(labels), copy.deepcopy(owned)
            if mutation == 'disagreement': rows[0]['label'] = 'error'
            if mutation == 'leakage': rows[0]['split'] = 'development'
            if mutation == 'hash': items[0]['observation']['text'] = 'tampered'
            if mutation == 'duplicate': rows.append(rows[0])
            if mutation == 'synthetic': rows[0]['source'] = 'synthetic'
            if mutation == 'low-count': rows = rows[:-8]; items = items[:-4]
            if mutation == 'unbound': rows[0]['target_id'] = 'wrong'
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                validate_detector(items, rows)

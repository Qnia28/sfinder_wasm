"""Freeze Fast study input scope offline; never import or invoke a solver."""
import copy
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'tools/secondary-bench/prepared-20261005/A_TEMPLATE.json'
OUT = Path(__file__).with_name('SCOPE_20261015.json')
SEED = 'fast-budget-wide-v1-20261015'


def rank(value):
    return hashlib.sha256((SEED + ':' + value).encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--revision', type=int, choices=[1, 2], default=2)
    revision = parser.parse_args().revision
    raw = SOURCE.read_bytes()
    old = json.loads(raw.decode('utf-8-sig'))
    # Historical geometry identity, including all aliases/mirrors in the template.
    box_group = '3c0f03c0f'
    excluded = [c['id'] for c in old['commands'] if c['mirrorGroup'] == box_group]
    commands = []
    for original in old['commands']:
        if original['mirrorGroup'] == box_group:
            continue
        c = copy.deepcopy(original)
        c.pop('exactHumanQuality', None)
        c['secondary'] = 'auto'
        commands.append(c)
    assert len(commands) == 548
    groups = sorted({c['mirrorGroup'] for c in commands}, key=rank)
    assert len(groups) == 274
    # Include GRACE's historical regression board independent of its new timings.
    grace = next(c['mirrorGroup'] for c in commands if c['sourceFumen'] ==
                 'v115@9gili0DeglAtRpQ4g0DeBtRpR4DeAtzhQ4NeAgH')
    panel_groups = [grace] + [g for g in groups if g != grace][:63]
    panel_ids = [c['id'] for c in commands if c['mirrorGroup'] in panel_groups]
    assert len(panel_ids) == 128
    edges = []
    for group in panel_groups[:8]:
        base = next(c for c in commands if c['mirrorGroup'] == group and c['family'] != 'restricted-split')
        edges.append({'id': base['id'] + '/edge-single-queue', 'baseCommandId': base['id'],
                      'kind': 'per-save', 'patternRule': 'lexicographically-first concrete expansion of base pattern',
                      'useHold': True, 'primary': 'auto'})
        edges.append({'id': base['id'] + '/edge-save-T', 'baseCommandId': base['id'],
                      'kind': 'minimals', 'wantedSave': 'T', 'patternRule': 'unchanged',
                      'useHold': True, 'primary': 'auto'})
    arms = [
        {'id': 'BASE100', 'budget': 100000, 'preview': 'coupled', 'grace': 'coupled'},
        {'id': 'B1', 'budget': 1000, 'preview': 'coupled', 'grace': 'coupled'},
        {'id': 'B10', 'budget': 10000, 'preview': 'coupled', 'grace': 'coupled'},
        {'id': 'B40', 'budget': 40000, 'preview': 'coupled', 'grace': 'coupled'},
        {'id': 'DIRECT', 'budget': None, 'preview': 0, 'grace': 0},
        {'id': 'NO_PREVIEW', 'budget': 100000, 'preview': 0, 'grace': 5000},
        {'id': 'NO_GRACE', 'budget': 100000, 'preview': 2500, 'grace': 0},
        {'id': 'I_ONLY', 'budget': 100000, 'preview': 0, 'grace': 0},
        {'id': 'I10_FIXED_AUX', 'budget': 10000, 'preview': 2500, 'grace': 5000},
    ]
    slots = {'capture': 1112, 'matrix': (548 + 384) * 9 * 3,
             'endToEnd': (128 * 2 + 16) * 5 * 3, 'traceScreen': 32 * 2 * 2 * 2,
             'preflightMaximum': 64}
    seconds = {'capture': 340, 'matrix': 100, 'endToEnd': 220,
               'traceScreen': 100, 'preflightMaximum': 340}
    reserved = sum(slots[k] * seconds[k] for k in slots) / 3600
    result = {
        'schema': 1, 'status': 'SCOPE_FIXED_NOT_EXECUTION_AUTHORIZATION',
        'study': SEED, 'baselineCommit': '3a938a337706748890accd179f97d4ecf2d0d108',
        'sourceTemplate': str(SOURCE.relative_to(ROOT)).replace('\\', '/'),
        'sourceTemplateSha256': hashlib.sha256(raw).hexdigest(),
        'historicalExecutionAuthorizationInherited': False,
        'selectionSeed': SEED, 'developmentNotFresh': True,
        'excluded': {'mirrorGroup': box_group, 'commandIds': excluded,
                     'reason': 'retain BOX exclusion for this Fast campaign'},
        'allCommands': commands,
        'perSaveCaptureRule': 'same 548 boards/patterns; kind=per-save; omit wantedSave',
        'perSaveMatrixSample': {'maximum': 384, 'maxPerMirrorGroup': 4,
                               'selectionContract': 'docs/FAST_BENCHMARK_SCOPE_20261015_KO.md section 2'},
        'endToEndBaseCommandIds': panel_ids, 'edgeCommands': edges,
        'matrixArms': arms, 'endToEndArms': [a['id'] for a in arms[:5]],
        'repeats': 3, 'slots': slots, 'totalSlots': sum(slots.values()),
        'resourceCaps': {'maxMeasurementVMs': 16, 'runnerHours': 1200,
                         'elapsedHours': 96, 'memoryBytesPerScope': 3 * 1024**3,
                         'swapBytes': 0, 'startupSeconds': 30, 'reapSeconds': 5,
                         'matrixSeconds': 60, 'endToEndSeconds': 180,
                         'captureSeconds': 300, 'captureEnumerationSeconds': 60},
        'worstCaseCallReservationHours': reserved,
        'setupTransportControlReserveHours': 130,
        'totalReservationHours': reserved + 130,
        'executionLockStillRequired': ['actual Linux source/runtime/WASM hashes',
                                      'captured matrix identities and per-save sample',
                                      'concrete edge queues', 'complete call schedule'],
    }
    output = OUT
    if revision == 2:
        output = OUT.with_name('SCOPE_20261015_v2.json')
        result['schema'] = 2
        result['study'] = 'fast-budget-wide-v2-20261015'
        result['supersedes'] = {'file': OUT.name, 'sha256': hashlib.sha256(OUT.read_bytes()).hexdigest()}
        regression = copy.deepcopy(next(c for c in commands if c['mirrorGroup'] == grace and c['family'] != 'restricted-split'))
        regression.update(id='regression/grace-p7/minimals-ALL', pattern='*p7',
                          family='historical-regression', expectedCases=5040, queueLength=7,
                          savedPieceCount=3, regressionRole='historical K45 expectation; verify current result')
        result['regressionCommands'] = [regression]
        result['regressionCaptureModes'] = ['minimals']
        result['endToEndModes'] = [
            {'kind': 'minimals', 'wantedSave': 'ALL', 'idRule': 'base ID + /e2e-minimals'},
            {'kind': 'per-save', 'omitFields': ['wantedSave'], 'idRule': 'base ID + /e2e-per-save'},
        ]
        result['endToEndRegressionIds'] = [regression['id']]
        result['endToEndCommandCount'] = 273
        result['perSaveMatrixSample'].update(
            primaryHard=False, strata=['d4', 'u3', 'family2', 'previewEligible2'],
            populationWeights='descriptive cell counts only; inclusion probabilities unknown')
        result['supplementalMatrixArms'] = [
            {'id': 'I1_FIXED_AUX', 'budget': 1000, 'preview': 2500, 'grace': 5000},
            {'id': 'I10_NO_GRACE', 'budget': 10000, 'preview': 2500, 'grace': 0},
            {'id': 'P_ONLY_2x2', 'budget': None, 'preview': 2500, 'grace': 0},
        ]
        result['supplementalPanel'] = {'maximum': 96, 'primaryHard': False,
            'subsetOf': 'main matrix panel', 'repeats': 3,
            'selection': '48 previewEligible=true + 48 false, alternating ALL/per-save in hash order; see scope doc'}
        result['traceScreen'] = {'matrices': 32, 'arms': ['BASE100', 'I10_FIXED_AUX', 'DIRECT'],
                                'traceModes': ['ON', 'OFF'], 'repeats': 2}
        result['staticEquivalence'] = {'maySkip': ['primaryHard non-baseline arms',
            'NO_PREVIEW when previewEligible=false', 'I_ONLY when previewEligible=false'],
            'negativeControlMatricesPerClass': 8,
            'state': 'SKIPPED_STATIC_EQUIVALENCE', 'copyMeasuredTiming': False,
            'allowOutcomeDependentSkipping': False}
        slots.update(capture=1113, matrix=(549 + 384) * 9 * 3 + 96 * 3 * 3,
                     endToEnd=273 * 5 * 3, traceScreen=32 * 3 * 2 * 2)
        result['totalSlots'] = sum(slots.values())
        reserved = sum(slots[k] * seconds[k] for k in slots) / 3600
        result['worstCaseCallReservationHours'] = reserved
        result['setupTransportControlReserveHours'] = 100
        result['totalReservationHours'] = reserved + 100
        result['reviewSources'] = []
        for name in ['Gemini-4argon.md', 'deepseek-4.1flash.md']:
            review = ROOT.parent / 'fast2nd/20261015' / name
            result['reviewSources'].append({'path': '../fast2nd/20261015/' + name,
                                            'sha256': hashlib.sha256(review.read_bytes()).hexdigest()})
    assert result['totalReservationHours'] <= 1200
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'path': str(output), 'allCommands': len(commands),
                      'mirrorGroups': len(groups), 'slots': slots,
                      'totalSlots': result['totalSlots'],
                      'totalReservationHours': result['totalReservationHours']}, indent=2))


if __name__ == '__main__':
    main()

"""Append-only evidence observations. Projections are disposable; solver calls=0."""
import datetime
import hashlib
import json
import math
import sqlite3
from pathlib import Path


def encode(value):
    # Match the existing independent auditor's Node canonical-hash contract.
    def numbers(v):
        if isinstance(v,float):
            if not math.isfinite(v):raise ValueError('nonfinite JSON')
            return int(v) if v.is_integer() else v
        if isinstance(v,list):return [numbers(x) for x in v]
        if isinstance(v,dict):return {k:numbers(x) for k,x in v.items()}
        return v
    return json.dumps(numbers(value), ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def digest(value):
    return hashlib.sha256(encode(value).encode()).hexdigest()


def connect(file):
    file = Path(file)
    file.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(file)
    db.execute('PRAGMA synchronous=FULL')
    db.executescript('''
      CREATE TABLE IF NOT EXISTS events (
        seq INTEGER PRIMARY KEY, event_id TEXT UNIQUE NOT NULL, kind TEXT NOT NULL,
        observed_utc TEXT NOT NULL, previous_hash TEXT NOT NULL, payload TEXT NOT NULL,
        event_hash TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS no_event_update BEFORE UPDATE ON events
        BEGIN SELECT RAISE(ABORT, 'append-only ledger'); END;
      CREATE TRIGGER IF NOT EXISTS no_event_delete BEFORE DELETE ON events
        BEGIN SELECT RAISE(ABORT, 'append-only ledger'); END;
    ''')
    return db


def verified_events(db):
    previous = ''
    result = []
    for seq, event_id, kind, utc, parent, text, h in db.execute('SELECT * FROM events ORDER BY seq'):
        payload = json.loads(text)
        event = dict(eventId=event_id, kind=kind, observedUtc=utc, previousHash=parent, payload=payload)
        if parent != previous or digest(event) != h or event_id != digest(dict(kind=kind, payload=payload)):
            raise ValueError('ledger chain mismatch at event '+str(seq))
        previous = h
        result.append(dict(seq=seq, eventHash=h, **event))
    return result


def append(file, kind, payload):
    db = connect(file)
    try:
        db.execute('BEGIN IMMEDIATE')
        events = verified_events(db)
        if kind=='RUN_REGISTERED':
            for old in events:
                other=old['payload']
                if old['kind']==kind and (other['repository'],other['runId'])==(payload['repository'],payload['runId']) and other['manifestHash']!=payload['manifestHash']:
                    raise ValueError('registered run manifest changed')
        event_id = digest(dict(kind=kind, payload=payload))
        existing = next((e for e in events if e['eventId'] == event_id), None)
        if existing:
            db.rollback()
            return existing
        event = dict(eventId=event_id, kind=kind,
                     observedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                     previousHash=events[-1]['eventHash'] if events else '', payload=payload)
        h = digest(event)
        cursor = db.execute('INSERT INTO events(event_id,kind,observed_utc,previous_hash,payload,event_hash) VALUES(?,?,?,?,?,?)',
                            (event_id, kind, event['observedUtc'], event['previousHash'], encode(payload), h))
        db.commit()
        return dict(seq=cursor.lastrowid, eventHash=h, **event)
    finally:
        db.close()


def projection(file):
    db = connect(file)
    try:
        events = verified_events(db)
    finally:
        db.close()
    latest = {}
    analyses = []; attempts = []; registrations = {}; run_observations = {}; collections = []; datasets = []; designs = []
    for event in events:
        p = event['payload']
        if event['kind'] == 'COLLECTION':
            latest[(p['repository'], p['runId'], p['runAttempt'])] = p
            collections.append(p)
        elif event['kind'] == 'LLM_ANALYSIS':
            analyses.append(p)
        elif event['kind'] == 'COLLECTION_ATTEMPT':
            attempts.append(p)
        elif event['kind'] == 'RUN_REGISTERED':
            registrations[(p['repository'],p['runId'])]=p
        elif event['kind'] == 'RUN_OBSERVED':
            run_observations[(p['repository'],p['runId'])]=p
        elif event['kind'] == 'DATASET_PUBLISHED':
            datasets.append(p)
        elif event['kind'] == 'EXPERIMENT_DESIGN':
            designs.append(p)
    # Identity includes run and epoch-derived callId. Reused evidence is not a new call.
    calls = {}; starts = {}; budgets = {}; conflicts = []
    for observation in collections:
        for c in observation['accounting']['calls']:
            key = (observation['repository'], c['campaignId'], c['invocationId'], c['callId'])
            old = calls.get(key)
            if old and old.get('rawHash') and c.get('rawHash') and old['rawHash'] != c['rawHash']:
                conflicts.append(dict(identity=list(key), reason='CONFLICTING_RAW_OBSERVATIONS'))
            if not old or c.get('rawHash'):
                calls[key] = c
        for s in observation['accounting']['starts']:
            starts[(observation['repository'], s['campaignId'], s['invocationId'], s['executionAttemptId'])] = s
            key=(observation['repository'],s['campaignId'],s['invocationId'],s['callId'])
            calls.setdefault(key,dict(campaignId=s['campaignId'],invocationId=s['invocationId'],callId=s['callId'],
                                     status='UNKNOWN_START',executionAttemptId=s['executionAttemptId']))
        campaign = observation['campaignId']
        contract = observation['accounting'].get('budget')
        if contract:
            previous = budgets.get((observation['repository'], campaign))
            if previous and previous != contract:
                conflicts.append(dict(campaignId=campaign, reason='CAMPAIGN_BUDGET_OR_ORIGIN_CHANGED'))
            budgets[(observation['repository'], campaign)] = contract
    campaigns = []
    for (repo, campaign), contract in budgets.items():
        cs = [c for k, c in calls.items() if k[:2] == (repo, campaign)]
        finished = {(c['invocationId'], c.get('executionAttemptId')) for c in cs if c.get('rawHash')}
        unknown = [s for k, s in starts.items() if k[:2] == (repo, campaign)
                   and (s['invocationId'], s['executionAttemptId']) not in finished]
        counts = {}
        for c in cs:
            status = c.get('status') or 'PLANNED_WITHOUT_RESULT'
            counts[status] = counts.get(status, 0) + 1
        observations = [o for o in latest.values() if o['repository'] == repo and o['campaignId'] == campaign]
        # Each observation carries parent reservations + current run allocations.
        # Never sum these cumulative values across continuation runs.
        hours = [o['accounting']['cumulativeReservedRunnerHours'] for o in observations]
        cp = [o['accounting']['cumulativeCpSyntheticCalls'] for o in observations]
        # A versioned budget amendment can link a prior campaign without copying
        # its calls into the new measurement population or resetting admission.
        inherited=max((o['accounting'].get('priorReservedCalls',0) for o in observations),default=0)
        reserved=len(cs)+inherited
        complete=all(o['collectionState']=='COMPLETE' for o in observations) and not unknown and not conflicts
        campaigns.append(dict(repository=repo, campaignId=campaign, budget=contract,
            reservedCalls=reserved, budgetEvidenceComplete=complete,
            **(dict(currentCampaignCalls=len(cs),inheritedReservedCalls=inherited,
                priorCampaignIds=sorted({o['accounting']['priorCampaignId'] for o in observations if o['accounting'].get('priorCampaignId')})) if inherited else {}),
            remainingCallCap=contract['maxCalls']-reserved if complete else None,
            remainingCallCapUpperBound=contract['maxCalls']-reserved,statusCounts=counts,
            unknownStarts=unknown, cumulativeReservedRunnerHours=max(hours) if hours and all(v is not None for v in hours) else None,
            cumulativeCpSyntheticCalls=max(cp) if cp and all(v is not None for v in cp) else None))
    summaries=[]
    for o in latest.values():
        summaries.append({**o,'accounting':{k:v for k,v in o['accounting'].items() if k not in ['calls','starts']},
                          'knownCallSlots':len(o['accounting']['calls']),'durableStarts':len(o['accounting']['starts'])})
    return dict(schemaVersion=1, ledgerHead=events[-1]['eventHash'] if events else '',
                observations=summaries, campaigns=campaigns, conflicts=conflicts,
                analyses=analyses, collectionAttempts=attempts, datasets=datasets, experimentDesigns=designs,
                registrations=[{k:v for k,v in r.items() if k!='manifest'} for r in registrations.values()],
                runObservations=list(run_observations.values()),
                performanceDecision='LLM_REVIEW_REQUIRED', solverCalls=0)

"""Freeze full original commands, audit fixtures and authorized RC comparison."""
import argparse,collections,hashlib,json,sqlite3,subprocess,sys,zipfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'postprocess'))
from ledger import projection,encode,digest
def sha(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def write(p,v):
    p.parent.mkdir(parents=True,exist_ok=True)
    with p.open('x',encoding='utf8') as f:f.write(encode(v)+'\n')
def prepare(files,out,release_assets):
    out.mkdir(parents=True,exist_ok=False);(out/'fixtures').mkdir();refs=[];commands=[]
    collection=files/'triage-database';rc=files/'release-candidates/P15_RC1_20261011'
    frozen=files/'benchmark-prepared/triage-p15-promotion-20261010-r14-frozen'
    m14=json.loads((frozen/'MANIFEST.json').read_text());allrefs=[r for r in m14['inputs'] if r['metadata']['dataset']=='ALL']
    assert len(allrefs)==548
    def fixture(data):
        h=hashlib.sha256(data).hexdigest();p=out/'fixtures'/(h+'.json')
        if not p.exists():p.write_bytes(data)
        f=json.loads(data);return f,dict(id=f['id'],filter=f['origin']['filter'],member='fixtures/'+h+'.json',sha256=h)
    for r in allrefs:
        f,ref=fixture((frozen/r['member']).read_bytes());assert ref['sha256']==r['sha256']
        commands.append(dict(command=f['origin']['command'],filters=['ALL'],fixtures=[ref],dataset='ALL',mirror=r['metadata']['mirror_group']))
    db=sqlite3.connect((collection/'per-save/per-save.sqlite').as_uri()+'?mode=ro',uri=True);db.row_factory=sqlite3.Row
    groups=collections.defaultdict(list)
    for r in db.execute('SELECT f.*,s.workspace_path FROM fixtures f JOIN sources s ON s.source_id=f.fixture_source_id'):groups[r['command_id']].append(dict(r))
    with zipfile.ZipFile(files/'archive/workspace-cleanup-20261010/HISTORY.zip') as z, zipfile.ZipFile(files/'archive/secondary-cleanup-20261006/HISTORY.zip') as original_archive:
        for c in db.execute('SELECT * FROM captures ORDER BY command_id'):
            original=None;fr=[]
            for r in groups[c['command_id']]:
                p=Path(r['workspace_path']);member='objects/'+r['fixture_sha256']
                data=p.read_bytes() if p.is_file() else (z if member in z.namelist() else original_archive).read(member)
                f,ref=fixture(data);assert ref['sha256']==r['fixture_sha256'];fr.append(ref);original=f['origin']['command']
            if original is None:
                original=dict(id=c['command_id'],kind='per-save',sourceFumen=c['fumen'],pattern=c['pattern'],family=c['family'],
                    mirrorGroup=c['mirror_group'],clear=c['clear'],useHold=bool(c['hold']),piecesNeeded=c['pieces_needed'],
                    queueLength=c['queue_length'],savedPieceCount=c['saved_piece_count'],exactHumanQuality='true')
            commands.append(dict(command=original,filters=list('IJLOSTZ'),fixtures=fr,dataset='PER_SAVE',mirror=c['mirror_group']))
    db.close();assert len(commands)==1098
    for entry in commands:
        c=entry['command'];assert c['queueLength']!=11 and c['queueLength']==c['piecesNeeded']+1
        assert c['clear']==4 and c['useHold'] is True
        h=digest(entry);member='commands/'+h+'.json';write(out/member,entry)
        # write adds newline; byte identity differs from canonical value digest.
        actual=sha(out/member);target=out/'commands'/(actual+'.json');(out/member).rename(target)
        refs.append(dict(id=c['id'],sha256=actual,member='commands/'+actual+'.json',metadata=dict(productCommand=True,
            dataset=entry['dataset'],family=c['family'],pattern=c['pattern'],mirror_group=entry['mirror'],fixtureCount=len(entry['fixtures']))))
    refs.sort(key=lambda r:r['id']);assert len({r['id'] for r in refs})==1098
    prior=projection(files/'benchmark-ledger/LEDGER.sqlite');assert not prior['conflicts']
    write(out/'PRIOR_ACCOUNTING.json',prior)
    rcmanifest=json.loads((rc/'RC_MANIFEST.json').read_text());products={}
    assets=json.loads(release_assets.read_text())
    for arm,dirname in [('DEV','dev-product'),('RC','rc-product')]:
        archive=rc/rcmanifest['archives'][arm]['archive'];assert sha(archive)==rcmanifest['archives'][arm]['sha256']
        remote=next(a for a in assets if a['name']==archive.name);assert remote['digest']=='sha256:'+sha(archive)
        rcmanifest['archives'][arm]['assetId']=remote['id']
        (out/archive.name).write_bytes(archive.read_bytes())
        inventory=json.loads((rc/(arm+'_FILES.json')).read_text())
        for f in inventory['productFiles']:products[dirname+'/'+f['path']]=f['sha256']
    source={}
    for n in subprocess.check_output(['git','ls-files','tools/secondary-bench','.github/workflows','src','wasm','package.json','package-lock.json'],text=True).splitlines():
        p=Path(n)
        if n.startswith(('src/','wasm/')) or n in ['package.json','package-lock.json']:
            data=subprocess.check_output(['git','show','HEAD:'+n]);products[n]=hashlib.sha256(data).hexdigest()
        elif n.endswith(('.mjs','.py','.sh','.json','.yml','.yaml')):source[n]=hashlib.sha256(subprocess.check_output(['git','show','HEAD:'+n])).hexdigest()
    tasks=[];phases=['RC_INITIAL_1','RC_INITIAL_2','RC_INITIAL_3','RC_CONFIRMATION_1','RC_CONFIRMATION_2']
    for phase in phases:
        for block in [1,2]:
            for r in sorted(refs,key=lambda r:digest([phase,r['id']])):
                arms=['DEV','RC']
                if int(digest([phase,r['id']])[:8],16)%2==block%2:arms.reverse()
                tasks.append(dict(task_id=f'{phase}-{block}-'+digest(r['id'])[:24],phase=phase,block=block,arms=arms,calls=2,
                    fixture_ids=[r['id']],conditional='CONFIRMATION' in phase))
    (out/'TASKS.jsonl').write_text(''.join(encode(t)+'\n' for t in tasks),encoding='utf8')
    job=dict(parts=12,jobMs=325*60000,reserveMs=5*60000,setupMs=10*60000,checkpointMs=2*60000,finalTransportMs=15*60000,
        transportAuditMs=3*60000,jobMinutes=350,scopeOverheadMs=20000)
    mandatory=[]
    for r in refs:
        if any(s in r['id'] for s in ['row-026/','row-140/','row-219/','row-292/','row-312/','row-346/','cycle1-pcinfo-024/','pcinfokorea-c2-029/','row-122/','row-161/','cycle1-alt-shoes-a/']):mandatory.append(r['id'])
    profile=dict(id='triage-cold-v1',lifecycle='fresh-process-cold',exactHumanQuality='true',timingContract='product-command-cold-settled-v1',
        memoryScope='command-process-tree',memoryMaxBytes=3221225472,swapMaxBytes=0,
        threads=dict(rustPrimary=1,highsPrimary=1,cpsatPrimary=2,rustSecondary=1,cpsatSecondary=1),productPolicy='UNCHANGED_COMMITTED_DEFAULT_PER_ARM',callTimeoutMs=600000)
    m=dict(schemaVersion=1,campaignId='RC_DEV_PRODUCT_20261011_R15',revision=15,purpose='product-integration-rc-dev',freshValidation=False,
        profile='triage-cold-v1',profileContract=profile,maxParallel=16,maxCalls=21960,maxRunnerHours=5382,overallMs=21*86400000,job=job,
        inputs=refs,baselineFiles=[],sourceFiles=dict(product=products,harness=source),tasksHash=sha(out/'TASKS.jsonl'),
        approval='USER_FULL_CENSUS_2X3_PLUS_2X2_16VM_STOPPABLE_AFTER_FIRST_CENSUS_20261011',
        measurement=dict(adapter='triage-fixture',variants=['DEV','RC']),analysis='AUTHORED_PRODUCT_RELEASE_DECISION',
        auditContract=dict(id='product-command-independent-python-v1',prerequisiteJobs=[],solverReplay=False,performancePass=False),
        evidence=dict(schemaVersion=1,retentionDays=30,retries=2,diskReserveBytes=4*1024**3),
        integration=dict(id='rc-dev-product-v1',rcCommit=rcmanifest['archives']['RC']['commit'],devCommit=rcmanifest['archives']['DEV']['commit'],
            originUtc='2026-10-10T17:13:25Z',priorControlHours=4/3,activationRecoveryRuns=[38070850805,38071021444],
            archives=rcmanifest['archives'],initialRounds=3,confirmationRounds=2,repeatsPerRound=2,newCpCalls=0,maxMatrixJobs=920,
            priorAccountingSha256=sha(out/'PRIOR_ACCOUNTING.json'),rcPackageSha256=sha(rc/'PACKAGE.json'),mandatoryConfirmation=mandatory,
            budgetAuthorization='NEW_RC_INTEGRATION_AUTHORIZATION_LINKED_TO_UNMODIFIED_PRIOR_LEDGER',
            excludedEmptyBoard11P=[],emptyPerSaveCommands=[e['command']['id'] for e in commands if not e['fixtures']]),
        provenance=dict(role='development',priorLedgerHead=prior['ledgerHead'],priorEvidencePooled=False),
        budget=dict(maxParallel=16,overallMs=21*86400000,maxCalls=21960,job=job))
    write(out/'MANIFEST.json',m)
    with zipfile.ZipFile(out/'RC_INTEGRATION_INPUTS.zip','x',compression=zipfile.ZIP_DEFLATED) as z:
        for p in sorted(out.rglob('*')):
            if p.is_file() and p.name!='RC_INTEGRATION_INPUTS.zip':z.write(p,p.relative_to(out).as_posix())
    write(out/'START.json',dict(confirm='RUN_RC_DEV_16VM',assetId=None,bundleSha256=sha(out/'RC_INTEGRATION_INPUTS.zip'),manifestHash=digest(m)))
    print(encode(dict(inputs=len(refs),fixtures=len(list((out/'fixtures').iterdir())),firstRoundCalls=4392,initialCalls=13176,maxCalls=21960,solverCalls=0)))
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--files',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--release-assets',type=Path,required=True)
    a=p.parse_args();prepare(a.files,a.out,a.release_assets)

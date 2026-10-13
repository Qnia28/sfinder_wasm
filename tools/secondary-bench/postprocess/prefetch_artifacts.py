"""Bounded parallel, hash-verified cache fill for the common package collector.

No packaging or execution verdict; package.py still verifies final inventory.
"""
import argparse,concurrent.futures,json,os,subprocess,uuid,threading,urllib.request,urllib.error
from pathlib import Path
from package import api,role,sha

def large_download(repo,a,temp,workers):
    """Bounded ranged transport for large immutable ZIPs; URLs/tokens stay in memory."""
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    token=subprocess.check_output(['gh','auth','token'],text=True,timeout=30).strip()
    request=urllib.request.Request(f'https://api.github.com/repos/{repo}/actions/artifacts/{a["id"]}/zip',headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json'})
    try:
        urllib.request.build_opener(NoRedirect).open(request,timeout=60)
        raise ValueError('expected artifact redirect')
    except urllib.error.HTTPError as e:
        try:
            if e.code!=302:raise RuntimeError('artifact redirect HTTP '+str(e.code)) from None
            url=e.headers['Location']
        finally:e.close()
    total=a['size_in_bytes'];size=4*1024**2
    def chunk(start):
        end=min(total,start+size)-1
        req=urllib.request.Request(url,headers={'Range':f'bytes={start}-{end}'})
        try:
            with urllib.request.urlopen(req,timeout=180) as response:
                if response.status!=206 or response.headers.get('Content-Range')!=f'bytes {start}-{end}/{total}':raise ValueError('range identity')
                data=response.read(end-start+2)
        except urllib.error.URLError as e:raise RuntimeError('range transport failed: '+type(e).__name__) from None
        if len(data)!=end-start+1:raise ValueError('range length')
        return start,data
    with temp.open('xb') as stream,concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures=[pool.submit(chunk,start) for start in range(0,total,size)]
        for future in concurrent.futures.as_completed(futures):
            start,data=future.result();stream.seek(start);stream.write(data)
def prefetch(repo,run,out,workers):
    objects=out/'objects';objects.mkdir(parents=True,exist_ok=True)
    inventory=[a for page in api(repo,f'actions/runs/{run}/artifacts?per_page=100',True) for a in page['artifacts']]
    (out/'PREFETCH_INVENTORY.json').write_text(json.dumps(inventory),encoding='utf8')
    stopped=threading.Event()
    def get(a):
        if stopped.is_set():return 'DEFERRED'
        if role(a['name'])=='excluded':return 'EXCLUDED'
        assert not a['expired'] and a['digest'].startswith('sha256:')
        h=a['digest'][7:];dest=objects/(h+'.zip')
        if dest.exists():assert sha(dest)==h;return 'CACHED'
        temp=objects/(h+'.prefetch-'+uuid.uuid4().hex)
        try:
            if a['size_in_bytes']>=64*1024**2:
                large_download(repo,a,temp,min(workers,6))
            else:
                with temp.open('xb') as f:
                    result=subprocess.run(['gh','api',f'repos/{repo}/actions/artifacts/{a["id"]}/zip'],stdout=f,stderr=subprocess.PIPE,timeout=300)
                if result.returncode:
                    stopped.set()
                    raise RuntimeError(result.stderr.decode(errors='replace'))
            assert sha(temp)==h,'artifact hash';os.replace(temp,dest);return 'DOWNLOADED'
        finally:temp.unlink(missing_ok=True)
    from collections import Counter
    counts=Counter();errors=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures={pool.submit(get,a):a for a in inventory}
        for f in concurrent.futures.as_completed(futures):
            try:counts[f.result()]+=1
            except Exception as e:errors.append(dict(artifactId=futures[f]['id'],error=str(e)))
    print(json.dumps(dict(counts=dict(counts),errors=errors,solverCalls=0)));return errors
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--repo',required=True);p.add_argument('--run',required=True,type=int);p.add_argument('--out',type=Path,required=True);p.add_argument('--workers',type=int,default=8,choices=range(1,17));a=p.parse_args();raise SystemExit(bool(prefetch(a.repo,a.run,a.out,a.workers)))

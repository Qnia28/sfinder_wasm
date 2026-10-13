"""Range-cache transport accepts only exact offsets; no remote calls."""
import io,os,sys,tempfile,unittest,urllib.error
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools/secondary-bench/postprocess'))
import prefetch_artifacts as p

class Response(io.BytesIO):
    status=206
    def __init__(self,data,content_range):
        super().__init__(data);self.headers={'Content-Range':content_range}

class Tests(unittest.TestCase):
    def test_range_identity_and_exact_reassembly(self):
        data=b'x'*(4*1024**2)+b'end'
        class Redirect:
            def open(self,req,timeout):
                raise urllib.error.HTTPError(req.full_url,302,'redirect',{'Location':'https://example.invalid/zip'},None)
        for bad in [False,True]:
            def get(req,timeout):
                self.assertFalse(req.has_header('Authorization'))
                start,end=map(int,req.get_header('Range').removeprefix('bytes=').split('-'))
                return Response(data[start:end+1],f'bytes {start+int(bad)}-{end}/{len(data)}')
            with tempfile.TemporaryDirectory(dir=Path(os.environ['LOCALAPPDATA'])/'Temp/opencode') as tmp:
                dest=Path(tmp)/'download'
                with patch.object(p.subprocess,'check_output',return_value='synthetic-token'),patch.object(p.urllib.request,'build_opener',return_value=Redirect()),patch.object(p.urllib.request,'urlopen',side_effect=get):
                    if bad:
                        with self.assertRaisesRegex(ValueError,'range identity'):p.large_download('owner/repo',{'id':1,'size_in_bytes':len(data)},dest,2)
                    else:
                        p.large_download('owner/repo',{'id':1,'size_in_bytes':len(data)},dest,2)
                        self.assertEqual(dest.read_bytes(),data)

if __name__=='__main__':unittest.main()

"""No model/provider calls: parse actual stream and validate channel boundary."""
import importlib.util, io, json, sys, unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('bus_watch',Path(__file__).resolve().parents[1]/'bin'/'bus-watch.py')
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
class Stream(io.BytesIO):
    def __enter__(self): return self
    def __exit__(self,*args): self.close()
class Tests(unittest.TestCase):
    def test_persistent_stream_uses_authorization_and_keeps_id(self):
        received=[]
        def open_request(req,timeout):
            received.append((req,timeout))
            return Stream(b': connected\n\nevent: message\nid: 7\ndata: {"id":7,"sender":"peer","recipient":"worker","body":"ready"}\n\n')
        with patch.object(w.bus,'REMOTE_URL','http://127.0.0.1:47800'),patch.object(w.bus,'REMOTE_TOKEN','test-only'),patch.object(w.urllib.request,'urlopen',open_request):
            messages=list(w.events('worker',6))
        self.assertEqual(messages[0]['body'],'ready');self.assertEqual(len(received),1)
        self.assertIsNone(received[0][1]);self.assertIn('after=6',received[0][0].full_url)
        self.assertEqual(received[0][0].get_header('Authorization'),'Bearer test-only')
    def test_mismatched_event_id_cannot_deliver(self):
        with patch.object(w.bus,'REMOTE_URL','http://127.0.0.1:47800'),patch.object(w.bus,'REMOTE_TOKEN','test-only'),patch.object(w.urllib.request,'urlopen',return_value=Stream(b'id: 7\ndata: {"id":8,"body":"wrong"}\n\n')):
            self.assertEqual(list(w.events('worker')),[])
    def test_channel_requires_explicit_sender_allowlist(self):
        with self.assertRaisesRegex(ValueError,'ALLOW'):
            w.channel('worker',set())
    def test_channel_declares_only_opted_in_delivery_without_permission_relay(self):
        req={'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-03-26'}}
        output=io.StringIO()
        with patch.object(sys,'stdin',io.StringIO(json.dumps(req)+'\n')),patch.object(sys,'stdout',output):
            w.channel('worker',{'peer'})
        r=json.loads(output.getvalue())['result'];self.assertIn('claude/channel',r['capabilities']['experimental'])
        self.assertNotIn('claude/channel/permission',r['capabilities']['experimental'])
if __name__=='__main__': unittest.main()

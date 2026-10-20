"""Wake this Cursor chat when Agent Bus mail arrives for cursor-worker.

Prints one AGENT_BUS_CURSOR_WAKE line per allowed sender. Cursor notify_on_output
turns that into a follow-up in the sharing session. Does not drive Codex Desktop
or steal focus. Stop: node/python stop file or `python bin/bus-cursor-chat-wake.py stop`.
"""
import importlib.util
import json, os, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import agent_bus_mcp as bus

def _watchmod():
    spec = importlib.util.spec_from_file_location('bus_watch', ROOT / 'bin' / 'bus-watch.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

STATE = ROOT / 'var' / 'cursor-chat-bridge-state.json'
PID = ROOT / 'var' / 'cursor-chat-wake.pid'
STOP = ROOT / 'var' / 'cursor-chat-wake.stop'
MAILBOX = 'cursor-worker'
SKIP = {'cursor-worker', 'hub-47801-probe'}
ALLOW = {'editor-agent-bus'}


def load_state():
    try:
        return json.loads(STATE.read_text(encoding='utf-8'))
    except Exception:
        return {'after': 0, 'delivered': [], 'skipped': []}


def save_state(st):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(st, indent=2), encoding='utf-8')


def should_skip(row):
    sender = str(row.get('sender') or '')
    if sender in SKIP or sender == MAILBOX:
        return 'loop-self' if sender == MAILBOX else 'skip-sender'
    if sender not in ALLOW:
        return 'not-allowlisted'
    dest = str(row.get('recipient') or '')
    if dest and dest not in (MAILBOX, 'all'):
        return 'not-for-mailbox'
    return None


def request_stop():
    STOP.parent.mkdir(parents=True, exist_ok=True)
    STOP.write_text(time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), encoding='utf-8')


def listen():
    if STOP.exists():
        STOP.unlink()
    st = load_state()
    PID.parent.mkdir(parents=True, exist_ok=True)
    PID.write_text(str(os.getpid()), encoding='utf-8')
    bus.call_tool('bus_register', {'name': MAILBOX, 'kind': 'cursor-chat', 'note': 'This Cursor session wake'})
    after = int(st.get('after') or 0)
    print(json.dumps({'listening': MAILBOX, 'after': after, 'state': str(STATE), 'pid': os.getpid()}), flush=True)
    watchmod = _watchmod()
    for message in _iter(watchmod, after):
        if STOP.exists():
            print(json.dumps({'stopping': True}), flush=True)
            return
        mid = int(message['id'])
        st['after'] = max(int(st.get('after') or 0), mid)
        if mid in st.get('delivered', []) or mid in st.get('skipped', []):
            save_state(st)
            print(json.dumps({'action': 'duplicate', 'id': mid}), flush=True)
            continue
        reason = should_skip(message)
        if reason:
            st.setdefault('skipped', []).append(mid)
            st['skipped'] = st['skipped'][-400:]
            save_state(st)
            print(json.dumps({'action': 'skip', 'id': mid, 'reason': reason}), flush=True)
            continue
        st.setdefault('delivered', []).append(mid)
        st['delivered'] = st['delivered'][-400:]
        save_state(st)
        body = str(message.get('body') or '')
        print('AGENT_BUS_CURSOR_WAKE ' + json.dumps({
            'id': mid,
            'sender': message.get('sender'),
            'recipient': message.get('recipient'),
            'body': body[:4000],
        }, ensure_ascii=False), flush=True)


def _iter(watchmod, after):
    cursor = after
    backoff = 1
    while True:
        if STOP.exists():
            return
        try:
            for message in watchmod.events(MAILBOX, cursor):
                if STOP.exists():
                    return
                if int(message['id']) <= cursor:
                    continue
                cursor = int(message['id'])
                yield message
                backoff = 1
            raise ConnectionError('Push stream closed')
        except (KeyboardInterrupt, BrokenPipeError):
            return
        except Exception as error:
            print('Push disconnected: ' + str(error) + '; reconnecting with cursor ' + str(cursor), file=sys.stderr, flush=True)
            time.sleep(backoff)
            backoff = min(30, backoff * 2)


def stop():
    request_stop()
    pid = 0
    try:
        pid = int(PID.read_text(encoding='utf-8').strip())
    except Exception:
        pid = 0
    if pid and pid != os.getpid():
        try:
            os.kill(pid, 9)
        except OSError:
            pass
    print(json.dumps({'stop': True, 'pid': pid or None}), flush=True)


def main():
    cmd = (sys.argv[1] if len(sys.argv) > 1 else 'listen')
    if cmd == 'stop':
        stop()
    elif cmd == 'status':
        print(json.dumps(load_state(), indent=2), flush=True)
    else:
        listen()


if __name__ == '__main__':
    main()

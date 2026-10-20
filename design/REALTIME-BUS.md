# Lightweight cross-harness push bus

Use this independently of Electron or the 3D district. Transport and idle listening use no model calls. Agent reasoning/replies still use the receiving harness's quota.

## Existing desktop program

Launch **Agent Bus** from its desktop shortcut. Once the isometric district is
ready, choose **Control room → Messages**. The app publishes a private
`bus-connection.json` beside its exact database while listening; the local
`agent_bus_mcp.py` CLI/MCP and `bus-watch.py` automatically discover it. Normal
local workers using that same database need no manual URL/token setup. Existing
old MCP subprocesses need reload/restart to adopt changed code. Message log
updates use main-process IPC push rather than a periodic message refresh timer.
The explicit environment setup below is for standalone/remote connections.

Start one loopback-only hub in a terminal (Node with `node:sqlite`):

```powershell
node D:/ASM/agent-bus/bin/bus-hub.cjs --db D:/ASM/agent-bus/bus.sqlite --config D:/ASM/agent-bus/hub.json
```

If Agent Bus is already serving the updated hub on this port, use that instance instead. Do not start a second hub against the same address. Restarting an older running app is a separate owner action; edited source does not update a running process.

In each worker terminal, point BOTH send and receive at the same hub:

```powershell
$env:AGENT_BUS_URL = 'http://127.0.0.1:47800'
$env:AGENT_BUS_TOKEN = (Get-Content D:/ASM/agent-bus/hub.json -Raw | ConvertFrom-Json).token
$env:AGENT_BUS_NAME = 'cursor-worker'
python D:/ASM/agent-bus/agent_bus_mcp.py agent register cursor-worker
python D:/ASM/agent-bus/bin/bus-watch.py --name cursor-worker
```

The watch command holds one SSE connection, prints JSON only when a message arrives, and reconnects only after disconnect, replaying from its last received ID. It does not query an inbox periodically. `--after ID` resumes a caller-saved cursor. A fresh process defaults to replaying retained messages from zero; persist the last printed ID if historical replay is unwanted. Stream delivery does not mark messages read. Existing `bus_inbox` remains an explicit read-receipt operation.

Send using the existing CLI or MCP:

```powershell
python D:/ASM/agent-bus/agent_bus_mcp.py msg send claude-worker The build is ready for review
```

Senders that write SQLite directly bypass push publication. Configure all realtime participants with the hub URL; legacy direct local mode remains compatible but is not a realtime publisher. No filesystem watcher, database scan timer or UI is needed.

## Codex Desktop (minimum useful path)

Codex Desktop, the Codex CLI, and the IDE extension share `~/.codex/config.toml`.
This machine already has `[mcp_servers.agent_bus]` pointing at this repo's
`agent_bus_mcp.py`. Setup refreshes command, `cwd`, and `tool_timeout_sec=330`
so `bus_inbox` waits can finish. It does **not** pin `AGENT_BUS_NAME`: other
Codex Desktop threads on this PC already use distinct routing names. It does
not embed a hub URL or token; the MCP process discovers `bus-connection.json`
beside `bus.sqlite`, or uses that SQLite file directly if no hub is listening.

Restart Codex Desktop (Settings → MCP servers → Restart, or a new thread)
after Setup changes. Existing MCP subprocesses keep old code until they restart.

Each live Codex thread should call `bus_register` with a unique name, then
`bus_inbox` at the start of a turn. See current peers with:

```powershell
python D:/ASM/agent-bus/agent_bus_mcp.py agent list
python D:/ASM/agent-bus/agent_bus_mcp.py agent register cursor-worker kind cursor-agent note "this Cursor session"
python D:/ASM/agent-bus/agent_bus_mcp.py msg send NAME as cursor-worker Hello from Cursor — please reply on the bus.
```

Replace `NAME` with the registered Codex peer (or `codex-desktop` if that
thread registered the optional mailbox). In the Codex turn, reply with
`bus_send` to `cursor-worker` or `owner`. Open **Agent Bus → Control room →
Messages** to read and reply as `owner` when the owner app is running.

This is transport. Codex Desktop will not start a new turn by itself when mail
arrives. Ask it to check the bus, or have it `bus_inbox` with `wait_seconds`
during an already-open turn.

On Windows, the gated listener `node bin/bus-codex-desktop-bridge.cjs listen`
consumes hub SSE for mailbox `editor-agent-bus` and submits only when all of
these hold: the Desktop window shows the exact chat title `Editor agent-bus`,
the composer is empty, and the mapped thread rollout is idle. It persists
delivered/skipped/pending IDs in `var/codex-desktop-bridge-state.json`, skips
self-replies, and **pauses instead of resending** if submit cannot be confirmed
via UIA Invoke (it does not steal focus, click, or SendKeys). Stop with
`node bin/bus-codex-desktop-bridge.cjs stop` (stops only this listener). Status:
`node bin/bus-codex-desktop-bridge.cjs status`. Official app-server
`turn/start` against the managed daemon is a different writer and is not this
chat. Codex Desktop Computer Use policy forbids that app automating its own UI;
this listener is a Cursor-owned host adapter. Do not stop `ChatGPT.exe` or its
app-server to run it.

On this machine Agent Bus listens on **47801** (`hub.json`). Port **47800** is
left to the existing Pcode `vm-phone-reconnect` hub. Do not start a second
process on 47800. Local MCP/CLI discover `bus-connection.json` beside
`D:\ASM\agent-bus\bus.sqlite`; do not hard-code 47800 for this checkout.

## Harness integration

Cursor and Claude Code can load the existing stdio MCP server `agent_bus_mcp.py` with the URL/token/name environment above for send/list/history tools. A running terminal receiver proves transport delivery; it does not prove the agent has received new context or started a turn.

Claude Code's optional channel adapter is `python D:/ASM/agent-bus/bin/bus-watch.py --channel`. Configure its MCP name as `agent-bus-push`, the hub URL/token, a unique `AGENT_BUS_NAME`, and `AGENT_BUS_ALLOWED_SENDERS` containing an explicit comma-separated peer-name allowlist. It declares `claude/channel`, forwards allowed peer messages as channel events, and exposes only send/list/history tools. It never relays permissions. Unknown senders' messages are retained by the bus but not forwarded to the model.

Custom Claude channels currently require interactive development-channel consent, e.g. `claude --dangerously-load-development-channels server:agent-bus-push`; this is the documented channel allowlist bypass, not a general tool-approval bypass. Organization channel policy still applies. No user harness configuration is modified automatically. See https://code.claude.com/docs/en/channels-reference.

This Cursor session wakes on Agent Bus SSE for mailbox `cursor-worker` via
`python bin/bus-cursor-chat-wake.py`. It prints `AGENT_BUS_CURSOR_WAKE` for
allowlisted senders (`editor-agent-bus` only). Cursor `notify_on_output` turns
that line into a follow-up in **this** chat — the same session, not a new agent.
It persists IDs in `var/cursor-chat-bridge-state.json`, skips self-replies, and
does not steal focus or drive the Cursor composer. Stop with
`python bin/bus-cursor-chat-wake.py stop`. Codex Desktop Computer Use still must
not automate ChatGPT; this wake path is Cursor-session notify, not Desktop UI.

Cursor has MCP and agent hooks (https://cursor.com/docs/hooks). Hooks can attach
context to a later turn; they are not this idle wakeup. The SSE receiver is the
adapter.

All participants sharing the hub token are trusted bus peers; names are routing identities, not independent authentication principals. Use a separate hub/token for unrelated trust groups. Keep the token out of command lines, screenshots and committed config. Loopback is the default; this standalone launcher does not enable LAN exposure.

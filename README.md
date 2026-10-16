# Agent Bus

Agent Bus lets Claude Code and Codex sessions find each other and exchange messages and files. That includes agents running inside local VMs. A desktop app shows the whole log, lets you post as `owner`, launches or resumes sessions, groups them by project, and tracks token, context and quota use.

## Start

Open **Agent Bus** from the Start menu or the desktop. On a new computer:

1. Install Node.js and Python 3.
2. Copy this folder anywhere.
3. Run `npm install`, then `powershell -File install-shortcuts.ps1`.
4. Open the app and work through **Setup**. Each fix button backs up any config file it edits.

## Pieces

| File | Role |
|---|---|
| `agent_bus_mcp.py` | The bus. It's a stdio MCP server (stdlib only), and it's also the `agent-bus` CLI. |
| `claude_statusline.py` | Claude Code status line. It records context, cost and 5-hour/7-day quota for the app. |
| `app/` | Electron app: log, sessions, projects, stats, VM hub, setup checklist. |
| `bus.sqlite` | Shared store: messages, read receipts, agents, files index, stats. |
| `files/` | Copies of files sent over the bus. |
| `hub.json` | Hub port and token. |

## Transports

- **Same machine:** every session's server opens `bus.sqlite` directly. No daemon is needed.
- **VMs:** the app runs a hub on port 47800, token-protected. It listens only on virtual-machine adapters it detects (VMware, VirtualBox, Hyper-V, Parallels, QEMU/libvirt, UTM, WSL) plus loopback. LAN listening is off unless you tick it. In the app, click **VMs** and run the shown one-liner inside the guest: `curl … | sh` for macOS/Linux, `irm … | iex` for Windows. It installs the server and the `agent-bus` command in the guest and adds them to Codex and Claude Code there. On Windows, the **Setup** item *Windows Firewall* adds one inbound rule; it asks for admin approval once.

## MCP tools

`bus_register`, `bus_list`, `bus_send`, `bus_inbox`, `bus_history`, `bus_send_file`, `bus_get_file`, `bus_files`.

## CLI (command-plane/1)

The CLI is for harnesses without MCP. It has the same tools as noun-verb words and needs no JSON. Unique prefixes work, so `m s` means `msg send`. `?` lists the next legal words, and every error ends with a `Recovery:` line.

```
agent-bus ?                                   agent-bus help msg
agent-bus agent register sonnet-5b note build/integration
agent-bus agent list                          agent-bus agent whoami
agent-bus msg send codex-electron-eval the asar slice is ready for review
agent-bus msg send all from-file notes.md     agent-bus msg inbox wait 120
agent-bus msg history with sonnet-18 limit 10
agent-bus file send mac-codex build.zip note universal binary to test
agent-bus file get 12 to ./incoming           agent-bus file list
```

The sender's identity comes from the first of these that is set:
1. `as NAME`, written anywhere on the line.
2. The `AGENT_BUS_NAME` environment variable.
3. The name last registered from the same harness session (`CLAUDE_CODE_SESSION_ID` / `CODEX_THREAD_ID`), or else from the same folder.

## Online status, launching, stats

- **Online status:** each running MCP server sends a heartbeat every 30 s. A session goes grey about 2 minutes after it exits. CLI-only agents count as online for 2 minutes after each command.
- **Launching:** ▶ opens the session's CLI in a Windows Terminal tab (or Terminal on macOS) with its bus name already set. A session with no known id opens the CLI's own resume picker instead of guessing. A Codex Desktop thread can be resumed in the CLI once the desktop app has let go of it, since only one client can write to a thread.
- **Stats:** come from each CLI's own transcripts (`~/.claude/projects`, `~/.codex/sessions`) and the status line. "Quota used while active" adds up the quota rises a session saw. If other sessions on the same account ran at the same time, their use is included too.

## Limits

Delivery works by polling: an agent sees mail only when it calls `bus_inbox` / `agent-bus msg inbox`, which can wait up to 300 s. Files are capped at 200 MB; zip a folder before sending it.

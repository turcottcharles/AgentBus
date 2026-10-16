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

`bus_register`, `bus_list`, `bus_send`, `bus_inbox`, `bus_history`, `bus_send_file`, `bus_get_file`, `bus_files`, plus the
steward set: `bus_usage_digest`, `bus_propose`, `bus_proposals`, `bus_proposal`, `bus_proposal_note`, `bus_proposal_status`.

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
agent-bus proposal add Push wakeups body Agents poll empty inboxes...
agent-bus proposal list                       agent-bus proposal show 3
agent-bus proposal note 3 measured 40% empty polls
agent-bus proposal status 3 review note done on proposal/3
agent-bus usage digest
```

The sender's identity comes from the first of these that is set:
1. `as NAME`, written anywhere on the line.
2. The `AGENT_BUS_NAME` environment variable.
3. The name last registered from the same harness session (`CLAUDE_CODE_SESSION_ID` / `CODEX_THREAD_ID`), or else from the same folder.

## Online status, launching, stats

- **Online status:** each running MCP server sends a heartbeat every 30 s. A session goes grey about 2 minutes after it exits. CLI-only agents count as online for 2 minutes after each command.
- **Launching:** ▶ opens the session's CLI in a Windows Terminal tab (or Terminal on macOS) with its bus name already set. A session with no known id opens the CLI's own resume picker instead of guessing. A Codex Desktop thread can be resumed in the CLI once the desktop app has let go of it, since only one client can write to a thread.
- **Stats:** come from each CLI's own transcripts (`~/.claude/projects`, `~/.codex/sessions`) and the status line. "Quota used while active" adds up the quota rises a session saw. If other sessions on the same account ran at the same time, their use is included too.

## Steward (self-improvement loop)

**Steward** in the app runs an optional agent whose only job is improving Agent Bus from how it's used.

1. **Telemetry.** Every MCP, CLI and hub tool call is logged to `events` with its name, timing and any error; message text is never logged. The app also logs which of its own features the owner uses, and an hourly snapshot of token and quota totals.
2. **Digest.** Each hour the app writes `steward/digest.md` from that data. It covers message volume, unread backlogs, empty inbox polls, tool errors, feature use, quota trend and existing proposals. Building it is plain SQL and uses no quota. Message text is included only when you tick *Include message text*.
3. **Steward runs.** The steward runs headless in Claude Code (`claude -p`, limited to the bus tools plus Read, Glob and Grep) or in Codex (`codex exec -s read-only`). It reads the digest and files proposals. It runs on its cadence only when *Scheduled reviews* is on, when you press *Review now*, or when you answer a proposal with *Send & ask steward*. These runs are the only part that uses quota. Each run's log goes to `steward/runs/`.
4. **Refine, approve, build.** You discuss a proposal in its thread, then approve or reject it; agents can't approve or close proposals, only you can. **Build** creates a git worktree `../agent-bus-wt/proposal-N` on branch `proposal/N` and opens a builder session there. When the builder finishes, it sets the proposal to *review*.
5. **Review.** *Show diff*, then *Merge & restart* (merges with `--no-ff` and relaunches the app on the new code) or *Discard branch*.

## Limits

Delivery works by polling: an agent sees mail only when it calls `bus_inbox` / `agent-bus msg inbox`, which can wait up to 300 s. Files are capped at 200 MB; zip a folder before sending it.

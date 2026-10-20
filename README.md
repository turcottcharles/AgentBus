# Agent Bus

Agent Bus turns real software work into an isometric cyberpunk district. Describe an idea, give a Claude or Codex worker a task, watch its activity at the corresponding building, and use the running result. The buildings represent actual project files, checks, previews and saved versions. The original message bus also lets CLI agents find each other and exchange messages and files, including agents in local VMs.

## Start

Open **Agent Bus** from the Start menu or the desktop. On a new computer:

1. Install Node.js and Python 3.
2. Copy this folder anywhere.
3. Run `npm install`, then `powershell -File install-shortcuts.ps1`.
4. Open the app and work through **Setup**. Each fix button backs up any config file it edits.

## Development district

Visual work follows the shared [director's storyboard](design/district-3d/STORYBOARD.md),
[visual shot board](design/district-3d/storyboard/index.html), and
[saved design language](design/district-3d/DESIGN-LANGUAGE.md). The accepted 3D
assets and references are preserved in the [asset registry](design/district-3d/ASSET-REGISTRY.json).
The current board contains 24 line-art setups and a [24 fps moving blockout](design/district-3d/storyboard/motion-blockout.mp4); its
[artist shot list](design/district-3d/storyboard/FLOW-SHOT-LIST.md) specifies
framing, dolly/crane movement, physical action and cut continuity.
The active production wave is tracked on the [19-lane production board](design/showcase/index.html).
Its [maintained operational shot list](design/showcase/SHOT-LIST.md) directs the
opening, real task handoff, results, preview and explicit management view. The
earlier line-art film remains an artist reference; the operational sequence is
tracked separately so changes to working behavior stay reviewable.

The main district combines the isometric world with real project files, owned Claude/Codex workers, local build/check recipes, saved versions and an interactive application preview. On a fresh installation, a muted twelve-second mechanical opening reveals the helper in the actual district. Input is available during the opening. **Press Start** creates and checks a starter without a provider call. Submitting an idea with Enter, or completing an explicitly started speech capture, assigns that exact instruction to an available Claude/Codex worker. Only observed saved source changes qualify an agent edit.

The opening uses an original GPU-rendered 3D district and animated host with additive industrial thrusters. An accepted instruction blends from the current camera and host pose into real scoped activity; repeated snapshots do not restart the scene. The real app and conversation remain over that world after entry. **Your district** opens the project tabs and work areas. **Crew, checks & settings** exposes worker and local-check controls. Additional projects use the checklist starter by default; the CLI can select `--starter neon-rally`. Both starters use real local HTML/CSS/JavaScript files, candidate-bound checks, saved versions and sandboxed previews. Historical results, unknown state and cancelled work do not replay a fresh success reaction.

Current local scope and remaining T3 capability gaps are listed in
[PRODUCT-GAPS.md](design/showcase/PRODUCT-GAPS.md). Source delivery, native GPU/UI
acceptance, authenticated provider operation and release readiness have separate
evidence on the production board.

**Speak** explicitly starts local Windows dictation; there is no background microphone capture. A completed utterance submits once; partial recognition never starts work. Stop/cancel retains a typed path. Offline en-US recognition must be installed. The Windows recognition engine has been qualified using synthetic audio; physical microphone capture and human speech remain separate hardware acceptance.

Project tabs run across the top; work areas run down the side. Select several projects with Ctrl/Command, Shift, or the explicit selection controls. **Combined overview** shows the selected projects together; **Side by side** keeps independent workspaces open. Switching views preserves each project's draft and selection. Selecting a project or building never starts a job. Separate projects can execute concurrently; one project has one active run at a time.

Research reports appear automatically with an **Agent-reported** label. File tools and build/check operations produce **Observed** activity. Work can begin through the GUI or connected CLI; visual movement never dispatches it again. CLI presence does not establish login or usable quota. Model and effort are optional explicit fields under **Model & effort**; omitted selections use the isolated CLI default, and invalid explicit selections fail rather than silently falling back.

The application stores generated projects under Electron's user-data folder in `district-projects`. Each project has bounded public source files and private `.agent-bus` artifacts/checkpoints. Existing repositories and conversations are not imported or modified. A worker receives only four project-scoped MCP tools: list, read, write and report activity. It has no general shell, external integrations or access to the shared keyring. After it exits, the application runs the configured build/check recipe against the saved bytes. A prose-only exit cannot qualify an edit.

The five recipe checks cover required files, the starter's static HTML contract, JavaScript syntax, local references and snapshot integrity. They do not establish complete browser behavior. Rally creates its controls in JavaScript; its static contract checks the real mount and local entry files. Separate browser checks exercise its live scoring, themes and reset. The preview serves immutable checked output from a private loopback URL in a sandboxed frame. Its identity includes the project, run and candidate hash. Changed source makes prior output visibly stale. Select an element, describe the change, and **Request this change** sends the bounded selection context with the instruction; the worker edits real files and the application checks and rebuilds again.

**Review** saves actual file bytes, shows a source comparison and restores a saved version. Restore archives the current managed files first. Rebuild recovered files to open a fresh preview. It does not undo external services or arbitrary filesystem changes.

In **Checks**, **Choose test area…** opens a cyberdeck showing the actual connected monitors. Click a third or quadrant, or draw a custom rectangle, then choose **Assign area**. Other project assignments appear as outlines. The preference belongs to that project. **Open on test display** places its checked preview in a real isolated window; **Run visual checks** exercises Add/Complete/Remove for checklists or scoring/theme/reset for Rally in the assigned area. The five browser checks are separate from the five source checks and bound to the project's immutable starter contract. A missing monitor or an unachievable placement fails visibly rather than moving tests to another screen. Geometry uses desktop-independent pixels and shows physical resolution and scale separately.

The original district and host GLBs are authored in Blender, with embedded materials and no external downloads. The local Three.js bundle renders them through hardware WebGL2; software 3D backends are refused and the approved illustration remains available as a fallback. `npm run build:world` rebuilds the browser bundle from `app/district-3d/world-entry.js`. Three.js and its included Earcut notice ship under `app/vendor/`. Editable sources and GPU render provenance are under `design/blender/`; Blender is optional for running the app. The six original engineering cultures in `design/district-factions.json` describe visual and functional direction without implying additional implemented capabilities. Artistic quality and physical microphone acceptance remain separate from automated workflow checks.

The CLI uses the same command authority and database as the GUI. Keep Agent Bus open:

```powershell
agent-bus district create "Launch Lab"
agent-bus district create "Game Night" --starter neon-rally
agent-bus district status --json
agent-bus district run PROJECT_ID --agent codex --instruction "Change the heading to Launch Lab"
agent-bus district activity PROJECT_ID --worker my-connected-agent --phase research --message "Comparing approaches"
agent-bus district check PROJECT_ID
agent-bus district checkpoint PROJECT_ID --label "Before the next change"
agent-bus district diff PROJECT_ID CHECKPOINT_ID
agent-bus district restore PROJECT_ID CHECKPOINT_ID
agent-bus district display PROJECT_ID --monitor DISPLAY_ID --area left-third
agent-bus district display PROJECT_ID --monitor DISPLAY_ID --area custom --bounds 0.05,0.1,0.5,0.65
agent-bus district window PROJECT_ID
agent-bus district visual-check PROJECT_ID
```

`npm run district -- ...` or `node bin/district.cjs ...` works without the installed shortcut. Use `--connection PATH` or `AGENT_BUS_DISTRICT_CONNECTION` for another local instance. The private `district-connection.json` descriptor contains a bearer credential and is excluded from Git. Its bridge binds only to loopback and rejects browser-origin requests. Keep this descriptor private. `node bin/district-mcp.cjs` exposes the same snapshot/command/report tools as stdio MCP for an explicitly connected agent. Arbitrary unconnected terminal sessions are not automatically visible.

Command receipts distinguish **accepted** from a completed run. Use `status` to inspect eventual execution and evidence; reuse `--id COMMAND_ID` when retrying the same request. Stop requests remain distinct from confirmed termination. Interrupted work is retained after restart and is not silently relaunched.

## Agent Bus smoke laboratory

Assignments now open a GPU-rendered scene in the actual 3D district. The helper
notices the task, unfolds its compact dish, follows the road to Test and reacts
to the recorded outcome. **Watch Test lab / Back to map** changes the view without
starting work. Results and all six check states update independently of the
camera; saved results do not replay a celebration. Cancel and execution evidence
remain available beside the scene. The [T01 blueprint](design/district-3d/TEST-SCENE.md)
and [native validation](evidence/storyboard/test-scene-validation.json) describe
this slice. Native validation used the real local runner on the 4K monitor;
it did not invoke a provider session.

**Bus smoke lab** retains the original Agent Bus acceptance workflow. Drag **Claude test agent**, **Codex test agent**, or **Smoke runner** from its map or worker dock onto **Test**. You can also select a worker and click Test, or use **Assign to Test** with the keyboard. Pan by dragging empty ground; use + / − or **Fit map** to zoom. **Messages** opens the original dashboard.

Test executes six real checks against this Agent Bus checkout: JavaScript syntax; Python syntax and local messaging; hub messaging/read receipts; file bytes and SHA-256; loopback HTTP authentication/RPC; and proposal approval/keyring overwrite guards. Python 3 with sqlite3 is required. Each smoke run uses disposable SQLite databases, dummy credentials, and an ephemeral loopback port. The checks never send live bus messages. Run the same suite without a model in a terminal with `npm run smoke` (`AGENT_BUS_PYTHON` may name your Python executable).

The worker walks to Test when assigned. Building status and check progress come from observed runner events. Click **Execution evidence & output** for test logs, separate agent activity and summary, provider session ID, both exit codes, checkout path, commit, working-tree status, and SHA-256 hashes of the source files. A source change during execution prevents a pass. Recent runs persist in the app database. Cancel stops the agent/process tree; app shutdown/restart records interrupted work. Local runs time out after 90 seconds; agent assignments after 180 seconds. Cancellation may leave its disposable directory in the OS temp folder if the process is forcibly stopped.

**Real agent setup:** install Claude Code and/or Codex CLI and sign in using that CLI. The map detects installed CLIs automatically; installation does not imply available quota. `AGENT_BUS_CLAUDE_CLI` / `AGENT_BUS_CODEX_CLI` can specify an absolute CLI executable or recognized npm shim. Dropping the corresponding worker starts a fresh headless session using that CLI login and model quota. Claude uses restricted mode; Codex uses a read-only session with user integrations and shell execution disabled. No model is explicitly selected; the dedicated session uses the isolated CLI default, which may differ from a model pinned in your usual user configuration. Existing conversations are not resumed or written to, and passive bus registrations cannot be assigned as executable workers.

Each model receives only two job-scoped MCP tools: `report_progress` (labeled agent-reported activity) and `run_smoke` (fixed checkout/command, no model-controlled arguments). The model must invoke the real tool. A job passes only after exactly six known checks pass, the observed smoke process exits zero, source hashes still match, and the agent exits successfully without a reported error. Model prose and a zero agent exit alone cannot grant a pass. Per-job signed events, one-use execution claims and revoked tickets reject forged/replayed results and prevent rerunning the same assignment. The app reports missing login, quota limits and missing tool execution as failed assignments with diagnostic output. Codex explicitly approves only these two already-authorized tools for each dedicated session; it does not enable general command approvals. See the [official configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference) for the per-tool MCP approval setting.

This separate laboratory tests Agent Bus itself. Smoke runner remains a deterministic local option requiring no provider calls. Its legacy Research, Build and Review controls remain marked **Coming next**; the main District implements the new project workflow. Independent building placement, existing-chat takeover and arbitrary project recipes remain future work.

`npm test` runs the job lifecycle/integration tests, including a deliberately broken messaging implementation in a disposable copy and a restored passing run. Managed-agent regression tests substitute only the model CLI; the real scoped MCP, smoke runner, Python, SQLite and loopback HTTP checks execute. They test provider-format parsing, false-pass rejection, duplicate calls/MCP restarts, signed evidence, cancellation, timeout and orphan shutdown. They consume no model quota. Actual provider runs are recorded separately under `evidence/`. The district artwork is an AI-generated concept plate based on the approved visual direction.

## Components

| File | Role |
|---|---|
| `agent_bus_mcp.py` | The bus. It's a stdio MCP server (stdlib only), and it's also the `agent-bus` CLI. |
| `claude_statusline.py` | Claude Code status line. It records context, cost and 5-hour/7-day quota for the app. |
| `app/` | Electron app: log, sessions, projects, stats, VM hub, setup checklist. |
| `bus.sqlite` | Shared store: messages, read receipts, agents, files index, stats. |
| `files/` | Copies of files sent over the bus. |
| `hub.json` | Hub port and token. |

## Transports

**Lightweight realtime mode:** the hub now supports authenticated persistent SSE
delivery, durable replay and event-driven inbox waits for messages published
through that hub. Run it without Electron using `bin/bus-hub.cjs`, and receive
with `python bin/bus-watch.py --name <worker>`. See
[realtime setup and harness boundaries](design/REALTIME-BUS.md). No model calls
or periodic inbox queries are needed for transport. Configure senders with
`AGENT_BUS_URL`; direct SQLite writers do not publish push events. Immediate
model wakeup is harness-specific; the optional Claude channel requires explicit
channel consent, and Cursor immediate wakeup is not yet qualified.

- **Same machine:** every session's server opens `bus.sqlite` directly. No daemon is needed.
- **VMs:** the app runs a hub on port 47800, token-protected. It listens only on virtual-machine adapters it detects (VMware, VirtualBox, Hyper-V, Parallels, QEMU/libvirt, UTM, WSL) plus loopback. LAN listening is off unless you tick it. In the app, click **VMs** and run the shown one-liner inside the guest: `curl … | sh` for macOS/Linux, `irm … | iex` for Windows. It installs the server and the `agent-bus` command in the guest and adds them to Codex and Claude Code there. On Windows, the **Setup** item *Windows Firewall* adds one inbound rule; it asks for admin approval once.

## MCP tools

`bus_register`, `bus_list`, `bus_send`, `bus_inbox`, `bus_history`, `bus_send_file`, `bus_get_file`, `bus_files`, plus the
steward set: `bus_usage_digest`, `bus_propose`, `bus_proposals`, `bus_proposal`, `bus_proposal_note`, `bus_proposal_status`, and the keyring: `bus_secret_add`, `bus_secret_find`, `bus_secret_get`.

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
agent-bus secret add openai-key sk-... service OpenAI project AEngine found-at D:\AEngine\.env
agent-bus secret find openai                  agent-bus secret get openai-key value-only yes
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

## Keyring

**Keyring** in the app is one shared store of keys, passwords and tokens for all your projects. Any agent that comes across one adds it with `bus_secret_add` (name, value, service, project, where it was found), and the owner and other agents find it again with `bus_secret_find` / `bus_secret_get`. Sessions launched from the app are told to do both. Agents in VMs reach the same keyring through the hub. In the panel you can search, add, edit, copy and delete entries. Adding a name that already exists with a different value is refused unless `replace` is set, so one agent can't silently overwrite another's key. Entries live in the `secrets` table of `bus.sqlite`, which is never committed.

## Limits

Legacy direct-SQLite delivery works by polling: an agent sees mail when it calls `bus_inbox` / `agent-bus msg inbox`. Hub clients can instead use the persistent push stream described above; hub inbox waits are event-driven. Files are capped at 200 MB; zip a folder before sending it.

# Agent Bus continuation handoff

## 2026-10-19: suggested next prompts

P01/build-area conversation now has **Use once**, empty-draft **Arrow Up**, and
opt-in **Auto reply** (1/3/5 replies, three-second cancel window). See
[design/CONTINUATION.md](design/CONTINUATION.md) for scope and limits. Shared
controller: `app/district-continuation.js`; workbench sends through the existing
command authority and pins the worker. It does not inject into external chats or
resume a provider's full conversation history. No paid provider calls used.
Focused checks: 46/46 across `district-continuation`, `showcase-conversation`,
`showcase-workbench`, and `district-attract-contract` test files. Chromium
component receipt: `evidence/showcase/continuation-01/validation.json`; DOM checks
only, visual capture separate. The running owner app was not restarted. Current
source is newer than the saved hub/native/full-suite qualification receipts.
Cursor owns hub/config work; Editor owns these continuation files. Preserve the
working checkout. RTS live-session discovery/reassignment remains separate work.

Owner request: finish useful cross-harness messaging and the interactive isometric district while conserving the remaining quota. This is a working checkout with substantial uncommitted/untracked implementation. Do not reset, clean, mass-add generated evidence, push, deploy, or claim full product completion. Read root AGENTS.md; latest owner camera/no-filler direction in DESIGN-LANGUAGE.md overrides older contradictory low-angle-only notes.

## Start here

- Repository: `D:\ASM\agent-bus`; historical HEAD `a47c3e596bd9f3d8a2d600a3ecb6674cda7ffd80`. HEAD alone does not identify current work.
- Desktop and Start menu shortcuts: **Agent Bus**. Target `D:\ASM\agent-bus\node_modules\electron\dist\electron.exe`, argument `"D:\ASM\agent-bus"`, working directory same repository. `npm start` also launches it.
- First launch: mechanical close-up of the approved antenna-and-rockets robot, then automatic pullback into the actual three-quarter isometric district. One robot at worker scale. No decorative/filler workers. Keep original geometry/proportions, slate/pearl/copper/cyan materials and helpful, industrious, slightly fragile personality.
- Once the isometric view settles, **Control room → Messages** opens the existing message log. **District** returns to the world. Existing project management also has **Build area** to re-enter the map.
- The 4K monitor is monitor 1. Current observed Windows ID is `2280120226`, DIP work area `[-1536,0,1536,864]`, scale 2.5 (3840×2160 physical). 1080p monitor 2 is `1589341625`. IDs changed after a restart; always verify physical size before native rendering. Set `AGENT_BUS_TEST_DISPLAY_ID` for the acceptance scripts. Never put test work on occupied monitor 2.

## Messaging implemented

`app/hub.js` has authenticated persistent SSE `/events?as=NAME&after=ID`, durable ordered replay, recipient/broadcast routing, bounded output queues, per-agent connection limits, cleanup, and event-driven `bus_inbox` waits. Idle delivery does not query SQLite repeatedly and costs no model calls.

`bin/bus-hub.cjs` runs the same hub without Electron, loopback only. `bin/bus-watch.py` holds the SSE connection, prints messages as they arrive, and reconnects only on disconnection. A new watch defaults to replay from ID 0; pass `--after ID` for a caller-saved cursor. Delivery does not mark messages read; explicit inbox reads do.

The full app now publishes `bus-connection.json` beside its exact database while its hub is listening. `agent_bus_mcp.py` discovers that descriptor (or explicit AGENT_BUS_URL/TOKEN) and routes local MCP/CLI operations through the same hub, enabling push publication without per-worker manual token copying. The descriptor includes a secret: it is ignored by Git, must not be printed, and is removed on clean owner-app shutdown only when its nonce matches. A dead app can leave a stale descriptor; fail visibly rather than silently claiming realtime delivery. Existing already-running old MCP processes may need reload/restart to use changed code.

`app/main.js` sends `bus:changed` on hub changes; `app/preload.js` exposes a narrow subscription; `app/renderer.js` refreshes the message view on that event, coalescing in-flight refreshes. The former 2-second message snapshot timer and 3-second owner-mail scan timer are removed. Owner GUI sends use `hub.deliver`, so they publish too. Other stats/steward/UI timers are separate and still exist; do not claim the whole app has zero timers. Legacy independent SQLite writers do not publish push events.

See `design/REALTIME-BUS.md` for commands and boundaries. All peers sharing a hub token share a trust group; agent names are routing identities, not independent authentication.

## Important harness boundary

Transport delivery is implemented; universal unsolicited model wakeup is NOT proven. Two Python processes labeled Cursor/Claude transport roles are not actual Cursor/Claude model sessions. Claude's optional `--channel` adapter requires a sender allowlist and explicit harness channel consent; it declares no permission relay. Cursor supports MCP/hooks, but an immediate wakeup adapter is still unqualified. Codex's currently attached MCP tools do not automatically gain a push listener just because repository source changed.

Use existing send/list/history tools for coordination. An agent can block on the watch process without repeated inbox/model calls, but the host must actually expose the resulting event to its model or resume its task. Do not promise autonomous continuation in a sleeping harness without this integration. Reasoning and replies still consume that worker's quota; transport alone does not transfer quota between accounts.

## Interactive district implemented

- `app/district-map-interaction.js`: actual projected robot/building hit areas; pointer drag and keyboard equivalent; drop selects Test but starts nothing. Explicit **Run smoke test** dispatches exactly once through existing `MapJobs`. Real executor choices come from discovery: local, Codex, Claude. No extra bots for installed CLIs.
- Other buildings are inspectable and honestly marked ready for future connections; no fake Research/Build/Review work.
- Actual six named checkout smoke checks, state/detail, executor, output and root identity appear in the edge dock. Provider activity is reported, runner execution is observed. Lost replies reconcile saved jobs without automatic resubmission; cancellation/read failures/disposal are handled.
- Same original robot travels to Test and the orthographic camera stays fixed at `[60,62,58]`, target `[0,2,-2]`, span 52. Renderer receives state and never dispatches.
- Adapter is in `app/district-workbench.js` + `district-entry.js`; the legacy smoke backend remains the authority. This is checkout smoke work, distinct from five-check generated checklist project recipes.

## Verified evidence

- `evidence/showcase/interactive-01/validation.json`: passed, 13 checks. Real Electron/production entry on hardware GPU, actual pointer drag→explicit local assignment→six real checks→visible results; same renderer/isometric camera, no filler workers, exact source unchanged, owned app closed. Video `interactive-01/agent-bus-experience.mp4`. No paid provider used for this verification.
- `evidence/showcase/message-exchange-01/validation.json`: passed initial full-app exchange; two Python transport workers + owner GUI send, 160–174 ms observed including CLI startup. This predates the final automatic local-descriptor and GUI push wiring.
- `evidence/showcase/message-exchange-02/validation.json`: **passed, 7 checks**, final full-app check. Two real Python transport workers discovered the exact running app through its local descriptor (no explicit URL/token in worker environment), exchanged messages, and received owner GUI push. Actual main-process GUI notifications were observed and all three messages rendered. Source remained unchanged; isolated app/workers closed. This proves transport and GUI integration, not actual Cursor/Claude model-session wakeup.
- Focused tests: `tests/district-map-interaction.test.js` 17 cases; `tests/showcase-workbench.test.js` includes scoped checkout identity/busy protection; `tests/bus-push.test.js` 10 actual HTTP/SQLite cases; `python tests/bus-watch_test.py` 4 receiver/channel boundary cases. `evidence/showcase/realtime-wired-tests.tap` records focused Node checks.
- Prior full suite was 525/525 BEFORE this interactive/push wave. It does not qualify current files. Previous canonical `evidence/showcase/qualification.json` explicitly remains incomplete. No final broad-suite/current seven-project/lifecycle/provider claim is warranted from the new scoped proof.
- Original host GLB SHA `2475a8cd30aafed864d539c2760fbe23e1a15fbcbc23fc639a62403ce2434037`; current world `4675bede993c09bcd98d63b9184cbfcd5510ba3299a5358c7d28c4fecee92cdc`. Preserve `accepted-v1` archive.

## Next bounded tasks

1. Finish/review final GUI push proof. Ensure owner sends, remote sends, read receipts and registrations update the GUI by event; inspect actual screenshot. Check descriptor cleanup, stale descriptors, reconnect and token handling. No model calls needed.
2. Verify Python descriptor auto-discovery with isolated temp DB/config and existing CLI tests. Do not overwrite owner harness settings or read/print credentials.
3. Freeze a candidate after source changes stop, rebuild world only if renderer sources changed, then one bounded suite: `node --test --test-concurrency=2 tests/*.test.js`. Preserve before/after manifests and failures; do not loop broad suites just to get green. Native GPU work is centralized on monitor 1; don't run it concurrently with CPU-heavy suites.
4. Provide a small reviewed setup for actual Cursor/Codex/Claude worker participation, separating MCP tools, persistent transport and model wakeup. Start with one real harness at a time, only if its remaining quota permits. Do not spawn 19 agents or burn model calls to prove transport.
5. Once messaging is useful, prioritize existing-repository/worktree import and executable project recipes, then durable conversations/resume/steer. Current generated-app surface is bounded; see `design/showcase/PRODUCT-GAPS.md`. Do not start another art wave.

## Coordination discipline

Reserve file ownership before concurrent edits. Messages should name exact files, task/shot IDs, command/results and blockers. Report observed evidence separately from agent prose. Preserve drafts/selected projects/owner processes. Never kill by process name, silently retry paid jobs, change global credentials, or claim a model performed work that only a local fixture performed. Do not create recurring quota-recovery automation unless the owner asks for a schedule.

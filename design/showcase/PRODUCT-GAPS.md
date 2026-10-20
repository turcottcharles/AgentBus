# Product gaps and showcase readiness

Reviewed 2026-10-18T03:51:02.662Z. Production source was read only. Current checkout HEAD is a47c3e596bd9f3d8a2d600a3ecb6674cda7ffd80 with substantial uncommitted showcase work; this is not a frozen/release qualification.

Current acceptance is generated from the [canonical qualification receipt](../../evidence/showcase/qualification.json) into the [production board](index.html). Its source identities and individual gate states determine what is current. Earlier native seven-project/lifecycle observations and authenticated Codex/Claude edits remain scoped historical evidence after visual changes; they do not qualify the whole changed UI. The five-source versus six-smoke count adapter is implemented. The original review below is an audit snapshot, with capability gaps retained on the roadmap. Physical microphone use, owner artistic acceptance and release qualification remain separate.

The concept is a game-shaped control room for real agent work. Current code implements that for Agent Bus smoke tests and small owned web apps. The showcase connects the accepted host performance to actual assignment, activity and results; appearance alone does not extend what the agents can do.

**Decision: do not declare the full showcase or T3 parity complete yet.** The bounded local command/file trust model passed focused negative checks, but the continuous opening-to-work integration and current native/provider gates remain open. Broad T3 features below are subsequent scope, not reasons to add a large transplant before the local showcase works.

## Fastest path to a truthful local showcase

1. Finish the single continuous opening/live-context adapter. Keep explicit command authority outside the renderer; normalize smoke six-step evidence and project five-check evidence separately. A direct five-check project fixture currently renders `0/6 checks · passed` in the legacy smoke presenter. See [app/district/test-performance.js:37](D:/ASM/agent-bus/app/district/test-performance.js:37) and [app/district/recipes.js:11](D:/ASM/agent-bus/app/district/recipes.js:11).
2. Prove assignment arriving during the opening does not remount/replay/reset the world. Real results, including an early failure or cancellation, must appear immediately; only a newly observed live pass may get one later acknowledgment. Preserve project/run/candidate identity and reported/observed labels.
3. Integrate all lane receipts, freeze one source/bundle candidate, then root qualifies the native path: typing dispatches nothing; one Enter creates one assignment; source changes/checks/current playable preview agree; a second explicit change produces a new candidate; Stop and unknown remain truthful; selected projects retain separate state; saved diff/restore recovers actual bytes.
4. Run at least the current selected real provider path under root authority and retain actual session/error/output evidence. A found CLI, fake CLI fixture or old successful run does not prove current login, quota, policy or runtime.
5. Record the exact candidate, maintained shots and remaining artistic/physical-microphone acceptance separately. Do not block this local milestone on implementing every deferred T3 feature.

## Implemented boundaries that must stay intact

- District execution uses a closed command contract and four project-scoped file/activity tools. Reports cannot author observed edits, checks or outcomes: [app/district/contracts.js:3](D:/ASM/agent-bus/app/district/contracts.js:3), [app/district/project-agent-mcp.js:171](D:/ASM/agent-bus/app/district/project-agent-mcp.js:171), [app/district/runtime.js:166](D:/ASM/agent-bus/app/district/runtime.js:166).
- Owned workspaces reject traversal, links, internal paths and unsupported/oversized public files. Generated project roots are separate from arbitrary user repositories: [app/district/workspaces.js:7](D:/ASM/agent-bus/app/district/workspaces.js:7), [app/district/workspaces.js:94](D:/ASM/agent-bus/app/district/workspaces.js:94).
- Preview resolves exact owned run artifacts, serves immutable bytes and verifies picked element identity before an explicit next instruction: [app/district/runtime.js:381](D:/ASM/agent-bus/app/district/runtime.js:381), [app/district/preview.js:251](D:/ASM/agent-bus/app/district/preview.js:251), [app/district-feedback.js:229](D:/ASM/agent-bus/app/district-feedback.js:229).
- District IPC is owner-main-frame guarded; the bridge requires its private descriptor credential and loopback/Origin/Host guards: [app/main.js:114](D:/ASM/agent-bus/app/main.js:114), [app/district/bridge.js:268](D:/ASM/agent-bus/app/district/bridge.js:268).
- Provider login stays with the selected local CLI. Exact model/effort may be requested, but catalog/auth/quota discovery is explicitly unavailable: [app/district/providers/index.js:10](D:/ASM/agent-bus/app/district/providers/index.js:10).

## Capability gaps relative to pinned T3 source

The comparison uses T3 commit `07cb90286656393e395192d82f5c9980b604ef31`, verified locally. T3 was not run. These rows group capabilities rather than pretend to count every T3 feature. Existing bus/dashboard, external session launch, statistics, file exchange and Steward features are kept separate from their absence in District.

| Gap | What current District does | What remains / next boundary |
| --- | --- | --- |
| G01 · General real-project workspaces and recipes | Creates two bounded starter apps and runs fixed static/syntax recipes. | Import existing repositories/worktrees and executable project recipes. This is the largest next step toward general real work. |
| G02 · Durable provider conversation, resume/fork/steer and editable queue | Persists runs/logs; starts fresh scoped Claude/Codex sessions. | Owned durable conversation, resume/fork/steer and editable queued turns. Legacy session launch is separate. |
| G03 · Interactive provider approval and permission profiles | Run preauthorizes four bounded project tools. | Actual pending provider approvals and enforceable permission profiles before adding broad tools. |
| G04 · Delegated project/client authority and protected secret requests | Single-owner loopback descriptor; separate legacy shared keyring. | Delegated project/client grants and protected one-use secret entry before untrusted remote or credential tasks. |
| G05 · General source control and publish/review workflow | Byte checkpoints, diffs and archive-before-restore. | General branch/worktree/commit/PR/review/merge. Legacy Steward Git applies to Agent Bus proposals. |
| G06 · Integrated PTY, workspace editor and rich attachments | Agent text-file tools and preview element feedback. | Integrated PTY, source editor and rich attachment context with independent capabilities. |
| G07 · Provider account/model/quota/context discovery | Manual model/effort propagation and real provider errors. | Provider-backed account/login/model/quota/context discovery. Legacy transcript stats are not current managed-run readiness. |
| G08 · Durable District schedules, follow-up queue and background residence | One active run per project; explicit stop/retry. | Durable queue, schedule, hold/recovery and background residence. Legacy Steward cadence is separate. |

Evidence for every row, including pinned T3 primary-source permalinks, is in [security-review.json](D:/ASM/agent-bus/evidence/showcase/security-review.json). None of these deferred rows establishes a new exploitable flaw in the current narrow workflow.

## Concrete trust limits

The legacy bus keyring intentionally returns values across projects; its `project` field is a search label, not authorization, and values are stored as text in shared SQLite. The new scoped District provider exposes no keyring tool. Keep this distinction visible; do not describe the old store as project-isolated or the broad District connection descriptor as a guest token. Sources: [agent_bus_mcp.py:393](D:/ASM/agent-bus/agent_bus_mcp.py:393), [app/schema.js:19](D:/ASM/agent-bus/app/schema.js:19), [app/district/project-agent-mcp.js:171](D:/ASM/agent-bus/app/district/project-agent-mcp.js:171).

Ordinary conversation is not protected credential entry: instructions are persisted in run state and sent to the provider. A future secret workflow needs project-bound one-use references rather than secrets in chat/logs: [app/district/runtime.js:286](D:/ASM/agent-bus/app/district/runtime.js:286). This is a scope limit before credential tasks, not evidence that current scoped agents can read the owner keyring.

SC-05 replaced the stale 10-command MCP schema with the shared runtime allowlist. Its lane receipt records 25 focused passes; final integration remains root-owned: [bin/district-mcp.cjs:7](D:/ASM/agent-bus/bin/district-mcp.cjs:7).

## Checks and limits

Eight focused security negatives passed with test isolation disabled: traversal/link/ownership, scoped-tool forgery, signed-event replay/forgery, ticket revocation/expiry, cross-project reports and cancelled voice identity. No provider, native/GPU or child-process fixture was started. The separate in-process count fixture reproduced the adapter requirement above. Source review and these checks do not establish current native usability, provider success, showcase continuity or owner artistic acceptance.

# Observed work → cinematic district

Implementation guidance for lanes 18 and 16, reviewed against current source on 2026-10-17. This is a presentation projection. The world renderer never sends commands, starts providers, approves anything, writes source or decides outcomes. Keep the frozen `setActivity({state,label})` API.

## Bind one real attempt

Lane 18 selects the exact `projectId` and `runId` returned by the owner's command. Read that run from the snapshot; pass its recorded `state` unchanged. Do not select the newest run globally or borrow another project's activity. A provider being installed, an online bus heartbeat, a session ID, typing, a cinematic beat or an accepted command is not evidence of productive work.

Use matching `activities` only to decorate the label: match project/run, and attempt/session when present; retain `basis` and `freshness`. Prefer the current projector output over replaying raw reports. Reports with unknown project/run remain unassigned. Never promote a reported `build` or `test` phase into the run states `building` or `testing`.

At first load or after losing connection, a terminal record is historical state, not a new achievement. Show its text without replaying a celebration. During a snapshot error, label the last view “Saved state · connection unconfirmed”, use a quiet `unknown` presentation state, and freeze work effects. With no selected run use quiet `idle`. These two presentation sentinels never enter the runtime/store.

## State, label, gesture and facility

All gestures are short, interruptible presentation cues. A state that remains unchanged does not retrigger them on each snapshot poll.

| Recorded state | Evidence and truthful label | Original host gesture / district cue |
| --- | --- | --- |
| `queued` | Run persisted with its command receipt: “Accepted · waiting to start”. | Host acknowledges once at the central dispatch console. A single outlined route can show the assignment relation; it does not imply a process is moving or executing. No facility machinery. |
| `starting` | Runtime is starting the owned provider: “Connecting Codex” / “Connecting Claude”. Login and quota are still unconfirmed. | Host turns toward the crew bay, then holds an attentive pose. A connection indicator may wait; no editing sparks, completion count or quota meter. |
| `working` | Signed agent report or observed scoped edit reached runtime. Label “Agent-reported · Research: …” or “Observed · Saved styles.css”, retaining the actual basis. | Host attends the neutral crew console with one restrained head/hand cue. Under the frozen two-field API this state does **not** identify research versus editing; do not parse the label to choose a facility. Reported phases remain visible in the DOM activity text. |
| `running` | Compatibility state accepted by current UI; not emitted by the current project execution path. “Working · stage not specified”. | Same neutral crew-console pose; never assume build, test or source editing. |
| `building` | Runtime/recipe owns the operation: “Observed · Building checked output” with actual detail/check name. | Host gestures toward the Build foundry. A bounded assembly pulse may run while this state is current. No invented percentage, file count or successful parcel. |
| `testing` | Runtime owns recipe or browser checks. Use “Observed · Source checks” for ordinary runs; “Observed · Browser checks” only when `run.kind === 'visual'`. | Host looks toward the Test lab. Light only the current check if its actual check record is available in the DOM. No synthetic check completion cadence. |
| `passed` | Runtime qualified this particular result. Ordinary run: “Source checks passed”. Visual run: “Browser checks passed”. Append “historical” if candidate/source no longer match; preserve `previewError` visibly. | One small acknowledgment only after an observed live transition, then a static review-ready marker. No autonomous reviewer avatar, approval gate, full-city victory, or portal opening. Passed source checks do not establish browser behavior or owner artistic acceptance. |
| `failed` | Runtime's failure and bounded diagnostic: “Attempt failed · …”. Actual saved files may still exist. | Host stops the work pose and directs attention to a quiet amber diagnostic marker at the relevant area. Keep the previous valid preview explicitly prior/historical. No automatic retry or rollback. |
| `stopping` | Owner requested cancellation; owned operation has not confirmed termination. “Stopping · waiting for confirmation”. | Host gives a brief open-palm pause cue. Stop productivity effects, but retain a waiting indicator. Never show “Stopped” yet. |
| `cancelled` | Runtime recorded cancellation after its operation result. “Cancelled · saved source retained”. For providers, runtime separately checks termination evidence. | Host lowers the active pose and settles. No success cue, automatic cleanup, source rollback or next task. |
| `termination_unknown` | Stop was requested but process termination was not confirmed. “Stop status unconfirmed · inspect details”. | Stationary caution pose/marker. Neither working nor safely idle; do not animate another assignment or clear the uncertainty after a timeout in the renderer. |
| `interrupted` | Runtime recovered an unfinished prior run after restart. “Interrupted · completion unconfirmed”. | Quiet caution marker; no resumed work animation. Rechecking/restoring requires an explicit owner command. |
| `timed_out` | Render if a persisted run actually has this state. “Time limit reached · inspect details”. Current agent-session timeout commonly arrives as runtime `failed` with its real diagnostic, so do not invent this state from an animation timer. | Same quiet diagnostic treatment as failure, with no assertion that a process stopped unless the run evidence says so. |
| Other / missing | “State unavailable”. | Quiet fallback; no active facility or terminal achievement. |

The current recipe can produce `building → testing → building → passed`: it checks source first, then copies immutable bytes. Follow recorded transitions rather than forcing a fixed Build-then-Test storyboard. Individual check events update the actual check list and do not necessarily change `run.state`.

Research/Workshop accents beyond the neutral `working` pose require a separately explicit, trusted phase channel in a future renderer contract. For this phase, use the existing labeled DOM activity list; do not smuggle new authority into `label` or infer it from prose.

## Preview and demonstration are separate channels

- `passed` alone never opens a preview. The existing workbench owns actual preview selection and requires matching project/run/candidate identity, a nonce, and current source hash. A previous candidate may stay inspectable while clearly labeled prior. The 3D portal is scenery until that UI displays the actual bound app.
- `setBeat(hook|crew|make|turn)` drives the illustrative trailer only. Keep “DEMO” visible for its idea cards, workers, progress and playable scoreboard. Demo motion never generates `report_activity`, source edits, checks, rewards or a command receipt.
- `setEngaged` changes composition to keep the real conversation/output usable; it does not mean a run started or succeeded. Typing and focus do not pause the trailer. Only Enter or an explicit speech-final commit dispatches once through the existing command path.
- `setPaused` controls presentation for an explicit pause, document visibility and reduced motion as appropriate. It never cancels a provider. Cancel remains an explicit UI command with its recorded `stopping` outcome.
- With reduced motion, use static host poses and text. Renderer failure leaves the illustrated fallback visible and preserves conversation, controls and real work.

## Selection and precedence in lane 18

1. Resolve the exact bound run, not a provider or the latest global activity.
2. Read authoritative `run.state`. `stopping`, every terminal state and unknown connection take precedence over any lingering activity. Do not let a late Research report reopen a terminal scene.
3. Find only a matching current activity; append its basis/freshness and a bounded plain-text detail. An observed saved file does not mean checks passed; a report does not mean that file was saved.
4. Call `setActivity` only when the projected state or label changes. Renderer effects stay bounded and cannot advance that state themselves.
5. Keep full run/candidate identity, signed edit evidence, checks, provider errors and termination result inspectable in existing DOM details. No new renderer/network/runtime API is needed.

Current source trap: `contracts.js` treats `termination_unknown` as terminal, while UI `ACTIVE` sets keep it blocked for safety and `ActivityProjector` does not currently include it in its terminal fence. Therefore the run state must suppress stale work effects independently of the activity projection. This document does not change that code.

## Rally prompt consistency check

The current provider prompt and scoped MCP initialization both derive from the validated private ticket's `contractId`. `neon-rally` preserves both score controls, score outputs, theme/reset/status controls and exactly one `data-neon-rally-app` mount. It does not request checklist selectors. New journal HMAC bodies bind this contract; a missing legacy contract defaults only to `checklist`.

This remains coherent with current source: `district-attract-demo.js` creates the Rally controls dynamically from `comets`/`bolts`; the owned standalone starter mounts the same component with `demo:false`, without automatic demo scoring. The recipe's static HTML check requires the mount and local entry references; live controls/handlers belong to the separate browser checks. Do not claim the source recipe executed those interactions.

A bounded read-only Node assertion checked the eight prompt selector/mount names against the current component and verified absence of checklist selectors. It passed; no provider, browser or model call was made for this review.

## Source anchors and acceptance probes

- `app/district/runtime.js:274-368`: persisted queued run, provider observations, signed-edit/source-delta requirement, recipe phases, candidate-bound qualification and preview error distinction.
- `app/district/runtime.js:125-135` and `:324-334`: cancellation request versus confirmed/unknown provider termination.
- `app/district/runtime.js:215-255`: browser-run identity, named checks, contract and freshness qualification.
- `app/district/activity.js:22-35`, `:137-165`: facility projection, terminal handling, scope and source-order fences. `app/district/contracts.js:6`: authoritative terminal state list.
- `app/district/project-agent-mcp.js:16-23`, `:79-101`, `:190`: contract instructions, signed contract binding and scoped initialization. `app/district/agent-session.js:95-109`: matching provider prompt.
- `app/district-attract-demo.js:29-68`, `:157-165` and `app/district/recipes.js:92-104`, `:208-259`: Rally live controls versus source-only recipe.

Use snapshot fixtures to verify: queued never looks productive; reported “all tests passed” while `working` cannot show success; observed edit cannot light the pass marker; testing→building is rendered without fabricated check progress; stopping remains unconfirmed; termination_unknown defeats a fresh lingering report; a stale passed candidate does not open a portal; a first-load historical pass does not replay celebration; another project's event cannot move this host; changing beats/focus/typing/visibility sends zero commands. These are acceptance probes for lanes 18/16, not claims that those implementations have already passed them.

# WYSIWYG story for the 3D district

The opening shows an idea becoming a playable app, then invites the person to make a change. Before an explicit instruction, every staged transformation is visibly a **DEMO**. The host is an original animated guide; its appearance, costume or group never grants a provider, tool, permission or specialty.

## Four beats

These are story targets. The current 3D renderer supplies four camera shots, original host motion and ambient geometry; the labelled playable transformation is a separate DOM demonstration. A camera cut is not a source edit or an implemented 3D app-assembly mechanism.

| Beat | Trailer image and words | Truth behind the image |
| --- | --- | --- |
| `hook` | A calm plaza, an idea, the host noticing it. “Got an idea?” | A scripted introduction. No project, provider session or job is started by this beat. Keep the title readable and the lower 105 DIP clear for conversation. |
| `crew` | The host welcomes original crew shapes; the district wakes. “An idea takes shape.” | A scripted illustration of the supported workflow, not a claim that these figures are running agents. A costume or faction cannot imply extra tools or a different permission level. Actual availability and errors come from the provider snapshot. |
| `make` | An idea assembles into the Neon Rally console; scores and its colorway change. “Make it yours.” | A labelled, scripted demonstration of an app already supplied with the product. Demo play changes only its own DOM. It does not edit project files, run checks, spend quota or prove AI generation. |
| `turn` | The host opens the plaza toward the real input. “Your turn.” | The conversation remains usable over the world. Typing, focus and partial speech change a draft only and never pause the trailer. Enter or one final result from an explicitly started speech capture commits once. |

The transition to real work has a visible boundary: a command receipt and actual project/run identity. Do not morph a demo success indicator into a real pass badge.

## Implemented paths the story may demonstrate

| Visible promise | Actual path | Required visible distinction |
| --- | --- | --- |
| Use GUI or CLI | GUI and `bin/district.cjs` submit commands to the same district runtime. CLI provides create/run/check/preview/display/visual-check/window/status operations. | `accepted` means requested, not finished. Show actual run state and errors. |
| Start with something playable | Press Start creates the real local `neon-rally` starter, runs its configured local recipe, waits for a passed candidate, then opens an identity-checked loopback preview. | This first app is a supplied template. A provider edit is a separate explicit instruction; no agent is credited for copying the starter. |
| Ask an agent to change it | `start_task` launches an owned Codex/Claude session with bounded project tools. Signed file-change observations and changed source hashes are required before its edit qualifies. | “Agent-reported” research is different from observed file edits, checks and outcome. CLI installation is not proof of sign-in or quota. |
| Build, check, play | The recipe builds immutable public bytes and records named checks, source hash and candidate hash. Preview opens that exact candidate. Separate browser checks use the fixed app contract. | Local structural/syntax checks are not a browser behavior pass. A loaded playable preview is not proof that all checks passed. Show their separate results. |
| Point at a change | Preview selection carries project/run/candidate/nonce identity into an explicit change request. The next agent edit runs the same save/build/check/preview path. | A selected element is context, not automatic source mapping or authority to execute page instructions. Reject stale or wrong-project selections. |
| Keep several projects in view | Project tabs support ordinary, Ctrl/⌘, Shift and explicit toggle selection; overview and side-by-side panes retain independent project scope. | Multiselect is a view choice. It does not start a bulk job, merge workspaces or apply one instruction to every selected project. |
| Compare work areas and choose screen regions | Multiple Research/Workshop/Checks/Review/Preview panels can be selected. The monitor picker separately saves a real OS display and one preset/custom normalized test rectangle per project. | Work-area selection and screen placement are different controls. A selected rectangle is part of a real display, not a virtual monitor or new process. Opening/testing needs an explicit command and a current candidate. |
| Recover saved work | Checkpoints retain actual source bytes; diff and restore operate on the project's owned files. | A screenshot or cinematic rewind is not a restored baseline. Show the checkpoint/result receipt. |

Source anchors: `app/district-workbench.js` (`childCommand`, `startFirstApp`, project selection); `app/district-conversation.js` (`commit`, speech-final handling); `app/district/runtime.js` (`report_activity`, `execute`, candidate/window gates); `app/district-ui.js` (facility multiselect); `app/district-selection.js`; `app/district/regions.js`; `bin/district.cjs`.

## Renderer and integration boundary

The frozen renderer is `DistrictAttractWorld.mount({container})`, returning `setBeat`, `setEngaged`, `setActivity`, `setPaused`, `getDiagnostics` and `destroy`. It draws a WebGL2 canvas behind existing DOM and receives presentation state only. It contains no commands, network calls or audio. `setBeat` stages the demo; `setActivity` may show a supplied state/label but cannot infer a job or result. `setEngaged` marks the interaction mode without making typing a pause signal. `setPaused` handles visibility, explicit lifecycle and reduced-motion needs, never draft input. Renderer failure keeps the illustrated fallback and reports `ready:false`.

The workbench remains the authority for explicit commands and the conversation owns draft/commit deduplication. Rendering, replaying, mounting, selecting projects, moving a camera and observing activity cannot call `start_task`, `run_checks` or any other command.

## Story truth review

- Reviewed existing workbench, conversation, runtime, selection, region and CLI paths. These are source observations, not fresh live-provider or visual qualification.
- Reviewed `app/district-3d/world-entry.js:186-342` and the new workbench `syncAttractWorld` wiring. The six frozen methods are present. `setBeat` selects camera shots; `setEngaged` adjusts framing; `setActivity` selects state-only accents and never parses its label into a facility or command. The first activity binding suppresses a passed-result gesture; subsequent changed states can cue once. The workbench mounts only for the entry experience, exposes diagnostics and destroys the world when leaving. Typing/focus are not pause inputs.
- Renderer source requests hardware WebGL2, refuses software/unknown GPU identities, marks ready only after drawing, limits dimensions/frame rate, loads only fixed IPC-supplied embedded GLBs, retains substantive procedural geometry when an asset fails, and handles visibility/context loss/disposal. This is source coverage, not a measured GPU, performance, asset-load or fallback acceptance result. The generated bundle and assembled app still need root qualification.
- `setBeat` currently changes camera targets rather than constructing an app in the 3D world. Keep the DOM scoreboard and its theme/score transformation visibly labelled as the prebuilt demonstration; do not advertise a completed 3D assembly sequence from the camera API alone.
- Initial integration review found that the 3D activity label uses worker/run detail without separately retaining activity basis/freshness, and refresh failure leaves a saved run available. Require explicit reported/observed words and quiet `unknown` presentation while connection is unconfirmed. A historical terminal result on first bind must not replay a completion celebration. These findings were sent to lane 18; the story does not assume them fixed.
- The existing workbench has labelled demo play and separate checked-template/real-provider paths. Its existing pause calculation includes entry submission, visibility, transition and error state; it does not subscribe to typing as a pause trigger. The new renderer must preserve that distinction. Its current “YOUR AI CREW BUILDS IT” beat over the demonstration should become “An idea takes shape”, matching `CAPABILITY-COPY.md`; keep “DEMO · prebuilt example” visible through transformation.
- Do not claim the first Press Start result was generated from the idea: the implementation creates/checks a starter before submitting any nonempty instruction to a provider.
- No source review establishes AAA visual quality, all-age usability, speech availability, live provider success or owner artistic acceptance. Those claims require the assembled running app and the corresponding evidence.

## Recording gate

Final source follow-up: the renderer now includes an explicitly illustrative idea
core and twelve assembling panels between the camera beats. These props disappear
on engagement. The workbench supplies observed run-state labels and an unknown
state on failed refresh, keeps a persistent prebuilt-demo marker, and requires a
fresh candidate-bound snapshot before engaging. Nine executable lifecycle cases
cover receipt retry, stale output, destruction and outer-view visibility. GPU,
live-provider and artistic results are recorded separately under evidence.

Record one uninterrupted journey: labelled demo while typing; one explicit commit; real receipt and provider/file activity; named local checks; separate actual browser check; playable candidate; element feedback and a second checked candidate; independent multiselected projects and screen placement; saved diff/baseline recovery. Include an unavailable provider or failed check without a success animation. Inspect diagnostics and context-loss fallback on the declared 4K display. The renderer's performance and appearance remain separate from the software workflow result.

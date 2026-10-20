# Agent Bus showcase crew

The owner explicitly authorized 19 agents to turn the accepted vision into a showcase and working product, and carefully maintain the shot list and work tracking. Read root AGENTS.md and its shared design references, plus INTRO-REVEAL.md and TEST-SCENE.md. The latest owner direction resumes production beyond the old storyboard pause.

## Shared locks

LATEST OWNER CORRECTION: start with ONE robot and ready-to-use buildings. No
filler bots. Additional robots require actual connected agent sessions or work.
This supersedes older low-angle/explicit-overhead locks:
after the cute close robot reveal, W02 automatically pulls back to a three-quarter
isometric overhead district. The same robot is a worker among similar robots,
all at one physical scale. Use the approved antenna-and-rockets model family for
the crew. Close-up size comes from the camera. No giant foreground mascot above
different tiny robots. T01/R01 stay in the shared overhead district.

The tuned antenna-and-rockets robot is the primary visual anchor. Derive the
district, lighting, camera framing and interface from its materials, mechanisms
and helpful, industrious, slightly fragile personality. Accommodate its approved
silhouette; do not redesign it to suit another style. Keep dish, face, hands and
rockets readable in W01, T01 and R01, including alongside explicit work output.

Preserve the accepted original host GLB, current district GLB, accepted-v1 archive, approved compact dish, industrial thruster direction and character: industrious, slightly fragile, helpful. Cold/amber mechanical opening -> warm profile -> actual assignment -> purposeful travel -> real check progress/results. Sound is MUTED by default; the owner has not accepted the rough sound. No floating comic scoreboard/card or forced overhead camera. Typing does not dispatch or interrupt the world. All 3D pictures render on hardware GPU.

## Ownership and collaboration

Each lane edits ONLY files assigned in tasks.json, plus its own evidence/showcase/lanes/NN.json report. Ask root before editing another lane's files; send proposed changes instead. Root owns app/district-3d/world-entry.js, app/district-3d/test-scene.js, app/district/test-performance.js, app/map.js, app/main.js, app/preload.js, app/index.html, app/district/runtime.js, app/district-ui.js, shared ledger, package build and final integration. Do not overwrite or revert unrelated existing work. Do not commit, push, deploy, send external messages or run paid provider sessions. CLI version discovery and bounded local tests are allowed. No new subagents: all 19 slots are allocated.

Only root launches GPU/native rendering during this wave; other lanes author probes and report readiness. No shared world bundle rebuilds while lanes are changing source. Targeted Node tests and source checks are allowed. Do not run the broad suite on every lane. Test important behavioral changes; no tests that only mirror implementation.

## Integration contracts

Root will provide renderer mount({container,view:'cinematic',showcase:true}) and setShowcaseContext({projectId,run,unavailable:false}). Presentation NEVER dispatches. A real run retains project/run/candidate identity, status, basis and actual check counts. Historical results cannot celebrate. The opening must join the live scene without replaying or resetting when an assignment arrives, including if it arrives mid-intro. Reduced motion settles poses but preserves immediate text/status. Management is an explicit player choice.

Lane02 exports createShowcaseOpening({scene,hostGroup,joints,actor,camera,lights}) -> {duration:12,pose(seconds,{reducedMotion:false}),destroy()}; pose returns diagnostics including end pose/camera, face visibility, lighting and thruster audit. Reuse production host rig and new original thruster module; no GLB loading or own RAF/renderer. lights may include ambient,key,rim,practical; handle missing lamps. Keep dependency direction production -> production, never app -> design. Root integrates the opening, live test handoff and renderer.

Lane03 mounts the workbench renderer with showcase:true and supplies setShowcaseContext from its real scoped snapshot. It may use window.DistrictAttention when lane14 delivers it. Preserve create/check/preview and CLI coexistence, multi-project tabs, drafts and idempotency. Report further hooks needed in root-owned files.

Lane14 supplies browser/CommonJS UMD window.DistrictAttention.projectAttention(snapshot,selectedIds) returning project-scoped, deduplicated attention entries from actual runs/activity (failure, unknown/stale, waiting, completed); pure projection, no commands or timers. Coordinate API with lane03.

## Required lane receipt

Write JSON to evidence/showcase/lanes/NN.json with taskId, status (implemented/reviewed/blocked), summary, files, shotIds, tests [{command,result}], findings/blockers, integrationNotes, remainingQualification. Distinguish source checks from actual native/provider qualification. Send root a concise completion report with exact paths. Changes remain provisional until root integrates, freezes and qualifies the candidate.

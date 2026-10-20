# Agent Bus: director’s storyboard

**Latest owner correction:** the approved antenna-and-rockets robot is a worker
in the district. After the close reveal, W02 automatically pulls the camera out
to a three-quarter isometric overhead view, showing that single robot with the
buildings ready to use. Additional matching robots require real connected agents
or assignments; do not add decorative bots. Keep one consistent worker scale.
This supersedes the older player-choice-only overhead direction in this board.
The close-up comes from the camera; no giant mascot above miniature robots.
The original host geometry, compact dish and rockets remain the shared source.

The owner has now authorized the [T01 working Test scene](TEST-SCENE.md): the
approved helper performance travels through this district and observes real smoke
checks. This narrowly resumes that working slice; the accepted film stays saved.
The next attract edit has a shared [mechanical-first reveal brief](INTRO-REVEAL.md):
establish capable machinery before the face reveals the relatable helper.

The [visual board](storyboard/index.html) is a **line-art production storyboard**.
It shows 24 contrasting camera setups with action arrows, shot notes and a new-information purpose for every cut.
The point is to direct artists: what moves, where the camera is, what causes the
next event, and how the viewer follows it. These are staging studies, not final
art or proof of implemented work.

Read the [panel-by-panel shot list](storyboard/FLOW-SHOT-LIST.md) alongside the
pictures. [STORYBOARD.json](STORYBOARD.json) is the canonical shot/panel data;
[DESIGN-LANGUAGE.md](DESIGN-LANGUAGE.md) preserves the original host and district
identity. [ASSET-REGISTRY.json](ASSET-REGISTRY.json) identifies the saved sources.

## Editorial contrast

Lead with an extreme lens close-up, cut wider to meet the host, isolate the hand, then look over its shoulder toward Research. Follow with low courier travel and machine inserts. Alternate wide scale with macro detail for the defect and repair. Two quick gateway triggers release a four-second wide payoff. End with a reverse angle, an open hand, a quiet profile and the deliberate opening-lens match.

The edit uses unequal holds rather than four identical durations per group. Every shot has a visible **REVEAL** note explaining what it adds. Only the loop bookends repeat a camera; P01 remains a separate player-selected crane and overhead view.

## Flow

| Shot | Time | Four successive actions | Framing / transition |
| --- | --- | --- | --- |
| S01 — Already alive | 0–3 s | Track → notice → lift → present | Low, close host. Follow its gaze and hand; match on the packet. |
| S02 — Follow the work | 3–6 s | Catch → inspect → carry → dock | Research insert, courier tracking, Workshop latch. Preserve custody. |
| S03 — Make. Check. Repair. | 6–11 s | Brace → assemble → find gap → seat and rescan | Low mechanism details. Hold the test angle to make the repair readable. |
| S04 — The world answers | 11–19 s | Receive → open → reveal → respond | Low gateway reveal. Attached control and spatial consequence share the frame. |
| S05 — Your turn | 19–24 s | Return → invite → breathe → loop match | Return to the host. Keep background life and clear input space. |
| P01 — Choose your perspective | **Untimed player branch** | Keep state → choose → compare → manage | Lift to overhead only after the player chooses **Your district**. |

The first 20 panels make a 24-second attract-loop animatic. P01’s four references
are outside that loop. The active moving blockout renders camera and subject motion at 24 fps within
the approved cuts. It is an animated staging study, not final materials or a
finished soundtrack. The earlier pose-only film remains saved as
[flow-animatic.mp4](storyboard/flow-animatic.mp4). Full panel timing, physical action,
framing and movement notes live in the shot list and canonical data.

## What the artists must preserve

Keep the close, low-angle composition over the **actual management district**.
Later management uses the same place from three-quarter overhead. Research,
Workshop, Verification, Review and Preview do not change positions between views.
Camera changes reveal depth and relationships instead of replacing the city.

One copper/cyan packet has visible custody from the host through Research and
Workshop. It unfolds into the project fixture. Verification exposes a visible
gap; a tool seats the collar; a second scan precedes the represented pass. The
same fixture docks at Preview and unfolds into a dimensional kinetic pavilion.
An attached control changes that pavilion visibly in the world. This is an
illustrative production concept; it does not claim a new functioning demo exists.

The floating comic scoreboard/card is removed from current direction. Preserve
historical accepted-v1 files, but do not reuse their card or movie in this board.
The saved pearl host, paired lenses, copper hinges and layered buildings remain
the identity. Final materials use slate, cyan, violet, warm copper and pearl.
Line art deliberately postpones material polish while establishing the film.

Use anticipation, action and consequence. Keep a single clear focal action while
quieter hover, courier or machinery motion stays alive. Mark camera movement
separately from subject motion. Maintain the packet’s distinguishing tab, travel
direction and geography across cuts. Match S05D to S01A at the loop seam.

## Input and literal work

The conversation is available from frame one. Typing, focus and partial speech
keep the loop running and dispatch nothing. Enter or a completed explicitly
started utterance commits once. Do not automatically move to overhead on commit;
that is a later explicit player choice. The input remains clear of choreography.

All staged activity is labelled **DEMO / STORYBOARD**. In production, both cameras
consume the same project-scoped work state. Agent reports remain reported;
saved edits, named checks and candidate-bound previews require actual evidence.
A moving character or a completed ring cannot create a pass. GUI assignments and
CLI reports share that authority. Independent projects retain separate state.

## Production handoff

Name a shot and panel ID in every visual task. Give the asset, camera, action,
source of work state, transition and expected visible result. Use the shared
panel list rather than improvising another sequence. If a change affects more
than one shot, update the blueprint and check both sides of every affected cut.

Review whether the action reads without captions, then framing and silhouette,
custody and travel continuity, input truth, and geography. Hardware GPU renders
all local 3D pictures. The board starts no providers or work. Product visual
implementation outside T01 stays paused; existing management integration remains partial
and has not passed native runtime qualification.

## Moving blockout

The owner approved a motion pass on this board. S02C dollies alongside the courier and packet, creating road and building parallax. S03A pushes between working arms; S03D holds tool contact, withdrawal and the second scan. S04C cranes upward and dollies back during its four-second reveal. Host hover, gaze, articulated gestures, scanner sweep, gateway latches and pavilion vanes provide smaller motion. Camera paths stay inside each approved shot; cuts retain the perspective contrast. P01 remains an untimed player choice, outside the movie.

Canonical panel `motionCamera` endpoints and `motionDescription` direct the artists. Regenerate the moving film with `node design/district-3d/storyboard/render-motion.cjs`. Every 3D frame uses hardware WebGL2; encoding uses NVENC. No product code, provider work, live checks or new work-state behavior is started by this study.

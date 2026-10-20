# Capability copy for the 3D introduction

Show an ordinary person's useful result before the host introduces itself. A game-night scoreboard gives the film a legible purpose: two teams, a point added, a clear winner, then a visible change of theme. Keep the conversation available throughout. The film is an example; an actual agent begins only after a committed request.

## Four short beats

| Beat | Film and host action | Suggested visible words |
| --- | --- | --- |
| `hook` | An idea card arrives at the district. Show the scoreboard's purpose immediately. | **Make game night your own.** Example request: “A scoreboard for our teams.” |
| `crew` | The original host guides the idea toward the workshop. Use cinematic assembly, without simulated provider logs, checks or progress percentages. | **An idea takes shape.** |
| `make` | Reveal the working example. Add a point, then change its colors. Let the result carry the promise. | **Play it. Change it. Make it yours.** Example request: “Give it sunset colors.” |
| `turn` | The host turns toward the conversation after the useful result is clear. | **Hi. What would you like to make?** |

Keep **DEMO · prebuilt example** visible beside the example throughout its reveal and transformation. Its accessible description should say “A prebuilt scoreboard demonstration; no agent is running for this example.” This label must survive camera motion, small layouts and the transition into conversation. “YOUR AI CREW BUILDS IT” currently appears over scripted animation; replace it with the proposed `crew` line so the film does not assert live agent work.

Typing, textarea focus, a draft and a partial speech transcript must leave the film playing. Enter commits once; Shift+Enter makes a new line; an explicit speech final commits once. Keep **Type or speak. Enter to send.** beside the input. After commitment, the example may recede while real activity appears. The host can react to the actual recorded state, without making additional promises.

## Words tied to actual states

| Evidence/state | Primary wording | Detail and action |
| --- | --- | --- |
| No assignment | **Ready for your idea.** | No moving workers presented as productive work. |
| Local starter creation/checks | **Preparing your starter app…** | The first Neon Rally page is copied from a template and checked locally. Avoid “AI is making your app” here. |
| `queued` / accepted receipt | **Your request is queued.** | Acceptance does not mean the provider has started. |
| Owned provider start | **Starting Claude…** | A found CLI is not confirmed sign-in or available quota. |
| `activity`, `basis: reported` | **Claude reports: [public activity]** | Retain an **Agent report** label. |
| Signed `file_changed` | **Saved a change to [file].** | **Observed**; expose file/hash under details. A write is not a passed check. |
| Real recipe checks | **Checking the saved files…** | Show the actual named checks. Distinguish static/syntax checks from browser interaction. |
| Passed checks + bound preview | **Your checked version is ready to try.** | The current preview must match its run and candidate hash. |
| Earlier preview after a source change | **Showing the previous checked version.** | **New changes are not checked yet.** Keep the usable prior output. |
| Provider error | **Claude couldn't finish this request.** | Show the actual diagnostic and the appropriate next step below. Preserve saved source and the draft. |
| Stop requested | **Stopping Claude…** | **Waiting for confirmation.** Keep Stop/status reachable while the runtime is stopping. |
| Confirmed cancellation | **Stopped. Your saved changes are kept.** | Do not grant a pass or allow late provider success to change this result. |
| `termination_unknown` | **Stop requested. Process exit isn't confirmed.** | Preserve this distinct state and a details/recovery route. Do not shorten it to “Stopped.” |

Use a calm state sentence plus expandable **Claude's message**. Do not replace or rewrite the provider diagnostic. Do not use a retry countdown unless its reset timestamp came from the provider. Do not automatically retry or switch paid providers because of a failure.

For a reported limit: **Claude reported a usage limit. Your project is kept.** Follow with **Try again after the reset shown in Claude's message.** If no reset was reported, say **Claude did not provide a reset time.** An `allowed_warning` or allowed overage is not a blocking refusal.

For an explicit login failure: **Claude needs you to sign in on this computer. Your project is kept.** Offer setup/details, without requesting credentials in conversation. For 403/permission text: **Claude denied this request. See its message for the required permission.** The generic process classifier currently includes 403 under `auth`; that category alone must not trigger a sign-in prescription. For an unknown failure: **Claude couldn't finish. Open its message to see what happened.**

## Integration review for lane 18

The existing Stop button dispatches `cancel_run` for the active owned project run (`app/district-workbench.js:203-206`). Session cancellation revokes its ticket before process-tree termination (`app/district/agent-session.js:151-168`), and runtime distinguishes confirmed cancellation from `termination_unknown` (`app/district/runtime.js:328-334`). Keep that command path in the 3D conversation view; `setActivity` remains presentation only. Existing fixture coverage includes cancellation/revocation and bounded process stopping in `tests/district-agent-session.test.js` and `tests/district-process-control.test.js`. This copy review did not rerun tests or verify the assembled 3D Stop control.

Current conversation submission guards are in `app/district-conversation.js:87-99`, `125-133` and `167-175`. Current first entry creates/checks a Neon Rally template before submitting the person's change to a provider (`app/district-workbench.js:360-389`). Label that preparation accurately. An accepted request currently says the worker “has your idea”; prefer **Your request was sent to Claude. Starting…** until a provider session is observed.

Retained evidence contains both an earlier actual quota refusal (`evidence/real-agents-v1/claude-quota-blocked.json`) and a later actual Claude saved-edit/check/render success (`evidence/district-v2/provider-claude/validation.json`, session `e55d454a-7dbf-424a-acd3-e7513a098d3c`). Neither establishes current account availability or proves the new 3D integration. The older `provider-claude/failure.txt` is a timeout diagnostic alongside that later validation; do not use it as the latest provider verdict.

Before accepting the assembled experience: watch useful output before hello; type through all four beats; submit once; exercise an actual or clearly labeled fixture refusal; Stop an owned fixture while working; confirm the difference between stopping, stopped and unconfirmed exit; and verify that demonstration activity never enters real run history or earns completion evidence.

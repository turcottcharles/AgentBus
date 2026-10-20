# Suggested next steps and optional auto reply

P01 / build-area conversation, implementation slice, 2026-10-19.
The accepted robot, camera and world assets are unchanged.

Open a saved project with **Build area**. After an owned project worker ends a
run, the conversation offers a next prompt based on that run's original request,
recorded outcome and named failed checks. Generation is deterministic and has no
extra model cost. It does not read arbitrary provider prose as instructions or
declare the whole request complete because tests passed.

- **Use once** fills the editable draft; Enter sends it through the existing
  project command authority. Arrow Up also fills an empty draft, without sending.
- **Auto reply** opts into 1, 3 or 5 additional assignments. A three-second delay
  permits cancellation with **Stop auto**. Reasoning and edits use provider quota.
- Auto mode pins the same worker/provider and preserves the original request
  across its generated prompts. It does not silently switch providers.
- Editing or speaking, switching project/view, hiding the app, losing project
  state/provider availability, stale source, cancellation, unknown termination,
  unconfirmed dispatch or provider failure disarms auto mode. Ordinary named
  check failures may receive a repair prompt. An exit without a saved source
  change disarms continuation under the current edit-run contract.
- Auto settings are intentionally session-only. Reloading the app never resumes
  an old automatic chain. Each source run can cause at most one automatic send
  during that mount. Lost dispatch replies are not automatically retried.

Scope: the existing Agent Bus owned project-worker adapter supports Codex and
Claude. The suggestion/controller module has no provider-specific prompt logic;
future worker adapters can use it too. Follow-ups currently launch scoped
assignments in the same project using saved source and the original request;
they do not resume a provider's complete conversation history. External Cursor
or Codex Desktop mailboxes still require a demonstrated harness adapter before
these controls can start turns there. A scoped smoke-test robot is also distinct
from an editable-project worker; auto reply does not rerun smoke jobs.

Focused controller, conversation and workbench tests cover dispatch, provider
pinning, draft preservation, duplicate protection, limits, stops and errors.
These fixtures do not prove live-provider execution, GPU performance, final
visual acceptance or overall product qualification. The existing running
Electron app needs a deliberate reload/restart before it can show changed files.

## Relationship to the RTS work map

The existing Test slice supports selecting Test by dragging the robot and then
explicitly starting actual smoke work. Arbitrary live-session discovery and
reassignment between Coding, Research and Test remain future integration work.
A registered mailbox or installed CLI is insufficient evidence of a live worker.
Represent connected sessions once each, map CLI-reported work to a building,
and allow drag/drop to request a scoped role/recipe change. Show pending travel
until that harness accepts; show working animation only for acknowledged work.
Inspection must reveal actual instructions, files/checks and results. Declined,
offline or uninterruptible assignments need visible state rather than an
animation that implies success. Path animation represents routing; it never
holds up real work or produces a test verdict.

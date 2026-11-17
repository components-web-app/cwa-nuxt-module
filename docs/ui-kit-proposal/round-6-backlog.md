# UI kit round 6 backlog (agreed with Daniel, 2026-11-17)

Starts after the round 5 review panel has reported and Daniel has added his views.

## Decided on round 5
- Palette additions for contrast (red-300, yellow-700, stone-300) approved.
- Tree pattern (`CwaUiTree` as a treegrid) approved.
- Toast style B (tinted frosted) chosen; toasts never move, they turn see-through in place over an entirely hidden focused element.

## 1. Route editing flow
- Daniel is not convinced by the current route-edit flow, and does not want another modal on top of the page modal.
- Proposed instead: inside the modal, the Routes tab **slides to a sub-view** (the panel moves left, the edit form slides in) with a **Back** button in the sub-view header; Escape and Back return to the tab. Same pattern for Forward to and + Redirect.
- Keep route actions immediate (decided), so the sub-view has its own Save route / Cancel; it must not look like the modal's footer Save.
- Motion: slide under the motion rules, instant under reduced motion. Focus moves to the sub-view heading, and back to the triggering button on return.
- Phone: the same sub-view, full screen within the modal.

## 2. Stepper range (the Order tab's position input)
- Bug from Daniel: the stepper accepts typed values outside its range.
- Rule: typing is never blocked (no swallowed keystrokes). Only digits are accepted (and `-` only when min < 0). An out-of-range value is **never saved**: while typed, the field shows its error state with "Between 1 and 6". On Enter or blur it snaps to the nearest bound and saves that, with the polite announcement "Set to 6, the highest position".
- − is disabled at min and + at max, each with its reason. ArrowUp/Down, PageUp/Down, Home and End step within range. `role="spinbutton"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext`.
- Applies to every kit stepper. Show in the mockup: typing 9 into a 1–6 position, the error, then the snap on blur.

## 3. v5 review panel findings (full results: v5-review-panel.jsonl)
Verified by a checker per role and spot-checked by Claude. Apply in round 6 unless Daniel decides otherwise:
- **Route sub-view** (all four roles agree): replaces the tab strip *and* the modal footer while open (header "← Routes · Edit route"); its own Save route / Cancel; no extra confirm on top; Back or Escape with unsaved input asks; switching tabs asks; no router history; the hidden panel is `inert`.
- **Spec gaps (developers):** metadata-only mode for `useDataResolver`'s off-screen tab render (confirmed: it renders every tab into a detached div), so `field` inputs create no models there; `field` scope per provider (manager tab live, dialog/page local copy) and "exactly one of field, :model, v-model"; one either/or API with a group model sending one PATCH; §4.1 model return shape and migration from today's `states`; a self-contained typed catalogue (props, emits, slots) for every component, including Tree and ResourceSearch; bundle budget per PR; the CwaUiManagerTab dev warning only after tabs migrate; live region owned by the bar, not the tab; a fake-model factory for /kit.
- **Build plan (manager):** rewrite §12 to include v5's additions, give editors something visible earlier, split phase 6, restore the per-PR bundle column. The updateResource result change must keep callers that use the returned resource working (Claude counts fewer callers than the 28 claimed).
- **Design (designer):** soft buttons share the field fill, so actions look like inputs; section action on the heading line; the conflict diff looks like a link; phone toasts cover a full-screen dialog's header; trash icons always red in the tree; three different "more" glyphs; phone list status alignment, Scheduled vs Static confusion.
- **Users:** Forwarding vs Redirects naming; a confirm's Cancel over the form's Cancel; "· Unsaved" in the link colour; two unlabelled dates on phone rows; the phone "New" glyph is a circled plus beside "+ Draft"; phone Routes recommendation wrapping.
- Rejected by the checker: "removals land before the ~220 tabs migrate".

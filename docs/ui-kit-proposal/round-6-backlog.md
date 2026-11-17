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

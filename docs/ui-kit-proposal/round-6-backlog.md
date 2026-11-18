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

## 4. List loading must look alive (Daniel)
- Skeleton rows get a shimmer: a soft light band sweeping across every row in sync (one CSS gradient animation, 1.4 s loop), in both themes.
- Normal motion: the shimmer alone; "Still loading…" (with the spinner) appears only after about 5 s. (Daniel, after the first preview: the shimmer is clear enough, so no "Loading pages…" line after 1 s.)
- Reduced motion: no shimmer, so a spinner (the one animation we keep) plus "Loading pages…" sits above the skeleton from the start, becoming "Still loading…" after about 5 s.
- `aria-busy="true"` on the list and one polite "Loading pages" announcement. The same rule applies to search's first-load skeleton and any other skeleton.

## 5. Decided on the review panel (Daniel, 2026-11-17)
- Buttons get their own fill, distinct from fields (semi-bold label).
- ⋮ is the only "more" glyph: CTA, list rows and tree.
- Manual VoiceOver/NVDA pass once per new component and before each release; axe and keyboard tests on every PR.
- Routes tab headings: **Redirect to** (this page's address sends visitors elsewhere; row `/kitchens/shaker → /kitchens/shaker-range`) and **Redirected from** (old addresses that send visitors here; row `/shaker → this page`).
- **`updateResource` keeps its return** (the saved resource, or undefined on failure); replace the v3 `{ ok } | { ok, error }` wording. Per-field outcomes go into `fieldStates` keyed by (iri, field), using the fields the event sent, so one field's success never clears another's error (today's `removeByEndpoint`). Callers checked: the field model needs the returned resource's `@id` (a save on a live component returns a new draft IRI); `useItemPage` returns it to its caller; stranded merge, clone, remote changes and the Info tab only test success. Outside the module only bcio calls it (ArticlesCollection, result unused); the docs example doesn't use the result.

## 6. Template count in lists
- Needs api-components-bundle#587 (admin-only `_metadata.pageDataCount` on template pages). Until it ships, the list shows "Template" with no number. Bundle contract (2026-11-17): total only, admins only, template pages only, 0 when unused; the list says "Template · 14 pages" and "Template · unused".

## 7. Route status in page lists (decided 2026-11-17)
- The Pages list reads statuses from `GET /_/routes?pages[]=<page IRI>…&perPage=100` (`pageData[]=` for page data lists; PR bundle#590), one request per list page alongside `/_/pages`, joined on `route`; every match returned. No route data on Page (bundle rule: relations are IRIs; go-live state is owned and cache-managed by Route). A page with no match is "No route". api-components-bundle#588: `perPage` up to 100 with either filter, every match returned, more than 100 IRIs is a 422; admins get `path`, `liveAt`, `_metadata.effectiveLiveAt`.

## After the v6 polish: review panel (Daniel, 2026-11-17)

Run the review panel again (the same roles as after round 5, each finding checked) once the polish round is in:
- delete in the Info tab and the two confirm tiers;
- the bar's edge-line status on every control, with one saving episode (field line, bar spinner, header);
- the in-page indicators (left edge vs whole outline);
- the header's "safe to leave" status;
- the tab badge rule;
- the caret rule for a focused field updated remotely.

Daniel picks from the confirmed findings before the next round.

## Pending spec additions

- **Caret on a remote update:** a focused field with no unsent change takes the remote value. A plain text field keeps the caret at the same offset, or at the end if the text got shorter, never at the start. The HTML editor already uses a minimal replace.
- **The admin header in the mockup is a stand-in:** only its status changes (§7.2). A header restyle is not in scope.

## Bundle shapes, final (released in api-components-bundle 2.0.0-alpha.42)

- **#587 (bundle PR #589, released in 2.0.0-alpha.42):** `_metadata.pageDataCount` is an integer, the total page data of any class using the page as its template. It is on the `Page` item and each `GET /_/pages` member, only when `isTemplate: true` and the caller has the publishable permission; 0 when unused. It is absent for visitors, for ROLE_USER, for non-template pages and in manifests. Side effects: every authenticated `Page` GET is now `private, no-store`, and a template's private draft Mercure update is always sent. Nothing republishes the template when page data is created or deleted, so the list and the delete confirm must read the count fresh (re-fetch the page when opening the confirm).
- **#588 (bundle PR #590):** `GET /_/routes?pages[]=…&perPage=100` / `pageData[]=…`; see §7 above.

## Next round: the resource context menu joins the kit (Daniel, 2026-11-17)

The right-click menu (`CwaResourceManagerContextMenu` on `utils/ContextMenu.vue`) lists the resource stack under the pointer so the editor can select a parent or child. Bring it into the kit so its styles match: it becomes `CwaUiMenu` anchored at a virtual point, the same component as the CTA's ⋮ menu and the clone or move placement menu. The kit owns the menu: anchoring at the pointer or an element, items, groups, disabled rows with a reason, keyboard, focus return and phone behaviour (long press, sheet or popover). The resource manager keeps what goes in it, the stack logic. The mockup shows it on the sample page and in the `/kit` page plan, and the spec lists it in the catalogue, the migration plan (which replaces `utils/ContextMenu.vue`) and the build phases.

**Keep the nested containment layout (Daniel):** the right-click stack and the header's path selector keep today's boxes inside boxes, each name below the child it contains, restyled on kit tokens as one `CwaUiResourceStack` with two anchors (spec §5.3, §7.2). Not a flat `CwaUiMenu` list.

## From Daniel's preview review (2026-11-18)

- **Information popovers** are a dark `surface-info` with white text, not `surface-menu`, which blended into the fields. The info-tint look is on `/kit` beside it for comparison (7f).
- **No white flash before the focus ring** on any kit control (7f).
- **The auth pages' secondary links are grey** (`fg-muted`, `fg` on hover, underlined) (7f).
- **A dialog never focuses a header control on open** (the type select, the view link, the depth chain) (7f).
- **A segmented choice is only as wide as its options**, never stretched across the field column (7f).
- **Sizing consistency:** anything in a row with buttons is the buttons' height; chips and tag groups were taller. The image field's Alt button sits level with the field (7f).
- **A floating surface is never painted before it is placed:** menus flashed top-left before moving (7f).
- **Empty-position placeholders show only in edit mode**, never to an admin outside it (7b).
- **CWA is off on `/kit`**, so samples never select resources in the real admin (7e).
- **Edit dialogs become slide-overs from the right** (experiment): a centred dialog shifted as its content changed height. Confirms, the add component dialog and pickers stay centred (7d).

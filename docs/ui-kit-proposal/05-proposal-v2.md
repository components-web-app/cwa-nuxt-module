# CWA Admin UI Kit: proposal v6 (#236)

**From:** UI design. **For:** Daniel (decision owner) and module developers.
**Builds on:** `04-proposal.md` (v1) and Daniel's review of it. History is in `01`–`03`.
**Scope:** the UI kit only. Component configuration (`defineCwaConfig`, styles, UI variants, field declarations) is a separate job and is not designed here. The kit is developed in `ui-kit.html` until Daniel is happy, and only then implemented.
**Status:** proposal. Nothing is built. Every public name has a named consumer (R7); anything without one is internal and lives in `core/`.

What changed in v6 (the v5 review panel and Daniel's decisions, `round-6-backlog.md`):
- **The Routes tab is the Route, then navigation rows** (§8.3): Redirect to, Redirected from and Child routes are full-width rows with a muted summary and ▸, each opening a **sub-view** inside the modal. The modal's tabs stay, with Routes selected; the sub-view has a stacked header ("‹ Routes", then its title). While a form is open in it, its own Cancel and Save replace the modal's footer, so there is only ever one Save on screen and no confirm on top. Back, Escape or another tab with unsaved input asks first; no router history; the tab's hidden main view is `inert`. Focus goes to the title and returns to what opened it.
- **Redirect to / Redirected from** replace Forwarding / Redirects, rows show the direction (`/shaker → this page`), and no button ends in "…".
- **Stepper range rules** (§5.2): typing is never blocked, only digits are accepted, an out-of-range value shows "Between 1 and 6" and is never saved, blur or Enter snaps to the nearest bound and says so, and −/+ are disabled at the ends with their reason.
- **Loading shimmer** (§9.2): skeletons get one band sweeping every row in step, 1.4 s; with normal motion that is the only sign until "Still loading…" at about 5 s; with reduced motion there is no band, so a spinner and "Loading pages…" show from the start. Search's first load follows the same rule.
- **Buttons have their own fill** (`button` token, §2.1), not the field's, with a 600 label (§5.1).
- **⋮ is the only "more" glyph**: the bar, list rows and the tree (§5.1, §5.3, §5.4, §9.1). **A modal header has no ⋮** on any size (decided): delete lives only in the Info tab's "Delete this page" section, so it is harder to reach; the ⋮'s other item, Duplicate, was a mockup placeholder with no action in the module today and is dropped.
- **`updateResource` keeps its return** (§8.4): the saved resource or `undefined`. Per-field outcomes go into `fieldStates` keyed by `(iri, field)`, so one field's success never clears another's error.
- **Delete leaves the footer** (§8.6): every modal's footer is only Cancel and Save; deleting is the last section of the Info (or last) tab, and Delete route the last section of the Edit route form. **Type to confirm** for deletes that are hard to recover from, the simple confirm for the rest (a decision Daniel can adjust).
- **A ghost button never sits at a container's start or end edge** (§5.1).
- **Spec precision** for developers: the model's shape and the migration from today's `states` (§4.1); what `field="…"` binds to under each provider and "exactly one of `field`, `:model`, `v-model`" (§3); off-screen tab renders resolve metadata only (§3); one either/or API with a group model sending one PATCH (§6); a typed catalogue for every public component (§5.5); the bar owns the live region (§7, §11.2); the `/kit` fake model (§12).
- **§12 is rewritten**: editors see something in the second PR, phase 6 is split into 6a to 6d, each PR states its entry and visitor bundle budget and whether it adds a reka-ui consumer, the root warning is switched on when the tabs migrate, and removals land in one late PR.
- **Screen readers** (§11.4): a manual VoiceOver and NVDA pass once per new component and before each release; axe and keyboard tests on every PR.
- **Design fixes** (§8.2, §9.1, §10): "Unsaved" is `fg-muted` with an `accent-fg` dot; the conflict diff is tint and weight only, and none when most words differ; warning and danger alerts are a 10% tint over `surface` with a 3px edge; tree delete icons are muted until hover; phone list rows start their status glyph in one slot, Scheduled has a clock, a template a hollow square, and a date says what it is ("edited 15 Nov"); the phone status for New is a dashed ring; phone toasts sit below a full-screen dialog's header and tabs.

What changed after the final v6 review panel (`v6-final-review-panel.json`, Daniel's decisions; findings by number):
- **The resource stack, simplified** (§5.3; 1, 3, 4, 15, 21, 23, 33–36, 40): only components, positions and groups (pages and layouts are reached through the page/layout overlay and page settings, never the stack); **name only, as today; icons and second lines removed (Daniel)**; the innermost box opens at the pointer; no padding between the panel and the outermost box; a reka **Popover** holding the tree; Up/Down follow the names on screen and Left/Right follow the ARIA tree; "Show N more parents" is a button outside the nesting; choosing waits for the selection to resolve; Tab closes like Escape; the phone sheet is a modal dialog.
- **The add component dialog opens a detail sub-view** (§5.6; 5, 6, 7, 11, 14, 16, 25–27, 37–39): a click or Enter opens it, Add adds, nothing else adds; UI and Style can be chosen before adding and go in the create request; names rank first in search; a component that isn't allowed says so; sections are labelled groups; every leading visual is one fixed size; the footer is just Cancel and Add.
- **Admin-only config keys stay out of the visitor entry** (§5.6; 8).
- **The bar's file group and Style get a typed save mapping** (§4.1; 2); **removing the image has Undo and a failed remove keeps the file shown** (§7; 17, 29); **composite controls are named groups** and **a toggle's status sits outside its label** (§7, §11.3; 31, 32); **Note leads the Info row** (29).
- **The caret rule maps through the text diff** (§4.3; 9, 13).
- **Phone header** (§7.2; 10, 12, 18, 19, 22): status icon-only with its text in a tooltip on tap, the path selector at least 6rem with a ▾ when it has parents, Menu an icon, the label stays while the sheet is open.
- **One red per role** (§2.1; 30) and **section headings one step darker** (§2.1; 28).
- **One count, on Save** (§8.2): no separate "N unsaved" notice. **Rows open their modal; the modal header's eye views the page** (§9.1): rows have no ⋮.
- **Toast style options removed from the mockup** (§10.1): B is decided. **No open questions remain** (§13).

What changed after the v6 review panel (`v6-review-panel.json`, Daniel's decisions):
- **The resource stack joins the kit** (§5.3): `CwaUiResourceStack` keeps today's nested containment boxes (Daniel), restyled on kit tokens, as a tree with keyboard, for both the right-click menu and the header's path selector; long press on phones opens it as a sheet.
- **`CwaUiCombobox`** (§5.6): the add component dialog becomes one searchable list with sections, icons, optional thumbnails and Dynamic in place; new optional `icon`, `group` and `image` config keys.
- **Every bar control saves through one path** (§7): Style, Show, Image, Link and Note were missing it in the mockup.
- **Section headings are `fg-secondary`** (§2.1, §2.3); **the in-page error outline is a saturated red** (§7.1).
- **Caret rule for a remotely updated focused field** (§4.3) and **the mockup's admin header is a stand-in** (§7.2).
- **No modal header ⋮** (decided, reverses finding 30's "Delete page in the header ⋮"): delete is only in Info's last section (§8.6).
- **The bar's status and CTA have no divider between them**; one divider separates the tabs from the status-and-CTA group (§7).
- **The header's saved tick stays green at rest**; its text stays muted (§7.2).
- **The admin header always says something** (§7.2): a green tick and muted "All changes saved" at rest, "Saving…" from the first change of an episode (the debounce included), "N changes not saved" until a save actually succeeds; one persistent element, not a live region.
- **The selection outline uses the real colours** (§7.1): published green, draft or new orange, core magenta (`ComponentFocus.vue`); no name tag on the page, the admin header shows the selection's name; error solid red, conflict amber, saved green, and a soft **state-change glow** round the outline only (two stacked shadows, 250 ms rise, 650 ms fall); bar controls have none.
- **Error and conflict popovers open after 300 ms of hover**, at once on focus, and sit straight after their control in the DOM, so Tab and a screen reader's swipe reach them in order (§4.4).
- **One severity order everywhere** (§7, §8.3): conflict > error (> unsaved in modals), from one `badgeFor()`; a tab's name gives both counts, and the pinned status names both kinds.
- **Deleting** (§8.6): type the **name** (page name, user's email, route, orphan count), not "delete"; removing a component used in several places is a simple confirm; the page's cascade names the addresses that stop working, the count is fetched fresh before the confirm opens, unsaved edits are discarded with the delete; Delete page is a soft danger button.
- **Toast actions are the kit's small buttons**, and an unchanged upsert neither rebuilds nor re-announces (§10).
- **The in-page error toast has one trigger** (§7.1): an unresolved field no longer reachable from the bar; it goes when the field leaves the error.
- **The CTA group's inset is one token on three sides** (§7), and the status's hover fill uses it too.
- **Model and store precision** (§4.1, §8.4, §12): `slow` and `waiting` on `CwaFieldState`, `held` as plain data, one request in flight per model as a listed model change.

What changed in v5 (Daniel's review of v4):
- **WCAG 2.2 AA pass** (§11): darker field fills, 24px minimum targets everywhere and 2.75rem on touch, focus never hidden (scroll padding for the bar and admin header; a toast stack that entirely covers the focused element turns see-through in place), a single-pointer alternative to every drag, accessible sign-in, one quiet live region per surface with fixed announcement rules (§11.2), shapes as well as colours for every state (the Dynamic type is a square), and an accessibility checklist per component (§11.3). axe runs in Vitest and the browser tests, and a manual VoiceOver and NVDA pass happens before each kit PR merges.
- **Contrast fixes** (§2.1): dark field `#57534e`, light field `#d6d3d1`, chip `#6e6964` / `#b8b2ad`, dark error text red-300, light Dynamic yellow-700, light toggle-off stone-500, and new `tree-line` and `muted-on-field` tokens. Every pair is measured in §2.1.
- **Section headings read as headings** (§2.3, §2.4): 1.125rem / 650 in `fg-secondary` (stone-600 light, stone-300 dark; slightly grey, decided), with 2rem above, a 1px `line` rule and 2rem more before each section after the first, and 1rem to the first field. Modal title, section heading and field label are three distinct levels, as real `h2`/`h3` headings.
- **`CwaUiManagerTab` is each tab's single root** (§1, §3), with `field="…"` on kit inputs and a development warning for any other root.
- **The page modal's Routes tab is rebuilt with the kit** (§8.3): status from the route (Live, Scheduled, Not live, Held back by parent, No route), the recommended path inline with "Use this", the go-live control, Forward to, Add redirect and child routes. **Route actions save at once**, each after its own confirm and with its own saving state; the modal's Save is only for the page's fields.
- **A tree component** (`CwaUiTree`, §5.4): connector lines, expand and collapse, the ARIA treegrid keyboard pattern and row actions with 2.5rem hit areas. Used by the Routes tab and the routes list.
- **Search asks the API** (§5.3): 250 ms debounce, a request-id guard, cancel on close, and the states first load, searching, slow, many results, no matches, offline, server error and a chosen value outside the results.
- **A page's status in lists comes from its routes** (§9.3): Live, Scheduled · 20 Nov, Not live, Held back by parent, No route; a template says "Template · 14 pages". Pages have no "Draft". Row actions are **Edit settings** (also the row click) and **Go to page**.
- **Conflicts in modals are a notice under the field** (§8.2): the field keeps its normal look with the conflict tint; below it, a warning-edged notice with "Mia changed this while you were editing.", both versions as read-only quoted text with the difference highlighted, and **Use Mia's** / **Keep mine**. A modal alert counts them and Save says why it is blocked. The bar's conflict popover shows the values the same way.
- **Every ⓘ opens a popover** (§4.5) that never moves the layout. Errors under a modal field stay inline.
- **Create buttons read "+ Page", "+ Article"** (accessible names "Create page", "Create article"). A new component's main action is **"+ Draft"** ("Add draft") when publishable, **"+ Add"** otherwise.
- **The split button's trigger is ⋮** (vertical dots, "More actions"), matching today's `CwaUiFormButton`, and it can stand alone: a live component or a selected group shows only ⋮ (§5.1).
- **Bar spacing** (§7): on a desktop the split button has 4px above, below and to its right; on a phone the status is a glyph only, right against the action with no gap, with a distinct shape per state and its name read out.
- **Read-only values sit on the same line as their neighbours' values** at bar, modal and touch sizes.
- **Toasts are tinted frosted glass** (option B, Daniel's choice from three, §10.1); the toast region has no background, padding, shadow or blur of its own and lets clicks through; toasts never move, and turn see-through while they entirely cover the focused element.
- **A kit reference page**, `/kit` in the playground (§12), is phase 1.
- **One saving episode per field** (§7): 250 ms debounce, one request in flight with a single newest-value follow-up, and one uninterrupted sweep from the first send until nothing is waiting or in flight, then one "saved".
- **One bar episode for the pinned status** (§7): "Saving…" and its spinner run from the first send until nothing in the bar is in flight or waiting, gaps of up to 300 ms included, then "All changes saved" once. The spinner element is never re-created during an episode.
- **Tab badges are derived** (§7): the most severe unresolved state of the tab's fields, conflict before error; saving, pending and saved never touch it, and it re-renders only when that value changes.
- **Editing on the page** (§7.1): the bar's status stays primary; the whole selection outline carries the field states at its own width (Daniel's choice); no toast while the component is selected.
- **Saving → saved morphs instead of snapping** (§2.8): the moving segment grows from where it is to the full line while turning solid and success-coloured (180 ms, ease-out), holds 600 ms, then fades 400 ms; error and conflict grow to solid and stay. Sweeps are faster (1.1 s on a bar line, 1.2 s round the outline), the start fades in over 150 ms.
- **One toast renderer** (§10.1): every toast, the live ones and the Toasts section's samples alike, is built by the same function with the same classes, so all show option B.
- **The admin header says whether it is safe to leave** (§7.2): "Saving…", "All changes saved" at rest, or "1 change not saved" as a button; it replaces `SpinnerTick`.
- **Bar status is an edge line, on every bar control** (§1, §4.2, §4.4, §7; Daniel's decision): no status glyph inside any bar control and no glyph button anywhere in the bar. The value, the chevron and the calendar icon never move or change. A 2px line inside the control's bottom edge shows the state: an accent sweep while saving, success then a fade once saved, and a solid danger or warning line, with the field tint, for an error or a conflict. The error or conflict popover opens when the control is focused or hovered; Tab goes into it and Escape closes it with focus left on the control. Pending shows nothing on the control: the bar's status says it. This replaces v4's in-place glyph swap and widened end padding. Modals and pages are unchanged.
- **Deleting a page states the bundle's cascade** (§8.6): page data built from it as a template is deleted too (with the count), its route stays without a page, nested pages lose their parent.

What changed in v4 (Daniel's review of v3):
- **No reserved status slot.** *(Superseded in v6 by the edge line, §4.2.)* Controls with an end icon (select and multi-select chevrons, the date picker's calendar, resource search) show a state in that icon's place while it lasts: the chevron becomes the spinner while saving, the tick once saved, then the chevron again; error and conflict show their solid glyph there, still a button. Plain text inputs and steppers in the bar widen their end padding only while a state shows; the outer size never changes. Modal and page fields show no glyph inside at all (§4.2).
- **The textarea's corner glyph is gone** (textareas are modal and page only).
- **Admin pages with forms use the modal's Save model** (§8.2). Decided.
- **Create buttons name what they create**: "Create page", "Create article" (§8.2). Decided.
- **Unsaved changes are never dropped silently** (§8.5): Cancel, ×, Escape and a backdrop click ask "Discard 3 unsaved changes?"; leaving a modal or admin page asks "Leave without saving?" through `NavigationGuard`; closing or reloading the tab gets the browser's own `beforeunload` prompt. Nothing asks when nothing changed. Decided.
- **On `pointer: coarse` every control's value text is 1rem** (§2.3), not only text inputs. Decided.
- **No value is clipped** (§2.3): a value that truncates clips sideways only (`overflow-x: clip`), because `text-box` trim with `overflow: hidden` cut ascenders and descenders ("Split image").
- **The phone bar's primary action is flush right** in the touch layout too (§7).
- **The bar's primary action is a split button** (§5.1, §7): the main action, and an arrow ("More actions") that opens a kit menu with today's options: Add before/after (Add to start/end for a group; a disabled row with the reason when the group is full), Clone, Move; for a new component, Add, with Add and publish and Discard.
- **Bar width tokens apply to selects.** v3's `button.f { width: 100% }` outranked `w-md`, so a bar select sized itself to its value and grew or shrank when a state replaced its chevron; the width tokens now win.

What changed in v3 (Daniel's review of v2):
- **Modals and pages edit a local copy and keep a Save button** (§8.2). Changed fields and their tabs are marked, Save counts the changes and sends only those, errors from Save go on their fields, and a 412 on Save asks per field which version to keep. Live per-field saving stays in the bar only. Q6 is settled by this.
- **The page modal has tabs again** (Details, Routes, Info, then page data tabs), with create, required-field and failed-save flows across tabs (§8.3).
- **The bar's status and primary action are pinned in the tab row on every tab**, on desktop and phone (§7).
- **Only the innermost control under the pointer shows hover** (§2.7). The stepper buttons, a chip's × and clear buttons (and, until v6, status glyph buttons) have their own hover and pressed shades (`step-hover`, `step-press`).
- **Textareas grow with their text** up to 8 lines and then scroll, with no resize handle (§5.2).
- **Lists filter by type with square coloured toggles** and a matching dot per row; per-row thumbnails are gone (§9).
- **A failed save offers Retry and Reset**, never Undo. Undo is kept for things that happened and can be reversed (removing a chip, a successful either/or switch).
- **A sliding tab indicator and a short motion spec** (§2.8).

What changed in v2 (from v1):
- **Fields are filled, not bordered.** Borders and rings are used only for focus and for another editor's presence.
- **Every box is square.** The only rounded thing is the toggle switch.
- **Status glyphs are solid** shapes, legible at 1rem. *(In the bar's fields, superseded in v6 by the edge line; the glyphs remain for tab badges, the pinned status and modal error lines.)*
- **Errors and info have one pattern each**, for the bar and for modals and pages.
- **Spacing is friendlier**, with explicit values and mobile breakpoints. The modal form layout and the list grid are respecified.
- **Selects, searches and menus have a full open-state spec**, and the artifact must show them working.
- **The link input is generalised** into the either/or field group (Q7 decided).
- **Field save state lives in the resources store** beside `apiState` (Q6 direction).
- **Q8 accepted:** presence flags are portalled and the bar has a fixed height.
- The `defineCwaConfig` section and the questions it settled are gone.

---

## 1. Principles

1. **The bar is one row, always.** Every manager tab's single root is `CwaUiManagerTab`, which is the one-row layout. Fields never stack and overflow scrolls sideways. Multi-line content is edited in-line on the page (§7). A tab whose root is anything else gets a development warning.

   ```vue
   <CwaUiManagerTab>
     <CwaUiInput field="label" label="Label" />
     <CwaUiLinkInput :fields="['route', 'rawPath']" label="Link" />
     <CwaUiToggle field="openInNewTab" label="Open in a new tab" />
   </CwaUiManagerTab>
   ```

   Kit inputs inside it take `field="…"` and build their model from the tab's resource; `:model` stays for page data, a custom debounce and other unusual cases. What `field` binds to depends on the provider (§3).
2. **State lives at the field, without reserved space, and never moves the value.** No field keeps empty room for a glyph that is usually absent. In the bar a state is a 2px line inside the control's bottom edge (with the field's tint for an error or a conflict); nothing inside the control changes, so the value and the end icon never move and the outer size never changes. In modals and pages a field's state is shown by its label ("● Unsaved") and the line below it, never inside the field.
3. **The bar saves as you type; modals and pages save on Save.** The bar edits one selected component in place, so each field saves on its own. A modal or page edits a local copy and sends it when the editor presses Save (§8.2).
4. **Bind once.** `:model="title"` wires the value, presence, conflict, save state and errors. `v-model` remains for values that are not resource fields.
5. **Quiet when it works, visible when it fails.** A save shows a tick. A failure stays until it is resolved, and nothing blocks typing. A failed save offers **Retry** and **Reset** (back to the last saved value); nothing happened, so there is nothing to undo.
6. **One of each.** One button, one select, one field look, one disabled look, one spinner, one popover system (reka-ui, portalled into the app's container), one toast stack.
7. **Information is explicit, never hover-only.** No tooltips on fields. Help is an opt-in ⓘ that opens a popover on click or tap (§4.5), used sparingly, and never moves the layout.
8. **Friendly, not admin-like.** Generous, consistent spacing, plain sentence-case copy, and every control usable with a thumb on a phone.
9. **Admins only, loaded late.** Kit code is lazy and admin-only. Visitors pay nothing new.

---

## 2. Tokens

Tokens live in the `@theme` block of `src/tailwind/tailwind-cwa.css`, are used as `cwa:` utilities and are emitted as `--cwa-*`. Every size is in rem, so text zoom scales the controls.

### 2.1 Colour

Shades marked † are outside R5's palette list; Daniel approved them in v5.

| Token | Use | Dark (default) | Light (`cwa:theme-light`) |
|---|---|---|---|
| `surface` | bar, modal, page | stone-900 `#1c1917` | `#ffffff` |
| `surface-raised` | modal footer | stone-800 `#292524` | stone-100 `#f5f5f4` |
| `surface-menu` | menu, popover, toast (with `shadow-popover`) | stone-800 `#292524` | `#ffffff` |
| `button` | **soft button fill** (v6): its own fill, so an action never looks like an input; hover `field-hover` | stone-700 `#44403c` | stone-200 `#e7e5e4` |
| `shimmer` | the band sweeping across skeletons (§9.2) | white 24% | white 90% |
| `menu-highlight` | highlighted menu option | stone-600 `#57534e` | stone-200 `#e7e5e4` |
| `field` | **every input's fill** | stone-600 `#57534e` (2.29:1 on `surface`) | stone-300 `#d6d3d1` (1.49:1) |
| `field-hover` | field hover | `#625d58` | `#c9c4c0` |
| `chip` | chips inside a field | `#6e6964` | `#b8b2ad` |
| `field-danger` | field in error | `#6f514c` | `#dabfbd` |
| `field-warning` | field in conflict | `#6d5e45` | `#dcc9ad` |
| `muted-on-field` | placeholders and muted text on a fill | stone-200 `#e7e5e4` (6.08:1 on `field`, 5.18:1 on hover) | `#4f4a45` (5.88:1, 5.06:1 on hover) |
| `tree-line` | tree connector lines | stone-500 `#78716c` | `#8a837e` (3.73:1) |
| `toggle-off` | toggle track when off | unchanged (3.65:1) | stone-500 `#78716c` (4.80:1) |
| `step-hover` | hover on a control nested in a field (stepper −/+, chip ×, clear ×), laid over whatever fill the field has, tinted ones included | white 17% | stone-900 16% |
| `step-press` | the same controls while pressed | white 30% | stone-900 30% |
| `type-static` | Static page type: row dot, filter toggle swatch (the pressed toggle fills blue-600 with white text) | blue-400 † | blue-600 |
| `type-dynamic` | Dynamic page type: a **square** row marker and filter swatch (Static is a circle, so the type never depends on colour, WCAG 1.4.1); the pressed toggle fills yellow-400 with stone-900 text | yellow-400 † `#facc15` | yellow-700 † `#a16207` (4.92:1) |
| `line` | **dividers only** | stone-700 | stone-300 |
| `fg` | text, values | stone-100 `#f5f5f4` | stone-900 |
| `fg-secondary` | section headings in modals and admin pages (`text-section`); one step stronger than helper text and labels (final panel 28) | stone-200 `#e7e5e4` (13.9:1 on `surface`) | stone-700 `#44403c` (10.4:1 on `surface`) |
| `fg-muted` | labels in the bar, helper text | stone-400 on `surface` (6.9:1); `muted-on-field` on a fill | stone-600 `#57534e` on `surface`; `muted-on-field` on a fill |
| `accent` | primary button fill, selected tab, toggle on | blue-600 `#2563eb` (fill only) | blue-600 |
| `accent-fg` | **focus ring**, links, accent text | blue-400 † `#60a5fa` (6.9:1) | blue-700 † `#1d4ed8` (6.7:1) |
| `success` | saved glyph | green `#9cdd05` (6.2:1 on `field`) | lime-800 † `#3f6212` (5.6:1) |
| `line-saving` | bar status line while saving (v6) | blue-300 `#93c5fd` (4.23:1 on `field`, 3.61:1 on `field-hover`) | blue-700 `#1d4ed8` (4.50:1, 3.87:1) |
| `line-saved` | bar status line once saved; Undo is available | `#9cdd05` (6.2:1, 3.96:1) | `#3f6212` (4.75:1, 4.09:1) |
| `line-danger` | bar status line, error | red-200 `#fecaca` (4.91:1 on `field-danger`, 3.67:1 on its hover) | red-800 `#991b1b` (4.82:1, 3.85:1) |
| `line-warning` | bar status line, conflict | amber-300 `#fcd34d` (4.36:1 on `field-warning`, 3.31:1 on its hover) | amber-800 `#92400e` (4.39:1, 3.50:1) |
| `warning` | conflict, long-wait glyph | orange `#ffaa00` (3.3:1 on `field-warning`) | amber-700 † `#b45309` (3.11:1) |
| `danger` | error glyph | red-300 † `#fca5a5` (3.74:1 on `field-danger`) | red-700 † `#b91c1c` (3.75:1 on `field-danger`) |
| `danger-strong` | **the "not saved" status**: text and glyph of the admin header's status (§7.2), the bar's pinned status (§7) and their popover titles | red-400 `#f87171` (6.32:1 on `surface`) | red-600 `#dc2626` (4.83:1 on `surface`) |
| `danger-fill` | destructive button fill | red-600 `#dc2626` | red-700 |
| `danger-fg` | **error text** on `surface` and on a red tint (helper and error lines under fields, danger buttons' text) | red-300 † (8.6:1 on `surface`) | red-700 † (6.5:1) |
| `highlight` | reorder, clone, selection | magenta `#e30a6c` | magenta |

Rules:
- **Fields have no border.** The fill identifies the field, and an always-visible label names it. The fill is 2.29:1 against `surface` in dark and 1.49:1 in light: WCAG 1.4.11 is met by the visible label, which identifies the control, not by the fill. A 3:1 fill would be a mid grey that fights the values.
- **Status lines** (v6) have their own tokens because the tone tokens drop under 3:1 on hover fills (`accent-fg` on dark `field-hover` 2.56:1, `danger` on light `field-danger` hover 2.99:1, `warning` on either `field-warning` hover 2.5:1). Each line is measured against its resting fill and its hover fill, and on `surface` under a toggle (all ≥ 5:1).
- **Measured pairs** (v5): `fg` on `field` 6.99:1 (dark); the pending dot 3.00:1; focus ring `accent-fg` on `surface` 6.9:1 (dark), 6.7:1 (light); every glyph and state tint at least 3:1 against the fill it sits on; all text at least 4.5:1.
- `accent` is never text or a thin line. A selected option or toggle on `surface-raised` also gets an `fg` glyph.
- Text targets 4.5:1 and glyphs 3:1, against the fill they sit on (tinted fills included). PR 1 keeps the table in a spec.
- **One red per role** (final panel 30): `danger-strong` for the "not saved" status wherever it shows (header, bar status), `danger-fg` for error text, `danger` for the error glyph on a field tint, `line-danger` for the bar's edge line, `danger-fill` for a destructive fill. The in-page selection outline keeps its own site-side red (§7.1). One screen never shows the same role in two reds.
- Presence colours still come from `presenceColour`.
- Under `forced-colors: active`, every field gets a 1px `CanvasText` outline (fills disappear there), focus uses `Highlight`, and the glyphs stay.

### 2.2 Shape

- **Radius is 0 everywhere:** fields, buttons, menus, popovers, chips, badges, presence flags, avatars, cards, toasts and dialogs.
- **The one exception is `CwaUiToggle`**, whose track and thumb are fully round (`radius-toggle: 9999px`).
- Glyphs that are drawn as circles (the saved check, the pending dot, the spinner) are icons, not boxes, so they do not break the rule. The same goes for the small square caret (a rotated square) that points a popover at its trigger.
- **No field borders.** A line appears only for focus, presence, the selected tab's bar and the checkbox's control boundary (an inset 1.5px `fg-muted` ring on an unchecked box, so it reaches 3:1 on a white surface; WCAG 1.4.11).
- The current `rounded*` utilities in module components are removed as each component moves to the kit.

### 2.3 Type

| Token | Size / weight | Use |
|---|---|---|
| `text-flag` | 0.75rem / 600 (presence flag 0.6875rem) | presence flag, badge, count |
| `text-helper` | 0.8125rem / 400 | helper and error lines, list secondary line |
| `text-control` | 0.875rem / 400 | bar controls, menu options, bar labels |
| `text-control-lg` | 0.9375rem / 400 | modal and page fields |
| `text-label` | 0.875rem / 500 | labels above fields, buttons, tab names |
| `text-section` | 1.125rem / 650, `fg-secondary`, line-height 1.5rem | form section headings in modals and admin pages |
| `text-title` | 1.375rem / 650, line-height 1.75rem | modal titles, admin page headings |
| `text-confirm` | 1.0625rem / 650 | a confirm's title (not a heading) |

**Three levels in a modal or admin page:** the title (`h2`, `text-title`), section headings (`h3`, `text-section`, `fg-secondary`: slightly grey, so the title and the field values stay the strongest text), field labels (`text-label`, 0.875rem / 500). Helper text is 0.8125rem. Headings are real headings in order, sentence case, never all-caps. A page's heading level follows where it sits (an admin page's title is its `h1`, sections `h2`).

- **On `pointer: coarse`, every control's value text is 1rem**: text inputs, textareas, select and date values, placeholders, chips and segmented options. iOS Safari then does not zoom on focus, and a select sits at the same size as the text input beside it. Labels, helper text and menu options keep their sizes. (Decided in v4.)
- The system font stack, with `tabular-nums` on numbers, dates, counts and pagination.
- Sentence case everywhere. No upper-case headers.
- Text in the bar truncates and never wraps.
- **Text sits optically centred in every single-line control**, at every size (bar, modal and page, touch): equal space above the cap height and below the baseline, for values, placeholders and labels alike. This covers text inputs, number and stepper, selects, the multi-select and its chips, resource search, the date picker, buttons, filter toggles, segmented controls and tabs. Controls centre their content with flex `align-items: center` on a whole-pixel line box (`line-height: 1.25rem`), and value and placeholder spans also trim their line box to the cap height and baseline (`text-box: trim-both cap alphabetic`), so the result does not depend on the font's ascent and descent (system fonts differ: Segoe UI would otherwise sit about 1px low). **A trimmed box never clips vertically:** ascenders and descenders overflow a trimmed box by design, so a value that truncates uses `overflow-x: clip; overflow-y: visible` with `text-overflow: ellipsis`, never `overflow: hidden` (v3 did, and "Split image" lost the tops and tails of its letters). Where `overflow-x: clip` is unsupported the trim is dropped instead. Inline-start padding is unchanged. Controls that hug or centre their label horizontally (buttons, the sort select, toggles) keep doing so. Chips never wrap their own text; a chip that does not fit moves to the next line whole. A browser scenario measures the cap top and baseline of each control at each size and fails beyond 1px.

### 2.4 Spacing

The kit uses Tailwind's 0.25rem step and only these values: **0.25, 0.375, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3rem.** Semantic tokens:

| Token | Value | Where |
|---|---|---|
| `--spacing-field-x` | 0.75rem (bar), 0.875rem (modal, page) | field inner padding, left and right |
| `--spacing-label-gap` | 0.5rem (bar), 0.375rem (above) | inline bar label to its field; label above to field |
| `--spacing-helper-gap` | 0.5rem | field to helper or error line |
| `--spacing-row-gap` | 1.5rem | between fields in the bar row (a divider sits in the middle) |
| `--spacing-row-x` | 1rem | the bar row's inline padding |
| `--spacing-row-y` | 0.75rem | the bar row's block padding |
| `--spacing-stack` | 1.5rem | one field block to the next, in modals and pages |
| `--spacing-section` | 2rem, a 1px `line` rule, 2rem | one form section to the next: more space above a heading than below it |
| `--spacing-section-head` | 1rem | section heading (or its description) to its first field; a description sits 0.25rem under the heading |
| `--spacing-dialog` | 1.75rem (≥ `sm`), 1.25rem (< `sm`) | dialog padding (2.25rem / 2rem at the bottom of the body) |
| `--spacing-target` | 1.5rem | the minimum target on fine pointers (WCAG 2.5.8): toggles, row title links, checkboxes through their label |
| `--spacing-hit` | 2.75rem | the minimum tap area of every control on touch: segments, chip ×, checkbox (through its label), pager, inline text actions (padding may extend past the visual size) |
| `--spacing-popover` | 1rem | popover and toast padding |
| `--spacing-actions` | 0.75rem | gap between buttons |

### 2.5 Sizing and breakpoints

| Token | Fine pointer | `pointer: coarse` |
|---|---|---|
| `--spacing-control` (bar, list toolbar) | 2.25rem | 2.75rem |
| `--spacing-control-lg` (modal, page) | 2.75rem | 2.75rem |
| `--spacing-option` (menu option) | 2.25rem | 2.75rem |
| `--spacing-manager-tabs` | 2.5rem | 2.75rem |
| `--spacing-manager-row` (control + 2 × `row-y`) | 3.75rem | 4.25rem |
| `--spacing-manager` (tabs + row; the bar and its spacer) | 6.25rem | 7rem |
| `--spacing-status-line` (bar status line, v6; inside the control's box) | 2px | 2px |
| `--spacing-list-row` | 3.5rem (one line), 4rem (two lines) | 4rem |

Breakpoints (Tailwind's defaults, used with the `pointer` media query):

| Name | Width | Changes |
|---|---|---|
| < `sm` | < 640px (phone) | dialogs full screen; menus open as a bottom sheet (Q7); lists collapse to two lines; the bar's pinned status shows a glyph and a short word ("Draft", "1 not saved") and the action shortens to "Publish" |
| `sm` | ≥ 640px | dialogs centred |
| `md` | ≥ 768px (tablet portrait) | lists show meta columns; two-column form sections allowed |
| `lg` | ≥ 1024px (tablet landscape) | full bar summary text |
| `xl` | ≥ 1280px | the width a typical tab must fit without scrolling |

**Field widths** in the bar (`width` prop): `xs` 4.5rem, `sm` 9rem, `md` 13rem (default), `lg` 19rem, `auto` (content). In modals and pages fields are full width unless `width` is set.

### 2.6 Motion, focus, elevation

- **Motion:** `--duration-fast` 120 ms, `--duration-base` 200 ms, `--duration-slow` 300 ms, `--ease-out`; what animates is in §2.8. Reduced motion: no transitions or animations, the sweep becomes static, the spinner turns once every 2 s.
- **Focus:** a 2px `accent-fg` ring, offset 2px, square. It is the only line a field ever gets apart from presence. A focused field in error shows its tinted fill and the ring.
- **Presence:** a 2px inset ring in the peer's colour, plus the portalled flag (§4.3). When the field is also focused, the focus ring sits outside the presence ring.
- **Elevation:** `surface-raised` plus one shadow token, `shadow-popover` (`0 8px 24px rgb(0 0 0 / .28)`), for popovers, menus, toasts and dialogs. `z-index` tokens are unchanged. Popovers portal into `useNuxtApp().vueApp._container`.
- **Scroll padding** (WCAG 2.4.11): `scroll-padding-top` is the admin header's height, and while the bar is open `scroll-padding-bottom: var(--spacing-manager)` is set on the document, so focus never lands behind either.

### 2.7 Hover: only the innermost control

**Only the innermost interactive element under the pointer shows hover.** A field is hoverable, and some fields hold their own buttons, so the kit never shows two hovers at once.

- A nested control (a stepper's −/+, a chip's ×, a search field's clear ×, an inline ⓘ) shows its own `step-hover`, and `step-press` while pressed. These are translucent, so they read on any fill.
- While the pointer is on one, the field's own hover is suppressed: `.f:has(.nb:hover, .chip-x:hover, .in-btn:hover)` keeps the field at its resting fill.
- Error, conflict and presence keep their colour throughout: a tinted field stays tinted, and the nested control's shade sits on top of the tint.
- A chip that does nothing on its own gets no hover. Only its × does, with a 2.75rem tap area.
- Focus is unaffected: the focus ring follows focus, not the pointer.

### 2.8 Motion

CSS only, no animation library. Only opacity, transform, size and colour animate. Durations 120–300 ms (`--duration-fast` 120, `--duration-base` 200, `--duration-slow` 300) with `--ease-out` (`cubic-bezier(.2,.8,.2,1)`). Nothing delays input or blocks typing. Under `prefers-reduced-motion: reduce` every transition and animation is off, and the spinner turns once every 2 s. The spinner is the only motion that repeats.

| What | How |
|---|---|
| **Tab indicator** (bar and modal tabs) | One 2px `accent` bar, not a border per tab. It reads the selected tab's position and width as CSS variables (reka-ui's `TabsIndicator` exposes `--reka-tabs-indicator-position`/`-size`) and transitions `translate` and `width`, 250 ms. It jumps into place on first render and on resize; it slides only when the selected tab changes. |
| Menu, popover | fade and 0.25rem slide from the trigger's side, scale from 0.98, 120 ms |
| Bottom sheet | slide up 1.5rem and fade, 200 ms; scrim fades in, 200 ms |
| Dialog | overlay fades in 200 ms; dialog rises 0.5rem and scales from 0.98, 300 ms |
| Saved check, tab badges | scale from 0.6 and fade, 200 ms |
| Unsaved marker, error and conflict glyphs | fade, 120–200 ms |
| State-change glow (in-page outline only) | when the in-page selection outline changes to saved, error or conflict, a soft glow in the new colour rises and fades round the whole outline: two stacked `box-shadow`s, a tight one at a higher alpha and a wide soft one, 900 ms in all: a 250 ms rise (ease-out) to the peak and a 650 ms fall (ease-in-out) to nothing, no hold. Peak: `0 0 4px 1px` at 60% and `0 0 14px 2px` at 45% of the state colour. **Bar controls and every other field have no glow**: their line keeps only the grow-to-solid morph and the fade (above). Only on a change of state: never while saving, never again while the state stays. Reduced motion: no glow, only the colour |
| Bar status line | start: the band fades in, 150 ms; saving: a 40%-wide band sweeps across, 1.1 s, linear, repeating; **saving → saved, error or conflict morphs, never snaps**: the band grows from its current position to the full length (`background-size` 40% → 100%, position → 0) while the colour cross-fades to the target and a solid line fades in under it, 180 ms, ease-out; saved then holds 600 ms and fades its opacity only, 400 ms (size, position and colour unchanged); error and conflict stay solid. Done with the Web Animations API from the sweep's computed frame, every keyframe naming every animated property and `fill: 'forwards'`, so nothing interpolates back to the sweep. Reduced motion: no band; a still `line-saving` line, then a 150 ms colour change to the target, a 600 ms hold and no fade |
| Field tint (error, conflict), segmented control, toggle, buttons | colour transition, 120 ms (toggle thumb 200 ms) |
| Chip added | scale from 0.6 and fade, 120 ms (only the new chip) |
| Either/or switch | the newly shown field fades in, 120 ms |
| Toast | enters with a 0.5rem drop and fade, 200 ms; leaves with a 0.75rem slide and fade, 160 ms |
| Alert after a failed Save | fades in, 200 ms |

Left still on purpose: closing a menu, popover or dialog (instant, so focus returns at once), removing a chip (Undo is offered instead), a tab panel's content (switching tabs is instant; only the indicator moves), the stacking of other toasts when one leaves, the bar's row scrolling, and any error shake.

---

## 3. Surfaces decide the label

| Surface | Provided by | Label | Helper text | Error | Control |
|---|---|---|---|---|---|
| `bar` | `CwaUiManagerTab` | inline, left, `fg-muted` | in the ⓘ popover only | edge line, tint + popover on focus or a held hover (§4.4) | `control` |
| `modal` | `CwaUiDialog` | above, `text-label` | below | line below, from Save (§4.4) | `control-lg` |
| `page` | `CwaUiFormGroup` | above, `text-label` | below | line below, from Save (§4.4) | `control-lg` |

- v1's floating labels are dropped: they collided with the ⓘ, the "Optional" tag and the either/or group, and a label above reads better on a phone.
- There is no `labelPlacement` prop. `CwaUiTextarea` under `bar` throws in development and renders nothing in production.

**What `field="…"` binds to, per provider** (v6):

| Provider | `field="title"` binds to | Saves |
|---|---|---|
| `CwaUiManagerTab` | a live model of the selected resource (`useCwaResourceModel(iri, 'title')`, created once per field and tab) | as you type (§7) |
| `CwaUiDialog`, `CwaUiFormGroup` | the provider's local copy (`useItemPage`'s `localResourceData.title`) | on Save (§8.2) |
| none | nothing: a development error ("`field` needs a CwaUiManagerTab, CwaUiDialog or CwaUiFormGroup") and the control renders disabled | — |

- **Exactly one of `field`, `:model` or `v-model`** on a kit control. Two of them is a development error naming both; none is allowed only for a control that is not a resource field (`v-model` on a plain ref is still one). Inside a manager tab `:iri` is never needed: the tab provides it.
- **Off-screen tab renders resolve metadata only.** `useDataResolver` renders every manager tab into a detached element to read its `defineExpose` metadata. That render provides `cwaTabMetaOnly`; under it, `field` creates no model, starts no request and registers no presence, so a tab costs nothing until it is shown. It does record the tab's `field` names: `CwaUiManagerTab` collects them into the tab's metadata, so the tab badge (§7) knows which `(iri, field)` states belong to an unmounted tab.
- **The development warning for a tab root other than `CwaUiManagerTab`** is switched on only in the PR that migrates the module's own tabs (§12, 6e); before that, every existing tab would warn.

---

## 4. Fields

### 4.1 Binding contract

```ts
interface ResourceModelField<T = unknown> {
  iri: string
  field: string
  model: { value: T | null | undefined }
  remoteChange: { readonly value: RemoteFieldChange<T> | undefined }
  focusedBy?: { readonly value: FocusedPeer[] }
  focusListeners?: { onFocusin(): void; onFocusout(e: FocusEvent): void; onPointerdown(e: PointerEvent): void }
  state: { readonly value: CwaFieldState }
  retry(): Promise<void>
  reset(): Promise<void>
}
```

`CwaFieldState` is read from the resources store (§8.4) in the bar; in modals and pages the field reads its state from the modal's local copy (§8.2). A control takes exactly one of `field`, `:model` or `v-model` (§3). Multi-model controls (the either/or group, FileUpload, ImageAlt) show one edge line, on the visible control, from the most severe state among their models (conflict > error > saving > saved).

**Shape and migration** (v6). `useCwaResourceModel` (`composables/cwa-resource-model.ts`) today returns `model`, `states` (`pendingSubmit`, `submitting`, `isBusy`, `isLongWait`), `resetValue`, `localValueWithIri`, `remoteChange`, `focus`, `blur`, `focusedBy` and `focusListeners`. The kit's model adds `state`, `retry` and `reset`, and the old names stay as aliases for one minor release, logged in `DEPRECATIONS.md`:

| Today | v6 |
|---|---|
| `states.pendingSubmit` | `state.value.waiting` (a change is waiting to be sent, also during an episode) |
| `states.submitting` | `state.value.status === 'saving'` |
| `states.isBusy` | `state.value.waiting \|\| state.value.status === 'saving'` |
| `states.isLongWait` | `state.value.slow` |
| (none) | `state.value.status === 'error'`, `'conflict'`, `'saved'` |
| `resetValue()` | `reset()` |
| (none) | `retry()` |

- Kit components read only `props.model.state`, never `states`, so the aliases can go without touching the kit.
- **One request in flight per model is a change to the model's submit path**, not only new fields: today a debounce that fires while `isSubmitting` is true sends a second `updateResource` in parallel (only `mergeFromRoot` waits, for nested properties). The kit's model keeps one request in flight and one queued newest value; `status` is `'saving'` for the whole episode, from the first send until nothing is in flight or waiting. The follow-up targets the IRI the previous response returned (a save on a live component returns a draft). The `registerPendingUpdate` flush resolves only after the follow-up settles, so a publish waits for it (#394). `submit()` bypasses the coalescing: the 412 resend must go even when it carries the same value (CLAUDE.md, the Yjs trap). Tested on its own in phase 3 (§12).
- **A typed mapping** (final panel 2): `useCwaResourceModel(iri, field, { get, set })` returns a `ResourceModelField` whose `model` is the mapped value, with the same `state`, `retry` and `reset`. `get` maps the stored value to the control's, `set` maps back; `fieldStates` stays keyed by the stored field. Its first consumer is **Style**: `uiClassNames` stores class strings and the control shows style names (`deriveSelectedStyles` / `mergeSelectedStyles`, as `Ui.vue` does today). Apps get the same, for example a price stored in pence and shown in pounds.
- **Uploads write their own field state**: `useCwaResourceUpload` writes `fieldStates[(iri, fileProp)]` itself (`saving`, `saved`, `error`), Remove passes `iri`, and Retry re-sends the last downscaled `File`, held in the composable's closure. Upload writes are FormData, so they carry no `If-Match` (§8.4); that stays as it is today.
- **`state` is a `ComputedRef` nested in the returned object**, so it joins `focusedBy` and `remoteChange` on the #260 list: destructure it (`const { model, state } = useCwaResourceModel(…)`), never read `title.state` in a template.

Shared props: `label` (required; with `labelHidden` it is only the accessible name), `labelHidden`, `info`, `description`, `optional`, `placeholder`, `width`, `disabled`, `readonly`, `loading`.

### 4.2 Field shell (`core/ui/Field.vue`, internal)

- **Bar:** `Label ⓘ [ value ………… ▾ ]`. The label and ⓘ sit outside the fill. Nothing inside the control shows its save state.
- **Modal and page:**
  ```
  Label · Optional ⓘ  ● Unsaved
  [ value ……………………………………… ▾ ]
  Helper text, or the error line
  ```
- The state (`core/ui/FieldStatus.vue`) is its own component, reads only its field's state and owns the timers. In the bar it renders the line, the hidden description and the popover; in modals and pages it renders nothing inside the field.

**The bar's status line (v6, every bar control):**

```
Title [ Summer menu, served all day ]
      ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔   ← 2px, inside the control's box
```

1. **Where:** a 2px line along the bottom edge, **inside** the control's box (an absolutely positioned `::after`, `inset-inline: 0; bottom: 0`), so the outer size never changes. It covers the bottom 2px of the fill; no padding changes.
2. **Which controls:** every bar control. TextInput, Number (stepper), Select, MultiSelect, DatePicker, ResourceSearch and an input with a suffix take it across the field. Toggle takes it under the whole control (switch and its label), and SegmentedControl under its segments, each inside its own box.
3. **Nothing inside changes:** no glyph, no padding change. The value, a stepper's number, a select's chevron and the date picker's calendar keep their position and look in every state (measured, below).
4. **Modals and pages:** no line and nothing inside any field. "● Unsaved" stays after the label; errors and conflicts stay on the line below (§4.4, §8.2). The error and conflict tints remain.

| State | Fill | Bar status line (modal and page: none) |
|---|---|---|
| default | `field` | none |
| hover | `field-hover`; on an error or conflict field the tint darkens slightly and never reverts to grey; suppressed while the pointer is on a nested control (§2.7) | unchanged |
| focus | `field` | unchanged; the focus ring is outside the box (2px `accent-fg`, offset 2px) |
| disabled | `field` at 50% opacity | — (a reason goes in `info`) |
| read-only | transparent, value in `fg` | none |
| unsaved (modal, page) | `field` | none; the label row adds "Unsaved" in `fg-muted`, 500, after a 0.5rem `accent-fg` dot |
| pending (bar) | `field` | **none**: the pinned status counts it |
| saving (bar), long wait | `field` | `line-saving` band sweeping from the first send, `aria-busy`; reduced motion: a still `line-saving` line, plus the pinned "Saving…". The 300 ms applies only to the announcement ("Saving…" only when slow, §11.2) and the bar's gap hold (§7), never to the line |
| saved (bar) | `field` | the sweep grows into a solid `line-saved` (180 ms), holds 600 ms, fades 400 ms (§2.8); no glow (the glow is the in-page outline's only) |
| error | `field-danger` | solid `line-danger`; popover on focus, or after 300 ms of hover (modal: the line below, from Save or a client check) |
| conflict | `field-warning` | solid `line-warning`; popover on focus, or after 300 ms of hover (modal: found by Save, until a version is chosen) |
| saved with Undo (§5.6) | `field` | solid `line-saved`, kept until the next edit; Undo in the popover on focus or after 300 ms of hover |
| presence | `field` | 2px inset peer-colour ring (the status line is drawn over its bottom edge); flag on the field's top edge, portalled, fades after 3 s |

**Measured (v6, `ui-kit.html`, 1280px):** the outer box and the value's x offset are identical in every state for each kind: text input 144 × 36, value at 12px; stepper 144 × 36, value at 36px; select 144 × 36, value at 12px and chevron at 118px; toggle 24px high, switch at the same x; segmented 36px high, segments at 0. The line is 2px at `bottom: 0`. Contrast is in §2.1 (`line-*`): every line at least 3:1 against its resting and hover fills in both themes.

**Colour alone:** error and conflict lines differ by colour and tint only, never by a dash or pattern (decided, §11.1). The state is also given by the pinned status ("1 not saved", "1 conflict"), the tab's badge glyph (triangle, diamond), the popover's title and glyph, and the control's description, so it does not rely on colour (WCAG 1.4.1).

### 4.3 Presence

Accepted (Q8): flags are portalled into a layer at bar level that follows the row's scroll, so the bar's height is fixed. A flag is a square 0.6875rem label in the peer's colour, sitting on the field's top-left edge inside the row's top padding, so it never covers the tab strip or the selected tab's bar.

**When you focus a field another editor holds**, there is one state, not two stacked rings: your focus ring replaces the peer ring, and the flag stays up (no fade) reading "Mia is editing this too" until you leave the field.

**A focused field updated remotely** (round 6): when a field has focus and **no unsent change**, a remote save is applied to it at once (there is nothing to conflict with). A plain text field maps the caret and a selection through the **text diff** (final panel 9, 13): the common prefix and suffix of the old and new text give the changed range. A caret or selection end **before** that range keeps its offset; one **after** it moves by the change in length; one **inside** it moves to the end of the inserted text. So an edit after the caret leaves it where it is, and an edit before it never lands your caret in someone else's words. Nothing is applied **during IME composition**: the remote value waits until `compositionend`. Only text inputs and textareas (`type` text, search, url, email, tel, and `textarea`) map the caret; for other input types (number, date, the bar's selects) the value is replaced and focus stays put. The peer's flag shows "Mia changed this" for 3 s. The HTML editor already applies a minimal replace between the two documents, which keeps the caret where it was (the module's TipTap reference, #429). A field with an unsent change gets the conflict instead (§4.4).

### 4.4 Errors

**Modal and page: the message below the field, from Save.**

```
Title  ● Unsaved
[ ……………………………………………… ]     ← field-danger fill, no glyph inside
▲ Add a title. Every page needs one.
```

- Modal and page fields never save on their own, so their errors come from Save (a violation) or from a client check before sending (a bad URL, an empty required field). There is no Retry or Reset on the line: the editor fixes the value and presses Save again, and Cancel discards the local copy.
- The error line replaces the helper line while it shows. It is `text-helper`, `danger-fg`, prefixed by the same solid triangle.
- The input has `aria-invalid="true"` and `aria-describedby` pointing at the error line.
- Editing the field clears its error at once.
- Should a field need an inline action on its line, it is a text button: `accent-fg`, 600 weight, no underline until hover, with a 2.75rem tap area. Popovers, alerts and toasts use real buttons.

**Bar: an edge line, a tinted fill and a popover on focus or a held hover.**

```
Title [ Summer menu, served all day ]   … 1 not saved →  [Publish]
      ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔   ← line-danger, 2px, inside the box
                    ┌─────────────────────────────┐
                    │ ▲ Title: not saved         × │
                    │ The server couldn't save it. │
                    │ [Retry]  [Reset]             │
                    └─────────────────────────────┘
```

- There is **no glyph and no glyph button** in the control. The field's fill turns `field-danger` (conflict: `field-warning`) and a solid 2px `line-danger` (`line-warning`) runs inside its bottom edge. Both stay while hovered and while the popover is open.
- **The popover opens at once when the control is focused, and after 300 ms when it is hovered** (decided), so sliding the pointer along the bar opens nothing; leaving before 300 ms cancels it. It is anchored to the control and does not take focus, so typing carries on. A pointer can move into it (it closes 300 ms after the pointer leaves both, unless focus is in either). While a select's or a search's own menu is open, the popover does not open.
- **It sits straight after the control in the DOM** (reka `Popover` with its portal off; positioned `fixed`, so the bar's scroll does not clip it). The natural order is then: the control's parts (a stepper's −, input and +, a date picker's input and calendar button, a segmented control's segments), then the popover's actions, then the next control. No Tab is intercepted: **Tab from the control's last focusable part** enters the first action, **Shift+Tab from the first action** returns to that same last part, and **Tab from the last action** goes on to the next control and closes the popover. **Escape** closes it and returns focus to the part of the control that last had it. Touch screen readers reach the actions by swiping, in the same order. The close × is pointer-only (`tabindex="-1"`): Escape and moving focus away close it from the keyboard.
- The control has `aria-invalid="true"` (error only) and `aria-describedby` pointing at a hidden description that works on any device: "Not saved. The server couldn't save this. Retry and Reset follow." (conflict: "Changed by Mia while you were editing. Use Mia's and Keep mine follow."; Undo: "Saved. … Undo follows.").
- The popover is titled with the field's name and state, has a close ×, and a square caret points at the control.
- **Retry** sends the same value again. **Reset** puts the field back to its last saved value and clears the error; nothing is sent. The save failed, so nothing happened that could be undone, and the kit never calls this Undo.
- The pinned summary reads "1 not saved →" and the tab gets the triangle badge, so an error is visible from anywhere in the bar. "Show the field" focuses the control, which opens its popover.
- Errors are announced once through the surface's polite live region.

In the bar, conflicts use the same popover with the diamond and `field-warning`: "Mia changed this while you were editing.", then both values as read-only quoted text labelled "Mia's" and "Yours" (the same block as in modals, §8.2), then **Use Mia's** and **Keep mine** as two soft buttons. In modals and pages a conflict is found by Save and shown as a notice under the field (§8.2).

### 4.5 Info

- **Opt-in:** a field shows an ⓘ only when it has `info` (a string, or an `#info` slot for a link).
- **Glyph:** a solid circle with a knocked-out "i", 1rem, `fg-muted`, straight after the label text (after "· Optional"), 0.375rem away. Never pushed to the far end of the row.
- **A popover everywhere** (v5): in the bar, modals, pages and lists alike. A button named "About Title" with `aria-expanded` opens a popover anchored to the ⓘ, titled with the field's name, with a close × and a square caret, placed above or below by collision. It closes with Escape (focus returns to the ⓘ), a click or tap outside, or ⓘ again; it stays open while the pointer is over it, and never on hover alone (WCAG 1.4.13). **It never moves the layout** (measured: 0px). Any other help or "why it's disabled" text revealed by a toggle uses the same popover. Errors under a modal field stay inline.
- The text is also linked to the input with `aria-describedby` through a visually hidden copy.
- **In the bar**, a field's `description` (helper text) has nowhere to go, so it is shown in the ⓘ popover, and its presence makes the ⓘ appear.
- **Guidance for authors:** use `info` only when a field's effect is not obvious from its label ("Edit published version: changes go live immediately"). Never repeat the label. A dev warning fires when a tab has more than two ⓘ.
- **No tooltips on fields, ever.** `CwaUiTooltip` is not public. Internally it names icon-only buttons on fine pointers, after a 600 ms delay, and repeats only their accessible name.

---

## 5. Component catalogue

Files are under `src/runtime/templates/components/`. `CwaUi` names come from the path under `ui/`.

### 5.1 Primitives

| Component | Base | API and look |
|---|---|---|
| `CwaUiButton` | reka `Primitive` | `tone`, `variant: 'solid' \| 'soft' \| 'ghost'`, `icon`, `iconOnly`, `label`, `loading`, `disabled`, `disabledReason`, `to`, `type`, `options` (split button, below). Square, label 600. `solid` = tone fill; `soft` = the `button` fill (v6: its own fill, lighter than a field in light and darker in dark, so an action never reads as an input; `field-hover` on hover; replaces "outline": no borders); `ghost` = no fill until hover (`button`). Height follows the surface's control token; padding-x 1rem (0.75rem with an icon). **A ghost button never sits at a container's start or end edge** (v6): with no fill, its padding insets the text from the content edge while nothing shows the box, so it looks misaligned. At an edge use `soft` or `solid`, or, where a text button is the convention (a sheet's Done), keep `ghost` and pull it out by its padding (`margin-inline-end: -1rem`) so the text lines up with the content edge. Icon-only ghost buttons (the close ×, a tree row's bin) are square and their glyph is centred, so they are aligned by the container's own padding instead. No label ends in "…": a button names its action ("Redirect to another page"), and one that opens something more says so in its words, not with an ellipsis. |
| `CwaUiSpinner` | — | `size: 'sm' \| 'md'`, `aria-hidden` |
| `CwaUiProgress` | reka `Progress` | `value?`, `label`; a 0.25rem square-ended bar |
| `CwaUiBadge` | — | `tone`, `icon?`; square, `text-flag`, padding 0.125rem 0.5rem, tinted fill |
| `CwaUiReadonly` | — | `value`, `mono`, `copy`; middle ellipsis, full value in a popover with Copy |

**Split button** (`CwaUiButton` with `options`; consumer: the bar's primary action, today's `CurrentResourceCta` and `NewResourceCta`):
- Two square buttons 1px apart: the main action, and a trigger showing **solid vertical dots (⋮)**, as today's `CwaUiFormButton` does, with its own accessible name, **"More actions"**, `aria-haspopup="menu"` and `aria-expanded`. Each has its own hover and pressed fill; they are siblings, so only one shows hover (§2.7).
- **Without a main action only ⋮ shows**, flush right where the action would be, as today when `CurrentResourceCta` gives no label: a selected **live** component (nothing to publish: Add before/after, Clone, Move) and a selected **group** (Add to start, Add to end).
- The ⋮ opens a kit menu (`role="menu"`, §5.3) aligned to the split button's end edge: on click, Enter, Space or ArrowDown (a keyboard open highlights the first enabled item). Arrow keys, Home and End move through it, skipping disabled items; Enter or Space picks; Escape or Tab closes it, and Escape returns focus to ⋮. It opens with the menu motion (§2.8) and closes instantly. Below `sm` it opens as a bottom sheet.
- `options` is a list of items and groups; groups are separated by a 1px `line` divider (`role="separator"`). A disabled item is muted and shows its reason as a second line, never on hover. A destructive item uses `danger-fg` text.
- **Options for a selected existing component** (from `CurrentResourceCta`): a group of **Add before** and **Add after** (for a selected group: **Add to start** and **Add to end**), then **Clone**, then **Move** (only when the component can be moved, i.e. `moveFrom` resolves). When the target group is full (`componentGroupCapacity`), the add items are left out and one disabled row takes their place: "Add before or after", with "Main content is full: 6 of 6 components." under it. The main action is Publish now, Schedule or Cancel schedule.
- **A new, unsaved component** (from `NewResourceCta`): the main action is **"+ Draft"** (accessible name "Add draft") when the component is publishable, with **Add and publish**, a divider and **Discard** in the ⋮ menu; **"+ Add"** ("Add") when it is not, with only **Discard**. Discard (danger) confirms with the in-page confirm (§8.5).
- Copy is sentence case ("Add before", "Add and publish"), replacing today's title case.

**`CwaUiSubView`: one sub-view pattern for dialogs** (Daniel: the Routes tab's sub-views and the add component detail are the same thing). One component, used by both, so they share the look, the motion and the focus rules:
- **Header:** a stacked header under the dialog's header (or its tab strip): a ghost back link "‹ Routes" / "‹ Components" (`fg-muted`, 0.875rem, a solid ‹ glyph, its hit area 1.5rem tall and 2.75rem on coarse pointers, named "Back to Routes"), 0.5rem of space, then the sub-view's title as a heading at the section heading size (`subt`), both aligned to the body's inline padding, with a 1px `line` under the header. This is the Routes style, kept because the review panels found it clearer than the add dialog's first accent-coloured back link: muted, it never competes with the primary action, and the title reads as the heading of what follows.
- **Motion:** the Routes one: the sub-view slides in from 2rem to the right and fades (`d-base`, `ease`), and the main view comes back from the left; both are instant under reduced motion.
- **The main view is `hidden` and `inert`** while the sub-view is open, and keeps its state: scroll, search text and highlight are as they were when it comes back.
- **Focus:** on arrival focus goes to the sub-view's `initialFocus`, by default its title (`tabindex="-1"`); a consumer may name its primary action instead, as the add component detail does with Add (Daniel). Back (the link, Escape, and Alt+← where the dialog has no other use for it) returns focus to what opened the sub-view, or to the control the consumer names (the add dialog's search field). A dirty form asks before leaving (§8.5).
- **Semantics:** the sub-view is a region (or group) labelled by its title. No router history.
- Consumers: the Routes tab (§8.3) and the add component dialog (§5.6).

### 5.2 Inputs

| Component | Base | Bar | Notes |
|---|---|---|---|
| `CwaUiInput` | native | yes | `type`, `inputmode`, `nullable`, `prefix`/`suffix` slots |
| `CwaUiNumber` | reka `NumberField` | yes | `min`, `max` and the range rules below; commits on blur, Enter, step or unmount; in the bar its state is the edge line (§4.2), so the number never moves; the displayed number moves at once on every press, presses within 250 ms are one save, and moves made while a request is in flight become one follow-up with the newest position (#316, #374), so five quick presses send at most two requests and the line sweeps once; the −/+ buttons are the field's full height, with `step-hover` and `step-press` over the field's fill (error and conflict tints included), and the field's own hover is suppressed while the pointer is on one (§2.7) |
| `CwaUiTextarea` | native | **no** (modals and pages only) | `maxlength`, `counter`, `maxRows` (default 8). No resize handle (`resize: none`). It grows with its content (`field-sizing: content`, min 3 lines) up to `maxRows`, then scrolls inside; where `field-sizing` is unsupported a small script sets the height from `scrollHeight` on input and resize. The textarea fills the whole field box, so its text and scrollbar reach the field's edges, with `field-x` padding on both sides. It has no status glyph (modals and pages only). |
| `CwaUiToggle` | reka `Switch` | yes | the one rounded control: track 2.25 × 1.25rem, thumb 1rem; the label never changes with state |
| `CwaUiSegmented` | reka `ToggleGroup` | yes | 2–5 options, square, `field` fill, selected = `surface` fill + `fg` + 500 weight |
| `CwaUiSelect` | reka `Select` | yes | §5.3 |
| `CwaUiMultiSelect` | reka `Combobox` | yes | §5.3 |
| `CwaUiResourceSearch` | reka `Combobox` | yes | §5.3; 250 ms debounce, emits the IRI |
| `CwaUiEitherOr` | Segmented + children | yes | §6 |
| `CwaUiLinkInput` | `CwaUiEitherOr` preset | yes | §6.3 |
| `CwaUiDatePicker`, `CwaUiDayPicker`, `CwaUiDayRangePicker` | reka | yes | the calendar icon sits at the trailing edge, and a state replaces it (§4.2); calendar popover square; selected day = `accent` fill + `fg`, today = `accent-fg` underline |
| `CwaUiFileUpload`, `CwaUiImageAlt`, `CwaUiImageSlots` | native + Popover | yes | bar anatomy `[thumb] filename · 240 KB [Replace] [Remove]`, with the status line under the whole group (§4.2), so nothing moves); square thumbnail |
| `CwaUiInlineEdit` | — | no | the modal title |
| `CwaUiInlineHandoff` | — | yes | §7 |

**Stepper range** (`CwaUiNumber`, every kit stepper; v6):
- **Typing is never blocked**: no keystroke is swallowed except a character that can't be part of a number. Only digits are accepted, and `-` only when `min < 0`, at the start; a pasted value keeps its digits.
- **An out-of-range value is never saved.** While it is typed, the field shows its error state and the line (or, in the bar, the text after the stepper) says "Between 1 and 6"; the input has `aria-invalid="true"`.
- **Blur or Enter snaps** it to the nearest bound and saves that, with one polite announcement through the surface's region: "Set to 6, the highest position" (or "the lowest"). A value in range commits as usual.
- **− is disabled at `min` and + at `max`** (`aria-disabled`, still focusable), each with its reason linked by `aria-describedby` ("Already first in Main content").
- **Keys:** ArrowUp/ArrowDown ±1, PageUp/PageDown ±5, Home and End go to `min` and `max`; all stay in range.
- `role="spinbutton"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext` ("3 of 6").

### 5.3 Menus: select, multi-select, search

Every menu is a square `surface-menu` panel with `shadow-popover`, portalled, at least the trigger's width and at most 18rem tall, scrolling inside.

**Trigger:** a field with the value (or placeholder in `fg-muted`) and a solid chevron at the trailing edge. In the bar a state replaces the chevron while it lasts (§4.2). The open trigger shows the focus ring.

**Options:**
- Height `--spacing-option`, padding 0 0.75rem, `text-control`.
- **Highlighted** (pointer or keyboard): `menu-highlight` fill. A keyboard highlight also gets a 2px inset `accent-fg` bar on its leading edge, so it reads in both themes. The keyboard and pointer highlight are the same item.
- **Selected:** 500 weight and a solid check at the trailing edge (in `fg`, not `accent`).
- **Disabled:** 50% opacity; its reason is shown as a second line in `text-helper`, not on hover.
- **Groups:** a `text-helper` `fg-muted` heading, 0.5rem above, no rule.
- An optional `description` is a second `text-helper` line (the option is then 3rem tall).
- `nullable` adds "None" first, in `fg-muted`; `clearable` adds a × inside the trigger.

**Searchable** (ResourceSearch, MultiSelect, a Select with `searchable`): the trigger itself becomes the search input when open (combobox), filtering as you type, with the matched text in 600 weight. Page results show the title, with the path as the second line, and match on either.

**API-backed search** (`CwaUiResourceSearch`): the request waits 250 ms after the last keystroke; each request gets an id, and an answer that isn't the latest is ignored; a new request aborts the one in flight, and closing the menu aborts it too. Pages of 20. States, all inside the menu:

| State | Shows |
|---|---|
| Initial (first open) | five skeleton rows at the real option height with the shimmer (§9.2): with normal motion nothing else until "Still loading…" at about 5 s; with reduced motion a spinner and "Loading pages…" from the start; one polite "Loading pages" |
| Searching (results already shown) | the previous results dimmed to 55%, a small spinner and "Searching…" above them |
| Slow (over 3 s) | the same, reading "Still searching…" |
| Many results | the first 20, then "Showing 20 of 143. Keep typing to narrow it down." and **Show 20 more** (no infinite scroll) |
| No matches | "No pages match "abc"."; where the consumer allows it, **Create page "abc"** |
| Offline | "You're offline, so this search didn't run." with **Retry**; previous results stay |
| Server error | "The server couldn't search just now." with **Retry**; previous results stay |
| Chosen value not in the results | its label is fetched on its own (`GET` the IRI) with a skeleton in the field meanwhile, and it is listed first under "Chosen" |

Focus stays in the input throughout (`aria-activedescendant`). "Searching" is never announced per keystroke: once a search settles the live region says the count ("20 of 143 pages"), "No pages match abc", or the error (§11.2). Show more, Retry and Create are options, reachable with the arrow keys. The phone sheet has the same states and sits above the keyboard.

**Multi-select:**
- In modals and pages: chosen items are square chips inside the field (`field-hover` fill, `text-control`, a × button with a 2.75rem tap area; the chip itself has no hover, only its × does, §2.7), wrapping onto more lines; the field grows. The chevron is pinned to the first line's trailing edge (never wrapped onto a line of their own), and the search input keeps its "Add a style" placeholder after the chips, on the same line when it fits.
- In the bar: the first chip plus "+N" at a fixed `width`; opening lists every option with a check, chosen ones first.
- Backspace in an empty search highlights the last chip; a second Backspace removes it, with Undo (the removal happened, so it can be undone).

**Keyboard:** Arrow keys move the highlight, Home/End jump, typing jumps (Select) or filters (search), Enter selects, Escape closes and keeps focus on the trigger, Tab selects nothing and moves on.

**Phones** (< `sm`, coarse): the menu opens as a bottom sheet (full width, max 70vh, square top) with the search field pinned at the top (Q7).
- A tap opens the sheet without focusing the inline input, so typing always happens in the sheet; anything already typed is carried into the sheet's search with the caret at the end.
- A searchable sheet has a fixed height of 60vh, so results do not jump as they load.
- The sheet is positioned and sized from `window.visualViewport`, so it sits above the on-screen keyboard.
- A multi-select sheet shows the chosen options as a scrolling chip strip under the search, so each pick is visible.
- **Action menus** (a row's ⋮, the bar's ⋮) use the same system with `role="menu"`: an anchored menu on wide screens, a bottom sheet below `sm`.

**`CwaUiMenu`: one action menu for the whole admin** (round 6). The CTA's ⋮, a row's ⋮ and the clone and move placement menu (`ClonePlacementMenu`) are one component on reka-ui's `DropdownMenu`, with one look: the menu panel, options, groups and disabled rows above. It anchors at an element or at a point (`at: HTMLElement | { x, y }`, a virtual reference with collision avoidance); focus moves into it on open and returns to where it was on close (`returnTo`, default the trigger); a pointerdown outside closes it; below `sm` it is a bottom sheet with its title and Close.

**`CwaUiResourceStack`: the resource stack as nested boxes** (round 6; **keep the nested containment layout**, Daniel). One kit component, opened from **two anchors**: a right-click on the page (the resource context menu, `CwaResourceManagerContextMenu`, at the pointer) and the admin header's **path selector** (§7.2).
- **Shell** (final panel 1): a reka-ui **Popover** (`PopoverContent`), not `DropdownMenu`, which cannot hold a `role="tree"`; the tree is its only content besides the overflow button. The pointer anchor is a virtual reference at the pointer, the header anchor is the selector element. It shares `CwaUiMenu`'s behaviour: the popover surface, outside pointerdown closes it, focus goes in on open and back to `returnTo` on close, a sheet below `sm`.
- **What is in it:** only what registers as manageable: **components, their ComponentPositions and ComponentGroups** (`useCwaResourceManageable` in `ComponentPosition.vue` and `ComponentGroup.vue`, `useCwaResource` in components). **Pages and layouts are never levels**: they are reached through the page/layout overlay and page settings. A typical stack is Rich text → Component position → Main content group; a deep one alternates, for example Text → position → Left column group → Two columns → position → … → Main content group.
- **Layout:** boxes inside boxes. The outermost box is the furthest parent (a group); each box contains its child's box, and **each box's name sits below the child it contains**; the innermost box is the component under the pointer (or the selected resource, from the header). Containment is shown by space, not by indentation or a list. **The outermost box is the panel's edge**: the panel has no padding of its own (at most 1px between its edge and the outermost box) and carries `shadow-popover`; the nesting padding between levels is unchanged.
- **Each level: just its display name** (`displayName`, as today), in `text-label` (0.875rem / 500), left-aligned at the same inset in every box, cut with an ellipsis if it does not fit. **No type icon and no second line** (Daniel: icons pushed the names out of line, and "3 of 6 in Main content", "6 components" were too much and not useful). No counts anywhere. A 1px solid `line-strong` border (no dashed or dotted lines anywhere: those are the legacy UI), 0.375rem padding at every level and 0.375rem between a box's child and its name.
- **Hover** marks **one level only**, from its own name row: a solid `fg` border and the `field-hover` fill on that box, while the boxes inside it keep the popover surface. **The keyboard highlight** is the kit's 2px `accent-fg` focus ring on that box. **The selected level** has a 3px `accent-fg` edge on **its own name row only** (not down the whole box), and 600 weight (no check: names only), so it never depends on colour. The combobox (§5.6) uses the same language: hover fill, focus ring for the keyboard, and no accent edge on a highlight (final panel 23).
- **Opening** (final panel 15): the highlight starts on the **selected** level (the innermost when nothing is selected), shown with the selected look only, never the hover look, until the pointer or a key moves it.
- **Keyboard** (final panel 3, 36): focus is on the tree (`role="tree"`, `aria-activedescendant`). **Up and Down follow the names on screen**: names sit below their child, so **Up goes to the child and Down to the parent**. **Left goes to the parent and Right to the child**, as the ARIA tree pattern intends. Home = innermost (the top name), End = outermost, a letter jumps to the next level starting with it, Enter or Space selects, Escape closes and returns focus. **Tab closes and returns focus to `returnTo`**, as Escape does (final panel 33). **No key hint is shown** (Daniel), and none is hidden for screen readers: the tree semantics carry it.
- **Clicks** (final panel 34): a level is chosen only from **its own name row**, never from a child's box or the padding around it, so a tap at an outer box's centre cannot pick a nested child.
- **Semantics: a tree, not a flat menu.** Each box is a `treeitem` inside its parent's `group`, with `aria-level` counted from the outermost level of the **whole** stack (stable whether or not parents are hidden), `aria-expanded="true"` when it contains a child, `aria-selected` on the selected level, and an `aria-label` of its display name alone (otherwise its accessible name would include every child's text). Titled "Select a resource".
- **Long stacks** (final panel 35): at most **5 levels** from the innermost are shown (`limit`, adjustable). The rest are offered by a **"Show N more parents" button outside the tree's nesting**, under the outermost box; Down from the outermost level moves focus to it and Up returns to the tree. Expanding keeps the highlight where it was and the innermost box where it was, and a polite "3 more parents shown" is announced.
- **Opening position** (Daniel): **the innermost box's corner is placed exactly on the cursor.** Which corner depends on the room available. **Default:** the innermost box's top-left corner sits on the pointer, and the outer boxes extend up and left around it. **Near the right edge:** the top-right corner. **Near the bottom edge:** the bottom-left corner (bottom-right in the bottom-right area). The corner is chosen the way a context menu flips. **Only when there is no room for that corner** is the panel shifted (8px inside the viewport), keeping the innermost corner as close to the pointer as possible. Because the outer boxes wrap the innermost one, the panel extends from the cursor in the opposite direction from the chosen corner. Measured in the mockup (1280 × 900, distance from the chosen corner to the pointer): 0px at a centre click, 60px from the right edge (top-right) and 40px from the top-left corner, with 4 and 8 levels; at the very edges (6px away) the panel shifts by the outer boxes' padding, 23px with 4 levels and 30px with 8; near the bottom the bottom corners are used but the parents' names below the innermost box need room, so 60px from the bottom the corner is 71px (4 levels) or 146px (8 levels) from the pointer, and from about 250px above the bottom it is 0px again. The panel has no transition on its position, so it never slides in from a stale place. From the header (final panel 21): the innermost box is centred over the selector as far as the viewport allows (clamped 8px inside it), and the panel never covers the admin header's status: if it would, it moves left of it, or below the header when there is no room. Either way it **grows from the innermost box** (a 150 ms scale from 0.9 and fade, `ease-out`); under reduced motion it appears at once. Scrolling the page closes it.
- **Phones** (final panel 40): right-click becomes a **long press** (500 ms, cancelled by 8px of movement; left to the browser's text selection inside text being edited), and both anchors open a bottom sheet: `role="dialog"`, `aria-modal="true"`, labelled by its "Select a resource" header, with a **Close** button. Tab moves between the tree, the overflow button and Close (it does not close the sheet), the page behind is `inert`, and closing returns focus to `returnTo`.
- **Choosing a level** (final panel 4) calls `resourceStackManager.selectStackIndex(index, fromContext)`, which returns whether the selection changed (a confirm may cancel it). **The panel stays open until that resolves**, then closes and returns focus to `returnTo`: if the selection changed it outlines the level in its own colour (magenta for core resources), names it in the header and says "Main content group selected" in the live region; if it was cancelled nothing is announced. While it is pending, outside clicks and scrolling do not close it. The resource manager keeps the stack logic (`contextStack`, `resourceStack`) and hands the kit `levels: { key, label }[]`, innermost first.

**Kept from today's design, and changed** (for Daniel to judge):

| | Today | The kit | Why |
|---|---|---|---|
| Containment | nested boxes, name below the child | **kept** | Daniel finds it clear: where a resource sits is visible, not read |
| Levels | components, positions, groups | **kept**: no page or layout levels | only those register as manageable; pages and layouts have their own overlay and settings |
| Two anchors | right-click and the header's path selector share `ResourceContextItem` | **kept**, as one component | one behaviour to learn and test |
| Header open | innermost box over the selector, parents around it, scale from there | **kept**, clamped to the viewport and clear of the status | the selection stays where the eye is |
| Pointer open | the panel's corner at the pointer | **the innermost box's corner exactly on the pointer**, flipping corners like a context menu | the deepest item is always the one closest to the cursor (Daniel) |
| Theme | dark only (`bg-dark`, glass blur) | the popover surface in light and dark | the admin follows the site's theme everywhere else |
| Borders | dashed `gray-300` | solid `line-strong` (3:1 in both themes, no dashes); solid `fg` on the hovered level; the outermost box is the panel's edge | the kit's line tokens; a solid border plus fill reads as "this one" in both themes |
| Hover | `bg-dark` fill, white text | `field-hover` fill on that level only, inner boxes keep the surface | same idea; on a light surface a fill behind the children made every inner level look hovered |
| Spacing | `px-1.5 py-1`, tight | 0.375rem at every level | on the spacing scale, so deep stacks stay compact but legible |
| Text | the name only, `gray-300` | **name only, as today; icons and second lines removed (Daniel)**, in `text-label` | the names line up and nothing competes with them |
| Selection | not marked | accent edge on its name row and weight | you can see what is selected before you choose |
| Keyboard | none | tree keys following the screen, focus return; no on-screen hint | today's menu is mouse-only |
| Long stacks | every level | 5 levels and a "Show N more parents" button | a deep layout made a very wide, tall box |
| Phone | none | long press and a modal sheet with Close | there is no right-click on touch |

Mockup: §5, "Editing on the page": right-click the component (or Shift+F10), click the header's name, and "Deep nesting (9 levels)" (Rich text → position → Left column group → Two columns → position → Tab panel group → Tabs → position → Main content group).

### 5.4 Tree (`CwaUiTree`)

Consumers: the Routes tab's Redirected from and Child routes sub-views (§8.3) and the routes list page.

- **Rows** are 2.75rem (coarse 3rem), indented 1.5rem per level, with 1px `tree-line` connectors: a vertical line for each open ancestor and an elbow into each row. A row with children has a chevron (0.75rem, rotates when open, 2.5rem hit area); a leaf has a spacer the same width. Row content is a label (mono for paths) and an optional badge.
- **Row actions** sit at the end: square ghost icon buttons, 2.5rem (2.75rem coarse), each named for its row ("Delete the redirect from /shaker"). They are `fg-muted` at rest, a destructive one included, and take `fg` (or `danger-fg`) with the `step-hover` fill on hover or focus, so a column of red bins never shouts. More than two go into a ⋮ menu.
- **A row's label can be custom** (`#label` slot): the Routes tab shows the direction, `/shaker → this page` and, nested, `/shaker-style → /shaker`, with the arrow hidden and read as "redirects to".
- **ARIA treegrid** (a plain `tree` cannot hold buttons): `role="treegrid"`, rows with `aria-level`, `aria-setsize`, `aria-posinset` and `aria-expanded`, a roving tab stop. Up/Down move between rows, Home/End jump, Right opens a closed row or moves into its first action, Left closes an open row or moves to its parent, Enter runs the first action, Delete runs a delete action when the row has one. From an action, Left or Escape returns to the row.
- Empty: a sentence in `fg-muted` ("No old addresses send visitors here.").

### 5.5 Typed catalogue

Every public component, with its props, emits and slots. `Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'`. A field control also takes the shared field props (§4.1) and exactly one of `field`, `model` or `modelValue` (§3); those are not repeated below.

```ts
type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
interface FieldProps { label: string; labelHidden?: boolean; info?: string; description?: string; optional?: boolean
  placeholder?: string; width?: 'xs' | 'sm' | 'md' | 'lg' | 'full'; disabled?: boolean; readonly?: boolean; loading?: boolean
  field?: string; model?: ResourceModelField; modelValue?: unknown }
// emits for every field control: 'update:modelValue'(value); slots: info

interface MenuItem { label: string; value?: string; description?: string; icon?: string; image?: string; note?: string; tone?: 'danger'
  disabled?: boolean; disabledReason?: string; to?: string; onSelect?: () => void }
type MenuEntry = MenuItem | { group: string | null; items: MenuItem[] }   // groups are divided by a separator

CwaUiButton      { tone?: Tone; variant?: 'solid' | 'soft' | 'ghost'; icon?: string; iconOnly?: boolean; label?: string
                   loading?: boolean; disabled?: boolean; disabledReason?: string; to?: string; type?: 'button' | 'submit'
                   options?: MenuEntry[]; optionsLabel?: string /* default "More actions" */ }
                 emits: click(e); slots: default
CwaUiSpinner     { size?: 'sm' | 'md' }
CwaUiProgress    { value?: number; label: string }
CwaUiBadge       { tone?: Tone; icon?: string }                                  slots: default
CwaUiReadonly    { value: string; mono?: boolean; copy?: boolean }

CwaUiInput       FieldProps & { type?: 'text' | 'email' | 'url' | 'search' | 'password' | 'tel'; inputmode?: string; nullable?: boolean }
                 slots: prefix, suffix
CwaUiNumber      FieldProps & { min?: number; max?: number; step?: number; noun?: string /* "position" */
                   minReason?: string; maxReason?: string; rangeText?: (v: number) => string }
CwaUiTextarea    FieldProps & { maxlength?: number; counter?: boolean; maxRows?: number /* 8 */ }
CwaUiToggle      FieldProps
CwaUiSegmented   FieldProps & { options: { value: string; label: string; icon?: string }[] }
CwaUiCombobox    FieldProps & { options: MenuEntry[]; inline?: boolean /* inline-open list; default collapsed */
                   filter?: (item: MenuItem, q: string) => boolean; empty?: (q: string) => string }
                 emits: 'update:modelValue'(value), select(item) /* Enter on the chosen item, double-click */; slots: option({ item, highlighted }), footer
CwaUiMenu        { items: MenuEntry[]; label: string; at?: HTMLElement | { x: number; y: number }; open?: boolean
                   returnTo?: HTMLElement; longPress?: boolean }   // trigger in the default slot, or opened at `at`
                 emits: select(item), 'update:open'(open); slots: default (trigger), item({ item })
CwaUiResourceStack { levels: { key: string; label: string; description?: string; icon?: string }[] /* innermost first */
                   selected?: string; at: HTMLElement | { x: number; y: number }; limit?: number /* 5 */; label?: string; open?: boolean }
                 emits: select(level), 'update:open'(open)
CwaUiSelect      FieldProps & { options: MenuEntry[]; nullable?: boolean; clearable?: boolean; searchable?: boolean }
CwaUiMultiSelect FieldProps & { options: MenuEntry[]; max?: number }
CwaUiResourceSearch FieldProps & { endpoint: string; searchParam?: string /* 'search' */; perPage?: number /* 20 */
                   labelOf?: (r: CwaResource) => string; descriptionOf?: (r: CwaResource) => string
                   create?: { label: (q: string) => string; onCreate: (q: string) => void } }
                 emits: 'update:modelValue'(iri: string | null); slots: option({ resource }), empty({ query })
CwaUiEitherOr    { iri?: string; label: string; info?: string }                    slots: default (CwaUiEitherOrOption)
CwaUiEitherOrOption { label: string; fields: string[] }                          slots: default
CwaUiLinkInput   FieldProps & { route?: string /* 'route' */; rawPath?: string /* 'rawPath' */ }
CwaUiDatePicker  FieldProps & { min?: string; max?: string; step?: number /* minutes */ }    value: UTC ISO string | null
CwaUiDayPicker   FieldProps & { min?: string; max?: string }
CwaUiDayRangePicker FieldProps & { min?: string; max?: string }                   value: [string, string] | null
CwaUiFileUpload  FieldProps & { accept?: string; imageDownscale?: false | ImageDownscaleOptions }
CwaUiImageAlt    FieldProps & { imageField: string; altField: string }
CwaUiImageSlots  FieldProps & { slots: { field: string; label: string }[] }
CwaUiInlineEdit  { model: ResourceModelField<string>; placeholder?: string }
CwaUiInlineHandoff { label: string; model: ResourceModelField<string>; editor?: string /* registered editor id */ }

CwaUiTree        { label: string; nodes: TreeNode[]; actions?: (n: TreeNode) => TreeAction[] }
                 emits: toggle(node, open: boolean), action(node, index: number), delete(node)
                 slots: label({ node, parent, level }), badge({ node })
interface TreeNode { id: string; label: string; mono?: boolean; open?: boolean; children?: TreeNode[] }
interface TreeAction { icon: string; label: string; tone?: 'danger'; menu?: MenuEntry[] }

CwaUiManagerTab  { iri?: string }                                                 slots: default
CwaUiManagerRowDivider {}
CwaUiDialog      { title: string; size?: 'sm' | 'md' | 'lg'; tabs?: { key: string; label: string; disabled?: string }[]
                   resource?: string; saveLabel?: string; createNoun?: string }
                 emits: close(), saved(resource: CwaResource), 'update:tab'(key)
                 slots: default, [tab key], 'header-actions', footer-start
CwaUiFormSection { title?: string; description?: string; columns?: 1 | 2 }       slots: default, action
CwaUiFormGroup   { resource?: string; saveLabel?: string }                        emits: saved(resource); slots: default
CwaUiConfirm     via useCwaConfirm(): ({ title, description, keep = 'Keep editing', go, tone = 'danger', typed?: boolean, extra? }) => Promise<boolean>
CwaUiAlert       { tone: Tone; title: string }                                     slots: default, actions
CwaUiSearchField { modelValue: string; label: string }                           emits: 'update:modelValue'
CwaUiFilterToggle{ modelValue: boolean; label: string; colour: string }          emits: 'update:modelValue'
CwaUiPagination  { page: number; pages: number }                                 emits: 'update:page'
CwaUiListState   { state: 'loading' | 'empty' | 'error'; noun: string; error?: string }  emits: retry(); slots: empty-action
useCwaToast()    { show(t: { id?: string; tone: Tone; title: string; description?: string
                   actions?: { label: string; onClick: () => void }[]; persist?: boolean }): void; dismiss(id: string): void }
```


---

### 5.6 `CwaUiCombobox` and the add component dialog (round 6, approved)

**One kit component, two modes**, on reka-ui's `Combobox` (the ARIA combobox and listbox pattern: focus stays in the input, `aria-activedescendant` names the highlighted option):
- **Inline-open:** the search field with the list always visible under it. The add component dialog uses this.
- **Collapsed:** a searchable select for long option lists elsewhere (a layout, a page template): the searchable `CwaUiSelect` of §5.3 is this mode, so there is one implementation.

**The add component dialog** (replaces `AddComponentDialog.vue`'s button column and empty description pane). Two views in one dialog: the **list**, and a **detail sub-view** for the component chosen, the same pattern as the Routes sub-views (§8.3).
- **Opening:** "Add a component", with "To **Main content**, after Intro text" under the title; the search field has focus. One column, no description pane.
- **Rows:** a leading visual (below), the name, and a muted one-line description only when one is configured (cut to one line on wide screens, up to two lines on phones). **The leading visual is one fixed size in every state** (3 × 2rem): the configured image, else the skeleton or icon its `icon` names, else the generic `component` icon, so every name starts in the same column. **Nothing grows** on the highlighted row (Daniel). On the right, a muted "3 here" while searching, when the component is in the group. The number of UIs is not shown in the list (Daniel); UIs are chosen in the detail view.
- **Already in this group** (Daniel): a quick list above the full list, visually distinct from it: a wrapping row of compact **chips**, each the component's icon and name on the `button` fill (2.25rem tall, 2.75rem on coarse pointers), under a muted "Already in this group" heading and a 1px `line` below. A chip opens the same detail sub-view. Chips, not tiles: they read as shortcuts at a glance and take one or two lines, where tiles with thumbnails would compete with the list below and push it down. It is a `role="group"` labelled by its heading; each chip's description is its count ("3 here"). **Keyboard:** the chips are one tab stop after the search field (a roving `tabindex`); Left and Right move along them, Home and End jump; **Down or Tab moves into the list** (focus back to the search field with the first option highlighted), and Up from the first option returns to the chips. It is left out when the group is empty, and **hidden while a search is typed**, when the results take over as one list.
- **Sections** (final panel 26, 37): under the chips, every component not already in the group under its configured `group` ("Forms", "Layout", "Media", "Text", A to Z, then "Other" for components with none), or one A to Z list when no component has a `group`; then **Dynamic** in its own section, with the yellow square of the Dynamic filter and "Changes per article: each article picks what shows here" (the page data's own name in place of "article"). While searching, every match is listed once, in-group ones included, with "3 here" on the right. Each section is a reka `ComboboxGroup` with a `ComboboxLabel` (`role="group"` labelled by its heading). An option is named by its name alone (`aria-labelledby`), and its description, count and **section** are its description (`aria-describedby`, joined with commas), so a screen reader hears "Image, One image with alt text and a caption, 3 here, Media".
- **No duplicates** (final panel 5): the full list never repeats a chip, so a component appears once. An option's **value is the component name**; its `key` (defaulting to the value) gives its id and the highlight. Opening and adding are by name.
- **Dynamic is listed only on a page-data page outside layout editing** (`!isEditingLayout && resources.isDynamicPage`), as today (final panel 7).
- **Choosing** (Daniel): **a click on a row, or Enter on the highlighted row, opens the detail sub-view**. Nothing else adds: there is no double-click to add, no "chosen" row state and no ⓘ popover. The keyboard path is type, Enter (opens the detail), Enter (adds).
- **The detail sub-view** is a `CwaUiSubView` (§5.1), the same pattern, motion and header as the Routes sub-views: a stacked header, "**‹ Components**" then the component's name as its heading (`h3`, the sub-view is a group labelled by it); then, each only when configured: the **larger image** (16:9, up to 18rem wide), the **description**; then always "**Adding to Main content, after Intro text**"; then the choices below. **Add** (primary) has focus on arrival, except for Dynamic, where Data type does. A component with neither image nor description is just the name, the target line and Add: the sub-view stays short and is never padded. On arrival the dialog's polite region says "Hero section. Adding to Main content, after Intro text."
  - **UI**: a `CwaUiSelect` labelled "UI", only when the component has more than one UI, with the same options as the bar's UI tab, defaulting to the default (first) UI.
  - **Style**: only when the component has styles, the bar UI tab's control and keyed styles (multiple or single as configured), defaulting to none or to the configured defaults.
  - **Dynamic**: **Data type** and **Field**, both shown. Until a data type is chosen, Field has **the kit's disabled look** (50% opacity, a not-allowed cursor), is `aria-disabled="true"` (never natively disabled, so it stays focusable) and has "Choose a data type first." as its helper line and description; it does not open. Choosing a type enables it, loads that type's fields as its options, and its helper becomes "The page data property that holds the component."
  - These use modal sizing and labels and show **no save state**: nothing is saved until Add. **Add creates the component with `uiComponent` and `uiClassNames` set in its create request** (or in the draft's first POST for a publishable component, `+ Draft`); no extra PATCH.
  - **Hook, not built now:** when per-group restrictions on UIs and styles arrive (a future issue), the UI and Style options are filtered and preselected from the group.
- **Back** to the list is "‹ Components", **Escape** or **Alt+←**; the list comes back with its search text, scroll position and highlight as they were, and focus returns to the chip that opened the detail, or to the search.
- **Footer: just Cancel and Add** (Daniel), with no status text: screen readers learn the target from the sub-view's heading and its "Adding to…" line. **Add is never natively disabled** (final panel 39): in the list, and in Dynamic's sub-view until both selects are set, it is `aria-disabled="true"` with its reason as its description ("Choose a component first.", "Choose a data type and a field first."), activation is blocked in the handler, and activating it announces the reason. `instantAdd` components keep today's **Add now** label.
- **Search** (final panel 11): filters as you type, keeping the sections. **Rank by name first** (starts with the query, then a word starts with it, then contains it), then a match on the group, then on the description; within a section rows follow that rank, then A to Z, and sections with a better match come first, so typing "text" highlights **Rich text**, not Image. The match is in 650 weight; the first row is highlighted. Escape in a non-empty search clears it (a second Escape closes the dialog). The live region says the count ("1 component") after typing settles, never per keystroke.
- **No matches** (Daniel): one compact line at the list's normal padding, never a tall empty block: "No component called **galery**", the term trimmed and its inner spaces collapsed, in `fg` at 500 weight with **no quotes**, then a **Clear search** button on the same line when it fits. **When the search matches only components this group doesn't allow** (final panel 14): "**Map** isn't allowed in **Main content**" instead, the group name in the same `fg` 500.
- **Disallowed components stay out of the list** (`isComponentAllowedInGroup`, `explicitAllowOnly`), and a full group never opens the dialog (the group's `maxComponents`), as today.
- **Descriptions are plain text** (final panel 7): today's dialog renders `description` with `v-html`, and the playground config holds `'<p>…</p>'`. The kit renders text: HTML tags are stripped, with a one-time development warning naming the component when a description contains markup. This is a breaking change for apps, so it gets a CHANGELOG line, a `DEPRECATIONS.md` entry (the stripping and warning go once apps have migrated), and the playground config is updated.
- **Phone:** full screen, with the context line and the search field sticky at the top of the scrolling list and the footer pinned; the detail scrolls under its header.

**New optional config keys** on a component's `resources` entry (`CwaResourceMeta`), each with a test and a docs line (final panel 8):
- `icon`: **a kind or `lucide:<name>`**. The icon set is **Lucide** (ISC; Nuxt UI's default, which most of Daniel's sites use; 24px, 2px round stroke, `currentColor`), from `@iconify-json/lucide`. Resolved at build time: only the SVGs in use are written into the admin-only template below. **An unknown name warns** and falls back to `component`. Consumer: this dialog's rows and quick-list chips.
- **No inference and no per-kind defaults** (Daniel): an icon comes **only** from an explicit `icon`. A component with neither `icon` nor `image` shows **one generic icon**, Lucide `component`; a skeleton or a specific icon appears only when `icon` names that kind. Nothing is guessed from the component's name.
- **Kinds** (each verified in `@iconify-json/lucide` 1.2.156): heading → `heading`, rich-text → `letter-text`, image → `image`, gallery → `images`, carousel → `gallery-horizontal-end`, video → `square-play`, hero → `panel-top`, banner → `megaphone`, card → `layout-panel-top`, card-grid → `layout-grid`, section → `layout-template`, media-text → `columns-2`, columns → `columns-3`, container → `square-dashed`, link → `link`, button → `mouse-pointer-click`, link-group → `list`, tabs → `panels-top-left`, accordion → `list-collapse`, quote → `quote`, testimonial → `message-square-quote`, form → `form`, newsletter → `mail`, sign-up → `user-plus`, collection → `layout-list`, articles → `newspaper`, table → `table`, steps → `list-ordered`, file → `file-down`, chart → `chart-column`, heatmap → `grid-3x3`, map → `map-pin`, contact → `contact`, social → `share-2`, person → `user`, people → `users`, notice → `sticky-note`; fallback → `component`.
- **Skeleton thumbnails for layout kinds**: hero, card, card-grid, media-text, section, columns, carousel and collection draw a 48 × 32 inline SVG wireframe instead of the icon: a `surface-raised`-like frame (stone-800 fill and a stone-700 1px stroke in dark, the light equivalents in light, 2px radius), content bars in stone-600, image blocks in stone-500 and one blue-500 accent (the CTA or the active dot). Hero: a full-width image block, a title bar and a blue pill; card: an image on top, two bars below; card-grid: 3 × 2 mini cards; media-text: an image on the left, bars and a pill on the right; section: centred bars and a pill; columns: three bar stacks; carousel: a wide image with dots, one blue; collection: rows of a thumbnail and a bar.
- **Precedence:** a configured `image` wins, then the skeleton or icon that `icon` names, then the generic `component` icon. **The leading slot is one fixed size** (3rem × 2rem, so a 48 × 32 skeleton fits and a 1rem icon is centred), and every name starts in the same column.
- **Typing** (Daniel, agreed in principle): the keys are set wherever a component's config is defined, in `nuxt.config` `cwa.resources.<Name>` or in the component through `defineCwaConfig` ([#454](https://github.com/components-web-app/cwa-nuxt-module/issues/454)). `icon?: CwaComponentKind | \`lucide:${LucideIconName}\``: `CwaComponentKind` is the kit's union of kind names (hero, card-grid, form, …), so autocomplete lists them; `LucideIconName` is a type-only union generated from `@iconify-json/lucide` at build time, so every Lucide name autocompletes with no runtime cost; an invalid name is a type error and a build warning. `image?: string` is a custom picture (a screenshot or illustration), resolved like other app assets, or the `<Name>/preview.webp` convention when present; it wins over `icon`. Neither set: the one generic icon. **The custom option is `image`; there is no custom SVG icon key** (least exposure; it can be added later if a real need appears).
- `group`: a section name ("Text", "Media").
- `image`: a preview image. **By convention** `app/cwa/components/<Name>/preview.webp` is used when `image` is not set: the module finds it at build time (as it finds `admin/` and `ui/`).
- **These keys never reach the visitor entry.** `cwa-options.ts` is imported by `plugin.ts`, which every visitor loads, so the admin-only keys, the resolved icon SVGs and the skeletons go into their own template, `cwa-admin-resources.ts` (`write: true`, regenerated by `builder:watch` like the others), imported only by the lazy add dialog. Its marker is added to `entry-bundle-markers.mjs`, so phase 6a+ keeps its 0 B entry budget. **Serving:** the template `import`s each `preview.webp` as an asset (`import heroSection from '<abs>/preview.webp'`), so Vite hashes and emits it; the simpler choice, with nothing copied into `public/`.

**Rejected: live previews** of each component in the list. A preview needs data the component does not have yet, one render per UI, and the site's own styles inside the admin; a static `preview.webp` gives the editor the picture without any of that.

## 6. The either/or field group

### 6.1 Pattern

Some resources store **exactly one of several fields**: a link is a `route` *or* a `rawPath`; a media block might be an `image` *or* a `video`. `CwaUiEitherOr` is the kit pattern for all of them (Q7, decided).

**One API** (v6): the group takes the resource from its provider (no `:iri` inside a manager tab or dialog) and builds one group model, `useCwaResourceFieldGroup(iri, ['route', 'rawPath'])`, which owns every field of every option. Options never hold their own models: a control inside an option takes `field="…"`, which the group resolves from its group model. A commit is **one PATCH** with the chosen field and the `null`s.

```vue
<CwaUiEitherOr label="Link">
  <CwaUiEitherOrOption label="Page" :fields="['route']">
    <CwaUiResourceSearch field="route" label="Page" label-hidden endpoint="/_/routes" />
  </CwaUiEitherOrOption>
  <CwaUiEitherOrOption label="URL" :fields="['rawPath']">
    <CwaUiInput field="rawPath" label="URL" label-hidden type="url" />
  </CwaUiEitherOrOption>
</CwaUiEitherOr>
```

### 6.2 Behaviour

- **The segmented control picks which option is shown. Switching writes nothing**, so flipping to URL and back loses nothing.
- **Committing a value in one option clears the other options' fields in the same save:** one `updateResource` carrying the chosen field plus `null` for every non-null field of the other options (still merge-patch with changed fields only). There is never a moment with both set, and the API's either/or validator never sees a half state.
- **When a value is committed in the bar** (Daniel): a text option (URL) saves on the **normal 250 ms debounce after typing stops**, like every other bar text input; no blur is needed. It sends **only while the value validates**; while it does not, it keeps waiting, with no line and no error, and the validation message shows on blur (or Enter). A page pick saves at once. **The first save after switching options** carries the chosen field and the `null`s for the other option in that same PATCH, with Undo as the safety net. Measured in the mockup: typing `/about` and pausing sends one PATCH `{ rawPath: "/about", route: null }` 250 ms later with focus still in the field; "about us" sends nothing and shows its error only on blur.
- **In the bar, Undo** restores the cleared fields, again in one save. It stays available until the next edit in the group (not on a timer): the visible field keeps a solid `line-saved` line, and Undo is in the popover that opens when it is focused or hovered.
- **In modals and pages** the group edits the local copy like any field: choosing a value clears the other options' fields in the local copy, the helper line says what Save will clear ("Save sends this and clears the URL (…) in the same request."), and Save sends the chosen field and the `null`s in one request. There is no Undo there: nothing was saved, and Cancel discards the copy.
- **Initial option:** the first option with a non-null field. When more than one holds a value (old data), it shows the first, and a `warning` badge on the segmented control says "Both are set. Saving one clears the other."
- **One status line** for the group (bar only), on the visible field: saving, saved and error cover the whole save. A conflict on a hidden option puts the warning line under that segment and never switches the segment; focusing or hovering the segment opens the conflict popover.
- **Presence** is per field: a peer in the hidden option shows their flag on that segment.
- Bar: `Link ⓘ [Page | URL] [ /about-us ▾ ]`. Modal: the label, then the segmented control, then the field 0.375rem below.
- The segmented control has no inner padding: each segment is the control's full height (2.75rem on touch), and the pressed segment draws its inset with a `field`-coloured inner shadow.

### 6.3 `CwaUiLinkInput`

A preset of the group with the Page and URL options and `route`/`rawPath` defaults (`route?`, `rawPath?` props rename them). Its group model sets the debounces so authors cannot forget `debounceTime: 0`: a page pick saves at once; a URL saves 250 ms after typing stops, with no blur needed, and only while it validates (`/path` or `http(s)://host`); an invalid value waits silently and shows its message on blur (§6.2). URLs are validated before sending, and an off-site URL shows ↗. Title search on routes depends on the bundle (`/_/routes` filtering by page title), recorded in the bundle's CLAUDE.md.

---

## 7. The manager bar

- **One row, never stacked.** Height is `h-manager`, as is its spacer. The row scrolls horizontally with 2.5rem edge fades (a `mask-image` from `data-overflow-start/end`, set by a `ResizeObserver` and a passive scroll listener with injectable measurements). "Scroll fields left/right" arrows appear only at a hovered edge on a fine pointer, and never while a field in the row has focus, so they never cover what you type. Coarse pointers have no arrows: the fade and a visible peek of the next field carry the hint. Native Shift+wheel, trackpad and touch pans (including one starting on an input) scroll it. **Focus scrolls the whole field into view, label included**, clear of the fades (2.5rem). Every sample row of bar controls, wherever it appears, uses the same fades.
- **Row:** inline padding `row-x`, block `row-y`, gap `row-gap`. `CwaUiManagerRowDivider` is a 1px `line` rule, 1.5rem tall, centred in the gap. Labels and fields are vertically centred on one baseline.
- **One saving episode per field** (v6), for every bar control, driven by "this field has a change waiting or a request in flight", never per request:
  - **Debounce:** a save is sent 250 ms after the last change (`useCwaResourceModel`'s debounce), never per keystroke or per press. A select or page pick sends at once (`debounceTime: 0`).
  - **Coalesce:** one request in flight per field; changes made meanwhile become a single follow-up carrying the newest value, and the latest value wins (the reorder rule of #316 and #374 applies to the Order tab's position).
  - **The line:** nothing shows while a change is only waiting (pending is invisible). The sweep starts when the first request is sent (never after a delay: the 300 ms is only for the announcement and the bar's gap hold) and keeps running, as the same animation, until nothing is in flight and nothing is waiting; a keystroke or a press during the episode never restarts it. Then "saved" shows once and fades.
  - **Announcements:** "Saving…" at most once per episode (only when slow, §11.2), and one outcome at its end ("Position saved").
  - Measured in the mockup: a sentence typed at about 7 characters a second sends 1 request; the same sentence typed word by word with pauses sends one request per pause that outlasts the request, never one per key; five quick presses on the position stepper send 1 request; each case keeps one `Animation` object for the whole sweep with no restart.
- **Field state in the row** (v6) is the 2px status line inside each control's bottom edge (§4.2), on every bar control: never a glyph, never a glyph button, never a change of padding or end icon. Error and conflict popovers open on focus, or after 300 ms of hover (§4.4). The pinned status is the only place in the bar with a state glyph, and it always has words with it (below).
- **Tab strip** (`core/admin/ManagerTabs.vue`, reka `Tabs`): tab names in `text-label`, padding 0 1rem, selected = `fg` text with a 2px `accent` bar along the bottom edge (a selection indicator, not a field border). The bar is one sliding indicator (reka `TabsIndicator`, §2.8), shared by the bar and modal tabs. Scrolls with the same fades, and selecting a tab scrolls it fully into view. A tab with an error or held conflict shows the solid triangle or diamond, read from the store, so it survives the tab unmounting.
- **One severity order, from one helper** (`badgeFor(states)`, shared by the bar's tab badges, the pinned status, the modal tabs and the admin header): **conflict > error** (then **unsaved** in a modal, §8.3). The tab's accessible name and hover title give every count, so a conflict never hides an error: "Content: 1 conflict to resolve, 1 not saved". Badge words match the pinned status: "not saved", never "unsaved" (which in a modal means a change not yet sent with Save). **Which fields a tab holds** comes from the metadata-only render (§3): `cwaTabMetaOnly` creates no models but `CwaUiManagerTab` collects its children's `field` names into the tab's `defineExpose` metadata, and the badge is computed over `fieldStates[iri][field]` for those names, so it survives the tab unmounting.
- **Tab badges are derived, never toggled** (v6). A badge shows the most severe **unresolved** state among the tab's fields, in the order **conflict > error > nothing**; saving, pending and saved never affect it. A field's retry changes only that field's state, so with a conflict on Title and a failed Subtitle, retrying Subtitle (error → saving → saved) leaves the badge on "conflict" throughout. The badge is a computed value: its element re-renders only when that value changes, so its entrance animation plays only when it first appears or changes kind. (The v5 mockup rewrote the badge's markup on every status refresh, including a once-a-second timer, so the glyph's entrance animation replayed each time and the badge appeared to flash; it also ranked error above conflict, so the badge switched kind as Subtitle went from error to saving.)
- **Pinned end** (`core/admin/BarSummary.vue`): the status button and the primary action as a **split button** (Publish now, Schedule, Cancel schedule, or "+ Draft"/"+ Add" for a new component, plus ⋮; or ⋮ alone; §5.1), **always in the tab row, top right, level with the tabs, on every tab and at every width**. They never move into the field row, so the field row always has the bar's full width and the action never jumps when the tab changes. The tab strip scrolls (with fades) in the space to their left. A divider separates them from the tabs. Buttons are the tab row's height less twice the CTA inset (below), so the space to the right of the split button equals the space above and below it (measured: 4px each); on coarse pointers they are the full tab row height (2.75rem). ⋮ is square at the same height. The status is always a solid glyph **plus words**: ≥ `lg` "Draft · not live", "Saving…", "All changes saved", "1 not saved →", "1 conflict →", and with both kinds "1 conflict · 1 not saved →", which goes to the conflict first; below `lg` a short word ("Draft", "Saving…", "Saved", "1 not saved", "1 conflict", "2 issues"). "Saved" shows for 1.18 s, ending with the field line's fade, so every transient "saved" on screen (line, outline, pinned status) ends together; only the admin header keeps "All changes saved" (§7.2). **One bar episode** (v6): the status shows "Saving…" with its spinner from the first request sent by anything in the bar (every field, the order PATCH and its `GET <group>/order`, debounced changes) until nothing in the bar is in flight or waiting; a gap of up to 300 ms between one request settling and the next starting is part of the same episode, so "All changes saved" shows once, at the end, and never between requests. The spinner is one persistent element for the whole episode: the status updates only its text nodes and a `data-state` attribute, and only when they change; it never swaps its markup or toggles a class that would restart the animation. Measured in the mockup: one press of +, five quick presses, three presses 500 ms apart and a typed phrase each give exactly one spinner `Animation` and the text sequence Saving… → All changes saved (1, 1, 2 and 10 requests). It is a button: with an error or conflict it jumps to the field and focuses it, which opens its popover; otherwise it opens a popover with the full status. A spinner is never shown without "Saving…".
- **The CTA group's inset is one token on three sides** (`--spacing-cta-inset`): the space above the split button, below it and to its right edge is the same, and the status button's hover fill uses the same inset above, below, to the one divider on its left (between the tabs and the status-and-CTA group), and between it and the split button. There is no divider between the status and the split button. It is 0.25rem on a fine pointer and 0 on a coarse pointer or below 40rem, where the buttons fill the tab row's height (2.75rem) and sit flush. Measured in the mockup: the CTA 4/4/4px (top, bottom, right) and the status fill 4/4/4/4px (top, bottom, to the divider, to the CTA) at 1280; 0 everywhere at 390; in the desktop bar, the phone bar and the in-page sample alike. Modal footers follow the same rule for their Save: 1rem above, below and to the right (0.75rem on a phone, plus the safe-area inset at the bottom).
- **Phones** (bar narrower than 40rem): the same place, compact: the status is **a glyph only**, a square button the tab row's height, right against the split button with **no gap** (measured: 0px), and the action is shortened to "Publish". Each state has its own shape (a dot for Draft, a clock for Scheduled, a ringed dot for Live, bars for a group, a dashed ring for New (v6: a plus only ever means create, and it sat next to "+ Draft"), the spinner, the tick, the triangle, the diamond), so colour is never the only cue, and the button's accessible name is the full status ("Status: Draft · not live"). The split button sits **flush against the right edge**, ⋮ last, both 2.75rem tall and ⋮ 2.75rem wide, and its menu opens as a bottom sheet. It meets the right edge of the window with no gap (the tab row's end has no padding at this width, on touch as well: v3's mockup kept 0.25rem there because the coarse-pointer padding outranked the narrow-bar rule), at the tab row's full height (2.75rem, thumb-sized) and with its own inner padding; the tab strip keeps the row's left padding. With a right-side safe-area inset (a landscape notch), ⋮'s fill extends into the inset and its glyph stays clear of it: `width: calc(2.75rem + env(safe-area-inset-right))` with the inset as its right padding. Text fields are sized `calc(100cqw - 9.5rem)`, so a field and its label take most of the row and the next field peeks in; the row uses `scroll-snap-type: x proximity` with each field as a snap point. Controls are 2.75rem.
- **Editing on the page** (v6, §7.1, below). **Multi-line content** is edited in-line on the page. The bar shows `CwaUiInlineHandoff`: `Description "Our kitchens are made in…" [Edit on page]`. Edit on page scrolls the template's registered editor clear of the bar, focuses it and flashes an `accent-fg` outline for 600 ms; Escape returns focus to the button. With no registered editor, the button reads **Edit…** and opens a dialog with `CwaUiTextarea`.
- **Escape order:** confirm, popover or menu, inline edit, on-page editor, a dialog's sub-view (asks when dirty, §8.3), dialog, clone mode, deselect.
- **The bar owns the live region** (`ResourceManager`, announced through `BarSummary`), never the tab: a tab unmounts when another is chosen, and its region would go with it mid-announcement. Kit controls announce through an injected `announce()`.
- **Read-only values** (`CwaUiReadonly`) are centred on the same line as the neighbouring fields' values at bar, modal and touch sizes: the value box is the control's height with the same trimmed line box (measured: 0.01px apart).
- **The row scrolls by keyboard too:** the row and the tab strip are focusable scroll regions (`tabindex="0"`, named) when they overflow, so arrow keys scroll them (WCAG 2.1.1).

Module tabs on the row: `DynamicPage` (three selects · divider · status text), `Publish` (`Edit published version` toggle with `info`, `Schedule` toggle, date picker; the action is pinned), `Group`, `ResourceInfoTab` (`CwaUiReadonly`, badges), `Ui` (UI select, Style select or multi-select; where the options come from is the separate configuration job), `Order` (`CwaUiNumber width="xs"`).

**Every saving control in the bar goes through the one save path** (v6, a bug found in the mockup): text inputs, the stepper, selects, the multi-select (Style), toggles that save (Show), the file group (Replace, Remove), the either/or group and the Info tab's editable fields all run the same episode: the line under the control sweeps while saving and morphs to saved, error or conflict; the pinned status reads "Saving…" then "All changes saved"; the tab badge and the error and conflict popovers come from the same state. In the module that is `useCwaResourceModel` plus `CwaFieldStatus` for each one, never a control's own request. A toggle's and a file group's line sits under the whole control.
- **Composite controls are named groups** (final panel 32): the file group, the segmented control and the either/or group have a wrapper with `role="group"` named by the field label ("Image"), and the hidden status message is linked from that group with `aria-describedby`, so it is read when focus enters the group by any of its buttons. Buttons never get `aria-invalid` (it is not a state of `role="button"`); only text-like controls (inputs, textareas, comboboxes) do.
- **A toggle's status sits outside its `<label>`** (final panel 31): the line's slot and its hidden message are a sibling of the label inside the field wrapper, linked only by `aria-describedby`, so the switch's accessible name is exactly "Show" in every state (Vitest checks it).
- **Removing the image has Undo** (final panel 17), like removing a style chip: after a successful remove the line shows saved, and the popover keeps "This removed workshop-bench.jpg." with **Undo** until the next edit in the group; Undo restores the previous file IRI in one save. **A failed remove keeps the file shown** (final panel 29): the name, thumbnail and Remove stay, with the error line and **Retry remove** and **Reset** in its popover, so the group never shows "No image" beside the old thumbnail.
- **The Info tab's Note leads its row** (final panel 29), with a divider after it, so ID, Created and Updated stay together as read-only metadata.

Controls that do not save are not in it: the Publish tab's **Edit published version** (switches what the bar edits), **Schedule** and the date (sent by the Schedule action), and **Edit on page** (the in-page editor has its own path, §7.1).


### 7.1 Editing on the page (v6)

An in-page editor (`CwaInlineText`, the TipTap HTML editor) saves like a bar field: 250 ms debounce, one request in flight, one newest-value follow-up, one episode (§7).

- **The bar status is primary.** The bar is fixed and always visible, and its pinned status covers every save of the selected component, in-page editors included. An error from an in-page editor opens from the bar status ("1 not saved →", then its popover with Retry and Reset), never from a popover over the page content.
- **The whole selection outline carries the field's state** (decided by Daniel), drawn in the admin overlay (never in site CSS), with the same rules as a bar control's line: nothing while pending; one sweep from the first send until nothing is in flight or waiting, which typing never restarts; a morph to success, then back to the selection colour; solid danger or warning for an error or conflict.
  - **The selection colour is the real one** (`ComponentFocus.vue`): green (`--color-green`, #9cdd05) for a published component, orange (#ffaa00) for a draft or a new one, magenta (#e30a6c) for core resources. The saving sweep keeps its own blue; saved is `line-saved` (lime-800, darker than the published green), an error solid `line-danger` (red), a conflict solid `line-warning` (amber).
  - **The outline carries no label** (decided): a name tag could cover the site's content. The admin header shows the selected component's name at its top centre, as plain text.
  - **A glow marks each change of state** to saved, error or conflict (§2.8), on the outline only (never on bar controls or other fields), so a change reads even where the colours are close (saved lime-800 after a published lime outline; amber after a draft's orange).
  - **Width never changes:** the outline is four side strips at exactly the selection outline's width, 2px, in every state (idle, saving, saved, error, conflict; measured 2/2/2/2px in each). Only colour and brightness change.
  - **Start:** on the first send the strips cross-fade from the selection colour to a light saving colour (blue-300 `#93c5fd`) over 150 ms, so the whole border changes at once.
  - **While saving:** a dark segment (`line-saving`, blue-700), 25% of its side with soft ends, runs along every side at once, clockwise (top left to right, right downward, bottom right to left, left upward), on one 1.2 s cycle shared by all four, so they read as one motion and whichever sides are in view always move. The strips and their four animations persist for the whole episode.
  - **End:** each segment grows from where it is to its full side while turning `line-saved` (180 ms, ease-out) as the strips cross-fade to the same colour; the outline holds success for 600 ms and then cross-fades back to the selection colour over 400 ms. Error and conflict grow to solid `line-danger` or `line-warning` and stay. The segments' positions are read before the state changes, so the growth starts where they are.
  - **Reduced motion:** colour changes only (150 ms), no segments.
  - Rejected: a 4px line on the outline's left edge only. It was calmer while typing, but easy to miss.
- **Colours:** the overlay picks its line set from the luminance of the page behind the selection: the light set over a light page, the dark theme's set over a dark one. Measured: on the light sample site blue-700 6.6:1, lime-800 6.97:1, **error red-600 `#dc2626`** 4.75:1 and amber-700 4.94:1 on the component's #fffdf9, and at least 4.55:1 on the page's #f7f3ee; on a dark site (component #292524, page #1c1917, the mockup's "Dark site" switch) the saving base blue-500 4.12:1 and its segment blue-200 10.68:1, saved #9cdd05 9.22:1, **error red-500 `#ef4444`** 4.03:1 (4.65:1 on the page) and warning #fcd34d 10.52:1. Over a dark site, saved uses the same green as a published outline, so there the glow and the bar status carry the change. **The error outline is a saturated red** (decided): red-600 on light sites, red-500 on dark ones, never a dark or muted red; its glow uses the same red. It differs from the draft orange and the published green by hue, which is what the eye catches on an outline (lightness ratios are low: red-600 vs `#ffaa00` 2.53:1, vs `#9cdd05` 2.93:1), and the change of state is also carried by the glow, the bar status and the header.
- **Errors:** while the component is selected there is **no toast**; the outline and the bar status show it, and the bar status opens the message.
  - **One trigger for the toast**, for in-page editors and bar fields alike, computed once from `fieldStates` and the resource stack (never from an editor's unmount: an in-page editor does not unmount on deselect): the toast is raised when a field's state is unresolved and the field is **no longer reachable from the bar** (its component deselected, or its tab unmounted). Scrolling out of view is not a trigger. It is raised once and stays until the field leaves the error: a successful save (including a later edit's), Retry or Reset dismisses it. No success toast follows: routine saves are never toasted.
  - The toast: "Text wasn't saved", "Your last edit to “How we build a kitchen” (Rich text) wasn't saved.", with **Show me** (solid: selects it, scrolls to it and opens the bar status), **Retry** (selects it, moves focus to the bar status, which shows Saving…) and **Reset** (selects it and moves focus into the editor).
  - **The editor itself carries the error:** a registered in-page editor gets `aria-invalid="true"` and `aria-describedby` to a hidden "Not saved. Press Escape for Retry and Reset." while its save has failed; **Escape** from the editor then moves focus to the bar status and opens its popover on Retry. Both are cleared when the next save starts.
- **Announcements:** the bar's region, by the §11.2 rules: "Saving…" only when slow, then one outcome per episode. With the component deselected the bar is gone, so outcomes still arriving go to the page's region; the header's text never announces (§7.2).
- **Animation while typing (WCAG 2.2.2): decided, no change.** The outline's segments and the bar's sweep run for as long as an episode lasts; reduced motion turns them into still colours. Recorded as Daniel's decision, not as a fix.

### 7.2 The admin header's status (v6)

**The mockup's admin header is a stand-in:** only its status (this section) and the path selector (below) are in scope; Done and Menu are drawn to place them, and a header restyle is not part of the kit.

**The path selector** (`header/_parts/PathSelector.vue`) sits at the top centre: the selected resource's name in a solid `line-strong` box, `text-label`. With parents to choose it is a button (`aria-haspopup="dialog"` with `aria-controls`, named "Rich text, choose a parent") with a subtle **▾** after the name in `fg-muted` (final panel 18), so it reads as something to open; a solid `fg` border and `field-hover` fill on hover and while open; with none (the outermost group) it is the same box with no ▾, no hover and `aria-disabled`. A click, Enter or Space opens the resource stack (§5.3, internal `core/ui/ResourceStack.vue`) with the current stack, the **innermost box over the selector** as far as the viewport allows and clear of the status, growing from that box; choosing a level selects it, updates the name, and focus returns to the selector. While the anchored popover is open the selector's own label is hidden under the innermost box; **while the phone sheet is open the label stays visible** (final panel 22). Nothing selected: the page's title as plain muted text. **The status stays at the top right.**

**Phones** (below `sm`; final panel 10, 12, 19, 22): the centre track is `minmax(6rem, 1fr)`, so the path selector keeps **at least 6rem**, with an ellipsis, and is 2.75rem tall; the other items give way. **The status is always icon-only**, "not saved" included: the red triangle is a 2.75rem button whose accessible name is "1 change not saved"; the tick and the spinner keep their text as their accessible name too. **A tap or long press shows the status text in a tooltip** under it for 2 s (the "not saved" button also does its job, opening the bar status). **Menu is an icon-only button** named "Menu".

The header's spinner and tick (`SpinnerTick`, at the top right) become a glyph plus a short text status, in the same place, that answers "is it safe to leave?". The selected component's name sits at the top centre as plain text (§7.1).

- **"All changes saved"** in muted text with a **`success` tick that stays green at rest**, as `SpinnerTick`'s tick does today (measured on the header's `surface`: lime-800 `#3f6212` 7.08:1 on `#ffffff` in light, `#9cdd05` 10.62:1 on `#1c1917` in dark, both above 3:1), whenever nothing is waiting, in flight or failed: the resting state, mirroring `SpinnerTick`'s ready state. It never goes blank.
- **"Saving…"** with the spinner from the **first change of an episode**, the 250 ms debounce included, until nothing is waiting or in flight, held through gaps of up to 300 ms like the bar (§7): one episode, one spinner, no restarts.
- **"1 change not saved"** ("2 changes not saved"), with the triangle, from a failure until a save of that field actually succeeds (a retry that is still sending keeps it). It is a ghost button with the kit's hover and focus fill; it focuses the first one, selecting its component when needed and opening the bar status. Its text and triangle use `danger-strong`, a saturated red: red-600 `#dc2626` (4.83:1 on the light header) and red-400 `#f87171` (6.32:1 on the dark header), so it reads as red, not brown or pink.
- **Inputs, one internal getter** (`resourcesManager.saveStatus`, not computed in the header): *saving* is `requestCount > 0` (writes through `doResourceRequest` and `send`) or a `pendingUpdates` entry; GETs, Mercure re-fetches and presence never count. *Not saved* counts `fieldStates` in error or conflict, plus write errors in `errorStore` (a failed publish, order PATCH or delete; "Show it" opens the bar status or the error's toast). A modal's dirty local copy does **not** count: the modal is on screen with its own Save count and its own leave guard (§8.5), and the header sits behind its scrim.
- **One persistent element pair**: a text span and a button, each shown or hidden with `hidden`, never re-created, so the spinner never restarts and focus is never lost to a rebuild. When the button hides while it has focus (the retry succeeded), focus moves to the header's first control.
- **Not a live region.** Announcements go through the §11.2 regions only: the bar's while a component is selected, the page's otherwise (saves finishing after deselecting).

---

## 8. Modals, pages and save state

### 8.1 Modal form layout

| Part | Spec |
|---|---|
| Width | `size`: `sm` 28rem, `md` 36rem (default), `lg` 48rem; full screen below `sm` and in short landscape |
| Header | 3.75rem tall, padding 0 `--spacing-dialog`; `text-title` as an `h2`; close button (ghost, square, 2.75rem) at the end; sticky |
| Tabs | optional, under the header and sticky with it: 2.75rem, the bar's tab look and sliding indicator, scrolls with fades on a phone; the first tab's text lines up with the title |
| Body | padding `--spacing-dialog`; scrolls; fields full width |
| Field block | label row → 0.375rem → field → 0.5rem → helper/error. Blocks are `--spacing-stack` (1.5rem) apart. No dividers between fields. |
| Sections | `CwaUiFormSection`: heading `text-section` (1.125rem / 650, `fg-secondary`) as an `h3`, optional description `text-helper` `fg-muted` 0.25rem below, then 1rem to the first field. Each section after the first has 2rem of space, a 1px `line` rule, then 2rem before its heading. A section with no heading adds no top space, so an untitled form's padding is even on all sides. |
| Columns | `columns: 2` on a section puts short fields side by side, 1rem column gap, 1.5rem row gap; it collapses to one column when the dialog's content box is under 32rem (container query) and at 200% zoom |
| Toggles | a toggle row is label left, toggle right, helper below the label; the row is 2.75rem tall and the whole row toggles |
| Footer | sticky, `surface-raised` fill, padding 1rem `--spacing-dialog` (0.75rem plus the safe-area inset on a phone); actions right-aligned with 0.75rem gap: a short state text in `fg-muted` ("Choose 2 versions to save", "2 to fix"; hidden on a phone, where the alert says it), secondary (`soft`) then primary (`solid`); **only Cancel and Save, on every tab** (v6): a destructive action never sits in a footer (§8.6). Below `sm`: secondary and primary share the row 50/50. |
| Keyboard | the sticky header and footer are sized against `visualViewport`; the focused field scrolls above the on-screen keyboard |

Whether a dialog uses its phone layout is decided by the **viewport or overlay width** (a named container on the overlay), never by the dialog's own width: a 36rem dialog on a desktop is not a phone.

`CwaUiFormGroup` (pages) uses the same field block, section and column rules on `surface`, with a max content width of 40rem.

### 8.2 Saving in modals and pages

Modals and pages (`CwaUiDialog`, `CwaUiFormGroup`) keep a Save button. Nothing is saved as you type. **Admin pages** (the `/_cwa` pages with forms, such as site settings or a user's page) use exactly this model: a local copy, a Save button, nothing saved as you type (decided in v4).

- **A local copy.** Fields edit a copy of the resource (`useItemPage`'s `localResourceData`). The bar is different: it saves each field as you type.
- **Unsaved changes are marked** at three levels: the field ("● Unsaved" after its label; nothing is drawn inside the field), its tab (a dot after the tab name), and Save, which counts them: "Save" (disabled, nothing changed), "Save 3 changes", "Saving…", then the saved check and "Saved" for 1.5 s. The count is the number of changed fields; the accessible name says "Save 3 unsaved changes". **There is one count, and Save carries it** (Daniel): no separate "1 unsaved" notice in a footer or an admin page's action row. The footer's state text is only for what blocks Save ("Choose 2 versions to save", "2 to fix"). The Routes sub-view's footer keeps "2 unsaved page changes kept", because its Save is the route's, not the page's.
- **Save sends only the changed fields**, as a merge patch, in **one request** for the resource the modal edits. Route changes are not part of it (§8.3). Each carries `If-Match` with the stored version.
- **Client checks run first** (an empty required field, a value over its limit, a bad URL). Anything they catch is shown like a server error, and nothing is sent.
- **Errors returned by Save (422)** go on their fields, below them, linked with `aria-describedby` (§4.4). An alert at the top of the body says "This page wasn't saved. 2 fields need a change." and lists each field with its tab as a link that opens the tab and focuses the field. A request that succeeded clears its fields' markers; the failed request's fields stay unsaved.
- **A conflict (412) is shown when Save is pressed.** Nothing in that request is saved.
  - **The modal alert** (`warning`, announced once) says "1 field changed by Mia while you were editing." and "Nothing was saved. Choose which version to keep before saving.", and links to each field (opening its tab); the tab gets the diamond badge. The footer's state text reads "Choose 1 version to save", and Save is linked to it with `aria-describedby`.
  - **The field keeps its normal look**: it stays an ordinary, editable field with the `field-warning` tint. Nothing wraps it.
  - **A notice directly below it**, 0.5rem away: a block tinted 10% toward `warning` with a 3px `warning` start edge, `role="group"` labelled by its heading, and linked to the field with `aria-describedby`. Its heading line is the solid diamond, the peer's avatar in their colour and "Mia changed this while you were editing." Then both values as read-only quoted text, labelled "Mia's" and "Yours" (a definition list, no field look), with the words that differ in 650 weight on a light tint, never underlined (an underline read as a link); when more than half the words differ, nothing is marked, since marking most of a value helps no one. A value longer than two lines is clamped with **Show all**. Then **Use Mia's** and **Keep mine**, right-aligned soft buttons that wrap onto their own row when there is no room and never clip their labels (checked at 1280, 390 and 320px, and with a long name: "Use Alexandra's").
  - Choosing sets the field and removes the notice; Keep mine stays an unsaved change, and Use Mia's is no longer one. Fields only Mia changed take her value quietly, and the alert names them. Save stays blocked until every conflict has a choice, and the next Save carries Mia's version in `If-Match`.
- **Creating** uses the same button and flow, and the button **names what it creates**: **"+ Article"**, **"+ Page"** (a plus glyph and the noun; accessible names "Create article", "Create page"). The list's toolbar and empty state use the same button. It is always enabled; pressing it runs the client checks. One `POST` sends every filled field. On success the same modal becomes the edit view (§8.3).
- **Cancel or close with unsaved changes** asks first (§8.5).
- **State lives in the modal, not the store.** Unsaved, error and conflict states for a modal are part of its local copy (`useItemPage`), which must keep local edits through a re-fetch rather than replacing `localResourceData` wholesale. The store's `fieldStates` (§8.4) are for the bar.

### 8.3 Tabs in the page modal

The page modal has tabs, as today: **Details, Routes, Info**, then any page data tabs after them (a page data resource, such as a blog article, adds its own, e.g. **Article**). The tab strip is the bar's (`ManagerTabs`), sticky under the header.

- **Each tab shows its state**, from the modal's local copy: a dot when it holds unsaved changes, the triangle when it holds an error, the diamond when it holds an unresolved conflict, ranked by the shared `badgeFor()` (§7): **conflict beats error beats unsaved**. The badge re-renders only when its value changes. The tab's accessible name and title give every count: ", 1 to choose, 1 to fix, 2 unsaved".
- **After a failed Save, the tab holding a failed field is opened.** If the open tab holds one, it stays; otherwise the first tab in order that holds one opens. The body scrolls to the top, where the alert lists every failed field with its tab, and focus goes to the alert.
- **Required fields on another tab** are not flagged before Save. Pressing Save or Create with one empty marks it like a server error, badges its tab and opens it as above, so a field the editor never saw is found for them.
- **Creating** ("New article"): only the tabs that make sense before the resource exists are usable.
  - **Details** and the **page data tabs** are enabled: they are fields of the new resource.
  - **Routes is disabled** (`aria-disabled`, muted, with a small lock): a route points at a saved resource. It stays focusable and selectable, and its panel says why: "Routes open once the article is created. … Create the article and this tab lets you add its address." No tooltip.
  - **Info is hidden**: there is nothing to show before the resource exists.
  - After Create succeeds, the modal becomes the edit view of the new resource: Routes is enabled, Info appears, and the title becomes the new name.

**The Routes tab** (rebuilt with the kit; consumer: `RoutesTab*.vue`). v6 replaces v5's in-place editing, whose second Save row inside the modal and confirm on top of it confused every reviewer.

```
Route
Path   /kitchens/shaker  ⧉   ● Live
Recommended: /kitchens/shaker-kitchens · Use this
[Edit route]
────────────────────────────────────────────
Redirect to                             Off  ▸
Redirected from              3 old addresses  ▸
Child routes                        2 routes  ▸
```

- **Route**, at the top of the tab: the path (mono, with Copy; 0.25rem `label-gap` under its "Path" label like every read-only label and value pair, with no extra margin, and the badge centred on the path's line), its status badge from the route (Live, Scheduled · date with a clock, Not live; Held back by parent when an ancestor's go-live is later, from `isRouteGatedByAncestor`), the recommendation line when the path isn't the recommended one (an info note: the ⓘ glyph, `accent-fg` mixed 10% over `surface` with a 3px `accent-fg` edge, like the v6 alerts, reading "Recommended: /kitchens/shaker-kitchens" with a small soft **Use this** button at its end; below a 25rem container the button drops under the text; the note is not rendered when the path matches), a `warning` note when held back, and **Edit route** below them, never on the heading's line. **No route** is an empty state, never a "Path" label with nothing beside it: a muted sentence, "No route yet. Visitors can't open this page at its own address." (plus "It is reachable through a nested page." when a routed child makes it public), a primary **Add a route** that opens the same sub-view as Edit route, and the recommendation note below it, whose **Use this** opens Add a route with the path filled in and saves nothing on its own. Below, **Child routes** still shows (an unrouted page can have routed children); **Redirect to** and **Redirected from** are hidden, because an old address redirects to a route and there is none yet. **Parent has no route**: the same sentence, then an info alert with a button that opens the parent, and no rows. The "Path" label renders only beside a path.
- **Navigation rows** below it, in a list: **Redirect to** ("Off" or "→ /kitchens/shaker-range"), **Redirected from** ("3 old addresses" or "None") and **Child routes** ("2 routes" or "None"). They start 2.5rem below the Route section. Each is one `button` spanning exactly the content width, at least 3.5rem tall, with 0.75rem block and 1rem inline padding inside its hover fill, so the label and ▸ sit 1rem in from the content edge; its divider is the row's own bottom line, so fill and line are always the same width, with the label, a muted one-line summary that truncates, and a solid ▸; its accessible name is the label and the summary ("Redirected from: 3 old addresses"). The whole row is the target.

**Sub-views.** A row, Edit route, Add a route and Use this open a sub-view: a page of the Routes tab, inside the modal, built with `CwaUiSubView` (§5.1), which the add component detail (§5.6) shares.
- **The modal's tabs stay**, with Routes selected; only the tab's own content changes. Under the tab strip a stacked header: a ghost back link "‹ Routes" (`fg-muted`, 0.875rem, its hit area 1.5rem tall, 2.75rem on coarse pointers), 0.5rem of space, then the sub-view's title as a heading at the section heading size, both aligned to the body's inline padding. Focus moves to the title (`tabindex="-1"`). 
- **The tab's main view is `hidden` and `inert`** while a sub-view is open; the tab strip is not. The sub-view slides in from 2rem to the right and fades (`d-base`), and the main view comes back from the left; both are instant under reduced motion. The body scrolls to the top, and its scroll is restored on the way back.
- **Leaving:** "‹ Routes" or Escape returns to the main view, and focus returns to the row or button that opened the sub-view. Another tab simply switches, and coming back to Routes shows its main view. **With unsaved input** in a sub-view's form, each of these asks "Discard your route changes?" (**Keep editing** / **Discard**; changes on other tabs are kept). The sub-view adds no router history: it is the tab's state, not a route.
- **Footer:** while a form is open in a sub-view, its own footer replaces the modal's: "2 unsaved page changes kept" · **Cancel** · **Save route** (or **Add route**, **Redirect**, **Add**). There is never more than one Save on screen. A sub-view showing a list (Redirected from, Child routes, Redirect to without a form) has no footer: its actions save at once, and the modal's Save would have nothing to do there, so it is hidden too.
- **Saving needs no confirm**: what will happen is said in the form, above the footer, as it is typed ("The old path, /kitchens/shaker, keeps working: it will redirect here."; "Visitors to /kitchens/shaker will be sent to /kitchens/shaker-range." as a `warning` note; "/old-kitchens → this page"). Save route is the confirmation. Only destructive actions confirm, and none with a bare "Cancel": Delete route (**Don't delete**; typed when old addresses or child routes depend on it, §8.6), delete an old address (**Don't delete**, simple), Remove a redirect (**Keep redirecting** / **Stop redirecting**). Delete route is the last section of the Edit route form ("Delete this route"), never in the footer.
- **Outcome:** on success the form closes and a status line with a tick says what happened ("Route changed to /kitchens/shaker-kitchens. /kitchens/shaker now redirects here."), where the change shows: at the top of the tab for the route, at the top of the sub-view otherwise, with focus on it. On failure the form stays open with what was typed, under a `danger` alert with Retry ("The server couldn't save it. Nothing changed, and what you typed is still here."). Each sends its own request and is never part of the modal's Save.

| Sub-view | Content | Form |
|---|---|---|
| **Edit route** / **Add a route** | the form at once | path as a prefix select (the parent routes' paths) plus a suffix input, the recommendation ("Use this" fills both), the go-live control (Live / Scheduled / Not live, the date picker for Scheduled; `liveAt` is the route's own, the badge shows the effective one); a path change offers "Also change the 2 child routes that start with /kitchens/shaker/" (checked, sends `cascadeChildPaths`). Use this opens it filled with the recommendation. |
| **Redirect to** | "Sends visitors from this page's address to another page instead." Off: "Not redirecting. Visitors to /kitchens/shaker see this page." with **Redirect to another page**. On: `/kitchens/shaker → /kitchens/shaker-range`, "Visitors never see this page.", **Change** and **Remove** (confirms). | "Send visitors to", a resource search; **Redirect** |
| **Redirected from** | "Old addresses that send visitors here. One that sends visitors to another is shown under it.", **+ Add** (accessible name "Add an old address") above a `CwaUiTree` of `/shaker → this page`, with `/shaker-style → /shaker` nested, each with Delete (confirms; deleting a parent says its nested addresses go too) | "Old address", checked before sending ("Start with / and leave out spaces, for example /old-kitchens."), with a live preview; **Add** |
| **Child routes** | "Routes of the pages nested under this one. Their badges show when visitors can reach them.", a `CwaUiTree` with status badges and a ⋮ per row: **Edit settings**, **Go to page** | — |

- **Phones**: the same, in one column; the prefix select and suffix stack below 25rem (container query); row actions keep 2.75rem hit areas.

### 8.4 Field save state in the resources store (bar)

Per-field save state lives **with the resource in the resources store**, not in a separate registry:

```ts
interface CwaCurrentResourceInterface {
  data?: CwaResource
  apiState: CwaResourceApiState
  fieldStates?: { [field: string]: CwaFieldState }
}
interface CwaFieldState {
  status: 'pending' | 'saving' | 'saved' | 'error' | 'conflict'
  waiting: boolean        // a change is waiting to be sent (also mid-episode)
  slow: boolean           // a request has been in flight for more than about 1 s
  savedAt?: number
  error?: { kind: 'network' | 'server' | 'violation' | 'precondition'; message: string; status?: number }
  held?: { user: { id: string; name: string }; value: unknown }   // plain data
}
```

- **Beside `apiState`, not inside it.** `apiState` is the fetch's state and is replaced wholesale whenever a fetch starts (`startFetchResource` swaps SUCCESS for IN_PROGRESS; #375 restores a copy). A Mercure or reconnect re-fetch would otherwise wipe an unsaved error or a held conflict.
- **Client-only.** The key is added on the first write, and the server never saves, so it adds nothing to the SSR payload.
- **Plain data only.** `retry()` and `reset()` are model methods and store actions, and so are `acceptHeld()` and `keepMine()`, keyed by `(iri, field)`: today's `RemoteFieldChange` carries `accept()` and `keep()` functions (`model-editors.ts`), so only its data goes into `held`. The state stays serialisable and devtools-readable.
- **`status` is `'saving'` for the whole episode** (§4.1), with `waiting` true while a follow-up is queued, so the line never drops to pending between the request in flight and its follow-up.
- **Follows the resource:** when a save turns live into a draft, or a 412 moves a value with `moveTo`, the field states move to the new IRI with it (#429).
- **Errors are per field, and `updateResource` keeps its return** (v6, replacing v3's `{ ok }` wording): it still resolves to the saved resource, or `undefined` on failure. Per-field outcomes are written to `fieldStates` keyed by `(iri, field)`, from the fields the request sent, so one field's success never clears another field's error (today's `removeByEndpoint` clears every error for the endpoint). The callers checked: the field model needs the returned resource's `@id` (a save on a live component returns a new draft IRI); `useItemPage` returns it to its own caller; stranded merge, clone, remote changes and the Info tab only test for success; outside the module only bcio calls it (ArticlesCollection, result unused). The code that writes `fieldStates` is admin-only and lives in a lazy module, out of the entry (§12).
- **What reads it:** the bar's status line, the tab badges, the pinned summary and Retry after returning to a tab. Getters read by `(iri, field)`, so work scales with fields on screen (#259).
- **A field in error or held that is no longer reachable from the bar** (its tab unmounted, its component deselected; one trigger, §7.1) raises a persistent toast with **Show me**, **Retry** and **Reset** (**Retry all** and **Reset all** when there are several), dismissed when the field leaves that state, and `NavigationGuard` asks before leaving the page. Route-cache eviction never evicts a resource with an unresolved field state.

### 8.5 Unsaved changes: discard and leave

Decided in v4. A modal or admin page with unsaved changes never drops them without asking; with nothing changed, nothing asks.

| Trigger | Asks | Buttons |
|---|---|---|
| Cancel, the close ×, Escape, a backdrop click | "Discard 3 unsaved changes?", then "Your changes to Reference, SEO page title and Route path will be lost." | **Keep editing** (soft, focused first), **Discard** (solid `danger`) |
| Navigating away from a modal or an admin page (a link, the admin menu, Back) | "Leave without saving?", then "3 unsaved changes (…) will be lost." | **Keep editing**, **Leave** (solid `danger`) |
| Closing or reloading the browser tab | the browser's own `beforeunload` prompt | the browser's; its wording and look cannot be changed |

- The confirm is **in-page** (`CwaUiConfirm` on reka `AlertDialog`), never `window.confirm`: a square `surface-menu` panel, 24rem wide, over a scrim covering the modal or page, `role="alertdialog"` with its title and text linked. Focus starts on Keep editing and is trapped in the panel; Escape or a click on its scrim is Keep editing, and focus returns to what had it. Below `sm` the buttons share the row 50/50.
- The count and the field names come from the local copy (§8.2), so they match the Save button.
- **Leaving goes through the existing `NavigationGuard`** (`src/runtime/admin/navigation-guard.ts`): a modal or page with a dirty local copy registers with it, and the guard awaits the confirm before letting Nuxt navigate. Leave discards the copy and continues; Keep editing cancels the navigation.
- `beforeunload` is added only while a local copy is dirty and removed when it is saved or discarded, so a clean page never makes the browser ask.

### 8.6 Deleting (v6)

**Delete is never in a footer.** A modal's footer is only Cancel and Save, on every tab, so the button beside Save is never destructive.

- **Where it goes:** the last section of the modal's **Info** tab, or its last tab when it has no Info: page, layout, page data and user modals alike. The section is titled "Delete this page" (layout, article, user), has one sentence saying what goes and what stays, and a **soft `danger`** **Delete page** button (`danger-fg` text on the button fill; decided: only the confirm's own button is solid danger, so the tab's loudest element is not a delete sitting above Save). A route's delete is the last section of the Edit route form, with the same soft button. **Nothing else leads to it** (decided): the modal header has no ⋮ on any size, so delete is reached only by opening Info and scrolling to its last section.
- **The section's sentence is built like the confirm's**, from the same function, so the two never disagree: each clause appears only when it applies.
- **The page's cascade** (bundle): **page data built from the page as its template is deleted with it** (`AbstractPageData::$page` is `onDelete: CASCADE`). Each of those is itself a page with its own route (`AbstractPageData extends AbstractPage`, `route_id` `SET NULL`), so their addresses stop showing a page too. Bold, first: "14 pages built from this template are deleted too. Visitors to their 14 addresses get “Page not found”.", with **See the 14 pages** (the page data list filtered by this template, in a new tab; the filter key is never `page`, which the list binds as its page number); "Pages built from this template are deleted too, and their addresses stop showing a page." when the count is unknown; nothing for a page that is not a template (a count of 0, "Template · unused"). Then, muted, what is kept: "The route /kitchens/shaker is kept, and visitors to it get “Page not found”." only when the page has a route; "The 2 pages nested under it are kept and lose their parent." only when there are any (`parent_page_id` is `SET NULL`), counted from the pages and page data whose `parentPage` is this page (`GET /_/pages?parentPage=…` and the page data collection with the same filter, `itemsPerPage=0`; if the bundle has no such filter, the sentence says "Pages nested under it are kept and lose their parent." without a number), never from child routes, which are a different hierarchy.
- **The count is fresh** (bundle: nothing republishes the template when page data is created or deleted). Pressing Delete page re-fetches the page with a fresh, non-cached request (authenticated Page GETs are `no-store`) **before** the confirm opens: the button shows its spinner and "Checking" meanwhile, and after a 3 s timeout or a failure the confirm opens with the unknown-count wording. The Info section's sentence takes the fresh count at the same time, and is also refreshed whenever the Info tab is shown. **The confirm's text never changes once it is open**, so its description is read once and is true.
- **After a successful delete** the module evicts the cascaded page data from the store, re-fetches the affected routes and lists, and does not wait for Mercure (the cascade runs in SQL, so no Doctrine events, Mercure updates or cache purges are sent for those rows).
- **Unsaved edits in the modal:** the confirm adds "Your 3 unsaved changes are discarded too." A successful delete discards the local copy and unregisters its `NavigationGuard` and `beforeunload` before the modal closes or navigates, so "Leave without saving?" never follows a completed delete.
- **Focus after a delete:** to the next row of the list behind the modal, or the list's heading when no row is left, with one success toast. A route deleted inside its sub-view goes to the Route section's status line. A failed route delete moves focus to its alert, which is a `group` named by its title (not `role="alert"`, which would speak it twice and assertively).
- **The confirm says the consequence**, in this order: the title names the thing, 'Delete “Shaker kitchens”?'; then the cascade on its own line, bold; then a muted line for what is kept; then "This can't be undone.". Its buttons are **Don't delete** (soft, first) and the action (solid `danger`).

**Two tiers of confirm** (decided in v6, adjusted after the review panel):

| Tier | Actions |
|---|---|
| **Type to confirm** | deleting a page, layout, page data or user; deleting a route that has old addresses or child routes; deleting an old address that has old addresses under it; **Delete all** and **Delete everything** in the orphan reports |
| **Simple confirm** | deleting a route with neither; deleting one old address with none under it ("Its old address /shaker-style goes too." when one sits under it moves it to the typed tier); **removing a component**, from this location or from every place it is used (`/usage`): the confirm names how many places; deleting one orphan |

**Type to confirm: type the name** (decided):
- The field is labelled with what to type, quoted: **Type the page name, “Shaker kitchens”, to confirm** (layout, article and page data: their name; a user: **their email**; a route or an old address: its path; the bulk orphan deletes: **the count**, "Type the number of files, “23”, to confirm"). Never pre-filled.
- The match **ignores case and surrounding spaces**; **paste is allowed**.
- The helper line, linked by `aria-describedby`: "Delete page stays off until it matches."; "That doesn't match. Type Shaker kitchens." with the error look and `aria-invalid="true"` once the text can no longer become the name (never `aria-invalid=""`, which ARIA reads as false); "Matches. Delete page is on." with the tick. The change to matching, and back, is announced once, politely, through the confirm's own region.
- The danger button stays `aria-disabled` (focusable, 50% opacity) with its reason linked ("Type the page name in the field above to turn this on."), and does nothing until the field matches. **Enter** in the field submits once it matches.
- Focus starts in the field. Escape, Don't delete or the scrim cancel, as in every confirm (§8.5).
- A name avoids the speech-input clash of "delete", which Voice Control, Voice Access and Dragon take as an editing command; the typed field is part of the manual Voice Control pass (§11.4).


---

## 9. Lists

### 9.1 Row grid

Every admin list uses one CSS grid, with the header row on the same columns:

| Column | Width | Content and alignment |
|---|---|---|
| `select` (optional) | 2.75rem | checkbox, centred |
| `lead` (optional) | 2.5rem | a real image thumbnail only (files, images), 2.5rem, centred; never a decorative coloured tile. The page list has no lead column. |
| `primary` | `minmax(0, 1fr)` | title (`text-control`, 500), then, when the list has types, a 0.5rem type dot in the type's colour with the type's name as its accessible name; an optional second line (`text-helper`, `fg-muted`); left-aligned, the title truncated before the dot |
| `badge` | fixed per list, e.g. 7rem | one badge, left-aligned, so badges line up down the list |
| `meta` columns | fixed per column (date 8rem, count 5rem) | text left-aligned; numbers and dates right-aligned, `tabular-nums` |
| `actions` (optional) | 2.75rem per action | square `ghost` icon buttons, right-aligned, only for an action the row does not already have; more than two go into a ⋮ menu. The page list has none. |

- **Row actions** (Daniel, restoring the earlier model): **the whole row opens the item's edit modal**, its main action. **View on site** is an **eye** icon button at the top right of the modal header, before ×, named "View page on site": it navigates to the page (through `getInternalResourceLink(iri)` for a page without a route, with `cwa_force` as today) and closes the modal, asking first if it holds unsaved changes (§8.5). Rows do not repeat it, and **lists have no row ⋮** while it would only hold those duplicates: Delete lives in the modal's Info tab (§8.6). This applies to pages, page data, layouts and users alike; a list keeps a ⋮ only for an action that is its own. The one kept is the Routes tab's **Child routes** tree (§8.3): its ⋮ opens another page's settings from inside this page's modal, which the row itself (it expands) does not do.
- **Rows:** 3.5rem with one line, 4rem with two (4rem on coarse pointers). Padding 0 1rem, column gap 1rem, content vertically centred. Rows are separated by a 1px `line` divider; hover is `field-hover` at 50%; the selected row is an `accent` tint.
- **The whole row is the link** (to the item's modal); any action button stops propagation.
- **A hover fill never extends past its list's dividers** (v6), in every hoverable row in the kit: list rows, tree rows, navigation rows and menu options. The divider is the row's own bottom line and the fill is the row's box, so they are always the same width; content sits inside the row's padding, never bled past the edge with a negative margin.
- **Header row:** 2.5rem, `text-helper`, `fg-muted`, sentence case, same alignment as its column; sortable headers have a solid chevron.
- **Below `md`:** the grid becomes `lead · primary`, plus `actions` where a list has its own (`primary` alone in the page list). The second line is **status first**, its glyph in a fixed 0.75rem slot so every row's status starts at the same place (a coloured dot; a clock for Scheduled, so it never reads as the Static type's blue dot; a hollow square for a template), then the date with what it is ("edited 15 Nov"), left out when the status already carries one ("Scheduled · 20 Nov"), then the path last, so only the path truncates: `● Live · edited 17 Nov · /kitchens`. Rows are 4.25rem. Selection checkboxes are hidden, and a row is only highlighted while its checkbox is checked. A list's own ⋮ menu opens as a bottom sheet.
- The checkbox sits in a 2.75rem label, so the whole cell is its tap area.

### 9.2 Toolbar, states, pagination

- **Toolbar** above the list, 1rem below the page heading and 1rem above the header row: `CwaUiSearchField` (filled, flexible width, search glyph, clear button), `CwaUiFilterToggle`s for the list's types (today's admin pattern: the page list has **Static**, blue, and **Dynamic**, yellow). Each is a square filled button, `--spacing-control` tall, padding 0 0.875rem 0 0.75rem, `text-label`: off = `field` fill with a 0.625rem dot in the type's colour before the name (`field-hover` on hover); on = filled in the type's colour (`aria-pressed="true"`), with its on-colour text (white on blue, stone-900 on yellow) and a solid check in place of the dot. None on shows every type; each on narrows to those types. Every list that filters by type uses the same toggles and colours its row dots to match (a status filter, if a list needs one, uses the same toggle with its tone's colour). Then a sort `CwaUiSelect width="sm"`, and the count ("143 pages") at the end. Below `md`: the search field takes the full width, and the toggles and the sort share one horizontally scrolling row with edge fades; the count is dropped.
- **States:** `CwaUiListState` for loading (below) and empty (a short sentence plus the primary action; centred, 3rem block padding). **Error** is a `danger` `CwaUiAlert` with Retry above the previous rows, which stay visible and dimmed, and the copy says how old they are.
- **Loading** (v6): skeleton rows at the real row height (two bars for the title and second line, one for the end column; on a phone the end column is the ⋮'s width). One soft band (`shimmer`, a 100° linear gradient, 50vw wide, `background-attachment: fixed` so every row and the search skeleton sweep in step; Safari on iOS ignores `fixed` and sweeps each bar on its own) moves left to right every **1.4 s**, linear, on every skeleton bar. Measured in the mockup: the band's brightest point moved from x 161 to 411 in 230 ms; peak 245 over a 211 bar in light, 121 over 83 in dark.
  - **Normal motion:** the shimmer is the only sign. After about **5 s**, a spinner and "Still loading…" appear above the rows.
  - **Reduced motion:** no band. A spinner (the one animation kept) and "Loading pages…" sit above the rows from the start, becoming "Still loading…" after about 5 s.
  - **Screen readers:** the list has `aria-busy="true"` until it loads, and the surface's region says "Loading pages" once, politely; the skeleton rows are `aria-hidden`.
  - The same rule applies to search's first load (§5.3) and every other skeleton.
- **Create** is "+ Page" (accessible name "Create page") in the toolbar and the empty state.
- **Pagination** below the list, 1.5rem above: "1–20 of 143" on the left, `CwaUiPagination` on the right (square 2.75rem buttons with 1rem chevrons, current page `accent` fill). Below `sm`: Previous · "Page 2 of 8" · Next.

---

### 9.3 Page status comes from routes

Pages are not publishable, so a page's status in a list is its route's, never "Draft":

| Status | When | Badge |
|---|---|---|
| Live | its route is live | `success` dot + "Live" |
| Scheduled · 20 Nov | its route's own `liveAt` is in the future | `accent` clock + "Scheduled · 20 Nov" |
| Not live | its route has no go-live | neutral dot + "Not live" |
| Held back by parent | `isRouteGatedByAncestor`, from the routes of the pages on screen, read in one request: `GET /_/routes?pages[]=…&perPage=100` (api-components-bundle#588, bundle 2.0.0-alpha.42) | `warning` dot + "Held back by parent" |
| No route | no route (private unless a routed child makes it public) | neutral dot + "No route" |
| Template · 14 pages | a dynamic page (template): how many page data resources use it, from `_metadata.pageDataCount` (api-components-bundle#587: admin-only, template pages only, 0 when unused → "Template · unused"); "Template" with no count until it ships | neutral; a hollow square on a phone |

The second line is the route's path, or for a template "Template for blog articles". Below `md` the status (dot and word) comes first on the second line.

---

## 10. Feedback

- **Toasts** (`useCwaToast()`; consumer: apps' admin pages such as dons-hub's `useFlash`): square, 22rem wide (full width minus 1rem gutters on phones), `--spacing-popover`, a solid tone glyph, title, description and actions. Top-right below the admin header; on phones at the top, full width minus 0.5rem gutters, below the admin header, so they never cover the manager bar or its primary action. **While a full-screen dialog is open on a phone**, the stack starts below the dialog's header and tab strip (about 6.5rem; the dialog sets a class on `body`), so a toast never covers its title, close button or tabs (v6). `useCwaToast` is a small stub in the entry that queues calls and loads the toaster on first use, as the Mercure client does (§12). Upsert by `id`: an upsert whose tone, title, description and actions are unchanged neither rebuilds the toast nor announces it again (a toast is announced only when it first appears or its text changes); at most 3 visible; success and info 4 s, warning 6 s, errors and any toast with actions stay until dismissed. Never toasted: routine saves, an error on a mounted field, "Copied".
- **Toast actions are the kit's small buttons** (`CwaUiButton size="sm"`, 2rem): the primary one solid (Show me leads, because it opens the full context), the rest soft, never underlined text links, so a toast's decision looks like the same decision in a popover. **After an action** focus goes somewhere defined: Retry to the bar status (which shows Saving…), Reset to the editor or the field, Show me to the bar status; dismissing returns focus to where it was before it entered the toast.
- **Error copy:** raw `hydra:description` is never shown. Network: "You're offline. This wasn't saved." Server: "The server couldn't save this." Violation: the violation's own message. Precondition without real-time: "Someone else saved this first. Reload to see their version." No automatic resend when the connection returns. A failed save offers Retry and Reset (Retry all and Reset all in a toast for several), never Undo; Undo is only for something that happened and can be reversed.
- **The toast region** has no background, padding, shadow or blur of its own and has `pointer-events: none`; each toast has `pointer-events: auto`, so the empty space between and around toasts never blocks the page (checked over a photo: the region is invisible). **Toasts never change position**: always top-right below the admin header, at the top on phones. **Focus is never entirely hidden behind them** (WCAG 2.4.11 AA fails only when the focused element is entirely hidden): when the focused element is entirely covered by the stack, the stack turns see-through in place (15% opacity, `pointer-events: none`) while focus stays there, and returns when focus moves away. A partly covered element is left as it is. The change is a 120 ms opacity fade, instant under reduced motion.
- **`CwaUiAlert`** (modals and pages only): square, solid glyph, title, description, actions. Info is the `field` tint; **warning and danger are the tone mixed 10% over `surface` with a 3px tone start edge** (v6), so an alert never looks like a field, and the conflict notice (§8.2) and the Routes tab's notes use the same surface.
- **Loading:** spinner, progress and the skeleton shimmer (§9.2) only. Every literal "Loading..." goes; the words a loading state does show are "Loading pages…" and "Still loading…", by the rules in §9.2.

### 10.1 Toast style: B, tinted frosted (decided)

**One renderer.** Every toast comes from one function (`useCwaToast()`; `toastEl` in the mockup) with one set of classes, in one region with one stacking and timing. Samples on `/kit` are rendered by the same function into a container carrying the same style class, never hand-written markup.

**The kit's toasts use option B** (Daniel's choice): the menu surface mixed 12% toward the tone (`color-mix(in srgb, var(--tone) 12%, var(--surface-menu))`) at 85% opacity, with `backdrop-filter: blur(16px) saturate(1.5)`, the solid tone glyph and a 3px tone start edge; text in `fg`, actions as small kit buttons. Where `backdrop-filter` is unsupported, or under `prefers-reduced-transparency: reduce`, the tinted surface is solid. **Worst-case text contrast over a busy photo: 6.73:1** (dark theme over white); glyphs 3.02:1.

Options A (frosted) and C (solid tone) were compared in v5 and are no longer shown; B is decided.

---

## 11. Accessibility and tests

The kit targets **WCAG 2.2 AA**.

### 11.1 Rules

- **Contrast** (1.4.3, 1.4.11): text 4.5:1; focus rings, glyphs, state tints and control boundaries 3:1, measured against the fill each sits on (§2.1). Fields meet 1.4.11 through their visible label.
- **Use of colour** (1.4.1): every state has a shape or words as well as a colour (glyphs, the phone status; a bar control's status line is colour, so its state is also in the pinned status, the tab badge's shape, the popover's title and the control's description, §4.2). **Decided: no dashes.** Error and conflict stay solid lines, told apart by colour plus those text cues, the Static/Dynamic marker is a circle and a square, and links in text are underlined.
- **Target size** (2.5.8): every target is at least 24px (`--spacing-target`), or has 24px of space around it; 2.75rem on coarse pointers.
- **Focus not obscured** (2.4.11): scroll padding for the admin header and the bar (§2.6); a toast stack that entirely covers the focused element turns see-through in place, and never moves (§10); popovers never cover the field that opened them.
- **Dragging** (2.5.7): every drag has a single-pointer alternative. Reordering has the Order tab's number and Move; resizing has none in the kit.
- **Accessible authentication** (3.3.8): sign-in allows paste and password managers (`autocomplete="username"` and `current-password`), has no cognitive test, and a reset link instead of a puzzle.
- **Redundant entry** (3.3.7): a form never asks again for what the editor already gave in the same process (the add page data form takes defaults from its link, #390; Create keeps everything typed when it fails).
- **Consistent help** (3.2.6): the ⓘ always sits straight after the label, and the admin's help link is in the same place on every admin page.
- **Content on hover or focus** (1.4.13): popovers are dismissible (Escape, with focus left where it was), hoverable and persistent until dismissed. The only popovers that open on hover or focus are a bar control's error, conflict and Undo popovers (§4.4): at once on focus, after 300 ms of hover; they do not take focus, do not cover the control, sit after the control in the reading order, and reopen on the next focus or hover.
- **Pause, stop, hide** (2.2.2): decided, no change. The saving motion runs for as long as an episode lasts (§7.1); reduced motion stills it.
- **Status messages** (4.1.3): §11.2.
- **Keyboard** (2.1.1, 2.4.3): every control works by keyboard, including scrolling the bar row and tab strip (focusable scroll regions), the tree (§5.4), the menus (§5.3) and the split button. Modals and confirms trap focus and return it on close.
- **Reflow** (1.4.10): everything works at 320px wide with no horizontal page scroll, and at 200% zoom.
- **Headings and landmarks**: real headings in order (§2.3); landmarks named uniquely.

### 11.2 Announcements

Fast typing must never produce a stream of speech.

- **One region per surface.** The bar, a modal and a page each have a single polite live region, never one per field. Toasts use the same region. The bar's belongs to `ResourceManager` (announced by `BarSummary`), never to a tab, which unmounts when another is chosen (§7).
- **No speech while typing.** Nothing is announced while a field is pending or debouncing.
- **"Saving…" only when it's slow:** announced only when a save takes longer than about 1 second; otherwise only the outcome is.
- **Outcomes are combined.** Outcomes within about 1 second are merged into one message ("3 fields saved", "Title wasn't saved. 2 fields saved"), and the newest message replaces one still waiting rather than queueing behind it.
- **Errors** are announced once, politely, never `assertive`; after that `aria-invalid` and `aria-describedby` carry them (in the bar, the hidden description that also says "Retry and Reset follow"; an in-page editor's own hidden description, §7.1; in modals and pages, the error line). A failed save the editor isn't focused on says which field. A modal's conflict alert is announced once.
- **Search** announces the result count after the search settles, never per keystroke (§5.3).
- **The admin header's status is not a live region** (§7.2): the bar's region owns a selected component's outcomes, the page's region everything after deselecting.
- **Toasts** are announced when they appear or their text changes, never on an unchanged upsert.

### 11.3 Checklist per component

| Component | Checks |
|---|---|
| `CwaUiButton`, split button | name from its text, or an `aria-label` that contains the visible text ("+ Page" → "Create page"); ⋮ named "More actions", `aria-haspopup="menu"`, `aria-expanded`; 24px minimum; focus ring; disabled is `aria-disabled` with the reason reachable |
| `CwaUiInput`, `CwaUiNumber`, `CwaUiTextarea` | visible label linked; helper and error via `aria-describedby`; `aria-invalid`; steppers are `role="spinbutton"` with min, max, now and value text, their buttons named and `aria-disabled` at the ends with the reason; the snap is announced once; value text 1rem on touch; no clipped text |
| `CwaUiToggle` | `role="switch"`, the whole row is the target (≥ 24px); the label never changes with state |
| `CwaUiSegmented` | `role="group"` with a name; `aria-pressed`; selected shown by fill and weight |
| `CwaUiSelect` | select-only combobox (`role="combobox"`, `aria-expanded`, `aria-activedescendant`), its name includes the visible label; options `role="option"` with `aria-selected`; disabled reasons as text |
| `CwaUiMultiSelect` | combobox with chips as buttons named "Remove Dark"; removal undoable and announced |
| `CwaUiResourceSearch` | combobox; focus stays in the input; count announced after settling; Retry, Show more, Create reachable by arrow keys |
| `CwaUiDatePicker` | trigger named with its value ("Go live date, 18 Nov 2026, 09:00"); calendar is a dialog with named days; time zone stated |
| `CwaUiTree` | treegrid keyboard (§5.4); actions named per row; a direction arrow is hidden and read as "redirects to" |
| Navigation row, sub-view (`CwaUiSubView`) | a `button` named by label and summary; the sub-view is a region named by its title, which takes focus (or the consumer's `initialFocus`); the hidden main view is `inert`; focus returns to the opener |
| File group, segmented, either/or | the wrapper is `role="group"` named by the field label; its status message is linked from the group with `aria-describedby`, read when focus enters by any button; no `aria-invalid` on buttons |
| Toggle in the bar | the status slot and its message sit outside the `<label>`; the switch's accessible name is exactly its label in every state |
| Resource stack | a `tree` of `treeitem`s named by display name alone, stable `aria-level`; Up/Down follow the screen, Left parent, Right child; Tab and Escape close and return focus; the overflow is a button outside the nesting; the phone sheet is a modal `dialog` with a reachable Close |
| Add component list | sections are labelled groups; an option is named by its name and described by its description, count and section; Add is `aria-disabled` with its reason, never natively disabled |
| Skeleton | `aria-busy` on the list; skeletons `aria-hidden`; one "Loading pages" |
| `CwaUiDialog` | `role="dialog"`, `aria-modal`, named by its title; focus trapped and returned; Escape asks when dirty |
| `CwaUiConfirm` | `role="alertdialog"`, title and text linked, focus on the safe action; the text never changes once open; the typed tier (§8.6): a labelled field naming what to type, which takes focus, `aria-invalid="true"` (never empty) when it can no longer match, a polite announcement when it matches and when it stops, the danger button `aria-disabled` with its reason until it matches, Enter submits once it matches |
| Popover (info, status, error) | named; Escape and outside click close; stays open on hover; never moves layout |
| Toast | announced through the surface's region, once per appearance or change of text; dismiss button named; actions are kit buttons, and focus after an action goes to a defined place (§10); never moves; turns see-through (15%, no pointer events) while it entirely covers the focused element; errors persist |
| `CwaUiAlert` | announced once on appearing; links go to fields and tabs |
| List | table semantics or a grid with named columns; row title is a link (≥ 24px); checkboxes labelled per row; status in text |
| Manager bar | tab strip with `role="tablist"`; row is a focusable scroll region when it overflows; status button named with the full status |
| Conflict notice | `role="group"` named by its heading, linked to its field; values as text; buttons wrap and never clip |
| Bar status line (`FieldStatus`) | no glyph or button inside the control; error: `aria-invalid` and `aria-describedby` to the hidden description ("… Retry and Reset follow."); conflict: `aria-describedby`; the popover opens on focus without moving focus (on hover after 300 ms) and sits after the control in the DOM; Tab from the control's last part enters it, Shift+Tab from its first action returns to that part, Tab from its last action reaches the next control and closes it, Escape closes it with focus back on the part that had it; × is pointer-only; saving sets `aria-busy`; each line 3:1 against its resting and hover fill. **Keyboard test per composite** (stepper, date picker, MultiSelect, segmented, either/or): in the error state, Tab reaches every part of the control, then Retry, then Reset, then the next control |
| Admin header status | one persistent span and button, not a live region; the button named by its text; focus moves to the header's first control if the button hides while focused |
| In-page editor | `aria-invalid="true"` and a hidden description while its save has failed; Escape moves to the bar status and opens it |

### 11.4 Tests

- **axe** runs in Vitest (per component, `vitest-axe` on the mounted kit component in each state) and in the browser tests (on `/kit`, §12, and on each scenario's admin screens), at WCAG 2.2 AA. The mockup passes axe-core 4.14 (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`, best practice) at 1280 and 390 in light and dark.
- **Screen readers** (decided in v6): **axe and keyboard tests run on every PR**. A **manual VoiceOver (macOS and iOS), NVDA (Windows) and Voice Control (macOS) pass** (the typed confirm by voice included) happens once for each new component, in the PR that adds it, following its checklist rows (§11.3), and again over the whole kit before each release.
- **Browser scenarios:** the bar's height and the page's scroll are unchanged across every tab and state at 1280, 1024, 768 and 390px wide, and the status and primary action are in the tab row on every tab; a modal sends nothing until Save, Save sends only changed fields in one request, a 422 badges and opens the failing tab, a 412 shows a notice under each conflicting field and the next Save carries the new version, and Create disables Routes and hides Info; a route sub-view replaces the footer only while its form is open, keeps the tab strip, asks before discarding typed input on Back, Escape or another tab, returns focus to its opener and leaves the main view `inert`; route saves send their own request without a confirm and are never part of Save; a stepper never saves an out-of-range value and snaps on blur; a loading list shows only the shimmer for 5 s under normal motion and the spinner with "Loading pages…" at once under reduced motion; only one element shows hover when the pointer is on a stepper button or a chip's ×; a textarea grows to 8 lines and then scrolls; a 10-field row scrolls and never wraps; a Select, MultiSelect and ResourceSearch open, filter and select by keyboard and by touch, and a search cancels its request on close; the either/or group clears the other field in one request; an error's or conflict's popover opens on focus at once and on hover only after 300 ms; in the error state Tab goes through a stepper's −, input and + and a segmented control's segments, then Retry and Reset, then the next control, Shift+Tab comes back the same way, and Escape closes the popover with focus on the part that had it; a toast's actions leave focus on a defined element, never `<body>`; the admin header's button hands focus to the header's first control when it hides; the in-page error toast goes once a later save succeeds (fail, deselect, reselect, type); a bar control's outer box, value position and end icon position are identical in idle, saving, saved, error and conflict (text input, stepper, select, date picker, toggle, segmented); an ⓘ popover moves nothing (0px); a bar field's outer box is identical in every state; Cancel, Escape, the backdrop and a navigation ask only when the local copy is dirty; no control's value is clipped vertically; no text in a conflict notice overflows (`scrollWidth ≤ clientWidth`) at 1280, 390 and 320; read-only values are within 1px of their neighbours' value line; the desktop split button has equal space above, below and to its right; the phone status meets the split button (0px) and the split button meets the window's edge (0px); ⋮ opens its menu by click, Enter, Space and ArrowDown, and ⋮ alone shows for a live component and a group; every target is at least 24px; under reduced motion only the spinners animate (the shimmer stops); a list aligns its columns at 1280 and collapses at 390; one run at 200% zoom and one at 320px.
- **Vitest per control:** states and `:model` wiring with real `computed` refs (#260); the store's `fieldStates` survive a re-fetch; the announcer merges outcomes and stays silent while pending.

---

## 12. Phased plan

Rewritten in v6. Each step is one PR into `dev` under an issue linked from #236, running `test`, `test:types`, `lint`, `build` and `test:e2e`, with its own `CHANGELOG.md` line. **Every PR states its bundle change** against the two budgets the e2e guards measure (`entry-bundle-markers.mjs` for the entry, `visitor-page-preloads.mjs` for an anonymous page's preloads) and whether it adds a reka-ui consumer: a second consumer split reka-ui's popover into a chunk named in the entry's `__vite__mapDeps` (CLAUDE.md, ~12 B), so each new one is measured. Kit code is admin-only and lazy (§1, R9): visitors should see **0 B** from every row except where marked.

Editors see something in the second PR, then a whole vertical slice, before the long middle.

| # | PR | Contents | Editors see | Entry / visitor budget | New reka-ui consumer |
|---|---|---|---|---|---|
| 1 | Tokens and `/kit` | §2 tokens with the contrast spec, radius 0, the `button` and `shimmer` tokens, `CwaUiButton`, `CwaUiSpinner`, `CwaUiBadge`, and the `/kit` page (below) | nothing yet (admin colours shift slightly) | tokens are CSS in the compiled `cwa.css`; JS 0 B | no |
| 2 | Toasts | `useCwaToast` as an entry stub (a queue and a lazy `import()` of the toaster), `Toaster`, the phone dialog anchor (§10); `RequestErrors` and `Notification` switched to it | the new toasts | entry: the stub, ~150 B gzip, raised and stated; visitor 0 B | no |
| 3 | Field state | `fieldStates` in the resources store, written from a lazy admin module; `updateResource` keeps its return (§8.4); `state`, `retry`, `reset` on the model with the `states`/`resetValue` aliases (§4.1, `DEPRECATIONS.md`); **one request in flight per model** with a queued newest value, the follow-up sent to the returned IRI, the pending-update flush waiting for it and `submit()` bypassing it, with its own tests (§4.1); `useItemPage` keeps local edits through a re-fetch and reports per-field 422s and 412s | nothing visible; errors no longer clear each other | the store's getters only, measured; visitor 0 B | no |
| 4 | Vertical slice: the bar | `Field`, `FieldStatus`, info popover, Input, Toggle, Select, Number (with the range rules), `CwaUiManagerTab` with `field="…"` and `cwaTabMetaOnly` (§3), `BarSummary` owning the live region (§7), the split button with `CwaUiMenu` (element-anchored); the module's Publish and Order tabs ported | the new bar on two tabs | 0 B | yes: Popover, Select, NumberField (first consumer) |
| 5 | Bar controls | ResourceSearch (with the shimmer), MultiSelect, Segmented, `useCwaResourceFieldGroup` with EitherOr and LinkInput (§6), FileUpload, DayPicker, DatePicker moved over | every bar control | 0 B | Combobox |
| 6a | Dialog and Save | `CwaUiDialog` with tabs, FormSection, the Save model (§8.2), Alert, Confirm (`useCwaConfirm`, §8.5), Textarea; the page modal's Details and Info tabs | the new page modal | 0 B | AlertDialog, Dialog |
| 6a+ | Add component | `CwaUiCombobox` (inline-open), the add component dialog (§5.6), the `icon`, `group` and `image` config keys and the `preview.webp` scan in `module.ts`; **the icons are built here**, as the generated admin-only template `cwa-admin-resources.ts` holding only the Lucide SVGs and skeletons in use (adds `@iconify-json/lucide` to `dependencies`, read at build time; its marker joins `entry-bundle-markers.mjs`) | the new add dialog | 0 B (the dialog, its icons and its config keys are lazy admin code) | no (Combobox from 5) |
| 6b | Routes | `CwaUiTree`, the Routes tab with its navigation rows and sub-views (§8.3) | the new Routes tab | 0 B | no |
| 6c | Lists | list grid, SearchField, FilterToggle, Pagination, ListState with the shimmer (§9) | the new lists | 0 B | no |
| 6d | Auth and admin pages | FormGroup, the sign-in and reset pages, site settings | the new admin pages | 0 B | no |
| 6e | Module tabs and the root warning | the remaining module tabs on `CwaUiManagerTab`, then the development warning for any other tab root switched on (§3) | — | 0 B | no |
| 7 | In-page editing | InlineEdit, InlineHandoff, EditPlaceholder, LinkPopover, ImageAlt, ImageSlots, DayRangePicker; **`CwaUiResourceStack`** for the right-click menu (with the long press) and the header's path selector, replacing `utils/ContextMenu.vue` and `ResourceContextItem`; `ClonePlacementMenu` moved onto `CwaUiMenu` | in-page editing, the new right-click and path selector | 0 B (lazy admin chunk) | Popover (the stack), DropdownMenu |
| 8 | Site migration | the template's tabs, then CK, with migration notes and the docs repo `documentation` issue | everything, on real sites | 0 B | no |
| 9 | Removals | in **one late PR**, once the sites run on the kit: `Modal*`, `DialogBox`, Headless UI, `popper.ts`, the `states`/`resetValue` aliases | — | entry and visitor budgets **lowered** to the new sizes | no |

The v1 migration map (`04-proposal.md` §9) still applies, with two changes: `variant: 'outline'` becomes `'soft'`, and `hint` becomes `info`/`description`. Round 6 adds: **`utils/ContextMenu.vue`** (Popper, its own glass styles) and **`_common/ResourceContextItem.vue`** (the nested legacy dashed boxes) are replaced by `CwaUiResourceStack`, which keeps the nesting; `CwaResourceManagerContextMenu` and `header/_parts/PathSelector.vue` keep only the stack mapping and open it at the pointer and over the selector. `ClonePlacementMenu` moves onto `CwaUiMenu` as well, keeping its notes line and ⓘ reasons. **`AddComponentDialog.vue`'s list** (the button column and the description pane) is replaced by `CwaUiCombobox` inline-open in a `CwaUiDialog`; `findAvailableComponents`, the dynamic-position selects' options and `canInsertSelection` stay as they are.

**The kit reference page** (`playground/app/pages/kit.vue`, at `/kit`, with `definePageMeta({ cwa: { disabled: true } })` so the catch-all page and its route fetch never run there): it renders the real kit components with fake models fixed in every state (idle, pending, saving, saved, error, conflict, presence, disabled, read-only), at bar, modal and touch sizes, with menus and popovers open, a light/dark switch, a reduced-motion switch and the token list with measured contrast. The fake models come from **`fakeFieldModel(value, state)`** (`playground/app/kit/fake-field-model.ts`), which returns a `ResourceModelField` (§4.1) with real refs and a real `computed` `state`, and `retry`/`reset` that move the state as the store would; nothing touches the API or the store. It is not published (the package ships only `dist` and `bin`); designers run it with `pnpm run dev:http`, and there is no CI deploy. **Each kit PR adds its section.** The browser tests open `/kit` and run axe and this round's measurements: no vertical clipping, optical centring within 1px, fixed outer widths across states, read-only alignment, the split button's spacing and the phone status gap.

---

## 13. Decisions

No questions are open.

Settled in v6: **"Held back by parent" in lists** comes from the routes of the pages on screen, read in one request, `GET /_/routes?pages[]=…&perPage=100` (api-components-bundle#588, released in bundle 2.0.0-alpha.42), whose `_metadata.effectiveLiveAt` decides it (§9.3); the palette additions (red-300, yellow-700, stone-300) are approved; the tree is an ARIA treegrid; route edits use the sub-view (§8.3), not a second Save in the tab or a dialog on top; buttons have their own fill; ⋮ is the only "more" glyph; `updateResource` keeps its return (§8.4); the screen-reader pass runs once per new component and before each release (§11.4); a template's count waits for api-components-bundle#587 (§9.3).

Settled in v5: toasts use option B, tinted frosted (§10.1); page data field configuration belongs to the separate configuration job; `field="…"` is in, with `CwaUiManagerTab` as the tab root (§1); the model names in §8.4 stand; phones get bottom-sheet menus (§5.3); the round 4 palette is approved, and the fills are darkened, with 1.4.11 met by the visible label (§2.1); the split button's trigger is ⋮ as today.

Decided in v4: admin pages use the modal Save model (§8.2); Cancel, close and leaving ask before discarding unsaved changes, and the tab's close uses `beforeunload` (§8.5); on touch every control's value is 1rem (§2.3).

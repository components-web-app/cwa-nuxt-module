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
- **⋮ is the only "more" glyph**: the bar, list rows, the tree and the modal header (§5.1, §5.3, §5.4, §9.1).
- **`updateResource` keeps its return** (§8.4): the saved resource or `undefined`. Per-field outcomes go into `fieldStates` keyed by `(iri, field)`, so one field's success never clears another's error.
- **Spec precision** for developers: the model's shape and the migration from today's `states` (§4.1); what `field="…"` binds to under each provider and "exactly one of `field`, `:model`, `v-model`" (§3); off-screen tab renders resolve metadata only (§3); one either/or API with a group model sending one PATCH (§6); a typed catalogue for every public component (§5.5); the bar owns the live region (§7, §11.2); the `/kit` fake model (§12).
- **§12 is rewritten**: editors see something in the second PR, phase 6 is split into 6a to 6d, each PR states its entry and visitor bundle budget and whether it adds a reka-ui consumer, the root warning is switched on when the tabs migrate, and removals land in one late PR.
- **Screen readers** (§11.4): a manual VoiceOver and NVDA pass once per new component and before each release; axe and keyboard tests on every PR.
- **Design fixes** (§8.2, §9.1, §10): "Unsaved" is `fg-muted` with an `accent-fg` dot; the conflict diff is tint and weight only, and none when most words differ; warning and danger alerts are a 10% tint over `surface` with a 3px edge; tree delete icons are muted until hover; phone list rows start their status glyph in one slot, Scheduled has a clock, a template a hollow square, and a date says what it is ("edited 15 Nov"); the phone status for New is a dashed ring; phone toasts sit below a full-screen dialog's header and tabs.

What changed in v5 (Daniel's review of v4):
- **WCAG 2.2 AA pass** (§11): darker field fills, 24px minimum targets everywhere and 2.75rem on touch, focus never hidden (scroll padding for the bar and admin header; a toast stack that entirely covers the focused element turns see-through in place), a single-pointer alternative to every drag, accessible sign-in, one quiet live region per surface with fixed announcement rules (§11.2), shapes as well as colours for every state (the Dynamic type is a square), and an accessibility checklist per component (§11.3). axe runs in Vitest and the browser tests, and a manual VoiceOver and NVDA pass happens before each kit PR merges.
- **Contrast fixes** (§2.1): dark field `#57534e`, light field `#d6d3d1`, chip `#6e6964` / `#b8b2ad`, dark error text red-300, light Dynamic yellow-700, light toggle-off stone-500, and new `tree-line` and `muted-on-field` tokens. Every pair is measured in §2.1.
- **Section headings read as headings** (§2.3, §2.4): 1.125rem / 650 in `fg`, with 2rem above, a 1px `line` rule and 2rem more before each section after the first, and 1rem to the first field. Modal title, section heading and field label are three distinct levels, as real `h2`/`h3` headings.
- **`CwaUiManagerTab` is each tab's single root** (§1, §3), with `field="…"` on kit inputs and a development warning for any other root.
- **The page modal's Routes tab is rebuilt with the kit** (§8.3): status from the route (Live, Scheduled, Not live, Held back by parent, No route), the recommended path inline with "Use this", the go-live control, Forward to, Add redirect and child routes. **Route actions save at once**, each after its own confirm and with its own saving state; the modal's Save is only for the page's fields.
- **A tree component** (`CwaUiTree`, §5.4): connector lines, expand and collapse, the ARIA treegrid keyboard pattern and row actions with 2.5rem hit areas. Used by the Routes tab and the routes list.
- **Search asks the API** (§5.3): 250 ms debounce, a request-id guard, cancel on close, and the states first load, searching, slow, many results, no matches, offline, server error and a chosen value outside the results.
- **A page's status in lists comes from its routes** (§9.3): Live, Scheduled · 20 Nov, Not live, Held back by parent, No route; a template says "Template · 14 articles". Pages have no "Draft". Row actions are **Edit settings** (also the row click) and **Go to page**.
- **Conflicts in modals are a notice under the field** (§8.2): the field keeps its normal look with the conflict tint; below it, a warning-edged notice with "Mia changed this while you were editing.", both versions as read-only quoted text with the difference highlighted, and **Use Mia's** / **Keep mine**. A modal alert counts them and Save says why it is blocked. The bar's conflict popover shows the values the same way.
- **Every ⓘ opens a popover** (§4.5) that never moves the layout. Errors under a modal field stay inline.
- **Create buttons read "+ Page", "+ Article"** (accessible names "Create page", "Create article"). A new component's main action is **"+ Draft"** ("Add draft") when publishable, **"+ Add"** otherwise.
- **The split button's trigger is ⋮** (vertical dots, "More actions"), matching today's `CwaUiFormButton`, and it can stand alone: a live component or a selected group shows only ⋮ (§5.1).
- **Bar spacing** (§7): on a desktop the split button has 4px above, below and to its right; on a phone the status is a glyph only, right against the action with no gap, with a distinct shape per state and its name read out.
- **Read-only values sit on the same line as their neighbours' values** at bar, modal and touch sizes.
- **Toasts are tinted frosted glass** (option B, Daniel's choice from three, §10.1); the toast region has no background, padding, shadow or blur of its own and lets clicks through; toasts never move, and turn see-through while they entirely cover the focused element.
- **A kit reference page**, `/kit` in the playground (§12), is phase 1.

What changed in v4 (Daniel's review of v3):
- **No reserved status slot.** Controls with an end icon (select and multi-select chevrons, the date picker's calendar, resource search) show a state in that icon's place while it lasts: the chevron becomes the spinner while saving, the tick once saved, then the chevron again; error and conflict show their solid glyph there, still a button. Plain text inputs and steppers in the bar widen their end padding only while a state shows; the outer size never changes. Modal and page fields show no glyph inside at all (§4.2).
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
- **Only the innermost control under the pointer shows hover** (§2.7). The stepper buttons, a chip's ×, clear buttons and status glyph buttons have their own hover and pressed shades (`step-hover`, `step-press`).
- **Textareas grow with their text** up to 8 lines and then scroll, with no resize handle (§5.2).
- **Lists filter by type with square coloured toggles** and a matching dot per row; per-row thumbnails are gone (§9).
- **A failed save offers Retry and Reset**, never Undo. Undo is kept for things that happened and can be reversed (removing a chip, a successful either/or switch).
- **A sliding tab indicator and a short motion spec** (§2.8).

What changed in v2 (from v1):
- **Fields are filled, not bordered.** Borders and rings are used only for focus and for another editor's presence.
- **Every box is square.** The only rounded thing is the toggle switch.
- **Status glyphs are solid** shapes, legible at 1rem.
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
2. **State lives at the field, without reserved space.** No field keeps empty room for a glyph that is usually absent. In the bar a state replaces the control's end icon, or sits in end padding that widens only while it shows; the field's outer size never changes, so nothing around it moves. In modals and pages a field's state is shown by its label ("● Unsaved") and the line below it, never inside the field.
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
| `step-hover` | hover on a control nested in a field (stepper −/+, chip ×, clear ×, status glyph button), laid over whatever fill the field has, tinted ones included | white 17% | stone-900 16% |
| `step-press` | the same controls while pressed | white 30% | stone-900 30% |
| `type-static` | Static page type: row dot, filter toggle swatch (the pressed toggle fills blue-600 with white text) | blue-400 † | blue-600 |
| `type-dynamic` | Dynamic page type: a **square** row marker and filter swatch (Static is a circle, so the type never depends on colour, WCAG 1.4.1); the pressed toggle fills yellow-400 with stone-900 text | yellow-400 † `#facc15` | yellow-700 † `#a16207` (4.92:1) |
| `line` | **dividers only** | stone-700 | stone-300 |
| `fg` | text, values | stone-100 `#f5f5f4` | stone-900 |
| `fg-muted` | labels in the bar, helper text | stone-400 on `surface` (6.9:1); `muted-on-field` on a fill | stone-600 `#57534e` on `surface`; `muted-on-field` on a fill |
| `accent` | primary button fill, selected tab, toggle on | blue-600 `#2563eb` (fill only) | blue-600 |
| `accent-fg` | **focus ring**, links, accent text | blue-400 † `#60a5fa` (6.9:1) | blue-700 † `#1d4ed8` (6.7:1) |
| `success` | saved glyph | green `#9cdd05` (6.2:1 on `field`) | lime-800 † `#3f6212` (5.6:1) |
| `warning` | conflict, long-wait glyph | orange `#ffaa00` (3.3:1 on `field-warning`) | amber-700 † `#b45309` (3.11:1) |
| `danger` | error glyph | red-300 † `#fca5a5` (3.74:1 on `field-danger`) | red-700 † `#b91c1c` (3.75:1 on `field-danger`) |
| `danger-fill` | destructive button fill | red-600 `#dc2626` | red-700 |
| `danger-fg` | **error text** | red-300 † (8.6:1 on `surface`) | red-700 † (6.5:1) |
| `highlight` | reorder, clone, selection | magenta `#e30a6c` | magenta |

Rules:
- **Fields have no border.** The fill identifies the field, and an always-visible label names it. The fill is 2.29:1 against `surface` in dark and 1.49:1 in light: WCAG 1.4.11 is met by the visible label, which identifies the control, not by the fill. A 3:1 fill would be a mid grey that fights the values.
- **Measured pairs** (v5): `fg` on `field` 6.99:1 (dark); the pending dot 3.00:1; focus ring `accent-fg` on `surface` 6.9:1 (dark), 6.7:1 (light); every glyph and state tint at least 3:1 against the fill it sits on; all text at least 4.5:1.
- `accent` is never text or a thin line. A selected option or toggle on `surface-raised` also gets an `fg` glyph.
- Text targets 4.5:1 and glyphs 3:1, against the fill they sit on (tinted fills included). PR 1 keeps the table in a spec.
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
| `text-section` | 1.125rem / 650, `fg`, line-height 1.5rem | form section headings in modals and admin pages |
| `text-title` | 1.375rem / 650, line-height 1.75rem | modal titles, admin page headings |
| `text-confirm` | 1.0625rem / 650 | a confirm's title (not a heading) |

**Three levels in a modal or admin page:** the title (`h2`, `text-title`), section headings (`h3`, `text-section`, `fg`), field labels (`text-label`, 0.875rem / 500). Helper text is 0.8125rem. Headings are real headings in order, sentence case, never all-caps. A page's heading level follows where it sits (an admin page's title is its `h1`, sections `h2`).

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
| `--spacing-status` (status glyph, bar only; no space is reserved for it) | 1rem glyph, 2rem hit area | 1rem glyph, 2.75rem hit area |
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

- A nested control (a stepper's −/+, a chip's ×, a search field's clear ×, the status glyph button in the bar, an inline ⓘ) shows its own `step-hover`, and `step-press` while pressed. These are translucent, so they read on any fill.
- While the pointer is on one, the field's own hover is suppressed: `.f:has(.nb:hover, .chip-x:hover, .in-btn:hover, .st-btn:hover)` keeps the field at its resting fill.
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
| `bar` | `CwaUiManagerTab` | inline, left, `fg-muted` | in the ⓘ popover only | glyph button + popover (§4.4) | `control` |
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
- **Off-screen tab renders resolve metadata only.** `useDataResolver` renders every manager tab into a detached element to read its `defineExpose` metadata. That render provides `cwaTabMetaOnly`; under it, `field` creates no model, starts no request and registers no presence, so a tab costs nothing until it is shown.
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

`CwaFieldState` is read from the resources store (§8.4) in the bar; in modals and pages the field reads its state from the modal's local copy (§8.2). A control takes exactly one of `field`, `:model` or `v-model` (§3). Multi-model controls (the either/or group, FileUpload, ImageAlt) drive one status glyph in the bar from all their models.

**Shape and migration** (v6). `useCwaResourceModel` (`composables/cwa-resource-model.ts`) today returns `model`, `states` (`pendingSubmit`, `submitting`, `isBusy`, `isLongWait`), `resetValue`, `localValueWithIri`, `remoteChange`, `focus`, `blur`, `focusedBy` and `focusListeners`. The kit's model adds `state`, `retry` and `reset`, and the old names stay as aliases for one minor release, logged in `DEPRECATIONS.md`:

| Today | v6 |
|---|---|
| `states.pendingSubmit` | `state.value.status === 'pending'` |
| `states.submitting` | `state.value.status === 'saving'` |
| `states.isBusy` | `['pending', 'saving'].includes(state.value.status)` |
| `states.isLongWait` | `state.value.slow` |
| (none) | `state.value.status === 'error'`, `'conflict'`, `'saved'` |
| `resetValue()` | `reset()` |
| (none) | `retry()` |

- Kit components read only `props.model.state`, never `states`, so the aliases can go without touching the kit.
- **`state` is a `ComputedRef` nested in the returned object**, so it joins `focusedBy` and `remoteChange` on the #260 list: destructure it (`const { model, state } = useCwaResourceModel(…)`), never read `title.state` in a template.

Shared props: `label` (required; with `labelHidden` it is only the accessible name), `labelHidden`, `info`, `description`, `optional`, `placeholder`, `width`, `disabled`, `readonly`, `loading`.

### 4.2 Field shell (`core/ui/Field.vue`, internal)

- **Bar:** `Label ⓘ [ value ………… ▾ ]`. The label and ⓘ sit outside the fill. No space is reserved for a status glyph.
- **Modal and page:**
  ```
  Label · Optional ⓘ  ● Unsaved
  [ value ……………………………………… ▾ ]
  Helper text, or the error line
  ```
- The status glyph (`core/ui/FieldStatus.vue`) is its own component, reads only its field's state and owns the timers. It renders nothing in modals and pages, and nothing in the bar while the field is idle.

**Where the glyph goes in the bar (no reserved space):**

1. **Controls with an end icon** (Select and MultiSelect chevrons, the DatePicker's calendar icon, which sits at the trailing edge, ResourceSearch's chevron, an input's trailing suffix such as ↗): the state **replaces the icon in place** while it lasts. The chevron becomes the spinner while saving, the tick for 1.5 s once saved, then the chevron returns. Error and conflict show their solid glyph there, as the button that opens the popover. The end icon sits in a 1rem box (a 0.75rem chevron has 0.125rem either side), the same as the glyph, so nothing moves. While the state shows, the icon is hidden, and a click on the control's body still opens its menu. The glyph button is a sibling of the trigger button, never inside it.
2. **Plain text inputs and steppers:** the field's **inner end padding widens only while a state shows**, from `field-x` (0.75rem) to 2.25rem (the 1rem glyph and a 0.5rem gap), and the glyph sits in it. The field's outer width is fixed by its `width` token, so nothing around it moves; long text inside truncates 1.5rem earlier while the glyph shows. In a stepper the glyph sits between the value and the + button. Error and conflict also tint the whole field.
3. **Modals and pages:** no glyph inside any field. "● Unsaved" stays after the label; errors and conflicts stay on the line below (§4.4, §8.2). The error and conflict tints remain.

| State | Fill | Line | Bar glyph (modal and page: none) |
|---|---|---|---|
| default | `field` | none | none; the end icon, if any, shows |
| hover | `field-hover`; on an error or conflict field the tint darkens slightly and never reverts to grey; suppressed while the pointer is on a nested control (§2.7) | none | — |
| focus | `field` | 2px `accent-fg` ring | — |
| disabled | `field` at 50% opacity | none | — (a reason goes in `info`) |
| read-only | transparent, value in `fg` | none | copy button where useful |
| unsaved (modal, page) | `field` | none | none; the label row adds "Unsaved" in `fg-muted`, 500, after a 0.5rem `accent-fg` dot (v6: in the link colour it read as a link) |
| pending (bar) | `field` | — | solid dot, 0.625rem, `accent-fg` (never used alone as a summary without a word) |
| saving (bar, > 300 ms) | `field` | — | spinner, `aria-busy` |
| long wait (bar) | `field` | — | **solid circle with knocked-out clock hands**, `warning` |
| saved (bar) | `field` | — | **solid circle with knocked-out check**, `success`, 1.5 s, then the end icon returns |
| error | `field-danger` | none | **solid triangle with knocked-out "!"**, `danger`, a button (modal: the line below, from Save or a client check) |
| conflict | `field-warning` | none | **solid diamond with knocked-out "!"**, `warning`, a button (modal: found by Save, until a version is chosen) |
| presence | `field` | 2px inset peer-colour ring | flag on the field's top edge, portalled, fades after 3 s |

Glyphs are 1rem solid shapes with a knocked-out mark, never outline strokes. Each state differs by shape as well as colour. The swap between the end icon and a glyph is instant; the glyph itself fades or scales in (§2.8).

### 4.3 Presence

Accepted (Q8): flags are portalled into a layer at bar level that follows the row's scroll, so the bar's height is fixed. A flag is a square 0.6875rem label in the peer's colour, sitting on the field's top-left edge inside the row's top padding, so it never covers the tab strip or the selected tab's bar.

**When you focus a field another editor holds**, there is one state, not two stacked rings: your focus ring replaces the peer ring, and the flag stays up (no fade) reading "Mia is editing this too" until you leave the field.

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

**Bar: a clickable glyph, a tinted fill and a popover.**

```
Title [ Summer menu …  ▲ ]          … 1 not saved →  [Publish]   ← end padding widened for ▲
                    ┌─────────────────────────────┐
                    │ ▲ Title: not saved         × │
                    │ The server couldn't save it. │
                    │ [Retry]  [Reset]             │
                    └─────────────────────────────┘
```

- The triangle sits where the end icon was (a select's chevron) or in the widened end padding (a text input), and is a button named "Title: not saved, show details", with a 2rem (coarse 2.75rem) hit area. Click or tap opens the popover; it never opens on hover.
- The field's fill turns `field-danger`, and stays tinted on hover and while the popover is open.
- The popover is titled with the field's name and state, has a close ×, and a square caret points at the glyph.
- **Retry** sends the same value again. **Reset** puts the field back to its last saved value and clears the error; nothing is sent. The save failed, so nothing happened that could be undone, and the kit never calls this Undo.
- The pinned summary reads "1 not saved →" and the tab gets the triangle badge, so an error is visible from anywhere in the bar.
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
| `CwaUiButton` | reka `Primitive` | `tone`, `variant: 'solid' \| 'soft' \| 'ghost'`, `icon`, `iconOnly`, `label`, `loading`, `disabled`, `disabledReason`, `to`, `type`, `options` (split button, below). Square, label 600. `solid` = tone fill; `soft` = the `button` fill (v6: its own fill, lighter than a field in light and darker in dark, so an action never reads as an input; `field-hover` on hover; replaces "outline": no borders); `ghost` = no fill until hover (`button`). Height follows the surface's control token; padding-x 1rem (0.75rem with an icon). No label ends in "…": a button names its action ("Redirect to another page"), and one that opens something more says so in its words, not with an ellipsis. |
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

### 5.2 Inputs

| Component | Base | Bar | Notes |
|---|---|---|---|
| `CwaUiInput` | native | yes | `type`, `inputmode`, `nullable`, `prefix`/`suffix` slots |
| `CwaUiNumber` | reka `NumberField` | yes | `min`, `max` and the range rules below; commits on blur, Enter, step or unmount; in the bar a state glyph appears between the value and the + button only while it shows (§4.2); the −/+ buttons are the field's full height, with `step-hover` and `step-press` over the field's fill (error and conflict tints included), and the field's own hover is suppressed while the pointer is on one (§2.7) |
| `CwaUiTextarea` | native | **no** (modals and pages only) | `maxlength`, `counter`, `maxRows` (default 8). No resize handle (`resize: none`). It grows with its content (`field-sizing: content`, min 3 lines) up to `maxRows`, then scrolls inside; where `field-sizing` is unsupported a small script sets the height from `scrollHeight` on input and resize. The textarea fills the whole field box, so its text and scrollbar reach the field's edges, with `field-x` padding on both sides. It has no status glyph (modals and pages only). |
| `CwaUiToggle` | reka `Switch` | yes | the one rounded control: track 2.25 × 1.25rem, thumb 1rem; the label never changes with state |
| `CwaUiSegmented` | reka `ToggleGroup` | yes | 2–5 options, square, `field` fill, selected = `surface` fill + `fg` + 500 weight |
| `CwaUiSelect` | reka `Select` | yes | §5.3 |
| `CwaUiMultiSelect` | reka `Combobox` | yes | §5.3 |
| `CwaUiResourceSearch` | reka `Combobox` | yes | §5.3; 250 ms debounce, emits the IRI |
| `CwaUiEitherOr` | Segmented + children | yes | §6 |
| `CwaUiLinkInput` | `CwaUiEitherOr` preset | yes | §6.3 |
| `CwaUiDatePicker`, `CwaUiDayPicker`, `CwaUiDayRangePicker` | reka | yes | the calendar icon sits at the trailing edge, and a state replaces it (§4.2); calendar popover square; selected day = `accent` fill + `fg`, today = `accent-fg` underline |
| `CwaUiFileUpload`, `CwaUiImageAlt`, `CwaUiImageSlots` | native + Popover | yes | bar anatomy `[thumb] filename · 240 KB [Replace] [Remove]`, with the state glyph after Remove only while it shows (it is last in its group, so nothing moves); square thumbnail |
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
- **Action menus** (a row's ⋮, a modal's ⋮, the bar's ⋮) use the same system with `role="menu"`: an anchored menu on wide screens, a bottom sheet below `sm`.

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

interface MenuItem { label: string; value?: string; description?: string; icon?: string; tone?: 'danger'
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
CwaUiConfirm     via useCwaConfirm(): ({ title, description, keep = 'Keep editing', go, tone = 'danger', extra? }) => Promise<boolean>
CwaUiAlert       { tone: Tone; title: string }                                     slots: default, actions
CwaUiSearchField { modelValue: string; label: string }                           emits: 'update:modelValue'
CwaUiFilterToggle{ modelValue: boolean; label: string; colour: string }          emits: 'update:modelValue'
CwaUiPagination  { page: number; pages: number }                                 emits: 'update:page'
CwaUiListState   { state: 'loading' | 'empty' | 'error'; noun: string; error?: string }  emits: retry(); slots: empty-action
useCwaToast()    { show(t: { id?: string; tone: Tone; title: string; description?: string
                   actions?: { label: string; onClick: () => void }[]; persist?: boolean }): void; dismiss(id: string): void }
```


---

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
- **In the bar, Undo** restores the cleared fields, again in one save. It stays available until the next edit in the group (not on a timer), in the status glyph's popover.
- **In modals and pages** the group edits the local copy like any field: choosing a value clears the other options' fields in the local copy, the helper line says what Save will clear ("Save sends this and clears the URL (…) in the same request."), and Save sends the chosen field and the `null`s in one request. There is no Undo there: nothing was saved, and Cancel discards the copy.
- **Initial option:** the first option with a non-null field. When more than one holds a value (old data), it shows the first, and a `warning` badge on the segmented control says "Both are set. Saving one clears the other."
- **One status glyph** for the group (bar only), at the visible field's end: saving, saved and error cover the whole save. A conflict on a hidden option puts the diamond on that segment and never switches the segment.
- **Presence** is per field: a peer in the hidden option shows their flag on that segment.
- Bar: `Link ⓘ [Page | URL] [ /about-us ▾ ]`. Modal: the label, then the segmented control, then the field 0.375rem below.
- The segmented control has no inner padding: each segment is the control's full height (2.75rem on touch), and the pressed segment draws its inset with a `field`-coloured inner shadow.

### 6.3 `CwaUiLinkInput`

A preset of the group with the Page and URL options and `route`/`rawPath` defaults (`route?`, `rawPath?` props rename them). Its group model sets the debounces so authors cannot forget `debounceTime: 0`: a page pick saves at once, a URL is debounced. URLs are validated (`/path` or `http(s)://`) before sending, and an off-site URL shows ↗. Title search on routes depends on the bundle (`/_/routes` filtering by page title), recorded in the bundle's CLAUDE.md.

---

## 7. The manager bar

- **One row, never stacked.** Height is `h-manager`, as is its spacer. The row scrolls horizontally with 2.5rem edge fades (a `mask-image` from `data-overflow-start/end`, set by a `ResizeObserver` and a passive scroll listener with injectable measurements). "Scroll fields left/right" arrows appear only at a hovered edge on a fine pointer, and never while a field in the row has focus, so they never cover what you type. Coarse pointers have no arrows: the fade and a visible peek of the next field carry the hint. Native Shift+wheel, trackpad and touch pans (including one starting on an input) scroll it. **Focus scrolls the whole field into view, label included**, clear of the fades (2.5rem). Every sample row of bar controls, wherever it appears, uses the same fades.
- **Row:** inline padding `row-x`, block `row-y`, gap `row-gap`. `CwaUiManagerRowDivider` is a 1px `line` rule, 1.5rem tall, centred in the gap. Labels and fields are vertically centred on one baseline.
- **Tab strip** (`core/admin/ManagerTabs.vue`, reka `Tabs`): tab names in `text-label`, padding 0 1rem, selected = `fg` text with a 2px `accent` bar along the bottom edge (a selection indicator, not a field border). The bar is one sliding indicator (reka `TabsIndicator`, §2.8), shared by the bar and modal tabs. Scrolls with the same fades, and selecting a tab scrolls it fully into view. A tab with an error or held conflict shows the solid triangle or diamond, read from the store, so it survives the tab unmounting.
- **Pinned end** (`core/admin/BarSummary.vue`): the status button and the primary action as a **split button** (Publish now, Schedule, Cancel schedule, or "+ Draft"/"+ Add" for a new component, plus ⋮; or ⋮ alone; §5.1), **always in the tab row, top right, level with the tabs, on every tab and at every width**. They never move into the field row, so the field row always has the bar's full width and the action never jumps when the tab changes. The tab strip scrolls (with fades) in the space to their left. A divider separates them from the tabs. Buttons are the tab row's height less 0.5rem on fine pointers, so the space to the right of the split button equals the space above and below it (measured: 4px each); on coarse pointers they are the full tab row height (2.75rem). ⋮ is square at the same height. The status is always a solid glyph **plus words**: ≥ `lg` "Draft · not live", "Saving…", "All changes saved", "1 not saved →", "1 conflict →"; below `lg` a short word ("Draft", "Saving…", "Saved", "1 not saved", "1 conflict"). It is a button: with an error or conflict it jumps to the field and opens its popover; otherwise it opens a popover with the full status. A spinner is never shown without "Saving…".
- **Phones** (bar narrower than 40rem): the same place, compact: the status is **a glyph only**, a square button the tab row's height, right against the split button with **no gap** (measured: 0px), and the action is shortened to "Publish". Each state has its own shape (a dot for Draft, a clock for Scheduled, a ringed dot for Live, bars for a group, a dashed ring for New (v6: a plus only ever means create, and it sat next to "+ Draft"), the spinner, the tick, the triangle, the diamond), so colour is never the only cue, and the button's accessible name is the full status ("Status: Draft · not live"). The split button sits **flush against the right edge**, ⋮ last, both 2.75rem tall and ⋮ 2.75rem wide, and its menu opens as a bottom sheet. It meets the right edge of the window with no gap (the tab row's end has no padding at this width, on touch as well: v3's mockup kept 0.25rem there because the coarse-pointer padding outranked the narrow-bar rule), at the tab row's full height (2.75rem, thumb-sized) and with its own inner padding; the tab strip keeps the row's left padding. With a right-side safe-area inset (a landscape notch), ⋮'s fill extends into the inset and its glyph stays clear of it: `width: calc(2.75rem + env(safe-area-inset-right))` with the inset as its right padding. Text fields are sized `calc(100cqw - 9.5rem)`, so a field and its label take most of the row and the next field peeks in; the row uses `scroll-snap-type: x proximity` with each field as a snap point. Controls are 2.75rem.
- **Multi-line content** is edited in-line on the page. The bar shows `CwaUiInlineHandoff`: `Description "Our kitchens are made in…" [Edit on page]`. Edit on page scrolls the template's registered editor clear of the bar, focuses it and flashes an `accent-fg` outline for 600 ms; Escape returns focus to the button. With no registered editor, the button reads **Edit…** and opens a dialog with `CwaUiTextarea`.
- **Escape order:** confirm, popover or menu, inline edit, on-page editor, a dialog's sub-view (asks when dirty, §8.3), dialog, clone mode, deselect.
- **The bar owns the live region** (`ResourceManager`, announced through `BarSummary`), never the tab: a tab unmounts when another is chosen, and its region would go with it mid-announcement. Kit controls announce through an injected `announce()`.
- **Read-only values** (`CwaUiReadonly`) are centred on the same line as the neighbouring fields' values at bar, modal and touch sizes: the value box is the control's height with the same trimmed line box (measured: 0.01px apart).
- **The row scrolls by keyboard too:** the row and the tab strip are focusable scroll regions (`tabindex="0"`, named) when they overflow, so arrow keys scroll them (WCAG 2.1.1).

Module tabs on the row: `DynamicPage` (three selects · divider · status text), `Publish` (`Edit published version` toggle with `info`, `Schedule` toggle, date picker; the action is pinned), `Group`, `ResourceInfoTab` (`CwaUiReadonly`, badges), `Ui` (UI select, Style select or multi-select; where the options come from is the separate configuration job), `Order` (`CwaUiNumber width="xs"`).

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
| Sections | `CwaUiFormSection`: heading `text-section` (1.125rem / 650, `fg`) as an `h3`, optional description `text-helper` `fg-muted` 0.25rem below, then 1rem to the first field. Each section after the first has 2rem of space, a 1px `line` rule, then 2rem before its heading. A section with no heading adds no top space, so an untitled form's padding is even on all sides. |
| Columns | `columns: 2` on a section puts short fields side by side, 1rem column gap, 1.5rem row gap; it collapses to one column when the dialog's content box is under 32rem (container query) and at 200% zoom |
| Toggles | a toggle row is label left, toggle right, helper below the label; the row is 2.75rem tall and the whole row toggles |
| Footer | sticky, `surface-raised` fill, padding 1rem `--spacing-dialog` (0.75rem plus the safe-area inset on a phone); actions right-aligned with 0.75rem gap: a short state text in `fg-muted` ("Choose 2 versions to save", "2 to fix"; hidden on a phone, where the alert says it), secondary (`soft`) then primary (`solid`); a destructive action sits alone on the left (`ghost`, `danger`). Below `sm`: secondary and primary share the row 50/50, destructive moves into the header's overflow menu. |
| Keyboard | the sticky header and footer are sized against `visualViewport`; the focused field scrolls above the on-screen keyboard |

Whether a dialog uses its phone layout is decided by the **viewport or overlay width** (a named container on the overlay), never by the dialog's own width: a 36rem dialog on a desktop is not a phone.

`CwaUiFormGroup` (pages) uses the same field block, section and column rules on `surface`, with a max content width of 40rem.

### 8.2 Saving in modals and pages

Modals and pages (`CwaUiDialog`, `CwaUiFormGroup`) keep a Save button. Nothing is saved as you type. **Admin pages** (the `/_cwa` pages with forms, such as site settings or a user's page) use exactly this model: a local copy, a Save button, nothing saved as you type (decided in v4).

- **A local copy.** Fields edit a copy of the resource (`useItemPage`'s `localResourceData`). The bar is different: it saves each field as you type.
- **Unsaved changes are marked** at three levels: the field ("● Unsaved" after its label; nothing is drawn inside the field), its tab (a dot after the tab name), and Save, which counts them: "Save" (disabled, nothing changed), "Save 3 changes", "Saving…", then the saved check and "Saved" for 1.5 s. The count is the number of changed fields; the accessible name says "Save 3 unsaved changes".
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

- **Each tab shows its state**, from the modal's local copy: a dot when it holds unsaved changes, the triangle when it holds an error, the diamond when it holds an unresolved conflict (error beats conflict beats unsaved). The tab's accessible name adds ", 2 unsaved", ", 1 to fix" or ", 1 to choose".
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

- **Route**, at the top of the tab: the path (mono, with Copy), its status badge from the route (Live, Scheduled · date with a clock, Not live; Held back by parent when an ancestor's go-live is later, from `isRouteGatedByAncestor`), the recommendation line when the path isn't the recommended one (an info note: the ⓘ glyph, `accent-fg` mixed 10% over `surface` with a 3px `accent-fg` edge, like the v6 alerts, reading "Recommended: /kitchens/shaker-kitchens" with a small soft **Use this** button at its end; below a 25rem container the button drops under the text; the note is not rendered when the path matches), a `warning` note when held back, and **Edit route** below them, never on the heading's line. **No route**: "None", the No route badge, the recommendation and **Add a route**. **Parent has no route**: an info alert with a button that opens the parent, and no rows.
- **Navigation rows** below it, in a list: **Redirect to** ("Off" or "→ /kitchens/shaker-range"), **Redirected from** ("3 old addresses" or "None") and **Child routes** ("2 routes" or "None"). They start 2.5rem below the Route section. Each is one full-width `button`, at least 3.5rem tall, with 0.75rem block and 1rem inline padding inside its hover fill; the row bleeds 1rem past the content edge on both sides, so its text still lines up with the content above while the hover fill gives it room, with the label, a muted one-line summary that truncates, and a solid ▸; its accessible name is the label and the summary ("Redirected from: 3 old addresses"). The whole row is the target.

**Sub-views.** A row, Edit route, Add a route and Use this open a sub-view: a page of the Routes tab, inside the modal.
- **The modal's tabs stay**, with Routes selected; only the tab's own content changes. Under the tab strip a stacked header: a ghost back link "‹ Routes" (`fg-muted`, 0.875rem, its hit area 1.5rem tall, 2.75rem on coarse pointers), 0.5rem of space, then the sub-view's title as a heading at the section heading size, both aligned to the body's inline padding. Focus moves to the title (`tabindex="-1"`). On a phone, Delete route sits in a ⋮ at the end of the back link's line.
- **The tab's main view is `hidden` and `inert`** while a sub-view is open; the tab strip is not. The sub-view slides in from 2rem to the right and fades (`d-base`), and the main view comes back from the left; both are instant under reduced motion. The body scrolls to the top, and its scroll is restored on the way back.
- **Leaving:** "‹ Routes" or Escape returns to the main view, and focus returns to the row or button that opened the sub-view. Another tab simply switches, and coming back to Routes shows its main view. **With unsaved input** in a sub-view's form, each of these asks "Discard your route changes?" (**Keep editing** / **Discard**; changes on other tabs are kept). The sub-view adds no router history: it is the tab's state, not a route.
- **Footer:** while a form is open in a sub-view, its own footer replaces the modal's: [Delete route on the left, Edit route only] … "2 unsaved page changes kept" · **Cancel** · **Save route** (or **Add route**, **Redirect**, **Add**). There is never more than one Save on screen. A sub-view showing a list (Redirected from, Child routes, Redirect to without a form) has no footer: its actions save at once, and the modal's Save would have nothing to do there, so it is hidden too, along with the header's page ⋮.
- **Saving needs no confirm**: what will happen is said in the form, above the footer, as it is typed ("The old path, /kitchens/shaker, keeps working: it will redirect here."; "Visitors to /kitchens/shaker will be sent to /kitchens/shaker-range." as a `warning` note; "/old-kitchens → this page"). Save route is the confirmation. Only destructive actions confirm, and none with a bare "Cancel": Delete route (**Don't delete**), delete an old address (**Don't delete**), Remove a redirect (**Keep redirecting** / **Stop redirecting**).
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
  savedAt?: number
  error?: { kind: 'network' | 'server' | 'violation' | 'precondition'; message: string; status?: number }
  held?: RemoteFieldChange
}
```

- **Beside `apiState`, not inside it.** `apiState` is the fetch's state and is replaced wholesale whenever a fetch starts (`startFetchResource` swaps SUCCESS for IN_PROGRESS; #375 restores a copy). A Mercure or reconnect re-fetch would otherwise wipe an unsaved error or a held conflict.
- **Client-only.** The key is added on the first write, and the server never saves, so it adds nothing to the SSR payload.
- **Plain data only.** `retry()` and `reset()` are model methods and store actions, so the state stays serialisable and devtools-readable.
- **Follows the resource:** when a save turns live into a draft, or a 412 moves a value with `moveTo`, the field states move to the new IRI with it (#429).
- **Errors are per field, and `updateResource` keeps its return** (v6, replacing v3's `{ ok }` wording): it still resolves to the saved resource, or `undefined` on failure. Per-field outcomes are written to `fieldStates` keyed by `(iri, field)`, from the fields the request sent, so one field's success never clears another field's error (today's `removeByEndpoint` clears every error for the endpoint). The callers checked: the field model needs the returned resource's `@id` (a save on a live component returns a new draft IRI); `useItemPage` returns it to its own caller; stranded merge, clone, remote changes and the Info tab only test for success; outside the module only bcio calls it (ArticlesCollection, result unused). The code that writes `fieldStates` is admin-only and lives in a lazy module, out of the entry (§12).
- **What reads it:** the bar's status glyph, the tab badges, the pinned summary and Retry after returning to a tab. Getters read by `(iri, field)`, so work scales with fields on screen (#259).
- **Unmounting a field in error or held** (tab switch, deselect) raises a persistent toast with **Show me**, **Retry** and **Reset** (**Retry all** and **Reset all** when there are several), and `NavigationGuard` asks before leaving the page. Route-cache eviction never evicts a resource with an unresolved field state.

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
| `actions` | 2.75rem per action | square `ghost` icon buttons, right-aligned; more than two go into a ⋮ menu |

- **Row actions** for pages: **Go to page** (an arrow icon button; it navigates to the page, through `getInternalResourceLink(iri)` for a page without a route) and ⋮ with **Edit settings** (the modal, also the row click), **Go to page** and **Delete**.
- **Rows:** 3.5rem with one line, 4rem with two (4rem on coarse pointers). Padding 0 1rem, column gap 1rem, content vertically centred. Rows are separated by a 1px `line` divider; hover is `field-hover` at 50%; the selected row is an `accent` tint.
- **The whole row is the link** (to the item's modal); action buttons stop propagation.
- **Header row:** 2.5rem, `text-helper`, `fg-muted`, sentence case, same alignment as its column; sortable headers have a solid chevron.
- **Below `md`:** the grid becomes `lead · primary · actions(⋮)` (`primary · actions` in the page list). The second line is **status first**, its glyph in a fixed 0.75rem slot so every row's status starts at the same place (a coloured dot; a clock for Scheduled, so it never reads as the Static type's blue dot; a hollow square for a template), then the date with what it is ("edited 15 Nov"), left out when the status already carries one ("Scheduled · 20 Nov"), then the path last, so only the path truncates: `● Live · edited 17 Nov · /kitchens`. Rows are 4.25rem. Selection checkboxes are hidden, and a row is only highlighted while its checkbox is checked. The ⋮ menu opens as a bottom sheet.
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
| Held back by parent | `isRouteGatedByAncestor` | `warning` dot + "Held back by parent" |
| No route | no route (private unless a routed child makes it public) | neutral dot + "No route" |
| Template · 14 pages | a dynamic page (template): how many page data resources use it, from `_metadata.pageDataCount` (api-components-bundle#587: admin-only, template pages only, 0 when unused → "Template · unused"); "Template" with no count until it ships | neutral; a hollow square on a phone |

The second line is the route's path, or for a template "Template for blog articles". Below `md` the status (dot and word) comes first on the second line.

---

## 10. Feedback

- **Toasts** (`useCwaToast()`; consumer: apps' admin pages such as dons-hub's `useFlash`): square, 22rem wide (full width minus 1rem gutters on phones), `--spacing-popover`, a solid tone glyph, title, description and actions. Top-right below the admin header; on phones at the top, full width minus 0.5rem gutters, below the admin header, so they never cover the manager bar or its primary action. **While a full-screen dialog is open on a phone**, the stack starts below the dialog's header and tab strip (about 6.5rem; the dialog sets a class on `body`), so a toast never covers its title, close button or tabs (v6). `useCwaToast` is a small stub in the entry that queues calls and loads the toaster on first use, as the Mercure client does (§12). Upsert by `id`; at most 3 visible; success and info 4 s, warning 6 s, errors and any toast with actions stay until dismissed. Never toasted: routine saves, an error on a mounted field, "Copied".
- **Error copy:** raw `hydra:description` is never shown. Network: "You're offline. This wasn't saved." Server: "The server couldn't save this." Violation: the violation's own message. Precondition without real-time: "Someone else saved this first. Reload to see their version." No automatic resend when the connection returns. A failed save offers Retry and Reset (Retry all and Reset all in a toast for several), never Undo; Undo is only for something that happened and can be reversed.
- **The toast region** has no background, padding, shadow or blur of its own and has `pointer-events: none`; each toast has `pointer-events: auto`, so the empty space between and around toasts never blocks the page (checked over a photo: the region is invisible). **Toasts never change position**: always top-right below the admin header, at the top on phones. **Focus is never entirely hidden behind them** (WCAG 2.4.11 AA fails only when the focused element is entirely hidden): when the focused element is entirely covered by the stack, the stack turns see-through in place (15% opacity, `pointer-events: none`) while focus stays there, and returns when focus moves away. A partly covered element is left as it is. The change is a 120 ms opacity fade, instant under reduced motion.
- **`CwaUiAlert`** (modals and pages only): square, solid glyph, title, description, actions. Info is the `field` tint; **warning and danger are the tone mixed 10% over `surface` with a 3px tone start edge** (v6), so an alert never looks like a field, and the conflict notice (§8.2) and the Routes tab's notes use the same surface.
- **Loading:** spinner, progress and the skeleton shimmer (§9.2) only. Every literal "Loading..." goes; the words a loading state does show are "Loading pages…" and "Still loading…", by the rules in §9.2.

### 10.1 Toast style: B, tinted frosted (decided)

**The kit's toasts use option B** (Daniel's choice): the menu surface mixed 12% toward the tone (`color-mix(in srgb, var(--tone) 12%, var(--surface-menu))`) at 85% opacity, with `backdrop-filter: blur(16px) saturate(1.5)`, the solid tone glyph and a 3px tone start edge; text and action buttons in `fg`, actions underlined. Where `backdrop-filter` is unsupported, or under `prefers-reduced-transparency: reduce`, the tinted surface is solid. **Worst-case text contrast over a busy photo: 6.73:1** (dark theme over white); glyphs 3.02:1.

The three options compared:

Each was shown with success, info, warning, error and an error with actions (Show me / Retry / Reset), over a busy page (a photo and text) and a plain page, in light and dark. Behaviour (position, stacking, timing, errors persisting, focus never hidden) is the same for all three.

| Option | Look | Worst-case contrast over the photo |
|---|---|---|
| **A · Frosted** | `surface-menu` at 85% with `backdrop-filter: blur(16px) saturate(1.5)`; the tone only in the glyph and a 3px start edge. Solid `surface-menu` when `backdrop-filter` is unsupported or under `prefers-reduced-transparency: reduce`. | text 8.57:1; glyphs 3.56:1 |
| **B · Tinted frosted** | the same blur, with the surface mixed 12% toward the tone (`color-mix`); solid tinted fallback | text 6.73:1; glyphs 3.02:1 |
| **C · Solid tone** | the tone as the background, white text: green-700 `#15803d` (5.02:1), blue-700 `#1d4ed8` (6.70:1), amber-700 `#b45309` (5.02:1), red-700 `#b91c1c` (6.47:1); success and warning were darkened to pass | independent of the page |

Worst case means the toast over the photo's lightest (white) and darkest (black) areas, taking the blurred backdrop as that colour at 15% under the 85% surface. In A and B the action buttons use `fg` with an underline: in the accent colour they fell to 3.68:1 (A) and 2.89:1 (B) in dark over white.

The design recommendation was A, for its higher contrast; Daniel chose B, which passes everywhere (text 6.73:1, glyphs 3.02:1 at worst) and makes the tone easier to tell at a glance.

---

## 11. Accessibility and tests

The kit targets **WCAG 2.2 AA**.

### 11.1 Rules

- **Contrast** (1.4.3, 1.4.11): text 4.5:1; focus rings, glyphs, state tints and control boundaries 3:1, measured against the fill each sits on (§2.1). Fields meet 1.4.11 through their visible label.
- **Use of colour** (1.4.1): every state has a shape as well as a colour (glyphs, the phone status), the Static/Dynamic marker is a circle and a square, and links in text are underlined.
- **Target size** (2.5.8): every target is at least 24px (`--spacing-target`), or has 24px of space around it; 2.75rem on coarse pointers.
- **Focus not obscured** (2.4.11): scroll padding for the admin header and the bar (§2.6); a toast stack that entirely covers the focused element turns see-through in place, and never moves (§10); popovers never cover the field that opened them.
- **Dragging** (2.5.7): every drag has a single-pointer alternative. Reordering has the Order tab's number and Move; resizing has none in the kit.
- **Accessible authentication** (3.3.8): sign-in allows paste and password managers (`autocomplete="username"` and `current-password`), has no cognitive test, and a reset link instead of a puzzle.
- **Redundant entry** (3.3.7): a form never asks again for what the editor already gave in the same process (the add page data form takes defaults from its link, #390; Create keeps everything typed when it fails).
- **Consistent help** (3.2.6): the ⓘ always sits straight after the label, and the admin's help link is in the same place on every admin page.
- **Content on hover or focus** (1.4.13): popovers are dismissible (Escape), hoverable and persistent until dismissed; nothing opens on hover alone.
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
- **Errors** are announced once, politely, never `assertive`; after that the error glyph, `aria-invalid` and `aria-describedby` carry them. A failed save the editor isn't focused on says which field. A modal's conflict alert is announced once.
- **Search** announces the result count after the search settles, never per keystroke (§5.3).

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
| Navigation row, sub-view | a `button` named by label and summary; the sub-view is a region named by its title, which takes focus; the hidden main view is `inert`; focus returns to the opener |
| Skeleton | `aria-busy` on the list; skeletons `aria-hidden`; one "Loading pages" |
| `CwaUiDialog` | `role="dialog"`, `aria-modal`, named by its title; focus trapped and returned; Escape asks when dirty |
| `CwaUiConfirm` | `role="alertdialog"`, title and text linked, focus on the safe action |
| Popover (info, status, error) | named; Escape and outside click close; stays open on hover; never moves layout |
| Toast | announced through the surface's region; dismiss button named; actions are buttons; never moves; turns see-through (15%, no pointer events) while it entirely covers the focused element; errors persist |
| `CwaUiAlert` | announced once on appearing; links go to fields and tabs |
| List | table semantics or a grid with named columns; row title is a link (≥ 24px); checkboxes labelled per row; status in text |
| Manager bar | tab strip with `role="tablist"`; row is a focusable scroll region when it overflows; status button named with the full status |
| Conflict notice | `role="group"` named by its heading, linked to its field; values as text; buttons wrap and never clip |

### 11.4 Tests

- **axe** runs in Vitest (per component, `vitest-axe` on the mounted kit component in each state) and in the browser tests (on `/kit`, §12, and on each scenario's admin screens), at WCAG 2.2 AA. The mockup passes axe-core 4.14 (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`, best practice) at 1280 and 390 in light and dark.
- **Screen readers** (decided in v6): **axe and keyboard tests run on every PR**. A **manual VoiceOver (macOS and iOS) and NVDA (Windows) pass** happens once for each new component, in the PR that adds it, following its checklist rows (§11.3), and again over the whole kit before each release.
- **Browser scenarios:** the bar's height and the page's scroll are unchanged across every tab and state at 1280, 1024, 768 and 390px wide, and the status and primary action are in the tab row on every tab; a modal sends nothing until Save, Save sends only changed fields in one request, a 422 badges and opens the failing tab, a 412 shows a notice under each conflicting field and the next Save carries the new version, and Create disables Routes and hides Info; a route sub-view replaces the footer only while its form is open, keeps the tab strip, asks before discarding typed input on Back, Escape or another tab, returns focus to its opener and leaves the main view `inert`; route saves send their own request without a confirm and are never part of Save; a stepper never saves an out-of-range value and snaps on blur; a loading list shows only the shimmer for 5 s under normal motion and the spinner with "Loading pages…" at once under reduced motion; only one element shows hover when the pointer is on a stepper button or a chip's ×; a textarea grows to 8 lines and then scrolls; a 10-field row scrolls and never wraps; a Select, MultiSelect and ResourceSearch open, filter and select by keyboard and by touch, and a search cancels its request on close; the either/or group clears the other field in one request; an error's glyph opens its popover by tap; an ⓘ popover moves nothing (0px); a bar field's outer box is identical in every state; Cancel, Escape, the backdrop and a navigation ask only when the local copy is dirty; no control's value is clipped vertically; no text in a conflict notice overflows (`scrollWidth ≤ clientWidth`) at 1280, 390 and 320; read-only values are within 1px of their neighbours' value line; the desktop split button has equal space above, below and to its right; the phone status meets the split button (0px) and the split button meets the window's edge (0px); ⋮ opens its menu by click, Enter, Space and ArrowDown, and ⋮ alone shows for a live component and a group; every target is at least 24px; under reduced motion only the spinners animate (the shimmer stops); a list aligns its columns at 1280 and collapses at 390; one run at 200% zoom and one at 320px.
- **Vitest per control:** states and `:model` wiring with real `computed` refs (#260); the store's `fieldStates` survive a re-fetch; the announcer merges outcomes and stays silent while pending.

---

## 12. Phased plan

Rewritten in v6. Each step is one PR into `dev` under an issue linked from #236, running `test`, `test:types`, `lint`, `build` and `test:e2e`, with its own `CHANGELOG.md` line. **Every PR states its bundle change** against the two budgets the e2e guards measure (`entry-bundle-markers.mjs` for the entry, `visitor-page-preloads.mjs` for an anonymous page's preloads) and whether it adds a reka-ui consumer: a second consumer split reka-ui's popover into a chunk named in the entry's `__vite__mapDeps` (CLAUDE.md, ~12 B), so each new one is measured. Kit code is admin-only and lazy (§1, R9): visitors should see **0 B** from every row except where marked.

Editors see something in the second PR, then a whole vertical slice, before the long middle.

| # | PR | Contents | Editors see | Entry / visitor budget | New reka-ui consumer |
|---|---|---|---|---|---|
| 1 | Tokens and `/kit` | §2 tokens with the contrast spec, radius 0, the `button` and `shimmer` tokens, `CwaUiButton`, `CwaUiSpinner`, `CwaUiBadge`, and the `/kit` page (below) | nothing yet (admin colours shift slightly) | tokens are CSS in the compiled `cwa.css`; JS 0 B | no |
| 2 | Toasts | `useCwaToast` as an entry stub (a queue and a lazy `import()` of the toaster), `Toaster`, the phone dialog anchor (§10); `RequestErrors` and `Notification` switched to it | the new toasts | entry: the stub, ~150 B gzip, raised and stated; visitor 0 B | no |
| 3 | Field state | `fieldStates` in the resources store, written from a lazy admin module; `updateResource` keeps its return (§8.4); `state`, `retry`, `reset` on the model with the `states`/`resetValue` aliases (§4.1, `DEPRECATIONS.md`); `useItemPage` keeps local edits through a re-fetch and reports per-field 422s and 412s | nothing visible; errors no longer clear each other | the store's getters only, measured; visitor 0 B | no |
| 4 | Vertical slice: the bar | `Field`, `FieldStatus`, info popover, Input, Toggle, Select, Number (with the range rules), `CwaUiManagerTab` with `field="…"` and `cwaTabMetaOnly` (§3), `BarSummary` owning the live region (§7), the split button; the module's Publish and Order tabs ported | the new bar on two tabs | 0 B | yes: Popover, Select, NumberField (first consumer) |
| 5 | Bar controls | ResourceSearch (with the shimmer), MultiSelect, Segmented, `useCwaResourceFieldGroup` with EitherOr and LinkInput (§6), FileUpload, DayPicker, DatePicker moved over | every bar control | 0 B | Combobox |
| 6a | Dialog and Save | `CwaUiDialog` with tabs, FormSection, the Save model (§8.2), Alert, Confirm (`useCwaConfirm`, §8.5), Textarea; the page modal's Details and Info tabs | the new page modal | 0 B | AlertDialog, Dialog |
| 6b | Routes | `CwaUiTree`, the Routes tab with its navigation rows and sub-views (§8.3) | the new Routes tab | 0 B | no |
| 6c | Lists | list grid, SearchField, FilterToggle, Pagination, ListState with the shimmer (§9) | the new lists | 0 B | no |
| 6d | Auth and admin pages | FormGroup, the sign-in and reset pages, site settings | the new admin pages | 0 B | no |
| 6e | Module tabs and the root warning | the remaining module tabs on `CwaUiManagerTab`, then the development warning for any other tab root switched on (§3) | — | 0 B | no |
| 7 | In-page editing | InlineEdit, InlineHandoff, EditPlaceholder, LinkPopover, ImageAlt, ImageSlots, DayRangePicker | in-page editing | 0 B | no |
| 8 | Site migration | the template's tabs, then CK, with migration notes and the docs repo `documentation` issue | everything, on real sites | 0 B | no |
| 9 | Removals | in **one late PR**, once the sites run on the kit: `Modal*`, `DialogBox`, Headless UI, `popper.ts`, the `states`/`resetValue` aliases | — | entry and visitor budgets **lowered** to the new sizes | no |

The v1 migration map (`04-proposal.md` §9) still applies, with two changes: `variant: 'outline'` becomes `'soft'`, and `hint` becomes `info`/`description`.

**The kit reference page** (`playground/app/pages/kit.vue`, at `/kit`, with `definePageMeta({ cwa: { disabled: true } })` so the catch-all page and its route fetch never run there): it renders the real kit components with fake models fixed in every state (idle, pending, saving, saved, error, conflict, presence, disabled, read-only), at bar, modal and touch sizes, with menus and popovers open, a light/dark switch, a reduced-motion switch and the token list with measured contrast. The fake models come from **`fakeFieldModel(value, state)`** (`playground/app/kit/fake-field-model.ts`), which returns a `ResourceModelField` (§4.1) with real refs and a real `computed` `state`, and `retry`/`reset` that move the state as the store would; nothing touches the API or the store. It is not published (the package ships only `dist` and `bin`); designers run it with `pnpm run dev:http`, and there is no CI deploy. **Each kit PR adds its section.** The browser tests open `/kit` and run axe and this round's measurements: no vertical clipping, optical centring within 1px, fixed outer widths across states, read-only alignment, the split button's spacing and the phone status gap.

---

## 13. Open questions for Daniel

1. **"Held back by parent" in lists.** A row can only say it if the pages collection carries each page's route with its effective go-live (`_metadata.effectiveLiveAt`), which is admin-only and today comes with the route, not the page. Ask the bundle to embed it in the admin pages collection, or show the page's own route status in lists and leave "Held back" to the Routes tab?

Settled in v6 (removed from this list): the palette additions (red-300, yellow-700, stone-300) are approved; the tree is an ARIA treegrid; route edits use the sub-view (§8.3), not a second Save in the tab or a dialog on top; buttons have their own fill; ⋮ is the only "more" glyph; `updateResource` keeps its return (§8.4); the screen-reader pass runs once per new component and before each release (§11.4); a template's count waits for api-components-bundle#587 (§9.3).

Settled in v5: toasts use option B, tinted frosted (§10.1); page data field configuration belongs to the separate configuration job; `field="…"` is in, with `CwaUiManagerTab` as the tab root (§1); the model names in §8.4 stand; phones get bottom-sheet menus (§5.3); the round 4 palette is approved, and the fills are darkened, with 1.4.11 met by the visible label (§2.1); the split button's trigger is ⋮ as today.

Decided in v4: admin pages use the modal Save model (§8.2); Cancel, close and leaving ask before discarding unsaved changes, and the tab's close uses `beforeunload` (§8.5); on touch every control's value is 1rem (§2.3).

# CWA Admin UI Kit: proposal v2 (#236)

**From:** UI design. **For:** Daniel (decision owner) and module developers.
**Builds on:** `04-proposal.md` (v1) and Daniel's review of it. History is in `01`–`03`.
**Scope:** the UI kit only. Component configuration (`defineCwaConfig`, styles, UI variants, field declarations) is a separate job and is not designed here. The kit is developed in `ui-kit.html` until Daniel is happy, and only then implemented.
**Status:** proposal. Nothing is built. Every public name has a named consumer (R7); anything without one is internal and lives in `core/`.

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

1. **The bar is one row, always.** `ResourceManager.vue` wraps every tab in `CwaUiManagerRow`. Fields never stack and overflow scrolls sideways. Multi-line content is edited in-line on the page (§7).
2. **State lives at the field, without reserved space.** No field keeps empty room for a glyph that is usually absent. In the bar a state replaces the control's end icon, or sits in end padding that widens only while it shows; the field's outer size never changes, so nothing around it moves. In modals and pages a field's state is shown by its label ("· Unsaved") and the line below it, never inside the field.
3. **The bar saves as you type; modals and pages save on Save.** The bar edits one selected component in place, so each field saves on its own. A modal or page edits a local copy and sends it when the editor presses Save (§8.2).
4. **Bind once.** `:model="title"` wires the value, presence, conflict, save state and errors. `v-model` remains for values that are not resource fields.
5. **Quiet when it works, visible when it fails.** A save shows a tick. A failure stays until it is resolved, and nothing blocks typing. A failed save offers **Retry** and **Reset** (back to the last saved value); nothing happened, so there is nothing to undo.
6. **One of each.** One button, one select, one field look, one disabled look, one spinner, one popover system (reka-ui, portalled into the app's container), one toast stack.
7. **Information is explicit, never hover-only.** No tooltips on fields. Help is an opt-in ⓘ that opens on click or tap (§4.5), used sparingly.
8. **Friendly, not admin-like.** Generous, consistent spacing, plain sentence-case copy, and every control usable with a thumb on a phone.
9. **Admins only, loaded late.** Kit code is lazy and admin-only. Visitors pay nothing new.

---

## 2. Tokens

Tokens live in the `@theme` block of `src/tailwind/tailwind-cwa.css`, are used as `cwa:` utilities and are emitted as `--cwa-*`. Every size is in rem, so text zoom scales the controls.

### 2.1 Colour

Shades marked † are outside R5's palette list and need Daniel's approval (Q2).

| Token | Use | Dark (default) | Light (`cwa:theme-light`) |
|---|---|---|---|
| `surface` | bar, modal, page | stone-900 `#1c1917` | `#ffffff` |
| `surface-raised` | modal footer | stone-800 `#292524` | stone-100 `#f5f5f4` |
| `surface-menu` | menu, popover, toast (with `shadow-popover`) | stone-800 `#292524` | `#ffffff` |
| `menu-highlight` | highlighted menu option | stone-600 `#57534e` | stone-200 `#e7e5e4` |
| `field` | **every input's fill** | stone-700 `#44403c` | stone-200 † `#e7e5e4` |
| `field-hover` | field hover, chip | stone-600 `#57534e` | stone-300 `#d6d3d1` |
| `field-danger` | field in error | `field` + 20% red-500 (`#66413e`) | `field` + 14% red-500 (`#e8cece`) |
| `field-warning` | field in conflict | `field` + 16% orange (`#625132`) | `field` + 18% amber-500 (`#ead8bd`) |
| `step-hover` | hover on a control nested in a field (stepper −/+, chip ×, clear ×, status glyph button), laid over whatever fill the field has, tinted ones included | white 17% | stone-900 16% |
| `step-press` | the same controls while pressed | white 30% | stone-900 30% |
| `type-static` | Static page type: row dot, filter toggle swatch (the pressed toggle fills blue-600 with white text) | blue-400 † | blue-600 |
| `type-dynamic` | Dynamic page type: row dot, filter toggle swatch (the pressed toggle fills yellow-400 with stone-900 text) | yellow-400 † `#facc15` | yellow-600 † `#ca8a04` |
| `line` | **dividers only** | stone-700 | stone-300 |
| `fg` | text, values | stone-100 `#f5f5f4` | stone-900 |
| `fg-muted` | labels in the bar, helper text, placeholders | stone-400 on `surface` (6.9:1); stone-300 on `field` (6.9:1) | stone-600 `#57534e` (6.1:1 on `field`) |
| `accent` | primary button fill, selected tab, toggle on | blue-600 `#2563eb` (fill only) | blue-600 |
| `accent-fg` | **focus ring**, links, accent text | blue-400 † `#60a5fa` (6.9:1) | blue-700 † `#1d4ed8` (6.7:1) |
| `success` | saved glyph | green `#9cdd05` (6.2:1 on `field`) | lime-800 † `#3f6212` (5.6:1) |
| `warning` | conflict, long-wait glyph | orange `#ffaa00` (4.0:1 on `field-warning`) | amber-700 † `#b45309` (3.6:1) |
| `danger` | error glyph, destructive fill | red-400 † `#f87171` (3.2:1 on `field-danger`) | red-700 † `#b91c1c` (4.4:1) |
| `danger-fg` | **error text** | red-400 † | red-700 † |
| `highlight` | reorder, clone, selection | magenta `#e30a6c` | magenta |

Rules:
- **Fields have no border.** The fill identifies the field, and an always-visible label names it. The fill is 1.7:1 against `surface` in dark and 1.3:1 in light, so the reading of WCAG 1.4.11 is Q3.
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
| `text-section` | 1rem / 650 | form section headings (a clear step above the 0.875rem / 500 label) |
| `text-title` | 1.125rem / 600 | modal titles, page headings |

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
| `--spacing-section` | 2.5rem | one form section to the next |
| `--spacing-section-head` | 1.25rem after a description, 1rem after a bare heading | section heading to its first field; a description sits 0.25rem under the heading |
| `--spacing-dialog` | 1.75rem (≥ `sm`), 1.25rem (< `sm`) | dialog padding (2.25rem / 2rem at the bottom of the body) |
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
- **Scroll padding:** while the bar is open, `scroll-padding-bottom: var(--spacing-manager)` is set on the document.

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
| `bar` | `CwaUiManagerRow` | inline, left, `fg-muted` | in the ⓘ popover only | glyph button + popover (§4.4) | `control` |
| `modal` | `CwaUiDialog` | above, `text-label` | below | line below, from Save (§4.4) | `control-lg` |
| `page` | `CwaUiFormGroup` | above, `text-label` | below | line below, from Save (§4.4) | `control-lg` |

- v1's floating labels are dropped: they collided with the ⓘ, the "Optional" tag and the either/or group, and a label above reads better on a phone.
- There is no `labelPlacement` prop. `CwaUiTextarea` under `bar` throws in development and renders nothing in production.

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

`CwaFieldState` is read from the resources store (§8.4) in the bar; in modals and pages the field reads its state from the modal's local copy (§8.2). A control takes `:model` or `v-model`, never both (dev warning). Multi-model controls (the either/or group, FileUpload, ImageAlt) drive one status glyph in the bar from all their models.

Shared props: `label` (required; with `labelHidden` it is only the accessible name), `labelHidden`, `info`, `description`, `optional`, `placeholder`, `width`, `disabled`, `readonly`, `loading`.

### 4.2 Field shell (`core/ui/Field.vue`, internal)

- **Bar:** `Label ⓘ [ value ………… ▾ ]`. The label and ⓘ sit outside the fill. No space is reserved for a status glyph.
- **Modal and page:**
  ```
  Label · Optional ⓘ · Unsaved
  [ value ……………………………………… ▾ ]
  Helper text, or the error line
  ```
- The status glyph (`core/ui/FieldStatus.vue`) is its own component, reads only its field's state and owns the timers. It renders nothing in modals and pages, and nothing in the bar while the field is idle.

**Where the glyph goes in the bar (no reserved space):**

1. **Controls with an end icon** (Select and MultiSelect chevrons, the DatePicker's calendar icon, which sits at the trailing edge, ResourceSearch's chevron, an input's trailing suffix such as ↗): the state **replaces the icon in place** while it lasts. The chevron becomes the spinner while saving, the tick for 1.5 s once saved, then the chevron returns. Error and conflict show their solid glyph there, as the button that opens the popover. The end icon sits in a 1rem box (a 0.75rem chevron has 0.125rem either side), the same as the glyph, so nothing moves. While the state shows, the icon is hidden, and a click on the control's body still opens its menu. The glyph button is a sibling of the trigger button, never inside it.
2. **Plain text inputs and steppers:** the field's **inner end padding widens only while a state shows**, from `field-x` (0.75rem) to 2.25rem (the 1rem glyph and a 0.5rem gap), and the glyph sits in it. The field's outer width is fixed by its `width` token, so nothing around it moves; long text inside truncates 1.5rem earlier while the glyph shows. In a stepper the glyph sits between the value and the + button. Error and conflict also tint the whole field.
3. **Modals and pages:** no glyph inside any field. "· Unsaved" stays after the label; errors and conflicts stay on the line below (§4.4, §8.2). The error and conflict tints remain.

| State | Fill | Line | Bar glyph (modal and page: none) |
|---|---|---|---|
| default | `field` | none | none; the end icon, if any, shows |
| hover | `field-hover`; on an error or conflict field the tint darkens slightly and never reverts to grey; suppressed while the pointer is on a nested control (§2.7) | none | — |
| focus | `field` | 2px `accent-fg` ring | — |
| disabled | `field` at 50% opacity | none | — (a reason goes in `info`) |
| read-only | transparent, value in `fg` | none | copy button where useful |
| unsaved (modal, page) | `field` | none | none; the label row adds "· Unsaved" in `accent-fg`, 600 |
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
Title · Unsaved
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

In the bar, conflicts use the same popover with the diamond, `field-warning` and the copy "Mia changed this", their value, **Use Mia's** and **Keep yours**. In modals and pages a conflict is found by Save and shown as a choice under the field (§8.2).

### 4.5 Info

- **Opt-in:** a field shows an ⓘ only when it has `info` (a string, or an `#info` slot for a link).
- **Glyph:** a solid circle with a knocked-out "i", 1rem, `fg-muted`, straight after the label text (after "· Optional"), 0.375rem away. Never pushed to the far end of the row.
- **Modal and page: a note in place.** A button named "About Title" with `aria-expanded`/`aria-controls`; click or tap inserts a note between the label row and the field (`accent` tint, `text-helper`, a close ×). The field moves down, so the note never covers the field, its helper line or the field above, and it works the same on a phone. Clicking ⓘ again or × closes it.
- **Bar: a popover**, because the row has no room. It is titled with the field's name, has a close ×, a square caret pointing at the ⓘ, and opens above or below by collision (in the bar, usually above). Escape or an outside tap closes it.
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
| `CwaUiButton` | reka `Primitive` | `tone`, `variant: 'solid' \| 'soft' \| 'ghost'`, `icon`, `iconOnly`, `label`, `loading`, `disabled`, `disabledReason`, `to`, `type`, `options` (split button, below). Square. `solid` = tone fill; `soft` = `field` fill (replaces "outline": no borders); `ghost` = no fill until hover. Height follows the surface's control token; padding-x 1rem (0.75rem with an icon). |
| `CwaUiSpinner` | — | `size: 'sm' \| 'md'`, `aria-hidden` |
| `CwaUiProgress` | reka `Progress` | `value?`, `label`; a 0.25rem square-ended bar |
| `CwaUiBadge` | — | `tone`, `icon?`; square, `text-flag`, padding 0.125rem 0.5rem, tinted fill |
| `CwaUiReadonly` | — | `value`, `mono`, `copy`; middle ellipsis, full value in a popover with Copy |

**Split button** (`CwaUiButton` with `options`; consumer: the bar's primary action, today's `CurrentResourceCta` and `NewResourceCta`):
- Two square buttons 1px apart: the main action, and an arrow button with its own accessible name, **"More actions"**, `aria-haspopup="menu"` and `aria-expanded`. Each has its own hover and pressed fill; they are siblings, so only one shows hover (§2.7).
- The arrow opens a kit menu (`role="menu"`, §5.3) aligned to the split button's end edge: on click, Enter, Space or ArrowDown (a keyboard open highlights the first enabled item). Arrow keys, Home and End move through it, skipping disabled items; Enter or Space picks; Escape or Tab closes it, and Escape returns focus to the arrow. It opens with the menu motion (§2.8) and closes instantly. Below `sm` it opens as a bottom sheet.
- `options` is a list of items and groups; groups are separated by a 1px `line` divider (`role="separator"`). A disabled item is muted and shows its reason as a second line, never on hover. A destructive item uses `danger-fg` text.
- **Options for a selected existing component** (from `CurrentResourceCta`): a group of **Add before** and **Add after** (for a selected group: **Add to start** and **Add to end**), then **Clone**, then **Move** (only when the component can be moved, i.e. `moveFrom` resolves). When the target group is full (`componentGroupCapacity`), the add items are left out and one disabled row takes their place: "Add before or after", with "Main content is full: 6 of 6 components." under it. The main action is Publish now, Schedule or Cancel schedule.
- **A new, unsaved component** (from `NewResourceCta`): the main action is **Add**; the menu holds **Add and publish**, a divider, then **Discard** (danger), which confirms with the in-page confirm (§8.5) before discarding. Today's module labels the main action "Add Draft" for a publishable component; the proposal shortens it to "Add", since the status already says it is a draft.
- Copy is sentence case ("Add before", "Add and publish"), replacing today's title case.

### 5.2 Inputs

| Component | Base | Bar | Notes |
|---|---|---|---|
| `CwaUiInput` | native | yes | `type`, `inputmode`, `nullable`, `prefix`/`suffix` slots |
| `CwaUiNumber` | reka `NumberField` | yes | commits on blur, Enter, step or unmount; in the bar a state glyph appears between the value and the + button only while it shows (§4.2); the −/+ buttons are the field's full height, with `step-hover` and `step-press` over the field's fill (error and conflict tints included), and the field's own hover is suppressed while the pointer is on one (§2.7) |
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

**Searchable** (ResourceSearch, MultiSelect, a Select with `searchable`): the trigger itself becomes the search input when open (combobox), filtering as you type, with the matched text in 600 weight. States inside the menu: "Searching…" with a spinner, "No matches for "abc"", and a failed load with Retry. Page results show the title, with the path as the second line, and match on either.

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
- **Action menus** (a row's ⋯, a modal's ⋯) use the same system with `role="menu"`: an anchored menu on wide screens, a bottom sheet below `sm`.

---

## 6. The either/or field group

### 6.1 Pattern

Some resources store **exactly one of several fields**: a link is a `route` *or* a `rawPath`; a media block might be an `image` *or* a `video`. `CwaUiEitherOr` is the kit pattern for all of them (Q7, decided).

```vue
<CwaUiEitherOr :iri="iri" label="Link">
  <CwaUiEitherOrOption label="Page" :fields="['route']">
    <CwaUiResourceSearch :model="route" label="Page" label-hidden endpoint="/_/routes" />
  </CwaUiEitherOrOption>
  <CwaUiEitherOrOption label="URL" :fields="['rawPath']">
    <CwaUiInput :model="rawPath" label="URL" label-hidden type="url" />
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

A preset of the group with the Page and URL options and `route`/`rawPath` defaults (`route?`, `rawPath?` props rename them). It creates its own models so authors cannot forget `debounceTime: 0`: a page pick saves at once, a URL is debounced. URLs are validated (`/path` or `http(s)://`) before sending, and an off-site URL shows ↗. Title search on routes depends on the bundle (`/_/routes` filtering by page title), recorded in the bundle's CLAUDE.md.

---

## 7. The manager bar

- **One row, never stacked.** Height is `h-manager`, as is its spacer. The row scrolls horizontally with 2.5rem edge fades (a `mask-image` from `data-overflow-start/end`, set by a `ResizeObserver` and a passive scroll listener with injectable measurements). "Scroll fields left/right" arrows appear only at a hovered edge on a fine pointer, and never while a field in the row has focus, so they never cover what you type. Coarse pointers have no arrows: the fade and a visible peek of the next field carry the hint. Native Shift+wheel, trackpad and touch pans (including one starting on an input) scroll it. **Focus scrolls the whole field into view, label included**, clear of the fades (2.5rem). Every sample row of bar controls, wherever it appears, uses the same fades.
- **Row:** inline padding `row-x`, block `row-y`, gap `row-gap`. `CwaUiManagerRowDivider` is a 1px `line` rule, 1.5rem tall, centred in the gap. Labels and fields are vertically centred on one baseline.
- **Tab strip** (`core/admin/ManagerTabs.vue`, reka `Tabs`): tab names in `text-label`, padding 0 1rem, selected = `fg` text with a 2px `accent` bar along the bottom edge (a selection indicator, not a field border). The bar is one sliding indicator (reka `TabsIndicator`, §2.8), shared by the bar and modal tabs. Scrolls with the same fades, and selecting a tab scrolls it fully into view. A tab with an error or held conflict shows the solid triangle or diamond, read from the store, so it survives the tab unmounting.
- **Pinned end** (`core/admin/BarSummary.vue`): the status button and the primary action as a **split button** (Publish now, Schedule, Cancel schedule, or Add for a new component, plus the "More actions" arrow; §5.1), **always in the tab row, top right, level with the tabs, on every tab and at every width**. They never move into the field row, so the field row always has the bar's full width and the action never jumps when the tab changes. The tab strip scrolls (with fades) in the space to their left. A divider separates them from the tabs. Buttons are the tab row's height less 0.5rem on fine pointers, and the full tab row height (2.75rem) on coarse ones; the arrow is square at the same height. The status is always a solid glyph **plus words**: ≥ `lg` "Draft · not live", "Saving…", "All changes saved", "1 not saved →", "1 conflict →"; below `lg` a short word ("Draft", "Saving…", "Saved", "1 not saved", "1 conflict"). It is a button: with an error or conflict it jumps to the field and opens its popover; otherwise it opens a popover with the full status. A spinner is never shown without "Saving…".
- **Phones** (bar narrower than 40rem): the same place, compact: the status is a glyph and a short readable word ("Draft", "Saving…", "Saved", "1 not saved"), never a bare dot, and the action is shortened to "Publish". The split button sits **flush against the right edge**, the arrow last, both 2.75rem tall and the arrow 2.75rem wide, and its menu opens as a bottom sheet. It meets the right edge of the window with no gap (the tab row's end has no padding at this width, on touch as well: v3's mockup kept 0.25rem there because the coarse-pointer padding outranked the narrow-bar rule), at the tab row's full height (2.75rem, thumb-sized) and with its own inner padding; the tab strip keeps the row's left padding. With a right-side safe-area inset (a landscape notch), the arrow's fill extends into the inset and its glyph stays clear of it: `width: calc(2.75rem + env(safe-area-inset-right))` with the inset as its right padding. Text fields are sized `calc(100cqw - 9.5rem)`, so a field and its label take most of the row and the next field peeks in; the row uses `scroll-snap-type: x proximity` with each field as a snap point. Controls are 2.75rem.
- **Multi-line content** is edited in-line on the page. The bar shows `CwaUiInlineHandoff`: `Description "Our kitchens are made in…" [Edit on page]`. Edit on page scrolls the template's registered editor clear of the bar, focuses it and flashes an `accent-fg` outline for 600 ms; Escape returns focus to the button. With no registered editor, the button reads **Edit…** and opens a dialog with `CwaUiTextarea`.
- **Escape order:** popover or menu, inline edit, on-page editor, dialog, clone mode, deselect.

Module tabs on the row: `DynamicPage` (three selects · divider · status text), `Publish` (`Edit published version` toggle with `info`, `Schedule` toggle, date picker; the action is pinned), `Group`, `ResourceInfoTab` (`CwaUiReadonly`, badges), `Ui` (UI select, Style select or multi-select; where the options come from is the separate configuration job), `Order` (`CwaUiNumber width="xs"`).

---

## 8. Modals, pages and save state

### 8.1 Modal form layout

| Part | Spec |
|---|---|
| Width | `size`: `sm` 28rem, `md` 36rem (default), `lg` 48rem; full screen below `sm` and in short landscape |
| Header | 3.75rem tall, padding 0 `--spacing-dialog`; `text-title`; close button (ghost, square, 2.75rem) at the end; sticky |
| Tabs | optional, under the header and sticky with it: 2.75rem, the bar's tab look and sliding indicator, scrolls with fades on a phone; the first tab's text lines up with the title |
| Body | padding `--spacing-dialog`; scrolls; fields full width |
| Field block | label row → 0.375rem → field → 0.5rem → helper/error. Blocks are `--spacing-stack` (1.5rem) apart. No dividers between fields. |
| Sections | `CwaUiFormSection`: heading `text-section` (1rem / 650), optional description `text-helper` `fg-muted` 0.25rem below, then 1.25rem to the first field (1rem with no description). A section with no heading adds no top space, so an untitled form's padding is even on all sides. Sections are 2.5rem apart, separated by space alone. |
| Columns | `columns: 2` on a section puts short fields side by side, 1rem column gap, 1.5rem row gap; it collapses to one column when the dialog's content box is under 32rem (container query) and at 200% zoom |
| Toggles | a toggle row is label left, toggle right, helper below the label; the row is 2.75rem tall and the whole row toggles |
| Footer | sticky, `surface-raised` fill, padding 1rem `--spacing-dialog` (0.75rem plus the safe-area inset on a phone); actions right-aligned with 0.75rem gap: a short state text in `fg-muted` ("Choose 2 versions", "2 to fix"; hidden on a phone, where the alert says it), secondary (`soft`) then primary (`solid`); a destructive action sits alone on the left (`ghost`, `danger`). Below `sm`: secondary and primary share the row 50/50, destructive moves into the header's overflow menu. |
| Keyboard | the sticky header and footer are sized against `visualViewport`; the focused field scrolls above the on-screen keyboard |

Whether a dialog uses its phone layout is decided by the **viewport or overlay width** (a named container on the overlay), never by the dialog's own width: a 36rem dialog on a desktop is not a phone.

`CwaUiFormGroup` (pages) uses the same field block, section and column rules on `surface`, with a max content width of 40rem.

### 8.2 Saving in modals and pages

Modals and pages (`CwaUiDialog`, `CwaUiFormGroup`) keep a Save button. Nothing is saved as you type. **Admin pages** (the `/_cwa` pages with forms, such as site settings or a user's page) use exactly this model: a local copy, a Save button, nothing saved as you type (decided in v4).

- **A local copy.** Fields edit a copy of the resource (`useItemPage`'s `localResourceData`). The bar is different: it saves each field as you type.
- **Unsaved changes are marked** at three levels: the field ("· Unsaved" after its label; nothing is drawn inside the field), its tab (a dot after the tab name), and Save, which counts them: "Save" (disabled, nothing changed), "Save 3 changes", "Saving…", then the saved check and "Saved" for 1.5 s. The count is the number of changed fields; the accessible name says "Save 3 unsaved changes".
- **Save sends only the changed fields**, as a merge patch, in **one request per resource** (normally one: the page; the page modal also sends one to the route when Routes changed it). Each carries `If-Match` with the stored version.
- **Client checks run first** (an empty required field, a value over its limit, a bad URL). Anything they catch is shown like a server error, and nothing is sent.
- **Errors returned by Save (422)** go on their fields, below them, linked with `aria-describedby` (§4.4). An alert at the top of the body says "This page wasn't saved. 2 fields need a change." and lists each field with its tab as a link that opens the tab and focuses the field. A request that succeeded clears its fields' markers; the failed request's fields stay unsaved.
- **A conflict (412) is shown when Save is pressed.** Nothing in that request is saved. A `warning` alert says "Mia saved this page while you were editing, so nothing was saved. Choose which version to keep for each field below, then Save again." Each field both of you changed gets the `field-warning` tint, the diamond, the line "Mia saved a different title while you were editing. Choose which to keep." and a two-option choice under it: **Use Mia's** (her value) and **Keep yours** (your value), square radio cards with the value in full. Choosing sets the field; Keep yours stays an unsaved change, and Use Mia's is no longer one. Fields only Mia changed take her value quietly, and the alert names them. Save stays disabled until every conflict has a choice, and the next Save carries Mia's version in `If-Match`.
- **Creating** uses the same button and flow, and the button **names what it creates**: "Create article", "Create page", never a bare "Create" or "Add" (decided in v4). The list's toolbar and empty state use the same words ("Create page"). It is always enabled; pressing it runs the client checks. One `POST` sends every filled field. On success the same modal becomes the edit view (§8.3).
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
- **Errors are per field.** `updateResource` returns `{ ok: true } | { ok: false; error }` to the model that sent it, so `removeByEndpoint` no longer clears another field's error.
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
| `actions` | 2.75rem per action | square `ghost` icon buttons, right-aligned; more than two go into a ⋯ menu |

- **Rows:** 3.5rem with one line, 4rem with two (4rem on coarse pointers). Padding 0 1rem, column gap 1rem, content vertically centred. Rows are separated by a 1px `line` divider; hover is `field-hover` at 50%; the selected row is an `accent` tint.
- **The whole row is the link** (to the item's modal); action buttons stop propagation.
- **Header row:** 2.5rem, `text-helper`, `fg-muted`, sentence case, same alignment as its column; sortable headers have a solid chevron.
- **Below `md`:** the grid becomes `lead · primary · actions(⋯)` (`primary · actions` in the page list). The second line is **status first** (the solid coloured dot and its word), then the date, then the path last, so only the path truncates: `● Scheduled · 15 Nov · /kitchens/handleless`. Rows are 4.25rem. Selection checkboxes are hidden, and a row is only highlighted while its checkbox is checked. The ⋯ menu opens as a bottom sheet.
- The checkbox sits in a 2.75rem label, so the whole cell is its tap area.

### 9.2 Toolbar, states, pagination

- **Toolbar** above the list, 1rem below the page heading and 1rem above the header row: `CwaUiSearchField` (filled, flexible width, search glyph, clear button), `CwaUiFilterToggle`s for the list's types (today's admin pattern: the page list has **Static**, blue, and **Dynamic**, yellow). Each is a square filled button, `--spacing-control` tall, padding 0 0.875rem 0 0.75rem, `text-label`: off = `field` fill with a 0.625rem dot in the type's colour before the name (`field-hover` on hover); on = filled in the type's colour (`aria-pressed="true"`), with its on-colour text (white on blue, stone-900 on yellow) and a solid check in place of the dot. None on shows every type; each on narrows to those types. Every list that filters by type uses the same toggles and colours its row dots to match (a status filter, if a list needs one, uses the same toggle with its tone's colour). Then a sort `CwaUiSelect width="sm"`, and the count ("143 pages") at the end. Below `md`: the search field takes the full width, and the toggles and the sort share one horizontally scrolling row with edge fades; the count is dropped.
- **States:** `CwaUiListState` for loading (skeleton rows at the real row height) and empty (a short sentence plus the primary action; centred, 3rem block padding). **Error** is a `danger` `CwaUiAlert` with Retry above the previous rows, which stay visible and dimmed, and the copy says how old they are.
- **Pagination** below the list, 1.5rem above: "1–20 of 143" on the left, `CwaUiPagination` on the right (square 2.75rem buttons with 1rem chevrons, current page `accent` fill). Below `sm`: Previous · "Page 2 of 8" · Next.

---

## 10. Feedback

- **Toasts** (`useCwaToast()`; consumer: apps' admin pages such as dons-hub's `useFlash`): square, 22rem wide (full width minus 1rem gutters on phones), `--spacing-popover`, a solid tone glyph, title, description and actions. Top-right below the admin header; on phones at the top, full width minus 0.5rem gutters, below the admin header, so they never cover the manager bar or its primary action. Upsert by `id`; at most 3 visible; success and info 4 s, warning 6 s, errors and any toast with actions stay until dismissed. Never toasted: routine saves, an error on a mounted field, "Copied".
- **Error copy:** raw `hydra:description` is never shown. Network: "You're offline. This wasn't saved." Server: "The server couldn't save this." Violation: the violation's own message. Precondition without real-time: "Someone else saved this first. Reload to see their version." No automatic resend when the connection returns. A failed save offers Retry and Reset (Retry all and Reset all in a toast for several), never Undo; Undo is only for something that happened and can be reversed.
- **`CwaUiAlert`** (modals and pages only): square, tinted fill, solid glyph, title, description, actions.
- **Loading:** spinner, progress and the existing sweep only. Every literal "Loading..." goes.

---

## 11. Accessibility and tests

- Contrast pairs from §2.1 are kept in a spec, measured against the fill each element sits on.
- Every field has a programmatic label; helper, info and error text are linked with `aria-describedby`; errors set `aria-invalid`.
- Every state has a distinct glyph shape as well as a colour; presence shows the name.
- `forced-colors`, `prefers-reduced-motion`, and `pointer: coarse` with 44px hit areas and 16px input text.
- **Browser scenarios:** the bar's height and the page's scroll are unchanged across every tab and state at 1280, 1024, 768 and 390px wide, and the status and primary action are in the tab row on every tab; a modal sends nothing until Save, Save sends only changed fields in one request per resource, a 422 badges and opens the failing tab, a 412 asks per field and the next Save carries the new version, and Create disables Routes and hides Info; only one element shows hover when the pointer is on a stepper button or a chip's ×; a textarea grows to 8 lines and then scrolls; a 10-field row scrolls and never wraps; a Select, MultiSelect and ResourceSearch open, filter and select by keyboard and by touch; the either/or group clears the other field in one request; an error's glyph opens its popover by tap; a bar field's outer box is identical in every state, a select's chevron is replaced by the state and returns after saved, and no modal or page field ever draws a glyph inside; Cancel, Escape, the backdrop and a navigation ask only when the local copy is dirty; no control's value is clipped vertically (descender-heavy values at bar, modal and touch sizes); the phone bar's split button ends at the window's right edge (0px); the "More actions" arrow opens its menu by click, Enter, Space and ArrowDown, Escape returns focus to it, and the menu shows Add before/after, Clone and Move for an existing component, the disabled reason for a full group, and Add and publish and Discard for a new one; a list aligns its columns at 1280 and collapses at 390; one run at 200% zoom.
- **Vitest per control:** states and `:model` wiring with real `computed` refs (#260); the store's `fieldStates` survive a re-fetch.

---

## 12. Phased plan

Each step is one PR into `dev` under an issue linked from #236, running `test`, `test:types`, `lint`, `build` and `test:e2e`, and stating any bundle-budget change.

| # | PR | Contents |
|---|---|---|
| 1 | Tokens and bar frame | §2 tokens, contrast spec, radius 0, fixed `h-manager`, `CwaUiManagerRow` wrapping, portalled flag layer |
| 2 | Field state | `fieldStates` in the resources store, the `updateResource` result, per-field errors, `retry`/`reset`, `NavigationGuard` hook; `useItemPage` keeps local edits through a re-fetch and reports per-field 422s and 412s |
| 3 | Field shell and first ports | `Field`, `FieldStatus`, error and info patterns; Input, Toggle, Button, Select, ResourceSearch; `BarSummary`; module tabs on the row |
| 4 | Toasts | `useCwaToast`, `Toaster`; `RequestErrors` and `Notification` removed |
| 5 | New controls | Number, Segmented, MultiSelect, EitherOr and LinkInput, FileUpload, DayPicker |
| 6 | Modals, pages, lists, auth | Dialog (with tabs and the Save model), FormSection, FormGroup, Confirm/Prompt, list grid, SearchField, FilterToggle, Pagination, ListState, Alert, Textarea; `Modal*`, `DialogBox`, Headless UI and `popper.ts` removed |
| 7 | In-page editing | InlineText, InlineHandoff, EditPlaceholder, LinkPopover, ImageAlt, ImageSlots, DayRangePicker |
| 8 | Site migration | template tabs, then CK; migration notes; the docs repo `documentation` issue |

The v1 migration map (`04-proposal.md` §9) still applies, with two changes: `variant: 'outline'` becomes `'soft'`, and `hint` becomes `info`/`description`.

---

## 13. Open questions for Daniel

1. **Page data fields.** Page data has no SFC, but its fields should be nicely configurable for the page data modal. Where that configuration lives is decided with the separate configuration job; the kit only needs the modal layout in §8.1 to render whatever it declares. Kept open.
2. **Palette:** approve stone-200 (light field fill), blue-400, blue-700, amber-700, lime-800, red-700 and red-400, or name replacements?
3. **Filled fields and WCAG 1.4.11.** A field's fill is 1.7:1 (dark) and 1.3:1 (light) against the surface, under the 3:1 a strict reading asks of a control's boundary. The mitigations are an always-visible label, 4.5:1 placeholder and value text, 3:1 glyphs and a forced-colors outline. Accept, or darken the dark fill to stone-600 (2.3:1) at the cost of a heavier look?
4. **`field="…"` shorthand** on kit inputs inside a tab (consumer: 153 title tabs), keeping `:model`: yes or no?
5. **Model names:** `state`, `retry`, `reset` on the model, the `updateResource` result object, and the `fieldStates` shape in §8.4?
6. **Bottom-sheet menus on phones** (§5.3): yes, or keep anchored popovers everywhere?

Decided in v4 (removed from this list): admin pages use the modal Save model (§8.2); create buttons name what they create (§8.2); Cancel, close and leaving ask before discarding unsaved changes, and the tab's close uses `beforeunload` (§8.5); on touch every control's value is 1rem (§2.3).

Settled in v3: conflicts in modals (former Q6) are per field, shown when Save is pressed (§8.2); `useItemPage` must keep local edits through a re-fetch. The type colours (`type-static`, `type-dynamic`) join Q2's palette list.

# CWA Admin UI Kit: final proposal (#236)

**From:** UI design. **For:** Daniel (decision owner) and module developers.
**Builds on:** `01-requirements.md` (the brief, cited as §n / Rn), `02-design-draft.md`, `03-review-feedback.md` (triage cited as T1–T9).
**Status:** proposal. Nothing is built. Every public name has a named consumer (R7); anything without one is internal and lives in `core/`.

Changes from the draft, in short:
- `defineCwaConfig` is not designed here: it was agreed on #453 and is built in its own PR (see §8).
- The bar wraps every tab in the row itself, and conflicts no longer widen the row.
- Field state survives unmount.
- Nothing promises an offline resend.
- Contrast is fixed, and sizes are in rem with a touch step.

---

## 1. Principles

1. **The row is the unit.** `ResourceManager.vue` provides the `bar` surface and wraps every tab in `CwaUiManagerRow`, so a tab cannot stack fields. No prop puts a label above a field in the bar, and a textarea is refused there.
2. **State lives at the field, in reserved space.** Saving, saved, error, conflict and presence are drawn in a 1 rem status slot that every field reserves. A state change never moves anything sideways or down.
3. **Bind once.** `:model="title"` wires the value, presence, conflict, save state and errors. `v-model` remains for values that are not resource fields.
4. **Quiet when it works, visible when it fails.** A save shows a tick. A failure stays visible until it is resolved: a ⚠ in the slot, a pinned "1 not saved →" in the bar, and a badge on the tab. Nothing blocks typing.
5. **One of each.** One button, one select, one disabled look, one spinner, one popover system (reka-ui, portalled into the app's container), one toast stack.
6. **Hover never hides information.** A tooltip only repeats something already on screen. Their value, error text, reasons, full IRIs and time zones sit behind a tappable ⓘ or popover.
7. **Admins only, loaded late.** Kit code is lazy and admin-only. Visitors pay only for what they already pay for (the styles template #453 adds for `ResourceLoader`).

---

## 2. Tokens

The tokens live in the `@theme` block of `src/tailwind/tailwind-cwa.css` and are used as `cwa:` utilities. They are emitted as `--cwa-*`. Every size is in rem, so text zoom scales the controls.

### 2.1 Colour

Primitives come from the existing palette (stone, blue, magenta, orange, the existing green and danger red). `indigo`, `gray` and `neutral` are removed once the last component has moved off them. **The shades marked † are outside R5's list and need Daniel's approval (Q9).**

| Token | Use | Dark (default) | Light (`cwa:theme-light`) |
|---|---|---|---|
| `surface` | bar, modal, page | stone-900 `#1c1917` | `#ffffff` |
| `surface-raised` | popover, menu, toast | stone-800 `#292524` | stone-100 `#f5f5f4` |
| `surface-sunken` | control fill | stone-900 at 85% + blur | `#ffffff` |
| `line` | **dividers only** | stone-700 `#44403c` | stone-300 `#d6d3d1` |
| `line-strong` | **every input boundary**, hover | stone-400 `#a8a29e` (6.9:1) | stone-500 `#78716c` (4.8:1) |
| `fg` | text | stone-100 | stone-900 |
| `fg-muted` | inline labels, hints, placeholders | stone-400 | stone-600 `#57534e` |
| `accent` | primary fill, selected tab, toggle on | blue-600 `#2563eb` (fill only) | blue-600 |
| `accent-fg` | focus ring, links, accent text | blue-400 † `#60a5fa` | blue-700 † `#1d4ed8` |
| `success` | saved tick | green `#9cdd05` | lime-800 † `#3f6212` |
| `warning` | conflict, long wait | orange `#ffaa00` | amber-700 † `#b45309` |
| `danger` | error outline, icon | `#ef4444` | red-700 † `#b91c1c` |
| `danger-fg` | **error text** | red-400 † `#f87171` | red-700 † |
| `highlight` | reorder, clone, selection | magenta `#e30a6c` | magenta |

Rules:
- `accent` is never used for text or for a thin line. On stone-800 it is 2.93:1, so a selected tab or toggle inside a popover takes an `fg` check mark as well.
- `danger` is 4.03:1 on `surface-raised`, so text uses `danger-fg`.
- PR 1 recomputes every pair against `surface`, `surface-raised` and the blurred `surface-sunken` over a white page, and the spec file holds the table. The targets are 4.5:1 for text and 3:1 for boundaries and icons.
- The light scope is `@utility theme-light`, with its own `surface-sunken` and a light `accent`.
- Every state has an icon or text as well as its colour. Presence colours still come from `presenceColour`.
- Under `forced-colors: active`, outlines use `CanvasText` and `Highlight`, and the status icons stay.

### 2.2 Type

New names, so Tailwind's `text-sm` is not redefined:

| Token | Size | Use |
|---|---|---|
| `text-flag` | 0.75rem | presence flag, badge (the floor is 12 px) |
| `text-control` | 0.875rem | controls, inline labels, menu items (the floor for body text is 14 px) |
| `text-label` | 0.875rem medium | field labels, buttons |
| `text-title` | 1rem | modal titles, page headings |

The system font stack. `tabular-nums` on numbers, counts and pagination. Text in the bar truncates and never wraps.

### 2.3 Sizing and the bar's height

| Token | Fine pointer | `pointer: coarse` |
|---|---|---|
| `--spacing-control` (bar and list control) | 2rem | 2.75rem (44 px) |
| `--spacing-control-lg` (modal and page) | 2.5rem | 2.75rem |
| `--spacing-manager-tabs` | 2.25rem | 2.75rem |
| `--spacing-manager-row` (control plus 1rem padding) | 3rem | 3.75rem |
| `--spacing-manager` (tabs plus row: the bar and its spacer) | 5.25rem | 6.5rem |
| `--spacing-status` (the reserved status slot) | 1rem | 1rem, with a 2.75rem hit area |
| `--spacing-row-gap` | 0.75rem | 0.75rem |

Notes:
- **R1 reading (confirm, Q8):** the bar is one constant height for every tab and state, and that constant differs only by pointer class.
- Presence flags are portalled into a layer at bar level that follows the row's scroll (T2), so there is no 20 px lane. If the browser test shows that the portal drifts, the fallback is a lane of 1.25rem inside the row.
- The row always sets `overflow-y: hidden`.
- Hit areas on coarse pointers are at least 44 px, through padding or a pseudo-element.

**Field widths** (`width` prop, replacing hand-picked `w-*`):

| `width` | Size | Typical use |
|---|---|---|
| `xs` | 4rem | number, order |
| `sm` | 8rem | short select, date-only |
| `md` | 12rem | title, label (default) |
| `lg` | 18rem | URL, resource search, link input |
| `auto` | content | toggle, segmented, button |

These defaults are chosen so that a typical tab (title, link, toggle, Publish) fits at 1280 px without scrolling.

### 2.4 Radius, motion, elevation

- **Radius:** `radius-control` 2px, `radius-popover` 6px, `radius-full`.
- **Motion:** `--ease-out`, `--duration-fast` 120 ms, `--duration-base` 200 ms, `--duration-slow` 300 ms.
- **Reduced motion:** opacity only, the sweep becomes a static bar, and the spinner slows to one turn every 2 s.
- **Timers** live in the status slot, not in tokens (T3).
- **Focus ring:** 2px `accent-fg`, offset 2px, with a `surface` gap. It is drawn *outside* any state outline (danger, warning, presence), so a field that is focused and in error still shows both.
- **Elevation:** `z-index` tokens are unchanged. Toasts use `notifications`. All popovers portal into `useNuxtApp().vueApp._container`.
- **Scroll padding:** while the bar is open, `scroll-padding-bottom: var(--spacing-manager)` is set on the document, so focus never lands under the bar.

---

## 3. Surfaces decide the label

| Surface | Provided by | Label | Secondary text | Control |
|---|---|---|---|---|
| `bar` | `ResourceManager.vue` (through `CwaUiManagerRow`) | inline, left, `fg-muted` | status slot plus ⓘ or popover only | `control` |
| `modal` | `CwaUiDialog` | floating (rests at 14 px, floats at 12 px or more) | helper and error line below | `control-lg` |
| `page` | `CwaUiFormGroup` | above | helper and error line below | `control-lg` |

- There is no `labelPlacement` prop.
- In development, `CwaUiTextarea` under `bar` throws. In production it renders nothing.
- A dev-only `ResizeObserver` on the row warns, naming the tab, when the row's content is taller than one control.

---

## 4. Component catalogue

Every name is listed with its file under `src/runtime/templates/components/`. `CwaUi` names come from the path under `ui/`. Shared props are only those that every control honours:

- **Shared props:** `label` (required, and the accessible name with `labelHidden`), `labelHidden`, `hint`, `optional`, `placeholder`, `width`, `disabled`, `readonly`, `loading`.
- **Tone:** one union everywhere, `CwaUiTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'`.

### 4.1 Binding contract

```ts
interface ResourceModelField<T = unknown> {
  iri: string
  field: string
  model: { value: T | null | undefined }
  remoteChange: { readonly value: RemoteFieldChange<T> | undefined }
  focusedBy?: { readonly value: FocusedPeer[] }
  focusListeners?: { onFocusin(): void; onFocusout(e: FocusEvent): void; onPointerdown(e: PointerEvent): void }
  states: {
    pendingSubmit: { readonly value: boolean }
    submitting: { readonly value: boolean }
    isLongWait: { readonly value: boolean }
    lastSavedAt: { readonly value: number | undefined }
    error: { readonly value: CwaFieldError | undefined }
  }
}
interface CwaFieldError { kind: 'network' | 'server' | 'violation' | 'precondition'; message: string; retry(): Promise<void>; undo(): void }
```

- **One binding at a time.** A control takes `:model` or `v-model`. Passing both gives a dev warning. A `:model` control never emits `update:modelValue`, and a model object arriving through `v-model` also gives a dev warning.
- **`iri` and `field`** let the shell derive the target badge: a field whose `iri` is not the selected resource shows "Saves to this page's data". There is no hand-set `target` prop.
- **Multi-model controls** (LinkInput, FileUpload, ImageAlt, ImageSlots) follow a documented contract:
  - one *primary* model drives the status slot, presence and the live-region name;
  - errors and conflicts from any of their models surface in that slot;
  - `label` is still required.

### 4.2 Primitives

| Component (file) | Base | API | Notes |
|---|---|---|---|
| `CwaUiButton` (`ui/Button.vue`) | reka `Primitive` | `tone`, `variant: 'solid'\|'outline'\|'ghost'`, `icon`, `iconOnly`, `label`, `loading`, `disabled`, `disabledReason`, `to`, `type`, `options` (split button with `DropdownMenu`) | `loading` swaps the icon for a spinner at a stable width and sets `aria-busy`. A disabled button with a reason uses `aria-disabled` and keeps focus, so its ⓘ is reachable. |
| `CwaUiSpinner` (`ui/Spinner.vue`) | — | `size: 'sm'\|'md'` | `aria-hidden`; its parent carries the label. |
| `CwaUiProgress` (`ui/Progress.vue`) | reka `Progress` | `value?` (none means indeterminate), `label` | Replaces `ui/ProgressBar.vue`. |
| `CwaUiTooltip` (`ui/Tooltip.vue`) | reka `Tooltip` | `text`, `side` | Repeats only what is already visible (principle 6). |
| `CwaUiHint` (`ui/Hint.vue`) | reka `Popover` | `text?`, default slot | A tappable ⓘ, 1.5rem, or 2.75rem on coarse pointers. Its content is linked with `aria-describedby`. |
| `CwaUiBadge` (`ui/Badge.vue`) | — | `tone`, `icon?`, slot | |
| `CwaUiReadonly` (`ui/Readonly.vue`) | — | `value`, `mono`, `copy` (default true) | Middle ellipsis. The full value is in a popover, with Copy; the copy confirms with the slot's tick. Replaces `ModalInfo` and the IRI in `ResourceInfoTab`. |

### 4.3 Field shell (`core/ui/Field.vue`, internal)

Every input renders inside it.

- **Bar layout, one line:** `Label [control……] ◌`, where ◌ is the always-reserved status slot.
- **Modal and page layout:** the label (floating or above), the control with the slot at its trailing edge, then a helper or error line below.
- **Rendering cost:** the status slot (`core/ui/FieldStatus.vue`) is its own component. It reads only that field's refs and owns the timers, so a state change re-renders 1rem of the page, not the whole tab.

| State | Source | Bar | Modal / page |
|---|---|---|---|
| default / hover | — | 1px dotted `line-strong`; solid on hover | same, `control-lg` |
| focus | — | solid outline plus the offset ring (§2.4) | same |
| disabled | `disabled` | 50% opacity, `not-allowed`, no focus listeners; a reason goes in `hint` | same |
| read-only | `readonly` | no outline, copyable | same |
| loading | `loading` | spinner in the slot | same |
| pending | `pendingSubmit` | nothing while typing; a small dot after blur | same |
| saving | `submitting` for more than 300 ms | spinner, `aria-busy` | same |
| long wait | `isLongWait` | clock glyph in `warning`; the ⓘ says "Still saving: the server is slow" | text below |
| saved | `lastSavedAt` changed, and nothing newer is pending | `success` tick for 1.5 s (the slot's timer) | same |
| error | `states.error` | `danger` outline plus a ⚠ button; its popover holds the message, **Retry** and **Undo my change** | message and buttons below |
| conflict | `remoteChange` | `warning` outline plus a ⚠ button; its popover holds "Mia changed this", their value (`formatValue`), **Use Mia's** and **Keep yours** | same content below the field |
| presence | `focusedBy` | peer outline plus a portalled flag that fades after 3 s (`useFreshFlags`) | flag above |

**Announcements:** one polite live region per surface. It announces errors, conflicts, long waits, and a save that succeeds after an error ("Title saved"). It stays silent for routine saves and pending states. Errors are not assertive inside a field; error toasts are (§7).

### 4.4 Inputs

| Component (file) | Replaces | Base | Bar | Additions |
|---|---|---|---|---|
| `CwaUiInput` (`ui/Input.vue`) | `CwaUiFormInput` (`ui/form/Input.vue`, kept as an removed (no backward compatibility; CHANGELOG + README)), `ModalInput`, the list search input | native | yes | `type` (text, email, url, tel, password, search), `inputmode`, `nullable`, `prefix`/`suffix` slots, client validation for url, email and tel |
| `CwaUiNumber` (`ui/Number.vue`) | `Order.vue` input, perPage, lat/lng | reka `NumberField` | yes | `min`, `max`, `step` (`'any'` allowed), `nullable`, `stepper`. **Commits on blur, Enter, a step click or unmount.** A commit while unmounting registers through `registerPendingUpdate`. It emits `update:modelValue` only on commit, plus a `commit` event. |
| `CwaUiTextarea` (`ui/Textarea.vue`) | settings sitemap/robots, modal descriptions | native | **no** | `rows`, `autosize`, `maxlength`, `counter` |
| `CwaUiToggle` (`ui/Toggle.vue`) | `CwaUiFormToggle` (Headless UI `Switch`) | reka `Switch` | yes | The label never changes with the state. |
| `CwaUiSegmented` (`ui/Segmented.vue`) | `ModalRadioTabs`, either/or toggles, tri-state | reka `ToggleGroup` | yes | `options: { label, value, icon?, disabled?, reason? }[]` (2 to 5), `nullable` (a leading "Unset") |
| `CwaUiSelect` (`ui/Select.vue`) | `ui/Select.vue`, `ui/form/Select.vue`, `PageTypeSelect`, `FilterSelect`, `ModalSelect` | reka `Select` | yes | Generic `options: SelectOption[]` (`label`, `value`, `description?`, `disabled?`, `reason?`, `group?`), `by`, `nullable` (adds a "None" option) and `clearable` (a × button), which are independent. A `source: { endpoint, property }` (prefix-free) puts loading and error in the slot. An unmatched stored value shows as "Unknown: <value>". |
| `CwaUiMultiSelect` (`ui/MultiSelect.vue`) | `CwaUiSelect multiple`, Nuxt UI `USelectMenu` | reka `Combobox` | yes | Same `options`/`source`, plus `max`. **In the bar:** the first chip plus "+N" at a fixed `width`, never a nested scroller; tap or focus opens a popover listing the chosen items. The accessible name lists the labels. Backspace highlights a chip, and a second Backspace removes it, with Undo. Chips with × appear only in modals and pages. |
| `CwaUiResourceSearch` (`ui/ResourceSearch.vue`) | `CwaUiFormSearchResource` | reka `Combobox` | yes | `endpoint` (prefix-free), `property`, `searchProperties`, `nullable`. Accepts an IRI or an embedded resource and emits the IRI. A 250 ms debounce. |
| `CwaUiLinkInput` (`ui/LinkInput.vue`) | 24+ link tabs | Segmented + ResourceSearch + Input | yes | §4.5 |
| `CwaUiDatePicker` (`ui/DatePicker.vue`) | exists | reka | yes | The emit type becomes `string \| null`, props are destructured, and the label goes through the shell. |
| `CwaUiDayPicker` (`ui/DayPicker.vue`) | Nuxt UI `UCalendar` (CK) | reka `DateField` + `Calendar` | yes | `'YYYY-MM-DD' \| null`, `min`, `max`, `nullable`. Clearing emits `null`. |
| `CwaUiDayRangePicker` (`ui/DayRangePicker.vue`) | `UCalendar range` (SR) | reka `RangeCalendar` | yes | `{ start, end } \| null`. Its dates are re-derived when the model changes. |
| `CwaUiFileUpload` (`ui/FileUpload.vue`) | `CwaUiFormFile` (`ui/form/File.vue`) | native + reka `Popover` | yes | §4.6 |
| `CwaUiImageAlt` (`ui/ImageAlt.vue`) | 13 CK files, 5980bc, dons-hub | FileUpload + Input | yes | `upload`, `alt: ResourceModelField<string>`. With no alt, the chip reads **Add alt text** and opens the alt popover, whose placeholder holds the hint. |
| `CwaUiImageSlots` (`ui/ImageSlots.vue`) | CK `AboutFeatureGrid` and others | FileUpload × n | yes | `items: { label, upload }[]` |
| `CwaUiInlineEdit` (`ui/InlineEdit.vue`) | the modal's raw title input | — | no | Opens on click, Enter or the pencil button (always visible on coarse pointers). Enter commits and Escape reverts. It emits `update:modelValue` only on commit, plus `commit`. |
| `CwaUiInlineHandoff` (`ui/InlineHandoff.vue`) | prose crammed into bar inputs | — | yes | §6 |

Deferred until a consumer asks for them (COULD): `CwaUiSwatchSelect` and `CwaUiIconSelect`.

### 4.5 `CwaUiLinkInput`

```ts
props: { iri: string; label: string; route?: string /* 'route' */; rawPath?: string /* 'rawPath' */;
         width?: 'md'|'lg'; disabled?: boolean }
slots: { extra?() }
```
`Link  [Page | URL]  [/about-us ▾]  ↗  ◌`

- **It creates its own models** from `iri` and the two field names, so authors cannot forget `debounceTime: 0`. A page pick saves at once, and a URL is debounced.
- **Switching segment never writes anything.** The other side is cleared only when a value is committed, so flipping to URL and back does not wipe the link. A commit that clears the other side offers **Undo** in the slot's popover for 5 s.
- **The write path is Q7.** The recommendation is one `updateResource` carrying both fields (still merge-patch with changed fields only), so there is no transient both-set state and no 422 from the either/or validator.
- URLs are validated (`/path` or `http(s)://`) before sending. An off-site URL shows ↗ with an ⓘ "Opens in a new tab".
- **Page results** show the title with the path below and match on either. Title search depends on the bundle (`/_/routes` filtering by page title), which is recorded in the bundle's CLAUDE.md.
- A conflict on the hidden side puts a ⚠ marker on that segment. It never switches the segment.

### 4.6 Upload binding

`useCwaResourceUpload(iri, prop)` returns `upload` (renamed from `bind`, which is removed):

```ts
interface CwaUploadBinding {
  iri: string; field: string
  file: { readonly value: { url: string; thumbnailUrl?: string; filename: string; size?: number } | null }
  phase: { readonly value: 'idle' | 'preparing' | 'uploading' | 'storing' }
  progress: { readonly value: number | undefined }
  error: { readonly value: CwaFieldError | undefined }
  focusedBy: { readonly value: FocusedPeer[] }; focusListeners: ResourceModelField['focusListeners']
  select(file: File): Promise<void>; remove(): Promise<void>; disabled: { readonly value: boolean }
}
```

- **Anatomy in the bar:** `[thumb] filename · 240 KB [Replace] [🗑] ◌`. When empty: `[⬆ Upload image] ⓘ`.
- **Phase text** goes in the filename slot ("Preparing image…", "Uploading 40%"). A 2px progress line runs under the chip.
- **The old thumbnail stays** until the new file is stored, and comes back if the replace fails. Retry re-sends the already downscaled file.
- **Remove** asks for confirmation through the kit dialog.
- **Drop target:** the chip. The button keeps it usable from the keyboard and on touch.
- **Presence:** the upload reports focus like any field, so peers see who is replacing an image.
- An upload that finishes after its field has unmounted raises a success toast.

### 4.7 Manager bar layout

#### Bar frame (`main/admin/resource-manager/ResourceManager.vue`, internal)
- **Height** is `h-manager`, and the spacer's is too. The `clientHeight` watch and `min-h-[74px]` are removed.
- **Order:** the loading sweep (absolute), then the tab strip with the pinned summary and the primary action, then the row.
- **The row wraps every tab.** `ResourceManager` renders `<CwaUiManagerRow><component :is="selectedTab" /></CwaUiManagerRow>`. Tabs render bare fields, and a tab that renders its own row gets a dev warning.
- **Empty, loading and error tabs** render `CwaUiStatusText` in the same row.

#### Tab strip (`core/admin/ManagerTabs.vue`, internal; replaces `_parts/ManagerTabs.vue`; reka `Tabs`)
- It scrolls with edge fades and never clips. Arrow keys move between tabs, and the selected tab scrolls into view.
- **Tab names** come from `useCwaResourceManagerTab({ name })` or the 6b tab `label`. They are visible text and the accessible name.
- **A ⚠ badge** shows on a tab with a field in error or held conflict. It reads the field-state registry (§7.3), so the badge survives the tab unmounting.
- Tabs are at least 2.75rem tall on coarse pointers.

#### `CwaUiManagerRow` (`ui/ManagerRow.vue`, public: modal footers and apps' own admin pages also use it; tabs get it automatically)
```ts
props: { arrows?: 'auto' | 'always' | 'never' }
slots: { default() }
```
- **Layout:** `flex; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; scroll-padding-inline: 2rem`, with 0.25rem inline padding so the focus ring is not clipped.
- **Edge fades:** a `mask-image` driven by `data-overflow-start` and `data-overflow-end`. A `ResizeObserver` and a rAF-throttled passive `scroll` listener set them. The measurement is injectable, so Vitest can drive them in happy-dom.
- **Arrows:** "Scroll fields left" and "Scroll fields right" buttons, `tabindex="-1"`. With `auto`, they show whenever the row overflows on a coarse pointer, and on hover over the edge on a fine pointer.
- **Scrolling:** there is no wheel remap. Native Shift+wheel and trackpad scrolling work, and focus scrolls a field into view.
- **Pans on touch** that start on an input pan the row. This is tested on iPad Safari.
- **Gap:** the row owns a 0.75rem gap.
- **Divider:** `CwaUiManagerRowDivider` (`ui/ManagerRowDivider.vue`) is a 1px `line` rule, 1.5rem tall, with 1rem either side.
- **Provides** the `bar` surface and the live region.

#### Pinned end of the bar (`core/admin/BarSummary.vue`, internal)

This sits outside the scroller, to the right, beside the CTA. It never scrolls away.
- **Summary**, from `ResourcesManager` and the field-state registry, with no new requests:
  - "Draft · not live"
  - "Live"
  - "Saving…"
  - "All changes saved"
  - **"1 not saved →"** or **"1 conflict →"**, a button that switches to the tab, scrolls to the field, focuses it and opens its popover.
- **The primary action:** Publish now, Schedule or Cancel schedule. It is pinned here and not duplicated in the Publish tab's row.

#### Module tabs on the row

| Tab (file) | Becomes |
|---|---|
| `_tabs/position/DynamicPage.vue` (up to 5 rows) | `Page data type` select · `Property` select · `Component` select · divider · status text |
| `_tabs/component/Publish.vue` | `Edit published version` toggle (hint: "Changes go live immediately") · `Schedule` toggle · date picker. The action is in the pinned end. A scheduled time already past asks "That time has passed. Publish now instead?" before sending (#373: the API still decides). The schedule toast names the date, time and zone. |
| `_tabs/group/Group.vue` | selects and buttons; the disabled reason goes in a hint |
| `_tabs/ResourceInfoTab.vue` | `CwaUiReadonly` IRIs · badges |
| `_tabs/component/Ui.vue` | `UI` select (names from the generated config, §8) · `Style` as `CwaUiSelect` when `multiple` is false, `CwaUiMultiSelect` otherwise, with "Unknown style" for unmatched `uiClassNames` |
| `_tabs/component/Order.vue` | `CwaUiNumber width="xs"` · toggle |

**Escape order:** the innermost popover or menu, then an inline edit (revert), then the on-page editor (focus returns to the Edit on page button), then the dialog, then clone mode, then deselecting the component. Each layer stops propagation once it has handled the key.

### 4.8 Modals and pages

| Component (file) | Base | API |
|---|---|---|
| `CwaUiDialog` (`ui/Dialog.vue`; replaces `core/DialogBox.vue`) | reka `Dialog` | `open` (`v-model:open`), `title`, `titleModel?` (InlineEdit), `size: 'sm'\|'md'\|'lg'`, `loading` (skeleton fields); slots `default`, `actions`, `headerEnd` |
| `CwaUiFormGroup` (`ui/FormGroup.vue`) | — | `title?`, `description?`, `columns?: 1\|2`; slots `default`, `actions` |
| `CwaUiConfirmDialog`, `CwaUiPromptDialog` (`core/ConfirmDialog.vue`, `core/PromptDialog.vue`, internal) | `CwaUiDialog` | through `createConfirmDialog(vueApp, component)`. Escape and the backdrop answer `cancel`. The prompt replaces `window.prompt`. |

- **Small screens:** dialogs are full-screen below 640px wide or in short landscape. `columns: 2` collapses to 1 at narrow widths and at 200% zoom. The sticky header and actions are sized against `visualViewport`, and the focused field scrolls above the on-screen keyboard. Popovers stay inside the visual viewport and the focus trap.
- **Against the bar:** a dialog covers the bar (modal), and the bar is inert while it is open.
- **Saving:** save buttons are `loading` while `isUpdating`. A modal that stays open shows a tick on the button for 1.5 s.
- **Conflicts in modals:** handled by Q-C (§11). Until it is decided, a `CwaUiAlert` reads "Mia changed this page while you were editing. [Reload] [Keep my edits]".
- **Auth pages** (`main/auth/_parts/InputField.vue`) use the kit field under `theme-light`. The #386 read stays in the directive's `created` hook, and ids come from `useId()`.

### 4.9 Lists

| Component (file) | Replaces | API |
|---|---|---|
| `CwaUiSearchField` (`ui/SearchField.vue`) | the input in `core/admin/ListFilter.vue` | `v-model`, `label`, `debounce` (250); a search icon and a clear button |
| `CwaUiFilterChip` (`ui/FilterChip.vue`) | `core/admin/ListFilterButton.vue` | reka `Toggle`; a boolean `v-model`, `label`, `count?`; `aria-pressed` |
| `CwaUiPagination` (`ui/Pagination.vue`) | `core/admin/ListPagination.vue`, `ListPaginationButton.vue` | reka `Pagination`; `v-model:page`, `total`, `itemsPerPage` |
| `CwaUiListState` (`ui/ListState.vue`) | ad hoc text | `state: 'loading'\|'empty'\|'error'`, `title`, `description?`, an `action` slot, `@retry`. An error keeps the previous items. |

Sorting uses `CwaUiSelect width="sm"`. There is no table component until a consumer needs one.

### 4.10 Feedback components

- **`CwaUiStatusText`** (`ui/StatusText.vue`): `tone`, `icon?`, a slot. One line, truncated. The full text is in a popover when it is truncated.
- **`CwaUiAlert`** (`ui/Alert.vue`): `tone`, `title`, `description?`, `actions` slot, `dismissible`. Replaces `ui/alert/Info.vue` and `ui/alert/Warning.vue`. It is never used in the bar.
- **`CwaUiRemoteChangeConflict`** (`ui/RemoteChangeConflict.vue`): becomes the content of the conflict popover in the bar, and the line below the field in modals and pages. Its copy: "Mia changed this", with **Use Mia's** and **Keep yours**. Controls pass `formatValue` so that "their value" is readable. Known limitation: an array conflict keeps one side or the other, never a merge.
- **Loading** has three forms only: `CwaUiSpinner`, `CwaUiProgress` and the existing `ResourceLoadingIndicator` sweep. Every literal "Loading..." goes.

### 4.11 In-page editing

| Component (file) | Priority | Notes |
|---|---|---|
| `CwaUiInlineText` (`ui/InlineText.vue`) | SHOULD | `:model`, `tag`, `multiline`, `placeholder`; `''` → `null`; presence; the conflict in a popover anchored to the element; it scrolls its target clear of the bar and the toasts |
| `CwaUiEditPlaceholder` (`ui/EditPlaceholder.vue`) | **SHOULD** (raised from COULD) | edit mode only; "Add a description" for an empty field; ships with InlineText and is where Edit on page lands |
| `CwaUiLinkPopover` (`ui/LinkPopover.vue`) | SHOULD | URL or page search (LinkInput's results), opens in a new tab; replaces `window.prompt` in TipTap |

---

## 5. Composing a tab

The row is supplied by the bar.

```vue
<script setup lang="ts">
const { exposeMeta, iri } = useCwaResourceManagerTab({ name: 'Title' })
const title = useCwaResourceModel<string>(iri, 'title')
defineExpose(exposeMeta)
</script>

<template>
  <CwaUiInput :model="title" label="Title" width="lg" />
</template>
```

```vue
<template>
  <CwaUiInput :model="label" label="Label" />
  <CwaUiManagerRowDivider />
  <CwaUiLinkInput :iri="iri" label="Link" />
</template>
```

A wide tab, such as heading, layout, Calendly, image with alt, categories and per page, simply overflows. The row scrolls, with fades and arrows. A developer cannot:
- put a label above a field;
- wrap the row;
- add a textarea;
- forget the conflict control, the error state or presence on a `:model` control.

---

## 6. Multi-line hand-off (bar → page)

1. **The component template owns the editor**, `CwaUiInlineText` or the TipTap reference. In edit mode it registers under `(iri, field)` in a per-`Cwa` `WeakMap` registry (`admin/inline-editors.ts`, lazy).
2. **The bar shows `CwaUiInlineHandoff`:** `Description "Our kitchens are made in…" [✎ Edit on page] ◌`. Its props are `model` and `label`. The slot shows that field's save state, presence and conflict.
3. **Edit on page** scrolls the editor clear of the bar and toasts, focuses it with the caret at the end, and flashes an `accent-fg` outline for 600 ms. Escape in the editor returns focus to the button.
4. **When no editor is registered** (a field the template does not render, such as an SEO description), the button reads **Edit…** and opens a `CwaUiDialog` with `CwaUiTextarea` under the `modal` surface. In development the module warns once that the template has no editor for the field. If the field is empty and an `EditPlaceholder` is registered, Edit on page lands on it.

---

## 7. Feedback system

### 7.1 Toasts: `useCwaToast()` (public; consumer: apps' admin pages such as dons-hub `useFlash`)

```ts
const toast = useCwaToast()
toast.add({ id?, tone: 'success'|'info'|'warning'|'danger', title, description?,
            actions?: { label: string; onClick(): void | Promise<void>; tone?: CwaUiTone }[],
            duration?: number | null })
toast.dismiss(id)
```

- **`add` upserts by `id`.** For example, "Publishing…" becomes "Published" in place.
- **Mounting.** The toaster (`core/admin/Toaster.vue`, reka `Toast`) is a lazy admin component in the app's container, kept in a `WeakMap` keyed by `vueApp`. It is never mounted with `createApp`.
- **Error source.** It watches the error store, as `RequestErrors` does, so `ResourcesManager` in the entry never imports toast code.
- **SSR.** `add` is a no-op on the server.
- **Placement:** top-right, below the admin header and clear of the Publish action. At most 3 are visible, and the rest collapse into "+N more".
- **Durations:** success and info 4 s, warning 6 s. Errors, and any toast with actions, **stay until dismissed**. Timers pause on hover and focus, and while the document is hidden.
- **Announcement:** danger is assertive; the rest are polite. A toast never takes focus, F8 reaches the viewport, and Escape dismisses the focused toast.
- **Grouping:** several failures in one burst become one toast, "6 saves failed · Retry all".
- **Toasted:**
  - delete, publish, schedule, purge, warm and orphan-scan results;
  - an upload that finished off-screen;
  - an error or held conflict whose field has unmounted (it persists, with **Show me** and **Retry**);
  - going offline (`id: 'network'`);
  - a request error with no field.
- **Never toasted:**
  - a routine save;
  - an error belonging to a registered field;
  - a conflict on a mounted field;
  - "Copied".
- **Replaces** `main/admin/header/_parts/RequestErrors.vue`, `Notification.vue` and the fixed "Oops!" copy.

### 7.2 Error copy

Raw `hydra:description` is never shown.

| Kind | Copy |
|---|---|
| network | "Offline. Not saved. Retry when you're back." |
| server (5xx) | "The server couldn't save this. Retry, or undo your change." |
| violation (4xx with `propertyPath`) | the violation's `message` (it is written for people) |
| precondition (412 without RemoteChanges) | "Someone else saved this first. Reload to see their version." |

There is **no automatic resend when the connection returns**. The only `online` listener re-fetches resources (`api/mercure-client.ts`), and an offline queue would change save semantics, which is a non-goal.

### 7.3 Field state that survives unmount (Q6, recommended)

A per-`Cwa` registry, `resources/field-states.ts`, a `WeakMap` like `model-editors.ts` and keyed by `(iri, field)`, holds:
- `pending`
- `submitting`
- `lastSavedAt`
- `error`
- the held conflict

`useCwaResourceModel` reads and writes it instead of local refs.

What the registry feeds:
- the tab badges;
- the pinned bar summary;
- Retry after coming back to a tab.

When an errored or held field unmounts (switching tab, deselecting):
- a persistent toast offers **Show me** (it reselects the resource and the tab, then focuses the field) and **Retry**;
- `NavigationGuard` blocks leaving the page while any entry is in error or held, with a confirm.

Rejected:
- `KeepAlive`, because it does not cover deselecting;
- an implicit Keep mine, because that resolves a conflict silently.

### 7.4 The optimistic save model per field

The save life cycle is unchanged (#394, #429). These are the only model changes:

1. **`updateResource` returns a result** (`{ ok: true } | { ok: false; error: CwaFieldError }`) to the model that sent it. Errors are stored per `(endpoint, field)`, so `removeByEndpoint` no longer clears another field's error.
2. **`retry()`** calls `updateResource(localValue, true)` for that field. **`undo()`** restores the last stored value and clears the error.
3. **`lastSavedAt`** is a fact on the model. The 300 ms grace (counted from `submitting`) and the 1.5 s tick are timers in `FieldStatus`.

```
 edit ─▶ pending ─(debounce)─▶ submitting ─ok─▶ idle (slot ticks 1.5 s)
            ▲                     │  └─ fail ─▶ error ── Retry / Undo / next edit
            └─ remote change ─ conflict (save held) ── Use theirs / Keep yours
```

Performance:
- No state adds a request.
- Focus listeners attach their document listener only after a pointerdown.
- Ten unfocused fields attach nothing.

---

## 8. `defineCwaConfig` (decided in #453)

Agreed on [#453](https://github.com/components-web-app/cwa-nuxt-module/issues/453) and built in its own PR, not part of this kit. In short:
- Components declare `name`, `description`, `instantAdd`, `defaultData` and `styles`; layouts and pages declare `name` and `styles`; a `ui/*.vue` variant can declare its own `styles`. Manager tabs and UI variants stay discovered from the `admin/` and `ui/` folders.
- `cwa.resources`, `cwa.layouts`, `cwa.pages` and `useCwaResource`'s `styles` option are removed (no backward compatibility; README upgrade section). `cwa.pageData` stays in `nuxt.config.ts`.
- Styles are `{ key: { label, classes } }`; `uiClassNames` stores `style:<key>`, resolved against the rendering SFC's styles by `ResourceLoader` during the server render. Static literals only.

The kit reads the generated config in two places: the Ui tab (style options by label, "Unknown style" for a key the rendering SFC doesn't define) and the layout/page selects (each `description`).

### 8.1 Proposed later: field declarations (6b, an extension of #453, needs Daniel's agreement)

`kind` is a discriminated union, and a tab object uses `label` so that `name` always means a property:

```ts
managerTabs: [{ label: 'Link', fields: [
  { kind: 'text', name: 'label', label: 'Label' },
  { kind: 'link', label: 'Link' /* route?, rawPath? */ },
] }, 'AdvancedTab']
```

| Kinds | Renders |
|---|---|
| `text`, `textBlock` | Input, InlineHandoff |
| `number`, `toggle`, `segmented` | Number, Toggle, Segmented |
| `select`, `multiSelect` | Select, MultiSelect (static `options` or `source`) |
| `resource` | ResourceSearch |
| `link` | LinkInput |
| `image` | FileUpload, or ImageAlt with `alt` |
| `date`, `day`, `dayRange` | DatePicker, DayPicker, DayRangePicker |

- **Rendering.** A generated tab is the internal `core/admin/GeneratedTab.vue` inside the bar's row. It cannot override touch sizes or accessibility, and its hints are plain text.
- **Worked case (SR NavigationLink).** Today it is `LinkLabel.vue` plus `LinkTab.vue`: two tabs, about 55 lines, `v-model` with no presence or conflict. With 6b it is the four lines above, and both files are deleted.
- **Page data (Q5).** `app/cwa/page-data/<Class>.ts` declares `metaFields` with the same kinds, shipped with 6b.

---

## 9. Migration map

| Today (path under `src/runtime/templates/components/`) | Becomes | Note |
|---|---|---|
| `ui/form/Input.vue` (`CwaUiFormInput`) | `ui/Input.vue` `CwaUiInput` | removed (no backward compatibility; CHANGELOG + README) |
| `ui/form/Toggle.vue` (`CwaUiFormToggle`) | `ui/Toggle.vue` | Headless UI → reka; a label that swaps with state becomes Segmented |
| `ui/Select.vue`, `ui/form/Select.vue` | `ui/Select.vue`, `ui/MultiSelect.vue` | `CwaUiFormSelect` removed |
| `ui/form/File.vue` (`CwaUiFormFile`) | `ui/FileUpload.vue` with `upload` | the five-prop API is removed (29 CK/SR files) |
| `ui/form/SearchResource.vue` | `ui/ResourceSearch.vue` | `notNullable` → `nullable` |
| `ui/form/Button.vue`, `ButtonPopoverGroup.vue`, `ButtonPopoverItem.vue` | `ui/Button.vue` | `color` → `tone` + `variant`; `composables/popper.ts` is deleted |
| `ui/form/LabelWrapper.vue` | the `label` prop | removed |
| `ui/DatePicker.vue`, `ui/Calendar.vue`, `ui/InputDate.vue` | kept | `null` emit type fixed, props destructured |
| `ui/ProgressBar.vue` | `ui/Progress.vue` | |
| `ui/FieldPresence.vue`, `ui/RemoteChangeConflict.vue` | inside `core/ui/Field.vue` and its popover | public names kept for the TipTap reference |
| `ui/alert/Info.vue`, `ui/alert/Warning.vue` | `ui/Alert.vue` | |
| `core/admin/form/Modal{Input,Select,RadioTabs,Info,ReachableToggle}.vue`, `PageTypeSelect.vue`, `FilterSelect.vue` | kit inputs | internal, removed |
| `core/DialogBox.vue`, `core/ConfirmDialog.vue` | `ui/Dialog.vue`, `core/ConfirmDialog.vue` on it | |
| `core/admin/ListFilter.vue`, `ListFilterButton.vue`, `ListPagination.vue`, `ListPaginationButton.vue` | SearchField, FilterChip, Pagination, ListState | |
| `main/admin/header/_parts/RequestErrors.vue`, `Notification.vue` | `core/admin/Toaster.vue` | |
| `main/admin/resource-manager/_parts/ManagerTabs.vue` | `core/admin/ManagerTabs.vue` | |
| `main/admin/resource-manager/ResourceManager.vue` | fixed height, the row wrapper, `BarSummary` | |
| `main/auth/_parts/InputField.vue` | the kit field under `theme-light` | keeps the #386 `created` read |
| composables `cwa-select-input.ts`, `cwa-select.ts` | `useCwaSelect` (the options type widened) | |
| `useCwaResourceUpload().bind` | `.upload` | `bind` removed |
| `v-model.nullable` | the `nullable` prop | removed |

**Props to destructure during the port (TS2883):** `ui/DatePicker.vue`, `ui/Calendar.vue`, `ui/form/Button.vue`, `ui/form/File.vue` and `ui/form/SearchResource.vue`. Each removal gets a CHANGELOG line, and the migration note covers the ~220 site tabs.

---

## 10. Accessibility and test matrix

- **Contrast:** the §2.1 table is recomputed and kept in a spec. Input boundaries use `line-strong`. The focus ring is offset, so it is visible on `accent` fills and alongside state outlines.
- **Programmatic labels everywhere.** Hints and errors are linked with `aria-describedby`. Disabled controls with a reason use `aria-disabled` and stay focusable.
- **Keyboard:**
  - Tab through the row (focus scrolls into view).
  - Arrow keys in the tab strip.
  - Backspace twice to remove a chip.
  - The date segments.
  - The uploader's button.
  - The Escape order in §4.7.
- **Never by colour alone:** long wait has its own glyph; saved, error and conflict each have an icon; presence shows the name.
- **Live regions** as in §4.3.
- **Media rules:** `forced-colors`, `prefers-reduced-motion`, and `pointer: coarse` sizes with 44 px hit areas.
- **Browser scenarios (`test/browser`):**
  - the bar's height and the page's scroll are unchanged across every tab and state at 1280 px and 768 px;
  - a 10-field row scrolls and never wraps;
  - a conflict on a `:model` select shows its control;
  - "1 conflict →" focuses the field;
  - tablet projects at 1024×768 and 768×1024 with touch;
  - one run at 200% zoom;
  - a pan that starts on an input.
- **Vitest per control:** its states and its `:model` wiring, with real `computed` refs (#260). Row fades are driven by the injected measurements.

---

## 11. Phased plan

Each step is one PR into `dev`, under an issue linked from #236. Each runs `test`, `test:types`, `lint`, `build` and `test:e2e`, and states any bundle-budget change and what it buys. New reka-ui consumers whose chunk is measured in that PR are listed in the last column.

| # | PR | Contents | reka-ui consumers measured |
|---|---|---|---|
| 1 | Tokens and bar frame | §2 tokens and the contrast spec; fixed `h-manager`; `ResourceManager` wraps tabs in `CwaUiManagerRow` + `ManagerRowDivider`; dev height warning; portalled flag layer (lane fallback) | — |
| 2 | Tab strip and module tabs | `core/admin/ManagerTabs.vue`; `DynamicPage`, `Publish`, `Group`, `ResourceInfoTab`, `Ui`, `Order` on the row; `CwaUiReadonly`, `Badge`, `Hint`, `Tooltip`, `StatusText` | Tabs, Popover, Tooltip |
| 3 | Field state | `resources/field-states.ts` registry; the `updateResource` result; per-(endpoint, field) errors; `lastSavedAt`, `retry`, `undo`; `NavigationGuard` hook | — |
| 4 | Field shell and the first ports | `core/ui/Field.vue` + `FieldStatus.vue`; Input, Toggle, Select (with `source`), Button, ResourceSearch on reka with `:model`; conflict popover; `BarSummary` with the pinned primary action | Select, Switch, Combobox |
| 5 | Toasts | `useCwaToast`, `core/admin/Toaster.vue`; `RequestErrors`/`Notification` removed; grouping; Show me / Retry for unmounted fields | Toast |
| 6 | New controls | Number, Segmented, MultiSelect, LinkInput (after Q7), FileUpload + the `upload` binding, DayPicker | NumberField, ToggleGroup |
| 7 | Modals, pages, lists, auth | Dialog, FormGroup, Confirm/Prompt, SearchField, FilterChip, Pagination, ListState, Alert, Textarea, InlineEdit; `Modal*`, `DialogBox`, Headless UI and `popper.ts` removed | Dialog, Pagination, Toggle |
| 8 | (moved) | `defineCwaConfig` ships with #453; the Ui tab's "Unknown style" row lands with PR 2 | — |
| 9 | In-page editing | InlineText, InlineHandoff with the dialog fallback, EditPlaceholder, LinkPopover; ImageAlt, ImageSlots, DayRangePicker | RangeCalendar |
| 10 | Field declarations (6b) | `fields`, `GeneratedTab`, `app/cwa/page-data/<Class>.ts` (if Q5), lazy `cwa-admin-config.ts` | — |
| 11 | Site migration | template tabs, then CK; migration notes; the docs repo `documentation` issue | — |


---

## 12. Open questions for Daniel

Q1–Q4 were about `defineCwaConfig` and are settled by #453.

5. **Page data config:** #453 keeps `cwa.pageData` in `nuxt.config.ts`; add `app/cwa/page-data/<Class>.ts` for `metaFields` later, with 6b?
6. **Field-state registry:** per-`Cwa`, surviving unmount, with a persistent toast and `NavigationGuard` (recommended)?
7. **The link input's write:** one `updateResource` carrying both fields (recommended), or two ordered PATCHes through the If-Match queue?
8. **Bar height:** portalled flags and a 3rem row (recommended), or the lane? Does one constant per pointer class meet R1?
9. **Palette:** approve blue-400, blue-700, amber-700, lime-800, red-700 and red-400, or name replacements?
10. **`field="…"` shorthand** on kit inputs inside a tab (consumer: 153 title tabs), keeping the `:model` name (recommended), or neither?
11. **Q-B:** the model names `lastSavedAt` and `error` (with `retry` and `undo`), the `updateResource` result object, and errors per (endpoint, field)?
12. **Q-C:** per-field conflicts in modals now (needs `useItemPage` to stop replacing `localResourceData` wholesale), or the alert fallback first?

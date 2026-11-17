# CWA Admin UI Kit: design draft (#236)

**From:** UI design. **For:** Daniel (decision owner) and module developers.
**Answers:** `01-requirements.md`. Section numbers in brackets (§6.1, R1) point at the brief.
**Status:** proposal. Nothing here is built. Every public name below has its consumer named, as R7 requires; anything without one is marked *internal*.

Grounded in this checkout (`feat/236-ui-kit-proposal`):
`src/tailwind/tailwind-cwa.css`, `ui/form/{Input,Toggle,Select,Button,File,SearchResource,LabelWrapper}.vue`, `ui/{Select,DatePicker,FieldPresence,RemoteChangeConflict}.vue`, `ResourceManager.vue`, `ManagerTabs.vue`, `_tabs/component/Publish.vue`, `composables/cwa-resource-model.ts`, `resources/model-editors.ts`, `composables/cwa-styles.ts`, `module.ts` (`extendCwaOptions`), `types/index.ts`, and the playground's `NavigationLink`, `Image` and `HtmlContent` components.

---

## 0. The five decisions this draft asks for

| # | Decision | Recommendation |
|---|---|---|
| D1 | Where `defineCwaConfig` lives (§10 Q1) | A **compiler macro in `<Name>.vue`**, extracted at build time with `vue/compiler-sfc` (the same parser `component-group-declarations.ts` already uses) and stripped from the runtime output. |
| D2 | Which source wins (§10 Q2) | **`nuxt.config.ts` wins, key by key**, and a key set in both warns once at build time. The component's config is the default. |
| D3 | Field declarations now or later (§10 Q3) | **Later, but designed now.** Ship `defineCwaConfig` with styles and everything `cwa.resources.<Name>` covers first (step 6a). Generated tabs follow once the kit's inputs exist (step 6b). The type below already reserves `fields`. |
| D4 | `siteConfig` (§10 Q4) | Stays in `nuxt.config.ts` only. So do `pageData.<Class>` entries, because page data classes have no Vue file to sit next to. |
| D5 | Field state in the model | `useCwaResourceModel` gains `states.error` (message plus `retry()`) and `states.saved` (a short-lived flag). The kit's field shell is the consumer. Nothing else in save semantics changes. |

---

## 1. Design principles

1. **The row is the unit.** In the manager bar a tab is one row, and the kit makes stacking impossible rather than discouraged: the bar provides a `bar` surface, and a field under it cannot render a label above itself or a line below. Height is a token, not a measurement.
2. **State lives at the field.** Saving, saved, error, conflict and presence are drawn in a slot each field reserves in advance, so a state change never moves anything. A toast is for an outcome with no field.
3. **Bind once, get everything.** `:model="titleModel"` is the whole wiring. `v-model` still works for values that are not resource fields (filters, modal drafts), and then the co-editing states simply do not apply.
4. **Quiet by default, loud on failure.** A good save shows a tick for 1.5 s. A slow save says so after 5 s. A failed save turns the field red, keeps the value and offers Retry. Nothing blocks typing.
5. **One of each.** One button, one select, one disabled look (50% opacity, `not-allowed` cursor, no hover), one spinner, one popover system (reka-ui, portalled), one toast stack.
6. **Dark panel, quiet chrome.** The admin floats over someone else's design. Thin dotted outlines at rest (today's signature look), solid on focus, colour only where it means something.
7. **Admins only, loaded late.** Every kit component is loaded behind admin code. The visitor entry pays nothing; tokens are CSS the admin stylesheet already ships.

---

## 2. Tokens

All tokens live in `src/tailwind/tailwind-cwa.css` `@theme` and are used as `cwa:` utilities (`cwa:bg-surface`, `cwa:h-control`). Because the theme is emitted with the `cwa` prefix, each one becomes a `--cwa-*` custom property, which is what the light scope overrides.

### 2.1 Colour

Primitives are the admin palette already in the file: **stone**, **blue**, **magenta**, **orange**, plus the existing **green** (saved) and **danger** red. `indigo`, `gray` and `neutral` are removed once the last component has moved (R5); `amber-300` in `RemoteChangeConflict.vue` today is not in the palette and becomes `warning`.

Semantic tokens (dark panel is the default; auth pages and any light card opt in with `cwa:theme-light`):

| Token | Use | Dark | Light (`cwa:theme-light`) |
|---|---|---|---|
| `surface` | bar, modal, page background | `#1c1917` (stone-900) | `#ffffff` |
| `surface-raised` | popover, menu, toast | `#292524` (stone-800) | `#f5f5f4` |
| `surface-sunken` | control fill | `#1c1917` at 85% + blur (today's `dark-blur`) | `#ffffff` |
| `line` | idle dotted outline, dividers | `#44403c` (stone-700) | `#d6d3d1` |
| `line-strong` | hover outline | `#a8a29e` (stone-400) | `#78716c` |
| `fg` | text | `#f5f5f4` | `#1c1917` |
| `fg-muted` | inline labels, hints, placeholders | `#a8a29e` (6.9:1 on surface) | `#57534e` (7.6:1) |
| `accent` | primary button fill, selected tab, toggle on | `#2563eb` (blue-600, white text 5.2:1) | `#2563eb` |
| `accent-fg` | focus ring, links, text in accent colour | `#60a5fa` (blue-400, 6.7:1) | `#1d4ed8` |
| `success` | saved tick | `#9cdd05` (green) | `#3f6212` |
| `warning` | conflict, long wait, "still saving" | `#ffaa00` (orange) | `#b45309` |
| `danger` | error | `#ef4444` (4.6:1) | `#b91c1c` |
| `highlight` | reorder, clone, admin selection (unchanged) | `#e30a6c` (magenta) | `#e30a6c` |

Every state colour is paired with an icon or text (§8 "not colour alone"). Text-sized `accent` uses `accent-fg`, because blue-600 on stone-900 is 2.9:1. Presence colours keep coming from `presenceColour` (they already sit ≥ 25° of hue away from magenta, orange, yellow and the blues).

```css
@theme {
  --color-surface: #1c1917;
  --color-surface-raised: #292524;
  --color-line: #44403c;
  --color-line-strong: #a8a29e;
  --color-fg: #f5f5f4;
  --color-fg-muted: #a8a29e;
  --color-accent: #2563eb;
  --color-accent-fg: #60a5fa;
  --color-success: #9cdd05;
  --color-warning: #ffaa00;
  --color-danger: #ef4444;
  --color-highlight: #e30a6c;
}

@layer components {
  .cwa\:theme-light {
    --cwa-color-surface: #fff;
    --cwa-color-surface-raised: #f5f5f4;
    --cwa-color-line: #d6d3d1;
    --cwa-color-line-strong: #78716c;
    --cwa-color-fg: #1c1917;
    --cwa-color-fg-muted: #57534e;
    --cwa-color-accent-fg: #1d4ed8;
    --cwa-color-success: #3f6212;
    --cwa-color-warning: #b45309;
    --cwa-color-danger: #b91c1c;
  }
}
```

There is no `prefers-color-scheme` switch: the brief keeps the dark panel as the only admin theme (§3), and light is a scope for auth pages.

### 2.2 Type

| Token | Size / line | Use |
|---|---|---|
| `text-xs` | 12 / 16 | presence flag, badge, status text in the bar |
| `text-sm` | 13 / 20 | **controls, inline labels, menu items** (the bar's base) |
| `text-base` | 14 / 20 | modal and page fields, floating labels at rest |
| `text-lg` | 16 / 24 | modal titles, page headings |

System font stack (no web font to load). `font-medium` for labels and buttons, `tabular-nums` on number inputs, counts and pagination. Truncate, never wrap, in the bar.

### 2.3 Spacing and sizing

A 4 px grid. The sizes that make the bar's height a constant:

| Token | Value | Notes |
|---|---|---|
| `--spacing-control` | 32 px | every control's height in the bar and in lists (≥ 24 px touch target) |
| `--spacing-control-lg` | 40 px | modal and page controls (floating labels need the room) |
| `--spacing-manager-tabs` | 36 px | tab strip |
| `--spacing-manager-row` | 64 px | the row: a 20 px **flag lane** + 32 px control + 12 px bottom |
| `--spacing-manager` | 100 px | tabs + row; the fixed bar height, and the spacer's height |
| `--spacing-row-gap` | 12 px | between fields; 16 px either side of a divider |
| `--spacing-status` | 16 px | the per-field status slot, always reserved |

The flag lane is not decoration. A horizontally scrolling element clips vertically too (`overflow-x: auto` forces `overflow-y` to clip), so today's presence flag (`bottom-full` above the field) would be cut off inside a scroller. The row reserves its 20 px inside the scroll box, and 4 px of inline padding keeps the 2 px-offset presence outline visible at both ends.

**Field widths** (§6.1 size tokens, replacing 28 hand-picked `w-*` in CK):

| `size` | Width | Typical use |
|---|---|---|
| `xs` | 64 px | number, order, short code |
| `sm` | 128 px | select of a few words, date-only |
| `md` | 224 px | title, label, alt text (default) |
| `lg` | 320 px | URL, resource search, link input |
| `auto` | content | toggles, segmented controls, buttons |

### 2.4 Radius

`radius-control: 2px` (inputs, buttons; today's near-square look), `radius-popover: 6px` (menus, popovers, toasts, dialogs), `radius-full` (toggle track, chips, presence flag ends, badges).

### 2.5 Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | everything that enters |
| `--duration-fast` | 120 ms | hover, focus, toggle thumb |
| `--duration-base` | 200 ms | popover, menu, tab indicator |
| `--duration-slow` | 300 ms | toast enter/leave, flag fade (today's `duration-300`) |
| `--delay-status` | 300 ms | grace before "saving" appears (§7.1) |
| `--duration-saved` | 1500 ms | how long the tick stays |
| `--animate-admin-spinner` | existing | the one spinner |

Under `prefers-reduced-motion: reduce` every transition is opacity-only at `duration-fast`; the `ResourceLoadingIndicator` sweep becomes a static bar; the spinner slows to 2 s per turn rather than stopping (it still has to say "busy").

### 2.6 Elevation

`--z-index-*` stay as they are (`peer-outline` 899 → `context` 904). Toasts use `notifications` (903). All popovers portal into the app's container (`useNuxtApp().vueApp._container`, as `ComponentFocus` and the clone outlines already do), never into `<body>`, for the stacking reason CLAUDE.md records.

---

## 3. Surfaces decide the label

Three surfaces, provided by the layout components and read by every field through `inject`:

| Surface | Provided by | Label | Secondary text | Control height |
|---|---|---|---|---|
| `bar` | `CwaUiManagerRow` | **inline**, left of the control, `fg-muted` | status slot icon + tooltip/popover only | 32 px |
| `modal` | `CwaUiDialog` / `CwaUiFormGroup` inside it | **floating** | helper and error line below | 40 px |
| `page` | `CwaUiFormGroup` on `/_cwa` pages and auth pages | **above** | helper and error line below | 40 px |

There is **no `labelPlacement` prop**. A field in the bar cannot be given a label above it, because the bar never offers that option (R1 enforced by structure, goal 3). A field outside any surface falls back to `page`. In development, a `CwaUiTextarea` mounted under `bar` throws (the same `import.meta.env.DEV` convention `useCwaRealtime` uses for reserved names) and renders nothing in production.

---

## 4. Components

Naming: everything is `CwaUi<Name>` (auto-imported from `ui/`). Internal parts live in `core/` and are imported directly. Each entry gives anatomy, variants, states and the Vue API. Every input accepts **either** `:model` (a `ResourceModelField`) **or** `v-model`; the shared contract is in 4.2 and not repeated per control.

### 4.1 Primitives

#### `CwaUiButton` (replaces `CwaUiFormButton`; port to reka-ui `Primitive`)
- **Anatomy:** [icon?] label [trailing chevron if `options`] — one line, `h-control`.
- **Variants (`color`):** `primary` (accent fill), `secondary` (default; `line` outline, transparent), `ghost` (no outline; toolbar and toast actions), `danger`.
- **States:** default, hover, focus-visible (2 px `accent-fg` ring), active, `loading` (spinner replaces the icon, label stays so width is stable, `aria-busy`), disabled.
- **API:**
  ```ts
  props: { color?: 'primary'|'secondary'|'ghost'|'danger'; icon?: Component; iconOnly?: boolean; label?: string;
           loading?: boolean; disabled?: boolean; to?: RouteLocationRaw; type?: 'button'|'submit';
           options?: { label: string; value: unknown; disabled?: boolean }[] }
  emits: { click: [value?: unknown] }
  slots: { default?() }
  ```
  `iconOnly` requires `label`, used as `aria-label` and tooltip. `options` renders a split button with a reka-ui `DropdownMenu` (today's `ButtonPopoverGroup`).
- **Consumers:** Publish, Order, CTA, modals, dialogs, toasts.

#### `CwaUiSpinner`, `CwaUiProgress`
- Spinner: 16 px (`sm`) or 20 px; `aria-hidden` with the label carried by its parent. One look, one animation (`animate-admin-spinner`).
- Progress: `value?: number` (0–100; omitted = indeterminate), `label: string` (visually hidden). Replaces `ProgressBar.vue`. Consumers: uploader, warm, orphan scan.

#### `CwaUiTooltip`, `CwaUiHint`
- Tooltip: reka-ui `Tooltip`, 400 ms open delay, opens on focus as well as hover. Props `text: string`, `side?`. Slot: trigger.
- Hint: the ⓘ pattern from `ClonePlacementMenu` made a primitive. A 24×24 button that opens a reka-ui `Popover` on click or Enter; its content is referenced by `aria-describedby` on the field so it is announced without opening. Props `text?: string`, slot `default` for rich content. Consumers: field `hint`, disabled select options with a reason, clone menu.

#### `CwaUiBadge`
- Pill, `text-xs`. `tone: 'neutral'|'accent'|'success'|'warning'|'danger'`, optional `icon`. Consumers: publish state, component usage, target-resource indicator, list row status.

#### `CwaUiReadonly` (replaces `ModalInfo`; covers the IRI in `ResourceInfoTab`)
- **Anatomy:** [label per surface] value (truncated, middle-ellipsis for IRIs) [copy button].
- **API:** `value: string`, `label?: string`, `copy?: boolean` (default true), `mono?: boolean`. Full value in a tooltip and in the copy button's `aria-label`. Copy confirms with the status slot's tick, not a toast.

### 4.2 The field shell: `CwaUiField`

Every input renders inside it. Site developers rarely use it directly: the inputs wrap themselves.

**Anatomy in the bar (one row, left to right):**
```
 flag lane  ┆ [Mia ▾]                                                       ← 20 px, presence flag only
 control    ┆ Label  [prefix | value…………………………… | suffix]  ◌  [⚠ Mia · Use theirs / Keep mine]
             ^ inline   ^ control (size token)                  ^ status slot (16 px, always reserved)
```
**In modals/pages:** label floating or above, control, status slot inside the control's trailing edge, helper/error line below (`page`/`modal` only).

**Props (shared by every kit input):**
```ts
interface CwaUiFieldProps<T> {
  model?: ResourceModelField<T>
  modelValue?: T
  label: string
  labelHidden?: boolean
  hint?: string
  optional?: boolean
  placeholder?: string
  size?: 'xs'|'sm'|'md'|'lg'|'auto'
  disabled?: boolean
  readonly?: boolean
  loading?: boolean
  error?: string
  target?: 'page'|'pageData'
}
emits: { 'update:modelValue': [value: T] }
slots: { default(bindings: { id: string; describedBy: string; invalid: boolean }), prefix?(), suffix?() }
```
`label` is required: with `labelHidden` it is visually hidden but still the accessible name (§8). `error` is for `v-model` fields (modal validation); with `:model` the error comes from the model.

**`ResourceModelField` grows one key** (D5). Today (`model-editors.ts`) it is `{ model, remoteChange, focusedBy?, focusListeners? }`; `useCwaResourceModel` already returns `states: { pendingSubmit, submitting, isBusy, isLongWait }`. Proposed:
```ts
interface ResourceModelField<T = unknown> {
  model: { value: T | null | undefined }
  remoteChange: { readonly value: RemoteFieldChange<T> | undefined }
  focusedBy?: { readonly value: FocusedPeer[] }
  focusListeners?: { onFocusin(): void; onFocusout(e: FocusEvent): void; onPointerdown(e: PointerEvent): void }
  states?: {
    pendingSubmit: Ref<boolean>
    submitting: Ref<boolean>
    isLongWait: Ref<boolean>
    saved: Ref<boolean>
    error: Ref<{ message: string; retry: () => Promise<void> } | undefined>
  }
}
```
The whole return of `useCwaResourceModel` already satisfies this shape, so `:model="titleModel"` keeps working. `error` is per model (per field), so two fields on one resource no longer clear each other's errors (§7.1). Its message is the request's own violation or `hydra:description`, not "Oops! There was a problem."

**States and how each renders, by surface:**

| State | Source | Bar | Modal / page |
|---|---|---|---|
| default | — | dotted `line` outline | same, 40 px |
| hover | — | outline `line-strong` | same |
| focus | — | solid 2 px `accent-fg` outline | same |
| read-only | `readonly` | no outline, `fg` text, copy where useful | same |
| disabled | `disabled` | 50% opacity, `not-allowed`; **no focus listeners bound** (as today) | same |
| loading | `loading` | spinner in the status slot | same |
| saving | `pendingSubmit \|\| submitting` for > 300 ms | spinner in the status slot, `aria-busy` | same |
| long wait | `isLongWait` | spinner turns `warning`; tooltip "Still saving…" | text "Still saving…" below |
| saved | `saved` (1.5 s) | `success` tick, fades | same |
| error | `states.error` or `error` | `danger` outline + ⚠ button in the status slot; the button opens a popover with the message and **Retry** | message and Retry below |
| conflict | `remoteChange` | outline `warning` + compact conflict control after the status slot (4.9) | conflict control below the field |
| presence | `focusedBy` | peer-coloured 1 px outline + name flag in the flag lane, fading after 3 s (`useFreshFlags`, as today) | flag above the field |
| target | `target` | `CwaUiBadge` icon (page / page data) before the label, tooltip "Saves to this page's data" | same |

Rules that keep it fast (§7.7):
- The status slot is its own tiny component reading only that field's refs, so a state change re-renders 16 px, never the tab.
- The 300 ms grace and the 1.5 s tick are one `setTimeout` per field, cleared on unmount.
- Focus listeners come from the model (`focusListeners`), which attaches its document `pointerdown` listener only after a pointerdown and removes it on blur, so ten unfocused fields attach nothing.
- No state adds a network request; everything comes from the model and `ResourcesManager`.
- Announcements: one polite live region per surface (in `CwaUiManagerRow`, `CwaUiDialog`, `CwaUiFormGroup`), fed "Saving title", "Title saved", "Title not saved: <message>", "Mia changed Title". Not one region per field.

### 4.3 Inputs

Every input below takes the 4.2 props and `:model` / `v-model`. Only additions are listed.

| Component | Replaces | Headless base | In bar | Additions | Priority |
|---|---|---|---|---|---|
| `CwaUiInput` | `CwaUiFormInput`, `ModalInput`, raw list search | — (native input) | yes | `type: 'text'\|'email'\|'url'\|'tel'\|'password'\|'search'`, `nullable` (`''` → `null`; today a `v-model.nullable` modifier), `prefix`/`suffix` slots, `validate?: boolean` (url, email, tel) | MUST |
| `CwaUiNumber` | `Order.vue` input, perPage, lat/lng | reka-ui `NumberField` | yes | `min`, `max`, `step` (`'any'` allowed), `nullable`, `stepper?: boolean`. **Commits on blur, Enter or a step click**, never per keystroke: it writes `model.value` only then, so the model's debounce sees one change | MUST |
| `CwaUiTextarea` | settings sitemap/robots, modal descriptions | — | **no** (throws in dev under `bar`) | `rows`, `autosize`, `maxlength`, `counter` | MUST |
| `CwaUiToggle` | `CwaUiFormToggle` (Headless UI `Switch`, `indigo`/`gray`) | reka-ui `Switch` | yes | label is fixed and **never changes with the state** (today's link tab swaps "Internal"/"External": that becomes a segmented control). `on` = accent track | MUST |
| `CwaUiSegmented` | `ModalRadioTabs`, two-way toggles, tri-state | reka-ui `ToggleGroup` (single) | yes | `options: { label, value, icon?, disabled?, reason? }[]` (2–5), `nullable` adds a leading "Unset" segment (tri-state) | MUST |
| `CwaUiSelect` | `ui/Select.vue`, `CwaUiFormSelect`, `PageTypeSelect`, `FilterSelect`, `ModalSelect` | reka-ui `Select` | yes | `options: SelectOption[]` where `SelectOption = { label, value, description?, disabled?, reason?, group? }`; `nullable` adds "None"; `clearable`; `placeholder` | MUST |
| `CwaUiMultiSelect` | `CwaUiSelect multiple`, Nuxt UI `USelectMenu` | reka-ui `Combobox` (multiple) | yes | same `options`; `max?`. **In the bar** the trigger shows chips inside its fixed `size` width, scrolling within itself, and collapses to "3 selected" when they overflow; the full list is in the menu. Chips are removable by Backspace and by their × | MUST |
| `CwaUiResourceSearch` | `CwaUiFormSearchResource` | reka-ui `Combobox` | yes | `endpoint` (prefix-free, resolved through `normaliseApiPathPrefix`), `property`, `searchProperties?`, `nullable`. Accepts an IRI **or** an embedded resource as its value and always emits the IRI. 250 ms debounce; spinner and error in the status slot | MUST |
| `CwaUiLinkInput` | 24+ copied link tabs | Segmented + ResourceSearch + Input | yes | see 4.4 | MUST |
| `CwaUiDatePicker` | (exists) | reka-ui | yes | unchanged contract (UTC ISO or `null`, `min`, `minuteStep`); its `label` goes through the shell, so in the bar it is inline | MUST |
| `CwaUiDayPicker` | Nuxt UI `UCalendar` (CK) | reka-ui `DateField` + `Calendar` | yes | value `'YYYY-MM-DD' \| null`, `min`, `max`, `nullable`. Clearing emits `null`; never throws | MUST |
| `CwaUiDayRangePicker` | Nuxt UI `UCalendar range` (SR) | reka-ui `RangeCalendar` | yes | value `{ start: string; end: string } \| null`; one field, one save. Remote changes re-derive the internal `CalendarDate`s (the SR picker went stale because it cached them) | SHOULD |
| `CwaUiFileUpload` | `CwaUiFormFile` (5-prop API) | native input + reka-ui `Popover` | yes | see 4.5 | MUST |
| `CwaUiImageAlt` | 13 CK files, 5980bc, dons-hub | FileUpload + Input in a popover | yes | `upload: UploadBind`, `alt: ResourceModelField<string>`; alt is edited in a popover from the thumbnail chip, and its value shows as the chip's tooltip; a missing alt shows a `warning` dot | SHOULD |
| `CwaUiImageSlots` | CK `AboutFeatureGrid` etc. | FileUpload × n | yes | `slots: { label: string; bind: UploadBind }[]`; one labelled thumbnail chip per slot, dividers drawn by the row | SHOULD |
| `CwaUiInlineEdit` | the raw modal title input | — | no | text that becomes an input on click/Enter, Enter commits, Escape reverts. Consumer: modal titles | MUST |
| `CwaUiSwatchSelect`, `CwaUiIconSelect` | 5980bc tone, icon tabs | reka-ui `Select` | yes | `options` with `swatch` / `icon` | COULD |

`SelectOption` is today's type from `composables/cwa-select-input`, widened with `description`, `reason` and `group`.

### 4.4 `CwaUiLinkInput`

One control for `{ route, rawPath }` (§6.2), so the ~30 lines of logic in every link tab (the playground's `LinkTab.vue` is the reference) become one tag.

**Anatomy (bar):** `Link  [Page | URL]  [/about-us ▾ search…]  ↗  ◌`
- A segmented control picks **Page** or **URL**. Picking one **clears the other field in the same PATCH** (today only half the sites do it; the playground clears `rawPath` but never `route`).
- **Page**: a `CwaUiResourceSearch` on `/_/routes` by `path`; a pick saves at once (debounce 0, as `LinkTab` does).
- **URL**: a `CwaUiInput type="url"` validated before sending (relative `/path` or `http(s)://`); an off-site URL shows `↗` with tooltip "Opens in a new tab".
- Presence, conflict and save state are those of whichever field is showing; a conflict on the hidden one switches the segment so it is never a silent hold.

```ts
props: { route: ResourceModelField<string|null>; rawPath: ResourceModelField<string|null>;
         label?: string; size?: 'md'|'lg'; disabled?: boolean }
slots: { extra?() }
```
The `extra` slot holds things like CK's Calendly toggle, inside the same row.

### 4.5 `CwaUiFileUpload`

One `bind` API. `useCwaResourceUpload(iri, prop).bind` already exists and becomes the only input; the old five props are deprecated with a migration note (29 CK/SR files).

**Anatomy (bar, 32 px):** `[thumb 32×32] filename.jpg · 240 KB  [Replace] [🗑]  ◌` or, empty, `[⬆ Upload image]  hint ⓘ`.
- **Thumbnail** from the imagine filter (`imagineFilterName`), otherwise a file-type icon.
- **Drop target:** the whole chip, with an `accent` dashed outline while dragging. Not drop-only: the button opens the picker, and it is keyboard focusable.
- **Progress:** a 2 px determinate `CwaUiProgress` along the chip's bottom edge, with two phases ("Preparing image…" for the downscale, then "Uploading 40%") announced politely.
- **Remove** asks through the kit's confirm dialog.
- **Error:** the status slot's ⚠ with message and Retry, which re-sends the same (already downscaled) file.
- `accept` is implied for image fields; `hint` is separate from the button text ("Upload image", never a sentence).
- An upload that finishes after the admin has moved on raises a success toast ("Image uploaded to Hero"), because its field is no longer on screen.

```ts
props: { bind: UploadBind; label?: string; hint?: string; size?: 'md'|'lg'; disabled?: boolean }
```

### 4.6 Manager-bar layout

#### Bar frame (`ResourceManager.vue`, internal)
- Height is `h-manager` (100 px), set in CSS. The spacer is `h-manager` too, so the `watch` that measures `managerHolder.clientHeight` on every tab switch and the `min-h-[74px]` go.
- Order: `ResourceLoadingIndicator` (absolute, above), tab strip + CTA (36 px), row (64 px).
- Empty, loading, error and conflict tabs all render inside the same 64 px row. A tab with nothing to show renders `CwaUiStatusText` ("No settings for this component") in the row.

#### `CwaUiManagerTabs` (replaces `ManagerTabs.vue`; reka-ui `Tabs`)
- A horizontal scroller with the same edge fades as the row; it **never clips** (today it is `overflow-hidden`).
- Arrow keys move between tabs (reka-ui roving focus); the selected tab scrolls into view.
- A tab shows a **badge** when one of its fields is in error or conflict, so a held save is not hidden by being on another tab (see open question Q-A).
- Internal; site developers name tabs through `useCwaResourceManagerTab` or `defineCwaConfig`.

#### `CwaUiManagerRow` (public)
```ts
props: { arrows?: boolean }
slots: { default(), end?() }
```
- Renders `display: flex; flex-wrap: nowrap; overflow-x: auto; overscroll-behavior-x: contain; scroll-padding-inline: 32px`, with a 20 px flag lane and 4 px inline padding (2.3).
- **Edge fades:** a `mask-image` gradient on whichever side has more content, toggled through `data-overflow-start` / `data-overflow-end` attributes that one `ResizeObserver` and a passive, `requestAnimationFrame`-throttled `scroll` listener set. No re-render of the children.
- **Arrows (`arrows`):** 24×32 ghost buttons that scroll by 80% of the width; hidden when there is nothing to scroll; `aria-hidden` (keyboard users scroll by focusing).
- **Focus scrolling:** native focus scrolls the field into view, and `scroll-padding-inline` keeps it clear of the fade. Nothing else is needed.
- **Gap and dividers:** owns `gap: 12px`. `<CwaUiManagerRow.Divider />` (exported as `CwaUiRowDivider`) draws a 1 px `line` rule, 24 px tall, with 16 px either side. CK's hand-drawn `w-[1px] h-8` dividers go.
- **`end` slot:** pinned to the right, outside the scroll area (Publish's state badge, Order's display number).
- Provides the `bar` surface (3) and the live region (4.2).
- Shift + wheel and trackpad horizontal scroll work natively; a vertical wheel over the row scrolls it horizontally only when the row overflows and the page is not being scrolled (no hijack otherwise).

#### Module tabs rewritten onto the row
| Tab | Becomes |
|---|---|
| `DynamicPage.vue` (up to 5 stacked rows) | one row: `Page data type` select · `Property` select · `Component` select · divider · status text |
| `Publish.vue` | row: `Edit live version` toggle · publish badge · `Schedule` toggle · date picker · button(s); badge in `end` |
| `Group.vue` | row of selects/buttons; the disabled reason in a hint |
| `ResourceInfoTab.vue` | `CwaUiReadonly` IRIs (truncated, copy) · badges |
| `Ui.vue` | `UI` select · `Style` multi-select |
| `Order.vue` | `CwaUiNumber size="xs"` (commits on blur/Enter) · toggle |

### 4.7 Modal and form layout

#### `CwaUiDialog` (reka-ui `Dialog`; replaces the Headless UI `DialogBox`)
```ts
props: { open: boolean; title: string; titleEditable?: ResourceModelField<string>; size?: 'sm'|'md'|'lg'; loading?: boolean }
emits: { 'update:open': [boolean] }
slots: { default(), actions?(), headerEnd?() }
```
- Provides the `modal` surface. Header: title (or `CwaUiInlineEdit` bound to `titleEditable`), close button. Body scrolls; header and actions stay.
- `loading` shows skeleton fields, not "Loading...".
- The confirm and prompt dialogs are this component through `createConfirmDialog(vueApp, component)`; the prompt variant (`CwaUiPromptDialog`: one `CwaUiInput`, OK/Cancel) replaces `window.prompt` in TipTap links. Escape and backdrop answer `cancel` (CLAUDE.md rule).

#### `CwaUiFormGroup`
```ts
props: { title?: string; description?: string; columns?: 1|2 }
slots: { default(), actions?() }
```
A titled section with a 1- or 2-column grid of fields. Used in modals and on `/_cwa` pages; provides `page` unless inside a dialog.

#### Modal save behaviour (§7.5)
- Save buttons use `loading` while `isUpdating`.
- A modal that stays open shows the save button's own tick for 1.5 s.
- **No silent overwrite:** when the stored resource changes under unsaved modal edits, each changed field shows the same conflict control as the bar, below the field. This needs `useItemPage` to compare its `localResourceData` with the incoming store copy per field instead of replacing it; if that turns out to be a redesign it drops to SHOULD (as the brief allows) and the modal shows one `CwaUiAlert` ("Mia changed this page while you were editing. [Reload] [Keep my edits]") instead.

### 4.8 Lists and tables

| Component | Replaces | API |
|---|---|---|
| `CwaUiSearchField` | raw `ListFilter` input | `CwaUiInput type="search"` with a leading search icon, a clear button and a 250 ms `debounce` prop; `v-model` |
| `CwaUiFilterChip` | `ListFilterButton` (hidden checkbox) | reka-ui `Toggle`; `v-model: boolean`, `label`, `count?`; `aria-pressed` |
| `CwaUiPagination` | `ListPagination` | reka-ui `Pagination`; `v-model: page`, `total`, `perPage`; `tabular-nums`; first/prev/next/last as icon buttons |
| `CwaUiListState` | ad hoc text | `state: 'loading'|'empty'|'error'`, `title`, `description?`, `action?`, `@retry`. Loading = 5 skeleton rows at row height; empty = icon + text + optional action ("Add page"); error = `CwaUiAlert` with Retry that **keeps the previous items** (CLAUDE.md rule) |

Sorting uses `CwaUiSelect` (`size="sm"`). Rows are the existing list markup restyled to tokens; no table component until a consumer needs one (R7).

### 4.9 Feedback

#### Conflict: `CwaUiRemoteChangeConflict` (exists; restyled, compact in the bar)
- **Bar:** `⚠ Mia · [Use theirs] [Keep mine]` in `warning`, after the status slot, on the same line. Two real buttons (24 px targets), not underlined text. Hovering "Use theirs" shows their value in a tooltip.
- **Modal/page:** the same line below the field, with "Mia changed this to "…"" spelled out.
- Rendered by the field shell whenever `remoteChange` is set, for every kit control. Today only `Input` and `Toggle` render it; `CwaUiSelect` with `:model` had no conflict control, which is the silent hold (success criterion 5).
- Announced: "Mia changed Title. Use theirs or keep yours."

#### Toasts: see section 7.

#### `CwaUiStatusText`
`tone: 'neutral'|'success'|'warning'|'danger'`, `icon?`, slot. One line, truncated with a tooltip in the bar. Replaces `text-orange`, `text-yellow`, `text-danger` and CK `Map.vue`'s bare `<span>`.

#### `CwaUiAlert`
`tone: 'info'|'success'|'warning'|'danger'`, `title`, `description?`, `actions?` slot, `dismissible?`. Replaces `ui/alert/Info.vue`, `Warning.vue` and the danger box. **Not used in the bar** (it would add height); the bar uses status text and hints.

#### Loading (§7.6)
Three things only: `CwaUiSpinner` (a field, a button, a status slot), `CwaUiProgress` (uploads, warm, scans) and the existing `ResourceLoadingIndicator` sweep (bursts of requests). The seven others and every literal "Loading..." go.

### 4.10 In-page editing (outside the bar)

| Component | Notes | Priority |
|---|---|---|
| `CwaUiInlineText` | plain-text in-line editor for the page itself. `:model`, `tag?` (renders as that element so it takes the element's font), `multiline?`, `placeholder?`. `''` → `null`. Presence and conflict as in the bar, but the conflict control floats above the element in a popover anchored to it | SHOULD |
| `CwaUiLinkPopover` | link editing for rich text (URL or page search, open in new tab), replacing `window.prompt` | SHOULD |
| `CwaUiEditPlaceholder` | edit-mode-only "Add a description" placeholder for an empty field | COULD |

---

## 5. Composing a manager tab

### 5.1 A title tab (the 153-use case)
```vue
<script setup lang="ts">
const { exposeMeta, iri } = useCwaResourceManagerTab({ name: 'Title' })
const title = useCwaResourceModel<string>(iri, 'title')
defineExpose(exposeMeta)
</script>

<template>
  <CwaUiManagerRow>
    <CwaUiInput :model="title" label="Title" size="lg" />
  </CwaUiManagerRow>
</template>
```
Presence, conflict, saving, saved and error come from `:model`. There is nothing else to write.

### 5.2 The link tab (24+ copies today)
```vue
<script setup lang="ts">
const { exposeMeta, iri } = useCwaResourceManagerTab({ name: 'Link' })
const label = useCwaResourceModel<string>(iri, 'label')
const route = useCwaResourceModel<string | null>(iri, 'route', { debounceTime: 0 })
const rawPath = useCwaResourceModel<string | null>(iri, 'rawPath')
defineExpose(exposeMeta)
</script>

<template>
  <CwaUiManagerRow>
    <CwaUiInput :model="label" label="Label" />
    <CwaUiRowDivider />
    <CwaUiLinkInput :route="route" :raw-path="rawPath" label="Link" />
  </CwaUiManagerRow>
</template>
```

### 5.3 A wide tab that scrolls (CK-style feature card)
```vue
<script setup lang="ts">
const { exposeMeta, iri } = useCwaResourceManagerTab({ name: 'Card' })
const heading = useCwaResourceModel<string>(iri, 'heading')
const layout = useCwaResourceModel<string>(iri, 'layout')
const calendly = useCwaResourceModel<boolean>(iri, 'isCalendly')
const perPage = useCwaResourceModel<number | null>(iri, 'perPage')
const categories = useCwaResourceModel<string[]>(iri, 'categories')
const { bind: image } = useCwaResourceUpload(iri, 'image')
const alt = useCwaResourceModel<string | null>(iri, 'imageAlt')
defineExpose(exposeMeta)

const layouts = [{ label: 'Row', value: 'row', icon: RowIcon }, { label: 'Column', value: 'column', icon: ColumnIcon }]
const categoryOptions = [{ label: 'Kitchens', value: 'kitchens' }, { label: 'Bedrooms', value: 'bedrooms' }]
</script>

<template>
  <CwaUiManagerRow arrows>
    <CwaUiInput :model="heading" label="Heading" />
    <CwaUiSegmented :model="layout" label="Layout" :options="layouts" />
    <CwaUiToggle :model="calendly" label="Calendly" />
    <CwaUiRowDivider />
    <CwaUiImageAlt :upload="image" :alt="alt" label="Image" hint="Alt text: who, where, doing what" />
    <CwaUiMultiSelect :model="categories" label="Categories" :options="categoryOptions" size="lg" />
    <CwaUiNumber :model="perPage" label="Per page" size="xs" nullable :min="1" />
  </CwaUiManagerRow>
</template>
```
Seven controls, one row, 64 px. Wider than the bar, so it scrolls with fades and arrows. The hint that sites cram into labels today is an ⓘ.

### 5.4 Writing to the page data from a component tab
```vue
<CwaUiInput :model="pageDataTitle" label="Page title" target="pageData" />
```
`pageDataTitle` is a `useCwaResourceModel` on `resources.pageDataIriOf(iri)` (the depth rule in CLAUDE.md, never `pageDataIri`). `target` only draws the badge; the IRI comes from the model.

### 5.5 What a developer cannot do (by design)
- Put a label above a field in the bar: there is no prop for it.
- Wrap the row: `CwaUiManagerRow` sets `nowrap`, and its slot children are flex items it sizes.
- Add a textarea to the bar: it throws in development.
- Forget the conflict control: the shell renders it for every `:model` control.

---

## 6. Multi-line content: handing off from the bar to the page

Multi-line content is never edited in the bar (R1). The hand-off:

1. **The component template owns the editor.** It renders `CwaUiInlineText` (plain text) or the TipTap reference (rich text) bound to the field's model, in edit mode only. It registers itself in a per-`Cwa` registry (a `WeakMap` keyed by `$cwa`, like `clone-mode`) under `(iri, field)` while mounted.
2. **The bar shows a one-line preview, not an input.** A tab (or a declared field with `multiline: true`, section 8) renders `CwaUiInlineHandoff`:
   `Description  "Our kitchens are made in…"  [✎ Edit on page]  ◌`
   The preview is truncated `fg-muted` text; the status slot still shows that field's save state, conflict and presence, because it reads the same model.
3. **"Edit on page"** looks the field up in the registry, scrolls the element into view (`block: 'center'`, smooth unless reduced motion), focuses it and places the caret at the end, and flashes a 1 px `accent-fg` outline for 600 ms. Keyboard: Enter on the button; Escape in the editor returns focus to the button in the bar.
4. **No editor on the page** (the component's template has none in edit mode, or the element is hidden by a `v-if`): the button is disabled with the reason in its hint ("This component doesn't show Description on the page"), and in development the module warns once with the component and field name. There is no popover textarea fallback; that would be the bar editing multi-line content through a side door.

`CwaUiInlineHandoff` props: `model: ResourceModelField<string|null>`, `label: string`, `field: string`. Consumers: CK `ProcessStep.description`, `JournalHeading.quote`, smoking `ChartNotes`, dons-hub's description.

---

## 7. Toasts and the optimistic save model

### 7.1 Toast service

```ts
const toast = useCwaToast()
const id = toast.add({
  kind: 'success' | 'info' | 'warning' | 'error',
  title: string,
  description?: string,
  actions?: { label: string; onClick: () => void | Promise<void> }[],
  duration?: number | null,
  id?: string,
})
toast.update(id, partial)
toast.dismiss(id)
```

- **Per app, client-only, lazy.** `useCwaToast()` is a few lines: it finds the app's toaster through a `WeakMap` keyed by `nuxtApp` (no module-scope state, so SSR-safe) and `import()`s `CwaUiToaster` on the first `add`, mounting it in the app's container. On the server `add` is a no-op. The toaster is built on reka-ui `Toast` (`ToastProvider`, `ToastRoot`, `ToastViewport`), so swipe, pause and focus are handled.
- **Durations:** success and info 4 s, warning 6 s, error 10 s; anything with actions stays until acted on or dismissed (`duration: null`). Timers pause on hover and while any toast is focused.
- **Stack:** bottom-right, above the bar (`bottom: calc(var(--spacing-manager) + 16px)` when the bar is open). At most 3 visible; older ones collapse behind with "+2 more", expanding on hover or focus.
- **Same `id` replaces**, so "Publishing…" becomes "Published" in place, and repeated network-loss events show one toast.
- **Announcements:** success/info/warning polite; error assertive (reka's `type="foreground"`). Toasts never take focus; F8 jumps to the viewport (reka's hotkey) and Escape dismisses the focused one.
- **Look:** `surface-raised`, `radius-popover`, a 3 px tone bar on the leading edge plus the tone's icon, title `text-sm font-medium`, description `fg-muted`, actions as `ghost` buttons.

**Replaces `RequestErrors` and `Notification`.** `ResourcesManager`'s request errors become error toasts with the request's own message (`hydra:description`, `detail`, or the first violation), with **Retry** when the request can be repeated and **View** when there is a resource to go to. Validation errors whose `propertyPath` matches a field on screen go to that field instead (§7.4, SHOULD); only unmatched ones toast. That removes `useItemPage`'s hard-coded `plainPassword` toast.

**When to toast (and when not):**

| Toast | Never toast |
|---|---|
| delete, publish, schedule, purge, warm, orphan scan finished | a routine field save |
| an upload that finished off-screen | a field validation error with a field on screen |
| network lost / back (`id: 'network'`, persistent while offline) | a conflict (it is on the field) |
| a request error with no field | "Copied" (the status slot ticks) |

**Public:** apps' own admin pages use `useCwaToast` instead of dons-hub's `useFlash` and `ManageNotice` (the brief's consumer).

### 7.2 Optimistic save model, per field

The kit renders the model's existing life cycle; it does not change it (non-goal).

```
             edit                 debounce elapses            200/201
  idle ───────────▶ pending ─────────────────────▶ submitting ─────────▶ saved (1.5 s) ──▶ idle
   ▲                  │  ▲                           │   │
   │                  │  └──── edit while submitting ┘   │ 4xx / 5xx / network
   │                  │                                  ▼
   │                  │                               error ── Retry / next edit ──▶ submitting
   │                  ▼
   └──── resolved ── conflict (save held: remote change, 412) ── Use theirs / Keep mine
```

| Phase | Model signal | What the admin sees | Timing |
|---|---|---|---|
| pending / submitting | `pendingSubmit \|\| submitting` | their own value at once; nothing else for 300 ms, then a spinner | 300 ms grace, so a fast save never flickers |
| long wait | `isLongWait` | spinner turns `warning`, tooltip "Still saving…" | after 5 s (existing) |
| saved | `saved` | `success` tick that fades | 1.5 s; shown only when no newer edit is pending |
| error | `states.error` | `danger` outline, ⚠ with message and **Retry**; **the value stays** | until Retry or the next edit succeeds |
| conflict | `remoteChange` | `warning` outline and Use theirs / Keep mine, always visible | until chosen; the model holds the save meanwhile (#429, unchanged) |

Bar-level summary: the CTA area shows nothing while all is well. If any field of the selected resource is saving for > 300 ms, the CTA's publish button shows its spinner (a publish already waits for those saves, #394). If any field is in error or conflict, its tab carries the badge.

**Network loss:** fields keep their unsent values in `pending`; the status slot shows a `warning` cloud-off icon with "Offline: will save when you're back"; one persistent toast says so. On `online` the model's existing reconnect path sends them.

---

## 8. `defineCwaConfig`: config next to the component (§10)

Daniel's direction: extend the agreed `defineCwaStyles` into `defineCwaConfig`, with styles as one part, so a component can declare there what sites put in `nuxt.config.ts` today.

### 8.1 What it looks like

**A component** (`app/cwa/components/NavigationLink/NavigationLink.vue`):
```vue
<script setup lang="ts">
defineCwaConfig({
  name: 'Navigation link',
  description: 'A link to another page or site.',
  instantAdd: true,
  defaultData: {
    label: 'New link',
    route: cwaIri('/_/routes/home'),
  },
  styles: {
    multiple: false,
    classes: {
      Primary: 'btn btn-primary',
      Ghost: ['btn', 'btn-ghost'],
    },
  },
  managerTabs: ['LinkTab', 'AdvancedTab'],
  ui: ['NavigationLinkButton'],
})

const props = defineProps<IriProp>()
const { resource, exposeMeta } = useCwaComponent(props)
defineExpose(exposeMeta)
</script>
```

**A layout** (`app/cwa/layouts/Primary.vue`) or **page template** (`app/cwa/pages/BlogArticle.vue`):
```vue
<script setup lang="ts">
defineCwaConfig({
  name: 'Blog article',
  description: 'An article page with a hero and a body.',
  styles: { classes: { Wide: 'max-w-7xl', Narrow: 'max-w-3xl' } },
})
</script>
```
This replaces `cwa.layouts.<Name>` / `cwa.pages.<Name>` and the template's placeholder `classes` (`'Blue Background'`, `'Big Text'`). Layout and page `classes` become `styles.classes`, the same shape components use, so `mergeSelectedStyles` / `deriveSelectedStyles` serve all three.

### 8.2 Keys

| Key | Component | Layout / page | Today in `nuxt.config.ts` | Notes |
|---|---|---|---|---|
| `name` | ✓ | ✓ | `resources.<N>.name`, `layouts.<N>.name`, `pages.<N>.name` | default stays the spaced Pascal name |
| `description` | ✓ | ✓ | `resources.<N>.description` | plain text; Markdown is a COULD |
| `instantAdd` | ✓ | — | `resources.<N>.instantAdd` | |
| `defaultData` | ✓ | — | `resources.<N>.defaultData` | IRIs through `cwaIri()` (8.5) |
| `styles` | ✓ | ✓ | `useCwaComponent(…, { styles })` at runtime; `layouts/pages.<N>.classes` | `{ multiple?: boolean; classes: Record<string, string \| string[]> }` |
| `managerTabs` | ✓ | — | `resources.<N>.managerTabs` + the `admin/` scan | order and inclusion (8.4) |
| `ui` | ✓ | — | `resources.<N>.ui` + the `ui/` scan | order and inclusion, names from `ui/` |
| `fields` | reserved (8.7) | — | — | step 6b |

A component-only key in a layout or page warns at build time and is ignored. `siteConfig`, `pageData`, `pagesDepth` and every other module option stay in `nuxt.config.ts` (D4).

### 8.3 How it is read (D1: a macro)

- **Build time.** For every `<Name>.vue` under `app/cwa/components/<Name>/`, `app/cwa/layouts/` and `app/cwa/pages/`, the module parses the SFC with `vue/compiler-sfc` (already a dependency, used by `component-group-declarations.ts`) and finds a top-level `defineCwaConfig(...)` call in `<script setup>`.
- **The argument must be static**: an object literal of strings, numbers, booleans, `null`, arrays, nested literals, `cwaIri('…')` calls, and identifiers imported from a plain `.ts`/`.js` module. Imported values are evaluated with the module's existing build-time loader so an option list can be shared between the config and a custom tab (5980bc `variants`/`tones`, dons-hub `LINK_CARD_ICONS`). Anything else (a `ref`, a function, a local `const` computed at runtime) is a build error naming the file and the expression, the way `definePageMeta` reports it.
- **Stripped from the output.** A Vite transform removes the call from the compiled component, as Nuxt does for `definePageMeta`, so the config never reaches a runtime chunk. `defineCwaConfig` is declared as a global type only; it has no runtime export, so a call that escaped the transform fails loudly instead of quietly shipping its literal to visitors.
- **Regenerated on change.** The existing `builder:watch` hook already regenerates the options when `admin/` or `ui/` files change; it also re-reads the config when a CWA template file changes (it already does so for `cwa-component-group-declarations.ts` on any `.vue` change).
- **Why not a sibling `config.ts`:** it needs no SFC parsing, but it splits a component across two more files, and the brief's goal is "one place". The SFC is already parsed for group declarations, so the cost is paid. If Daniel prefers `config.ts`, the keys, types and precedence below are unchanged; only 8.3 changes.

### 8.4 Merge and precedence (D2)

Resolution per resource, in `extendCwaOptions`:

1. **Scan defaults:** spaced name, `managerTabs` from `admin/`, `ui` from `ui/` (today's behaviour).
2. **`defineCwaConfig`** overrides the scan.
3. **`nuxt.config.ts` `cwa.resources.<Name>`** overrides both, **key by key** (a whole `styles.classes` map replaces, it is not merged class by class). An app can still patch a layer's component.
4. **A key set in both 2 and 3 warns once at build time**: `[cwa] NavigationLink: "description" is set in defineCwaConfig and nuxt.config.ts; nuxt.config.ts wins.`

`managerTabs` and `ui` get one more rule, because today `mergeWith` concatenates arrays (the app's entries first, then the scanned ones):
- Listed in `defineCwaConfig`: that is the order. A scanned tab not listed is **appended**, with a build warning, so a tab never silently disappears. A name that is not in `admin/` is a build error.
- The config's order overrides a tab's own `useCwaResourceManagerTab({ order })`; setting both warns.
- `nuxt.config.ts` `managerTabs` keeps its current meaning (entries added ahead of the scanned ones), so existing sites do not change.

Precedence is covered by `module.spec.ts` cases: scan only; config only; nuxt only; both (nuxt wins, warns once); tabs listed, unlisted and unknown.

### 8.5 IRIs without the prefix

`defaultData` IRIs are written prefix-free and wrapped in `cwaIri()`:
```ts
defaultData: { pageData: cwaIri('/page_data/abc'), route: cwaIri('/_/routes/home') }
```
At build time `cwaIri('/x')` becomes a marker; when the component is created, `ResourcesManager` replaces each marker with the IRI under the runtime API path prefix (`normaliseApiPathPrefix` of `resolveApiUrl`). It cannot be done at build time because the API URL is runtime config. A plain string is never guessed at, because `'/about'` is a valid `rawPath`. Sites' hard-coded `/_api/page_data/...` is the #266 trap this removes.

### 8.6 Where the result goes (bundles)

`cwa-options.ts` is imported by `plugin.ts`, so it is in every visitor's entry. New admin-only data must not grow it:
- `description`, `defaultData`, `styles` and (later) `fields` go into a new generated template, `cwa-admin-config.ts`, imported only by admin code (the Add component dialog, the Ui tab, generated tabs), as `cwa-component-group-declarations.ts` already is. `entry-bundle-markers.mjs` gains a marker for it.
- `name`, `managerTabs`, `ui` and `instantAdd` stay where they are today.
- Moving `styles` out of `useCwaComponent(…, { styles })` also takes each component's class map out of the visitor's chunk; visitors only need the stored `uiClassNames`, which `useCwaAutoClass` applies. **To verify** before relying on it: nothing on the visitor path reads `ops.styles` (`deriveSelectedStyles` feeds `getCurrentStyleName`, an admin read).
- The runtime `styles` option of `useCwaComponent` stays for one alpha with a deprecation entry in `DEPRECATIONS.md`, and is ignored (with a dev warning) when `defineCwaConfig` sets `styles`.

### 8.7 Types

A generated `cwa-config.d.ts` declares:
```ts
declare global {
  function defineCwaConfig<TData extends Record<string, unknown> = Record<string, unknown>>(
    config: CwaTemplateConfig<TData>
  ): void
  function cwaIri(path: `/${string}`): string
}

interface CwaTemplateConfig<TData> {
  name?: string
  description?: string
  instantAdd?: boolean
  defaultData?: Partial<TData>
  styles?: { multiple?: boolean; classes: Record<string, string | string[]> }
  managerTabs?: (CwaManagerTabName | CwaFieldTab<TData>)[]
  ui?: CwaUiName[]
}
```
`CwaManagerTabName` and `CwaUiName` are unions generated from the `admin/` and `ui/` scans (as `CwaComponentNames` is today), so a typo is a type error. `TData` is opt-in (`defineCwaConfig<NavigationLinkData>({...})`), which types `defaultData` and field `name`s where an app has resource types; the module has none to infer.

### 8.8 Field declarations (step 6b, designed now)

So simple components need no tab file. A tab entry in `managerTabs` may be an object instead of a name:
```ts
managerTabs: [
  {
    name: 'Content',
    fields: [
      { name: 'heading', kind: 'text', label: 'Heading', size: 'lg' },
      { name: 'tone', kind: 'select', label: 'Background', options: [{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }], nullable: true },
      { name: 'showDates', kind: 'toggle', label: 'Show dates' },
      { kind: 'link', label: 'Link' },
      { name: 'image', kind: 'image', label: 'Image', alt: 'imageAlt', hint: 'Who, where, doing what' },
      { name: 'description', kind: 'text', multiline: true, label: 'Description' },
    ],
  },
  'AdvancedTab',
]
```

| `kind` | Renders | Extra keys |
|---|---|---|
| `text` | `CwaUiInput`, or `CwaUiInlineHandoff` with `multiline` | `type`, `nullable`, `multiline` |
| `number` | `CwaUiNumber` | `min`, `max`, `step` |
| `toggle` | `CwaUiToggle` | — |
| `select` / `multiselect` | `CwaUiSelect` / `CwaUiMultiSelect` | `options` (static) or `endpoint` + `property` |
| `segmented` | `CwaUiSegmented` | `options` |
| `link` | `CwaUiLinkInput` | `route?`, `rawPath?` field names (default `route`, `rawPath`) |
| `image` | `CwaUiImageAlt` or `CwaUiFileUpload` | `alt?`, `imagineFilterName?` |
| `date` / `day` / `dayRange` | the three pickers | `min`, `max` |

Shared keys: `name`, `label`, `hint`, `size`, `nullable`, `target`. The module renders a declared tab with one internal `CwaGeneratedTab` component: a `CwaUiManagerRow` of those fields, each bound with `useCwaResourceModel`. Generated and hand-written tabs mix freely in one `managerTabs` list. smoking's `ChartItem` goes from 4 tabs to 1; option lists leave tab files.

The same `kind`s replace `pageData.<Class>.metaFields`' `input`/`select` in `PageDataAdminModal` (in `nuxt.config.ts`, D4), rendered under the `modal` surface.

### 8.9 Migration for a site (CK, the largest)

1. Move each `cwa.resources.<Name>` block into `defineCwaConfig` in `<Name>.vue`. The build warning lists anything left in both places.
2. Move `useCwaComponent(…, { styles })` into `defineCwaConfig({ styles })`.
3. Replace hard-coded `/_api/...` IRIs in `defaultData` with `cwaIri('/...')`.
4. Move `cwa.layouts`/`cwa.pages` `classes` into each template's `styles.classes`, and delete the template's placeholders.
5. (6b) Replace one-field tabs with `fields`.

CK's ~290 lines of `nuxt.config.ts` resource config end up beside the components they describe; `nuxt.config.ts` keeps `siteConfig` and module options.

---

## 9. Public name migration

| Today | Becomes | Note |
|---|---|---|
| `CwaUiFormInput` | `CwaUiInput` | alias for one alpha |
| `CwaUiFormToggle` | `CwaUiToggle` | label must be fixed; a label that swaps with state → `CwaUiSegmented` |
| `CwaUiSelect` / `CwaUiFormSelect` | `CwaUiSelect`; `multiple` → `CwaUiMultiSelect` | `CwaUiFormSelect` removed |
| `CwaUiFormFile` | `CwaUiFileUpload` with `bind` | five-prop API deprecated |
| `CwaUiFormSearchResource` | `CwaUiResourceSearch` | `notNullable` becomes `nullable`, as on every other input |
| `CwaUiFormButton` | `CwaUiButton` | `color: 'blue'\|'grey'\|'dark'\|'error'` → `primary\|secondary\|ghost\|danger` |
| `CwaUiFormLabelWrapper` | the `label` prop on every input | removed; inline in the bar by surface |
| `CwaUiDatePicker` | unchanged | `label` now goes through the shell |
| `ModalInput`, `ModalSelect`, `PageTypeSelect`, `ModalRadioTabs`, `ModalInfo`, `ModalReachableToggle`, `FilterSelect` | kit inputs | internal, removed |
| `ui/alert/Info`, `Warning` | `CwaUiAlert` | |
| `RequestErrors`, `Notification` | toaster | internal |

Each removal gets a `CHANGELOG.md` line and a migration note for the ~220 site tabs.

---

## 10. Accessibility checklist (§8)

- Contrast pairs in 2.1 checked against `surface`; `fg-muted` is the lowest text colour in either theme (6.9:1 dark, 7.6:1 light). `line` outlines meet 3:1 for non-text only where they are the only boundary (focus uses `accent-fg`, 6.7:1).
- Every field has a programmatic label; hints and errors are linked by `aria-describedby`; status slot changes go through the surface's polite live region; error toasts are assertive.
- Keyboard: Tab through the row (native focus scrolls it, `scroll-padding-inline` clears the fades), arrows in the tab strip, Backspace on multi-select chips, the uploader's button, the date pickers' segments (reka-ui), Escape closes popovers and returns focus.
- Presence flags carry the name in text; conflict, error and saved each have an icon.
- `prefers-reduced-motion` as in 2.5.
- Controls are 32 px tall and at least 24 px wide; arrows, chips' × and conflict buttons meet 24×24.

---

## 11. Engineering notes

- **reka-ui only.** `Toggle` (Headless UI `Switch`), `ui/Select.vue`, `CwaUiFormSelect`, `Button`'s popper and `DialogBox` move to reka-ui; the `popper.ts` composable and `@headlessui/vue` leave `dependencies` when the last one goes.
- **Chunking.** Each new reka-ui consumer can split a chunk into the entry's `__vite__mapDeps` (as `ComponentUsageBadge` did, ~12 B gzip). Measure with `pnpm run test:e2e` per step and state any budget change.
- **No `const props = defineProps<…>()`** in shipped components (TS2883, #349): destructure, as `Input.vue` and `Toggle.vue` already do.
- **Tests per component:** states and `:model` wiring with real `computed` refs (the #260 nested-ref trap); a conflict raised on a `:model` select renders the control (success criterion 5). Browser scenarios: bar height and page scroll unchanged across every tab at 1280 and 768 px; a 10-field row scrolls and never wraps; the conflict control appears.

---

## 12. Open questions for Daniel

- **Q-A. A held conflict on a tab you leave.** Only the selected tab is mounted (`<component :is="selectedTab">`), so leaving a tab unmounts its models. Should leaving a tab with a held conflict keep that tab alive (`KeepAlive` for tabs with held saves), or resolve as Keep mine, as following a header link does? The tab badge in 4.6 only helps if the tab stays mounted.
- **Q-B. `states.error` and `states.saved` on `useCwaResourceModel` (D5).** These are the only model changes the kit needs. Agree the names and that `retry()` re-sends the kept value through the existing `submit()`?
- **Q-C. Modal conflict (§7.5).** Per-field conflict in modals needs `useItemPage` to stop replacing `localResourceData` wholesale. Is that acceptable in this release, or ship the single alert fallback in 4.7 first?
- **Q-D. `defineCwaConfig` imports.** Allowing imported constants (8.3) lets option lists be shared with custom tabs, at the cost of evaluating those modules at build time. Literal-only is simpler. Which?
- **Q-E. `managerTabs` in both places.** Keep `nuxt.config.ts`'s current "prepend" meaning for arrays (8.4), or make it replace like every other key, now that `defineCwaConfig` owns the order?

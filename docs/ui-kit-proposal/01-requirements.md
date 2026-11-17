# CWA Admin UI Kit: requirements brief (#236)

**From:** product. **To:** UI designer and developers. **Decision owner:** Daniel (project lead).
**Sources:** the module inventory (`src/runtime/templates/components/**`, `src/layer/**`), and inventories of the manager tabs in nine CWA sites (CK, SR, TPL, HB, bcio, 5980bc, smoking, hbcp-tatt, dons-hub; about 220 tab files, only about 50 distinct designs).

Priorities: **MUST** (the kit does not ship without it), **SHOULD** (first release unless it blocks a MUST), **COULD** (later, or when cheap).

---

## 1. Problem

The admin's inputs have grown piecemeal, and sites have filled the gaps themselves:

- **Five select implementations, three text-input styles, seven loading indicators, five disabled looks**, and two headless libraries (Headless UI and reka-ui) with two positioning systems.
- **Co-editing UI almost never reaches users.** Presence and the remote-change conflict control appear only when a field is bound with `:model`. One tab in nine sites does that; everything else binds `v-model="x.model.value"`. This also makes a held save silent: a field in conflict stops saving with no Use theirs / Keep mine control on screen.
- **No per-field save feedback anywhere.** `useCwaResourceModel` exposes `pendingSubmit`, `submitting`, `isLongWait`, but nothing renders them. Errors surface only as a generic "Oops! There was a problem." toast, never on the field.
- **The manager bar's single-row rule is not enforced by the components.** `DynamicPage.vue` stacks up to five rows; `ResourceManager.vue` uses `min-h` and re-measures its height on every tab switch; `ManagerTabs` clips instead of scrolling; no tab has a horizontal scroller; dons-hub's link card wraps to two lines.
- **Sites reach for Nuxt UI or custom code** for multi-select, date-only and date-range pickers, number inputs, tri-state booleans, link inputs and image previews, against the no-Nuxt-UI decision, and those controls cannot take part in co-editing (the CK/SR date pickers go stale on a remote change and throw when cleared).
- **Boilerplate and sprawl.** One field costs about 20 lines and often a whole tab (SR `SrnteMemberCard`: 5 tabs, 1 input each). The link editor is copy-pasted 24+ times with half-enforced Internal/External logic. Resource config sits far from the component in each site's `nuxt.config.ts` (CK: about 290 lines).

## 2. Goals

1. **One cohesive kit** for every admin input surface: manager bar, modals, `/_cwa` pages, lists, auth pages, menus and toasts. One look, one disabled state, one loading language.
2. **Co-editing by default.** Binding a field to a resource model gives presence, conflict, and saving/saved/error state with no extra wiring. The easy path is the correct path.
3. **The manager bar is one row of fixed height**, enforced by the kit's layout components, not by each tab author's discipline.
4. **Optimistic, quiet, fast feedback.** Edits show at once; status is shown where the user is looking; errors are actionable.
5. **Remove site boilerplate.** The common tab patterns (text field, link, image with alt, select, toggle) need no hand-written state logic, and simple components need no tab file at all.
6. **Co-locate component config** with the component through `defineCwaConfig`, of which component styles are one part (§10).
7. **Nothing of this reaches visitors' bundles.**

## 3. Non-goals

- Styling visitor-facing components, layouts or page templates (owned by apps), or the visitor-facing form composables (`useCwaForm*`, `ExampleForm`).
- A general-purpose design system for apps' own front ends. Apps' own *admin* pages (dons-hub `/manage`) may use the public kit, but we do not design for them beyond that.
- A theme system for apps to restyle the admin (`color`/`variant`/`size` theming is left out until there is one; the dark-panel look is the only theme for now).
- Multi-line or rich editing inside the manager bar (it belongs in-line on the page).
- Changing save semantics (merge-patch, changed fields only, the #394 flush, the #429 conflict model). The kit renders them; it does not redesign them.
- Mapping every API validation violation onto every field in the first release (see §7, SHOULD).

## 4. Hard rules (restated precisely; non-negotiable)

**R1. Manager bar: one row, constant height.**
- Every tab renders its controls in **one horizontal row**. Fields are **never stacked vertically**, inside a tab or inside a field (no label above, no helper line underneath, no message row).
- The bar's height is **fixed** and is **identical for every tab** of every component, including an empty tab, a tab that is loading, a tab showing an error or conflict, and a tab whose controls are disabled. Switching tabs must not move the page.
- When the row is wider than the bar, it **scrolls horizontally** (with visible affordance). It **never wraps**.
- **Secondary text** (a hint, a time zone, a status, a validation message, a conflict) goes **inline** in the row or behind a **tooltip/popover**, never on its own line.
- **Multi-line content is edited in-line on the page**, not in the bar. No textarea in the bar.
- Rich single-row controls are encouraged: file/image uploaders, selects, multi-selects, segmented controls, toggles, date and date-range pickers, comboboxes, steppers.
- Too many tabs: the tab strip scrolls; it never clips.

**R2. Cohesion across the admin.** The same kit (field shell, inputs, buttons, feedback) is used in the manager bar, modals, `/_cwa` pages, lists, menus and auth pages. A surface may choose a label placement variant; it may not have its own input implementation.

**R3. No Nuxt UI dependency.** Nuxt UI injects theme tokens that would bleed into or from apps. It is the **structural reference to port from** (keep the MIT header in a ported file, restyle with `cwa:` utilities, drop its theming props).

**R4. Headless base is reka-ui** for all new components. Existing Headless UI components move over to reka-ui as part of this work; at the end there is one headless library and one positioning system.

**R5. Tailwind v4, every class `cwa:`-prefixed.** No unprefixed app utilities in kit components or in the patterns we document for tabs. Colours from the admin palette only (blue/stone/magenta/orange tokens), never `indigo`/`gray`.

**R6. Admin code stays out of visitors' bundles.** Kit components and services load lazily for admins only; the existing guards (`entry-bundle-markers.mjs`, `visitor-page-preloads.mjs`, `prefetch-hints.mjs`) must pass, and their budgets only move with a stated reason.

**R7. No speculative exposure.** Every public component, prop and composable has a concrete consumer (module or the site evidence below) and a test.

## 5. Surfaces

| Surface | Today | Requirement | Priority |
|---|---|---|---|
| **Manager bar** (`ResourceManager.vue`, `ManagerTabs.vue`, `_tabs/**`) | `min-h-[74px]` + spacer re-measure; tabs clip; `DynamicPage` stacks 5 rows; `Publish` row can wrap | Fixed height; `CwaUiManagerRow` (nowrap, horizontal scroll, edge fade/shadows, optional arrow buttons, kit-owned gap and dividers); scrolling tab strip; `DynamicPage` rewritten as one row of inline selects; `Publish`, `Group`, `ResourceInfoTab` fit the row (long IRIs truncate with full value on hover/copy) | MUST |
| **Modals** (Page, PageData, PageResource, Routes, Users, Layouts, AddComponent, Stranded groups) | `ModalInput`/`ModalSelect`/`PageTypeSelect`/`ModalRadioTabs`/`ModalReachableToggle`/`ModalInfo`; editable title is a raw input | Kit fields with the floating-label variant; segmented control replaces `ModalRadioTabs`; read-only field replaces `ModalInfo`; title edit uses the kit inline-edit input; helper text allowed below fields here (R1 is bar-only) | MUST |
| **`/_cwa` pages** (settings, users, orphaned, layouts) | Mixed `CwaUi*` and `Modal*`; ad hoc inline result text | Kit fields with label-above variant; textarea; inline status text; alerts | MUST |
| **Lists** (`ListContent`, `ListFilter`, `ListFilterButton`, `FilterSelect`, pagination) | Raw search input, a fourth select style, hidden-checkbox chips | Kit search input, select, filter chip (toggle button), pagination; loading and empty states | MUST |
| **Toasts / notifications** (`RequestErrors`, `Notification`) | Errors only, fixed copy | Toast service (§7) | MUST |
| **Menus and popovers** (`ClonePlacementMenu`, `ComponentUsageBadge`, context menu, ⓘ reasons) | Already reka-ui | Restyled onto kit tokens; the ⓘ reason pattern becomes the kit's `hint` primitive | SHOULD |
| **Auth pages** (`InputField`, light theme) | Only field with per-field errors | Kit field, light variant, keeping the #386 directive-`created` autofill read | SHOULD |
| **Confirm/prompt dialogs** (`ConfirmDialog`, `DialogBox`, TipTap `window.prompt`) | Headless UI dialog; browser prompt for links | Kit dialog on reka-ui through `createConfirmDialog`; a prompt variant; client-only and per-app (never module-scope state) | SHOULD |
| **In-page editing** (TipTap reference, sites' `EditableText`) | 9 diverging editor copies; plain-text editor without presence | See §6.3 | SHOULD / COULD |

## 6. Input types the kit must cover

### 6.1 The field shell (MUST, the foundation)

One `CwaUiField` shell that every input sits in:

- **Binding:** accepts `:model` (a `useCwaResourceModel` field) **or** `v-model`. With `:model` it wires value, `focusListeners`, presence, conflict and save state automatically. Every kit input accepts `:model` (today only Input, Toggle and Select do).
- **Label placement variants:** `inline` (manager bar, the default there and the only one allowed there), `floating` (modals), `above` (pages). Placement is chosen by the surface, so a bar field cannot be given a label above it.
- **Hint** as an ⓘ tooltip/popover (sites cram "Alt text (who, where, doing what)" and "Link (/page or https://)" into labels today). `optional` marker. `placeholder`.
- **Size tokens** (e.g. `xs`/`sm`/`md`/`lg`/`auto` widths) replacing the 28 hand-picked `w-*` widths in CK alone.
- **States:** default, focus, disabled (one look everywhere), read-only, loading, saving, saved, error (with message and retry), conflict (Use theirs / Keep mine), peer presence (outline + fading name flag). In the bar all of these render within the row (icon, colour, tooltip); none adds height.
- **Target resource indicator** (SHOULD): a field that writes to the page or page data rather than the selected component says so (badge/icon + tooltip), since 2+ sites edit `displayPageIri`/`pageData` from component tabs.

### 6.2 Controls

| Control | Where it is used today (evidence) | Bar? | Priority |
|---|---|---|---|
| **Text input** (types text, email, url, tel, password, search; prefix/suffix adornment; `nullable`) | Title/label/caption tabs in every site (153+ uses); `ModalInput` in all modals; settings; users; `Order.vue` | Yes | MUST |
| **Number input / stepper** (nullable, min/max/step, `step=any`; commits on blur/Enter or debounced, not per keystroke) | `Order.vue` (emits per keystroke today), Collection `perPage` (6+ sites), CK `PostalAddress/Map` lat/lng | Yes | MUST |
| **Textarea** (autosize, optional counter/limit) | Settings sitemap XML and robots.txt; modals | **No** (modals/pages only) | MUST |
| **Toggle / switch** (static label, own label; no label flipping with state) | Publish, Order, Header Enable Navigation, settings ×8, users, modals, `isCalendly` ×11 (CK), "Show dates?" (SR), Paginate (bcio) | Yes | MUST |
| **Select** (single; options with description line, disabled option with reason, `nullable`/clearable "None", placeholder, grouped options) | `Ui.vue` UI/Style; Collection (all sites); 5980bc Feature/StepList Layout; SR Direction; CK cornice; dons-hub icon; modals (Prefix, Visibility, Role, Data type, Field); `AddComponentDialog`; list sort | Yes | MUST |
| **Multi-select** (chips; in the bar collapses to "N selected" or scrolls chips inside a fixed width; never grows the row) | `CwaUiSelect multiple` (Style); CK `PortfolioDetails` Categories/Worktop via Nuxt UI `USelectMenu` | Yes | MUST |
| **Combobox / resource search** (async search of an endpoint, debounced, accepts an IRI **or** embedded resource, resolves the API path prefix, clearable, loading/error inline) | `SearchResource` (Route in every link tab, `RoutesTabForwardTo`, CK tile routes, 5980bc `FeaturedArticles` with hard-coded `/_api/`) | Yes | MUST |
| **Link input** (one control for `{ route, rawPath }`: search pages or type a URL; enforces either/or by clearing the other; validates URLs; shows "opens in new tab" for off-site; saves a pick immediately; slot/flags for extras like Calendly) | 24+ copied link tabs (TPL, SR, CK, HB, 5980bc, smoking, dons-hub, hbcp `LinkFields`, bcio variants that never enforce either/or) | Yes | MUST |
| **Segmented control** (2–5 options, icon or text; also tri-state Unset/Yes/No) | `ModalRadioTabs` (modals); toggles used as two-way choices (Internal/External, Calendly); SR Row/Column; CK `CovingAndFramed` tri-state | Yes | MUST |
| **Date picker** (existing `CwaUiDatePicker`: UTC instant, local clock, `min`, minute step) | Publish schedule, Routes "Goes live" | Yes | MUST (label-above option removed from bar use) |
| **Date-only picker** (`YYYY-MM-DD` in/out, clearable) | CK `JournalHeading` date via Nuxt UI `UCalendar` (throws on clear) | Yes | MUST |
| **Date-range picker** (date-only start/end) | SR `ConferenceTitle` via Nuxt UI `UCalendar range` (stale after remote change) | Yes | SHOULD |
| **File / image uploader** (thumbnail from the imagine filter, filename, size, replace, remove with confirm, drop target, progress incl. downscale step, `accept` implied by an image field, error with retry, `hint` separate from the button text; one `bind` API, the old five-prop API deprecated) | 48+ `CwaUiFormFile` uses; 29 CK/SR files on the old API; dons-hub hand-built 50×50 preview; 5980bc PhonePoster's sentence-long button label | Yes | MUST |
| **Image with alt text** (alt edited as part of the image: inline Alt input or popover on the thumbnail chip) | 13 CK files, 5980bc `Feature/Photo`, dons-hub `Image` | Yes | SHOULD |
| **Multi-slot image uploader** (one labelled thumbnail chip per slot: A/B/C or named) | CK `AboutFeatureGrid` and 3 others (3 identical "Upload Image" buttons with hand-drawn dividers), `PortfolioImageLandscape`, SR `ResourceWithPreview` | Yes | SHOULD |
| **Ordered multi resource picker** (chips, reorder, max count) | 5980bc `FeaturedArticles` (three single pickers `article1..3`) | Yes | COULD |
| **Button** (blue/grey/dark/error; `loading`; options menu; link; icon-only with tooltip) | ~15 module files | Yes | MUST (port to reka-ui, unify disabled look) |
| **Read-only value / badge** (truncates, copy, full value on hover) | `ModalInfo`, `ResourceInfoTab` IRI, bcio Collection IRI as a bare `<p>` | Yes | MUST |
| **Row divider** | CK hand-drawn `w-[1px] h-8` dividers | Yes | SHOULD (part of `CwaUiManagerRow`) |
| **Filter chip** (toggle button) | `ListFilterButton` (hidden checkbox) | Lists | MUST |
| **Search field** (icon, clear) | `ListFilter` on every list page | Lists | MUST |
| **Pagination** | `ListPagination` | Lists | MUST |
| **Swatch select** | 5980bc "Background" tone | Yes | COULD |
| **Icon combobox** (preview, searchable allowed set, app-supplied icons) | 5980bc `IconTab`/`Step/Icon` (Nuxt `UIcon`), dons-hub icon select | Yes | COULD |

### 6.3 In-page editing (outside the bar)

| Item | Evidence | Priority |
|---|---|---|
| **Plain-text in-line editor** (single/multi-line, takes the element's font, `''` → `null`, with presence and conflict wiring) | 5980bc `EditableText`/`useEditableHere`; CK `noMenu` TipTap fork; prose crammed into bar inputs (CK `ProcessStep.description`, `JournalHeading.quote`, smoking `ChartNotes`, dons-hub description) | SHOULD |
| **Link popover** for rich text, replacing `window.prompt` | All TipTap copies; dons-hub's own `promptDialog` | SHOULD |
| **Admin empty-state placeholder** (edit-mode only) | Hand-written in 10+ components across sites | COULD |
| **Shared TipTap editor shipped by the module** | 9 copies, 6 contents | COULD (separate decision; the playground reference stays the source) |

## 7. Feedback and notifications

### 7.1 Per-field save state (MUST)

- **Optimistic:** the field shows the user's value immediately (already true). The kit must not block typing while saving.
- **Saving:** a small inline indicator once a save has been pending or in flight for more than ~300 ms (no flicker on fast saves). Driven by the model's existing `pendingSubmit`/`submitting`.
- **Saved:** a brief inline tick (≈1.5 s, then gone). No toast for routine saves.
- **Long wait:** after `isLongWait` (5 s) the indicator says so (tooltip "Still saving…").
- **Error:** the field is marked (colour + icon), the message is in a tooltip/popover in the bar or below the field elsewhere, the unsent value is kept, and there is an explicit **Retry**. Today only the next keystroke retries.
- **Conflict:** Use theirs / Keep mine is **always visible** when a save is held, for every kit control bound with `:model`. A held save with no visible control is a defect (fixes the silent hold in the inventory, §2 item 7).
- **Presence:** peer outline and fading name flag on every `:model` control, including selects, toggles, date pickers, uploaders and the link input.
- Errors are tracked **per field**, not only per endpoint, so two fields on one resource do not clear each other's errors.

### 7.2 Toast service (MUST)

- Lazy-loaded, client-only, one instance per app (no module-scope state; SSR-safe).
- Kinds: **success, info, warning, error**. Optional **actions** (Retry, Undo, View). Auto-dismiss with pause on hover/focus; errors stay longer; a stack limit with collapse.
- Replaces `RequestErrors` and the fixed "Oops! There was a problem." copy with the request's own message.
- Used for outcomes that have no field: delete, publish, purge, warm, orphan scans, uploads finishing off-screen, network loss. Never for routine field saves.
- Public, so apps' own admin pages can use it (dons-hub `useFlash`, `ManageNotice`).

### 7.3 Inline status and alerts (MUST)

- **Inline status text** component (neutral/success/warning/danger) replacing ad hoc `text-orange`/`text-yellow`/`text-danger` and CK `Map.vue`'s `<span>{{ message }}</span>`. Single-line in the bar.
- **Alerts:** info, success, warning, danger (today only info and a danger box used as generic error).

### 7.4 Validation (SHOULD)

- API violations with a `propertyPath` are shown on the matching field when one is on screen; only unmatched violations go to a toast. Removes `useItemPage`'s hard-coded `plainPassword` toast.
- Client validation for URL/email/tel/number kinds before sending.

### 7.5 Modals and pages (MUST)

- Save buttons show `loading` while `isUpdating`.
- **No silent overwrite:** when the stored resource changes under unsaved modal edits (Mercure, another admin), the modal shows a conflict notice per changed field instead of replacing the local copy. (SHOULD if it needs a `useItemPage` redesign; confirm with Daniel.)
- Success in a modal that stays open shows a saved state; closing is enough otherwise.

### 7.6 Loading (MUST)

One loading language: a spinner, a progress bar (determinate for uploads), and the existing `ResourceLoadingIndicator` sweep for request bursts. "Loading..." text and label swaps go.

### 7.7 Performance (MUST)

- Typing must stay at 60 fps: state indicators must not re-render the whole tab or bar; no layout shift (indicators occupy reserved space in the row).
- Toasts and dialogs load on first use.
- No added network requests for feedback (state comes from the model and `ResourcesManager`).
- Fields in a 10-field scrolled row must not each attach document listeners while unfocused.

## 8. Accessibility (MUST)

- WCAG 2.2 AA contrast in the dark panel and the light auth theme; focus visible on every control.
- Full keyboard operation of every control, including the horizontal row (focus moving into an off-screen field scrolls it into view), the tab strip, comboboxes, multi-select chips, date pickers and the uploader (no drop-only path).
- Labels are programmatic even when placement is inline or visually hidden; hints are reachable by keyboard and announced (`aria-describedby`), not hover-only.
- Save state, errors and conflicts are announced through a polite live region; error toasts assertive; toasts never steal focus and stay while focused.
- State is never conveyed by colour alone (icon or text too), including presence colours.
- Respect `prefers-reduced-motion` (sweeps, toast entry, flag fades).
- Touch targets ≥ 24×24 px; the bar must work on a tablet.

## 9. Bundle and engineering constraints (MUST)

- All kit code is admin-only and lazy: it never appears in visitors' entry or modulepreloads (existing e2e guards pass). Admin UI is never prefetched.
- reka-ui is the only headless library at the end; Headless UI is removed from the module's `dependencies` once the last component moves.
- Watch the reka-ui chunking traps already recorded: a new reka-ui consumer can split a chunk into the entry's `__vite__mapDeps`; measure with `pnpm run test:e2e` and state any budget change.
- One copy of `@internationalized/date` (date-only and range pickers inherit the existing trap and warning).
- No `defineProps<…>()` assigned to a const in shipped components (TS2883 empty declarations, #349).
- Every component has Vitest coverage of its states and its `:model` wiring, using the real `computed`/nested-ref shapes; browser scenarios for the bar's fixed height, horizontal scroll and conflict control.
- Existing public names (`CwaUiFormInput`, `CwaUiFormToggle`, `CwaUiSelect`, `CwaUiFormFile`, `CwaUiFormSearchResource`, `CwaUiDatePicker`, `CwaUiFormLabelWrapper`) keep working or get a documented replacement; we are in alpha, so breaking is allowed with a changelog line, but the 220 site tabs need a migration note.
- No narrative code comments; rationale lives in CLAUDE.md and the issue.

## 10. `defineCwaConfig`: component config next to the component

Daniel's direction: extend the agreed `defineCwaStyles` into `defineCwaConfig`, with styles as one part of it, so a component can declare there what it declares in `nuxt.config.ts` today.

**Requirements**

- **MUST** A component folder can declare its config in one place (e.g. `app/cwa/components/<Name>/<Name>.vue` macro or a `config.ts` beside it), read at build time into the generated `cwa-options.ts`, so nothing new loads at runtime for visitors.
- **MUST** It covers everything `cwa.resources.<Name>` covers today: `name`, `description`, `instantAdd`, `defaultData`, `managerTabs` order/names, `ui` variants, and **`styles`** (`{ multiple?, classes }`, the current `defineCwaStyles` content).
- **MUST** Layouts and pages can do the same (`app/cwa/layouts/<Name>.vue`, `app/cwa/pages/<Name>.vue`), covering `name`, `description` and `classes`/styles, which removes the template's placeholder `classes` copied untouched into sites (`'Blue Background'`, `'Big Text'`).
- **MUST** Precedence is defined and tested: `nuxt.config.ts` keeps working; when both set a key, one documented source wins (proposal: component config is the default, `nuxt.config.ts` overrides, so an app can still patch a layer's component). Conflicts warn at build time.
- **MUST** `builder:watch` regenerates on change, as `managerTabs`/`ui` scanning does today.
- **MUST** IRIs in `defaultData` are written prefix-free and resolved through the API path prefix (sites hard-code `/_api/page_data/...` today, the #266 trap).
- **SHOULD** Per-field declarations, so simple components need no tab file: field name, kind (text, number, toggle, select, multi-select, segmented, link, image+alt, date, date-range), label, hint, size, options (static, or from an endpoint), `nullable`, and which tab the field sits in. The kit renders such a tab as one `CwaUiManagerRow`. This is the fix for tab sprawl (smoking `ChartItem` 4 tabs → 1) and for option lists inlined in tab files (5980bc `variants`/`tones`, dons-hub `LINK_CARD_ICONS`, CK categories).
- **SHOULD** `pageData.<Name>.metaFields` gain the same field kinds (today only `input` and `select`), rendered with kit fields in `PageDataAdminModal`.
- **COULD** Descriptions as plain text or markdown rather than HTML strings.
- Typed: the config is fully typed against `CwaComponentNames`, and the field `name`s against the resource where types are known.
- Hand-written tab files stay fully supported; generated tabs and custom tabs can coexist in one component.

**Open questions for Daniel**

1. Where it lives: a compiler macro inside `<Name>.vue` (like `definePageMeta`) or a sibling `config.ts`? (A macro keeps one file; a sibling file is simpler to read at build time and needs no SFC parsing.)
2. Precedence when both `nuxt.config.ts` and `defineCwaConfig` set a key.
3. Is per-field declaration (generated tabs) in this release, or `defineCwaConfig` first with field declarations as a follow-up?
4. Should `siteConfig` defaults stay in `nuxt.config.ts` only (it is not per-component)? Proposal: yes.

## 11. Success criteria

**Measurable**

1. Every manager-bar tab in the module, the template and the playground renders at the same fixed bar height; a browser test switches through every tab of a multi-tab component and asserts the bar's height and the page's scroll position do not change, at 1280 px and 768 px wide.
2. A row wider than the bar scrolls horizontally and never wraps (browser test with 10 fields).
3. One implementation per control type: zero `Modal*`/`FilterSelect`/`PageTypeSelect`/`CwaUiFormSelect` duplicates remain; zero Headless UI imports in `src/`.
4. Every kit control accepts `:model` and shows presence, conflict and save state through it (Vitest per control).
5. No held save without a visible conflict control (test: conflict raised on a `:model` select, the control is in the DOM).
6. A failed field save shows an error on that field with Retry and keeps the value; a successful one shows saved, with no toast.
7. Toasts cover success/info/warning/error with actions; `RequestErrors` is gone.
8. Visitor bundle guards pass; any budget change is stated with what it buys.
9. The template's tabs and one migrated real site (proposal: CK, the largest) need no Nuxt UI, no unprefixed classes and no hand-written link/upload state logic in admin tabs; the link tab drops from ~30 lines of logic to one component.
10. A component with only simple fields can be fully configured through `defineCwaConfig` (if per-field declarations are agreed) with no tab file.
11. Keyboard-only and screen-reader walk-through of: select a component, edit a field in each control type, resolve a conflict, upload an image, dismiss a toast.

**Qualitative**

- An admin can tell, without looking at the page, what a field holds, whether it saved, and who else is editing it.
- A site developer can build a tab correctly (single row, co-editing, feedback) without reading CLAUDE.md.

## 12. Suggested sequencing

1. Tokens, field shell, `CwaUiManagerRow`, fixed bar height, scrolling tab strip, `DynamicPage` rewrite.
2. Port Input, Toggle, Select, Button, SearchResource onto reka-ui with `:model`; per-field save state and conflict.
3. Toast service, inline status, alerts.
4. New controls: number, segmented, multi-select, link input, uploader, date-only.
5. Modals, pages and lists onto the kit; remove `Modal*`.
6. `defineCwaConfig` (styles + resource config), then per-field declarations.
7. In-page plain-text editor, link popover, image+alt, multi-slot uploader, date range.

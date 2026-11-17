# UI kit round 5 backlog (agreed with Daniel, 2026-11-17)

Starts after round 4 has been reviewed and published to the shared link.

## 1. WCAG 2.2 AA pass
- Target WCAG 2.2 AA (not AAA). README states it.
- 2.5.8 target size: at least 24×24 px hit area for the chip ×, ⓘ, error/conflict glyph buttons and other small controls, with the visible size unchanged.
- 2.4.11 focus not obscured: page focus is never hidden behind the fixed bottom bar, toasts or presence flags (`scroll-padding-bottom` = bar height; toasts avoid the focused element).
- 2.5.7 dragging: every drag has a single-pointer alternative (the Order tab's number and buttons today).
- 3.3.8 accessible sign-in: paste allowed, password managers work, correct `autocomplete` on the auth pages (#386).
- 3.3.7 redundant entry and 3.2.6 consistent help: check the create flows and the ⓘ placement.
- 1.4.1 colour alone: the Static/Dynamic row dot gets a text alternative or a shape difference.
- 1.4.3 / 1.4.11 contrast: text 4.5:1; focus rings, glyphs and state tints 3:1; darken the borderless field fill so fields stand out from the page.
- 1.4.13 popovers: dismissible with Escape, hoverable, persistent.
- 4.1.3 status messages: live regions for saving, saved and errors, and for search result counts.
- Keyboard everywhere (including scrolling the bar row), focus trapped in modals, 1.4.10 reflow at 320 px (only the bar row scrolls sideways).
- Proposal: an accessibility checklist per component; axe-core in Vitest and the browser tests plus keyboard tests; a manual VoiceOver/NVDA check before each kit PR merges.

## 2. Routes tab and tree view
- Redesign the page modal's Routes tab with the kit. Today: `RoutesTab`, `RoutesTabView`, `RoutesTabManage`, `RoutesTabAddRedirect`, `RoutesTabForwardTo`, `RouteRedirectsTree`, `RouteListRow` in `src/runtime/templates/components/core/admin/`.
- Route view: path, Live / Scheduled / Not live, parent-gating warning, parent-has-no-route note.
- Manage route: prefix select (root or the parent's prefix) plus suffix; the **SEO recommendation** (title slug under the parent's prefix) shown inline under the path field ("Recommended: /kitchens/shaker-kitchen · Use this"), gone once the path matches; the go-live control.
- Add redirect, Forward to, child routes.
- A kit **tree** component for the redirect chain (`redirectedFrom`) and child routes: indented rows with connector lines, expand/collapse, ARIA tree keyboard pattern, row actions with proper hit areas. Reused by the routes list page.
- Phone layouts for the tree and the manage screen.
- **Decision:** route actions (Apply recommendation, Add redirect, Forward to, Delete) stay **immediate**, each with its own confirm and its own saving state on the tab. The modal's Save covers only the page's fields.

## 3. Search that queries the API
- Debounce 250 ms after the last keystroke. Each new search cancels the previous request or ignores a late answer (request-id guard, as admin lists do, #328). Closing the menu cancels the request in flight. Static option lists filter in the browser; only resource searches hit the API.
- States:
  - initial (the first page or recent items, or "Type to search pages");
  - first search (skeleton rows);
  - searching (previous results kept, dimmed, small spinner);
  - slow, after about 3 s ("Still searching…");
  - many results ("Showing 20 of 143. Keep typing to narrow it down", optional "Show more"; no infinite scroll);
  - no matches (optional "Create '…'");
  - offline and server error, with distinct copy, Retry, and the previous results kept;
  - the selected value not in the results (label fetched separately, as `SearchResource` does today).
- Accessibility: announce "Searching", the result count and "No matches"; focus stays in the input; arrow keys move through results without losing the typed text.
- Phone search sheet: the same states, and it stays clear of the on-screen keyboard.

## 4. Page status in lists comes from routes
- Pages are not publishable, so "Draft" is the wrong word for a page. The list's status column is derived from the page's route (`resources/route-publication.ts`, badges show the effective state):
  - **Live**
  - **Scheduled · <date>**
  - **Not live** (the route exists but isn't live)
  - **Held back by parent** (a parent route's later go-live gates it, #378)
  - **No route** (private, unless a routed child page makes it reachable, bundle #225)
- Dynamic pages (templates) show what uses them ("Template · 14 articles") instead of a route status.
- Draft/Live stays for components, which are publishable.

## 5. Manager tab authoring: one root, laid out for you
- **Decision:** a manager tab's single root is `CwaUiManagerTab`, which *is* the one-row layout; fields are its direct children and lay themselves out for the bar (inline label, bar control size, status in the end-icon place, errors as a popover). Keeps Vue's single-root rule, so attributes the bar passes (today `class="cwa:w-full"` in `ResourceManager.vue`) still land. Replaces the v3 idea of `ResourceManager.vue` wrapping every tab invisibly.
- A dev-mode warning names any tab whose root is not `CwaUiManagerTab`.
- Kit inputs take `field="…"` to build their model from the tab's resource (`:model` stays for page data, custom debounce and other unusual cases). Closes open question 4.
- Show it in the spec with the NavigationLink example:
  ```vue
  <CwaUiManagerTab>
    <CwaUiInput field="label" label="Label" />
    <CwaUiLinkInput :fields="['route', 'rawPath']" label="Link" />
    <CwaUiToggle field="openInNewTab" label="Open in a new tab" />
  </CwaUiManagerTab>
  ```

- **Announcements (Daniel, during round 5):** so fast typing never produces a stream of speech:
  - One polite live region per surface (bar, modal, page), never one per field; toasts use the same region.
  - Nothing is announced while a field is pending or debouncing.
  - "Saving…" is announced only when a save takes longer than about 1 s; otherwise only the outcome.
  - Outcomes within about 1 s are merged into one message ("3 fields saved"), and the newest message replaces one still waiting rather than queueing.
  - Errors are announced once, politely, never `assertive`; the glyph, `aria-invalid` and `aria-describedby` carry them after that. A failed save the user isn't focused on names the field.
  - Search announces the result count after it settles, never per keystroke.
  - Done in v5: spec §11.2; the mockup's bar and page each have one announcer that merges outcomes and stays silent while pending.

## 6. List row actions: Open vs View on site
- The v4 mockup's row menu (Open, View on site, Delete) was invented without a defined difference. Decide and name them: the row click opens the page's settings modal, so the menu's "Open" is redundant. Proposed: "Edit settings" (modal, also the row click) and "Go to page" (navigates to the page in the site with the admin; a page without a route uses the internal resource link, `getInternalResourceLink`; a template page previews through the same link). Awaiting Daniel.

## 7. Open questions list (§13 / artifact section 9)
- Remove as settled: Q1 page data fields (#455, defineCwaPageData), Q3 field fill contrast (darken the fill in the WCAG pass, §1 above), Q4 `field="…"` (yes, with `CwaUiManagerTab`, §5 above).
- Still open: Q2 palette, Q5 model names, Q6 bottom-sheet menus on phones (recommend yes), plus §6 above (Open vs View on site).

## 8. Daniel's round 4 review (2026-11-17)
- Create buttons: a plus icon plus the noun ("+ Page", "+ Article") instead of the word "Create". Accessible name "Create page" (WCAG 2.5.3 label in name holds: the name contains the visible "Page"). Update §8.2's "names what it creates" rule.
- The new component's main action: "+ Draft" when publishable (accessible name "Add draft"), "+ Add" otherwise (match today's module: `NewResourceCta.vue`).
- Phone bar: no gap between the status and Publish; the status shows its glyph only (the word goes, giving tabs more room). The glyph keeps a screen-reader name ("Draft", "Saving", "1 not saved") and distinct shapes per state, so it is never colour alone (1.4.1).
- Desktop bar: the space to the right of the split button equals the space above and below it.
- Read-only values in a row of fields: centre them on the same line as the neighbouring field's value text (they currently sit top-aligned). Check every mixed row at bar, modal and touch sizes.
- Settled: Q2 palette approved; Q5 model names approved; Q6 bottom-sheet menus on phones, yes.
- §6 Open vs View on site: use the proposed "Edit settings" / "Go to page" unless Daniel says otherwise.

- **The split button's trigger is ⋮** (Daniel, during round 5): today's `CwaUiFormButton` (`ui/form/Button.vue`) draws three vertical dots, "More actions", and shows only the dots when the button has no label; `CurrentResourceCta.vue` gives no label for a live component or a selected group. So: a solid vertical-dots glyph in the same square button (same hit area, hover, keyboard and menu); a **dots-only** state, flush right like Publish, for a selected live component (Add before/after, Clone, Move) and a selected group (Add to start, Add to end); a new component shows "+ Draft" or "+ Add" with ⋮ beside it; the phone bar stays flush right with no gap before the status. Done in v5 (§5.1, §7; shots `v5-cta-dots-*`).

## 9. Section headings in modals and admin pages
- Clearly distinct from labels: larger and heavier, in `fg`; more space above than below; a 1px `line` rule above each section after the first. Calm, no all-caps.
- Real headings in order (`h2` title, `h3` sections), so title, section heading and label are three levels.
- Record the type scale in the spec; shots `v5-modal-sections-*`.
- Done in v5: title 1.375rem/650, section 1.125rem/650 `fg`, label 0.875rem/500; 2rem + rule + 2rem between sections, 1rem heading to field (§2.3, §2.4, §8.1).

## 10. Toast styling: three options
- A, Frosted: `surface-menu` at ~85% with `backdrop-filter: blur(16px) saturate(1.5)`; tone only in the glyph and a 3px start edge; solid fallback without backdrop-filter or under `prefers-reduced-transparency`.
- B, Tinted frosted: the same blur, the surface mixed ~12% toward the tone (`color-mix`).
- C, Solid tone: tone background, white text at 4.5:1, darkening any tone that fails.
- Each with success, info, warning, error and an error with actions, over a busy page (photo + text) and a plain page, light and dark. Measure worst-case text contrast over the photo's lightest and darkest areas. Behaviour unchanged. Recommend one; Daniel picks.
- The toast region has no background, padding, shadow or blur and `pointer-events: none` (each toast `auto`), in all three options; check over the photo that the region is invisible.
- Done in v5 (§10, §10.1; shots `v5-toast-options-*`, `v5-toast-region-*`). Recommendation A.
- **Decision (Daniel): option B, tinted frosted**, for the live toasts and the spec (§10.1); the mockup keeps the comparison labelled "B chosen". Worst-case text over the busy photo 6.73:1 (glyphs 3.02:1).
- Correction (Daniel, during round 5): toasts never change position (the v5 draft moved the stack to the bottom when it covered focus, which read as random). 2.4.11 AA fails only when the focused element is entirely hidden, so when the stack entirely covers it the stack turns see-through in place (about 15% opacity, `pointer-events: none`) while focus stays there; partly covered is left alone; 120 ms fade, instant under reduced motion.

## 11. Kit reference page (spec only)
- `playground/app/pages/kit.vue` at `/kit`: the real components with fake models fixed in every state, at bar, modal and touch sizes, menus open, a light/dark switch, a reduced-motion switch, the token list.
- Not published (the package ships only `dist` and `bin`); designers run `pnpm run dev:http`; no CI deploy.
- Each kit PR adds its section. The browser tests open `/kit` and run axe plus this round's measurements (no clipping, centring, fixed outer widths, the Publish gap).
- Phase 1 in §12, with the tokens and bar frame. Done in v5 (§12).

## 12. ⓘ never pushes content down
- Every ⓘ on every surface opens a popover anchored to the icon: Escape or a click outside closes it, it stays open while hovered, it never shifts the layout. Convert any other toggle-revealed help or "why disabled" text too. Errors under a modal field stay inline.
- Measure 0px layout change; shots `v5-info-popover-*`; update the spec's info and errors sections.
- Done in v5 (§4.5); measured 0px.

## 13. The modal conflict
- First version (one tinted block wrapping field and notice) was corrected by Daniel: **the field keeps its normal, editable look** (only its conflict tint); the notice is a separate block directly below with a small gap, linked with `aria-describedby`.
- The notice: a 3px warning start edge; a heading line with the solid glyph, the peer's avatar and "Mia changed this while you were editing."; both values as quoted read-only text labelled "Mia's" / "Yours" (no field look), a two-line clamp with Show all, the difference highlighted; **Use Mia's** and **Keep mine**, right-aligned, wrapping onto their own row when there's no room and never overflowing or clipping (checked at 1280, 390 and 320, with "Use Alexandra's"; `scrollWidth ≤ clientWidth` on each button and line).
- A modal alert: "1 field changed by Mia while you were editing. Choose which version to keep before saving.", linking to the field and badging its tab; Save says why it is blocked. `role="group"` labelled by the heading; the alert announced once.
- The bar's conflict popover shows the values as read-only text the same way.
- Shots `v5-conflict-*` at 1280 and 390, light and dark, short and long values. Done in v5 (§4.4, §8.2).

## After round 5: review panel (agreed 2026-11-17)
- Once round 5 is verified and published, run a review workflow on the v5 mockup and spec: developers (DX: CwaUiManagerTab, field="…", buildability), end users (conflicts, search states, Routes tab, confirms), UI designer (headings, toasts, spacing, field contrast), manager (scope, build order). Verify findings, then send Daniel one combined summary before he adds his views.

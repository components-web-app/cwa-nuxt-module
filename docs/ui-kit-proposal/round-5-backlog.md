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

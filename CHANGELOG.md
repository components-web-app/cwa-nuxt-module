# Changelog

Changes to `@cwa/nuxt`, newest first. Add a line under **Unreleased** with every change that affects the published package, linking the PR or commit. When tagging, rename **Unreleased** to the version: the release job publishes that section as the GitHub release notes, and refuses to publish without it.

## [Unreleased]

- `useCwaFile`, `withFile` and `useCwaFileField` expose `srcset`: each sized variant of the field (original and imagine filters), ascending by width with the endpoint's `?published=` query, for a responsive `<img>` ([#377](https://github.com/components-web-app/cwa-nuxt-module/issues/377), [797a8ff1](https://github.com/components-web-app/cwa-nuxt-module/commit/797a8ff1))
- A component added with `instantAdd` is selected even while text in the previously selected component is still highlighted; a user click during a text selection is still ignored ([#379](https://github.com/components-web-app/cwa-nuxt-module/issues/379), [c5031fa4](https://github.com/components-web-app/cwa-nuxt-module/commit/c5031fa4))
- A route whose parent's go-live date has already passed no longer says "A parent route holds this page back" in the Routes tab ([#378](https://github.com/components-web-app/cwa-nuxt-module/issues/378), [7e1e434f](https://github.com/components-web-app/cwa-nuxt-module/commit/7e1e434f))
- Clicks inside the stranded component groups modal no longer reach the page behind it, which hid the manager and left draft view ([#380](https://github.com/components-web-app/cwa-nuxt-module/issues/380), [eb9940b1](https://github.com/components-web-app/cwa-nuxt-module/commit/eb9940b1))

## [2.0.0-alpha.9] - 2026-10-10

- Move up / Move down move a component one place even when its component group is on screen more than once: the reorder queue is held once per group instead of per mounted group, so each move is applied and sent once ([#374](https://github.com/components-web-app/cwa-nuxt-module/issues/374), [d2aa2579](https://github.com/components-web-app/cwa-nuxt-module/commit/d2aa2579))
- The orphaned files page lists **Invalid files**: files in use that break their upload field's current rules, each with a link to its resource, the field, path, adapter and every violation. They are report-only and never deleted, and the settings notice counts them. Needs api-components-bundle 2.0.0-alpha.11 or later ([#376](https://github.com/components-web-app/cwa-nuxt-module/issues/376), [09450e77](https://github.com/components-web-app/cwa-nuxt-module/commit/09450e77))
- A failed background re-fetch (after a Mercure reconnect or an update message) no longer turns on-screen components into "Error loading resource … Unknown error" notices: a loaded resource keeps its last data unless the API answers 4xx ([#375](https://github.com/components-web-app/cwa-nuxt-module/issues/375), [d998476a](https://github.com/components-web-app/cwa-nuxt-module/commit/d998476a))
- The manager's Info tab names the version a delete removes: **Delete Draft** for a draft and **Delete Live** for the live version of a publishable component; other resources still say **Delete** ([#371](https://github.com/components-web-app/cwa-nuxt-module/issues/371), [fd3b4d97](https://github.com/components-web-app/cwa-nuxt-module/commit/fd3b4d97))

## [2.0.0-alpha.8] - 2026-10-08

- Pages and page data have a **Public without a route** toggle in their settings, so a routeless page loaded by a custom fetch IRI can be read by visitors; it has no effect while the page has a route, and a flagged page shows as public (green) like a routed one. Needs api-components-bundle 2.0.0-alpha.9 or later ([#369](https://github.com/components-web-app/cwa-nuxt-module/issues/369), [5a919456](https://github.com/components-web-app/cwa-nuxt-module/commit/5a919456))

## [2.0.0-alpha.7] - 2026-10-06

- Visitors no longer see the previous page's dynamic component after client navigation between page-data pages, get live page-data component changes, and keep a dynamic position when its component is deleted: a dynamic position is recognised by `_metadata.isDynamicPosition`, since `pageDataProperty` is only sent to admins ([#368](https://github.com/components-web-app/cwa-nuxt-module/issues/368), [60c9635c](https://github.com/components-web-app/cwa-nuxt-module/commit/60c9635c))

## [2.0.0-alpha.6] - 2026-10-06

- **Breaking:** the minimum Nuxt version is 4.6.0, the first release that keeps layer pages reached through a symlink out of prefetch itself, so the module's workaround for it is removed ([#361](https://github.com/components-web-app/cwa-nuxt-module/issues/361), [6bb0743a](https://github.com/components-web-app/cwa-nuxt-module/commit/6bb0743a))
- **Security:** requires `vue` ^3.5.43, which fixes GHSA-g2v6-rqmx-r4w6 in `@vue/server-renderer` ([675cf507](https://github.com/components-web-app/cwa-nuxt-module/commit/675cf507))
- In development with Vue 3.5.42 or later, selecting a newly added component whose element renders after it mounts outlines that component, not the next one in the group ([532ebbed](https://github.com/components-web-app/cwa-nuxt-module/commit/532ebbed))
- On Nuxt 4.6, a page that throws while rendering a route the API serves is no longer sent as a cacheable 500: an error render is recognised by Nuxt's `ssrContext.error`, which also covers Nuxt 5's inline error rendering ([#340](https://github.com/components-web-app/cwa-nuxt-module/issues/340), [11f72946](https://github.com/components-web-app/cwa-nuxt-module/commit/11f72946))

## [2.0.0-alpha.5] - 2026-10-05

- A live page-data update that swaps a dynamic component now shows on other open pages straight away, instead of after the next navigation ([3938a1f3](https://github.com/components-web-app/cwa-nuxt-module/commit/3938a1f3))
- On a nested URL, adding a component to a dynamic position on a shallower page-data page writes it to that page's page data, not the routed child's, and its tab lists that page's properties ([bf37fd73](https://github.com/components-web-app/cwa-nuxt-module/commit/bf37fd73))
- A template page shared at two depths now renders each depth's own dynamic components; the console warning says what is left: a shallower depth shows a change to which component its page data holds after the next navigation ([05f4611e](https://github.com/components-web-app/cwa-nuxt-module/commit/05f4611e))
- Navigating between page-data pages no longer shows the previous page's dynamic component under the new title and then a blank body: a dynamic position renders the component the displayed page's manifest resolved for it until it is re-fetched for that path ([#368](https://github.com/components-web-app/cwa-nuxt-module/issues/368), [1e76b367](https://github.com/components-web-app/cwa-nuxt-module/commit/1e76b367))
- The build warns, naming the file and the reason, when a `<CwaComponentGroup>` (a bound reference at an unrecognised location, a `v-bind` object) or an unreadable file switches stranded component group warnings off for the whole site ([#367](https://github.com/components-web-app/cwa-nuxt-module/issues/367), [ceee52b2](https://github.com/components-web-app/cwa-nuxt-module/commit/ceee52b2))

## [2.0.0-alpha.4] - 2026-10-04

- **Security:** `?cwa_force=` with any value other than `true` no longer sends the server render into an endless redirect that pinned an SSR process; the parameter is removed whatever its value ([#366](https://github.com/components-web-app/cwa-nuxt-module/issues/366), [038e1364](https://github.com/components-web-app/cwa-nuxt-module/commit/038e1364))
- **Breaking:** live updates subscribe with the Mercure 1.0 protocol (`match=*`, and `last_event_id` on reconnect), so the API's hub must be Mercure 1.0 (api-components-bundle 2.0.0-alpha.8); a 0.x hub rejects the subscription ([#364](https://github.com/components-web-app/cwa-nuxt-module/issues/364), [61dd29f8](https://github.com/components-web-app/cwa-nuxt-module/commit/61dd29f8))
- A `<CwaComponentGroup>` whose location is page data (or any type that cannot own a group) is no longer created or attached, and the admin console warns to pass the page IRI instead: such a group was invisible to visitors, listed as orphaned, and was PATCHed with an `undefined` property on every admin load ([#363](https://github.com/components-web-app/cwa-nuxt-module/issues/363), [0a02879d](https://github.com/components-web-app/cwa-nuxt-module/commit/0a02879d))
- A warning in the admin header counts stranded component groups: groups attached to the page, its layout or a component on it whose reference no `<CwaComponentGroup>` in the app's templates declares, such as the old group left behind when a reference is renamed or a legacy group located at a draft IRI; the declarations are read from the app's Vue files at build time. Its modal lists their components and merges each one to the end of a shown group or deletes it ([#360](https://github.com/components-web-app/cwa-nuxt-module/issues/360), [94481372](https://github.com/components-web-app/cwa-nuxt-module/commit/94481372), [fee09284](https://github.com/components-web-app/cwa-nuxt-module/commit/fee09284))
- `/_cwa/orphaned` also reports stored files: orphaned files nothing references, which can be deleted after a confirmation, unknown files the API cannot prove it wrote, which are only listed, and missing files, whose resource can be viewed; site settings scans files separately and counts both reports in its notice. Needs an api-components-bundle release containing #371 ([#362](https://github.com/components-web-app/cwa-nuxt-module/issues/362), [60a0d792](https://github.com/components-web-app/cwa-nuxt-module/commit/60a0d792), [0d76809e](https://github.com/components-web-app/cwa-nuxt-module/commit/0d76809e))
- The module declares its real minimum Nuxt version, `>=4.5.2`, so Nuxt warns an app on an older version instead of failing later ([e0ef82ed](https://github.com/components-web-app/cwa-nuxt-module/commit/e0ef82ed))
- View on a never-published orphaned component shows its content instead of a 404 ([#359](https://github.com/components-web-app/cwa-nuxt-module/issues/359), [292f7885](https://github.com/components-web-app/cwa-nuxt-module/commit/292f7885))
- Every `/_cwa` admin page is guarded by the `cwa-admin` middleware: a signed-in non-admin goes home, and a signed-out visitor goes to login from the browser, since with a cross-origin API the server cannot see the session ([dd4f8a6d](https://github.com/components-web-app/cwa-nuxt-module/commit/dd4f8a6d), [5be5b635](https://github.com/components-web-app/cwa-nuxt-module/commit/5be5b635))
## [2.0.0-alpha.3] - 2026-09-26

- Times from the API with more than millisecond precision, such as the orphan report's `generatedAt`, display correctly in every browser ([d1695b8d](https://github.com/components-web-app/cwa-nuxt-module/commit/d1695b8d))
- Orphaned resources are deleted in one request to `POST /_/orphaned_resources/delete`, which checks each one again first; the page re-reads the report afterwards and lists what was deleted, including cascaded items, and what was kept and why. Needs an api-components-bundle release containing #353 ([#358](https://github.com/components-web-app/cwa-nuxt-module/issues/358), [519ef3e5](https://github.com/components-web-app/cwa-nuxt-module/commit/519ef3e5))
- Review orphaned component groups, positions and components at `/_cwa/orphaned`, view and delete them, and scan from site settings, which says when a scan has found orphans ([api-components-bundle#190](https://github.com/components-web-app/api-components-bundle/issues/190), [dca1fb13](https://github.com/components-web-app/cwa-nuxt-module/commit/dca1fb13))
- An `undefined` or non-string `allowedComponents` entry warns and syncs nothing instead of throwing ([#354](https://github.com/components-web-app/cwa-nuxt-module/issues/354), [825cf38c](https://github.com/components-web-app/cwa-nuxt-module/commit/825cf38c))
- `useResendVerifyEmail` resets `success` when a new request starts, so a throttled or failed resend no longer shows alongside the earlier success; Back to Login after a password reset no longer sends a second reset request ([#355](https://github.com/components-web-app/cwa-nuxt-module/issues/355), [28901c51](https://github.com/components-web-app/cwa-nuxt-module/commit/28901c51))
- An email the API refuses to send (400) asks the visitor to contact the site administrator, and warns in the console about `user.email_links.allowed_origins` ([#356](https://github.com/components-web-app/cwa-nuxt-module/issues/356), [28901c51](https://github.com/components-web-app/cwa-nuxt-module/commit/28901c51))

## [2.0.0-alpha.2] - 2026-09-25

- Throttled email requests (429) say when another can be sent; the admin resend link counts down until then ([#353](https://github.com/components-web-app/cwa-nuxt-module/issues/353), [6e0fd593](https://github.com/components-web-app/cwa-nuxt-module/commit/6e0fd593))
- A failed email send (503) says the email couldn't be sent, rather than implying one is on its way ([#353](https://github.com/components-web-app/cwa-nuxt-module/issues/353), [5467165f](https://github.com/components-web-app/cwa-nuxt-module/commit/5467165f))
- Cancel a pending email change from the admin user page ([#353](https://github.com/components-web-app/cwa-nuxt-module/issues/353), [6e0fd593](https://github.com/components-web-app/cwa-nuxt-module/commit/6e0fd593), [a5b34725](https://github.com/components-web-app/cwa-nuxt-module/commit/a5b34725))
- `CwaUiDatePicker`, `CwaUiCalendar` and `CwaUiInputDate`, built on `reka-ui` and ported from Nuxt UI; the Publish tab and a route's go-live date use the picker ([#320](https://github.com/components-web-app/cwa-nuxt-module/issues/320), [b57599bf](https://github.com/components-web-app/cwa-nuxt-module/commit/b57599bf))
- Schedule a draft to publish at a future time from the Publish tab, or publish it now ([#320](https://github.com/components-web-app/cwa-nuxt-module/issues/320), [f909013a](https://github.com/components-web-app/cwa-nuxt-module/commit/f909013a), [d654ed96](https://github.com/components-web-app/cwa-nuxt-module/commit/d654ed96))
- Ship type declarations for `ResourceModalTabs.vue`, which were empty in 2.0.0-alpha.1 ([#349](https://github.com/components-web-app/cwa-nuxt-module/issues/349), [314c6708](https://github.com/components-web-app/cwa-nuxt-module/commit/314c6708))
- `allowedComponents` accepts component names, with an auto-imported `CwaComponentNames` constant and `CwaComponentName` type ([#352](https://github.com/components-web-app/cwa-nuxt-module/issues/352), [93ca8a0a](https://github.com/components-web-app/cwa-nuxt-module/commit/93ca8a0a))
- Sync `allowedComponents` to groups with no stored list; an empty list is sent as `null` ([#351](https://github.com/components-web-app/cwa-nuxt-module/issues/351), [a995f757](https://github.com/components-web-app/cwa-nuxt-module/commit/a995f757))

## [2.0.0-alpha.1] - 2026-09-24

- First tagged release of `@cwa/nuxt`; releases are now published from `v*` tags ([7c61b7c](https://github.com/components-web-app/cwa-nuxt-module/commit/7c61b7ce331ec4a0cb8e76951a5de2ff806ed07a))

[Unreleased]: https://github.com/components-web-app/cwa-nuxt-module/compare/v2.0.0-alpha.9...HEAD
[2.0.0-alpha.9]: https://github.com/components-web-app/cwa-nuxt-module/compare/v2.0.0-alpha.8...v2.0.0-alpha.9
[2.0.0-alpha.8]: https://github.com/components-web-app/cwa-nuxt-module/compare/v2.0.0-alpha.7...v2.0.0-alpha.8
[2.0.0-alpha.7]: https://github.com/components-web-app/cwa-nuxt-module/compare/v2.0.0-alpha.6...v2.0.0-alpha.7
[2.0.0-alpha.6]: https://github.com/components-web-app/cwa-nuxt-module/compare/v2.0.0-alpha.5...v2.0.0-alpha.6
[2.0.0-alpha.5]: https://github.com/components-web-app/cwa-nuxt-module/compare/v2.0.0-alpha.4...v2.0.0-alpha.5
[2.0.0-alpha.4]: https://github.com/components-web-app/cwa-nuxt-module/compare/v2.0.0-alpha.3...v2.0.0-alpha.4
[2.0.0-alpha.3]: https://github.com/components-web-app/cwa-nuxt-module/compare/v2.0.0-alpha.2...v2.0.0-alpha.3
[2.0.0-alpha.2]: https://github.com/components-web-app/cwa-nuxt-module/compare/v2.0.0-alpha.1...v2.0.0-alpha.2
[2.0.0-alpha.1]: https://github.com/components-web-app/cwa-nuxt-module/releases/tag/v2.0.0-alpha.1

# Changelog

Changes to `@cwa/nuxt`, newest first. Add a line under **Unreleased** with every change that affects the published package, linking the PR or commit. When tagging, rename **Unreleased** to the version: the release job publishes that section as the GitHub release notes, and refuses to publish without it.

## [Unreleased]

- View on a never-published orphaned component shows its content instead of a 404 ([#359](https://github.com/components-web-app/cwa-nuxt-module/issues/359), [292f7885](https://github.com/components-web-app/cwa-nuxt-module/commit/292f7885))
- Every `/_cwa` admin page is guarded by the `cwa-admin` middleware: a signed-in non-admin goes home, and a signed-out visitor goes to login from the browser, since with a cross-origin API the server cannot see the session ([5be5b635](https://github.com/components-web-app/cwa-nuxt-module/commit/5be5b635))
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

[Unreleased]: https://github.com/components-web-app/cwa-nuxt-module/compare/v2.0.0-alpha.3...HEAD
[2.0.0-alpha.3]: https://github.com/components-web-app/cwa-nuxt-module/compare/v2.0.0-alpha.2...v2.0.0-alpha.3
[2.0.0-alpha.2]: https://github.com/components-web-app/cwa-nuxt-module/compare/v2.0.0-alpha.1...v2.0.0-alpha.2
[2.0.0-alpha.1]: https://github.com/components-web-app/cwa-nuxt-module/releases/tag/v2.0.0-alpha.1

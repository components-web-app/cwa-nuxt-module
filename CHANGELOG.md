# Changelog

Changes to `@cwa/nuxt`, newest first. Add a line under **Unreleased** with every change that affects the published package, linking the PR or commit. When tagging, rename **Unreleased** to the version: the release job publishes that section as the GitHub release notes, and refuses to publish without it.

## [Unreleased]

- Throttled email requests (429) say when another can be sent; the admin resend link counts down until then ([#353](https://github.com/components-web-app/cwa-nuxt-module/issues/353), [6e0fd593](https://github.com/components-web-app/cwa-nuxt-module/commit/6e0fd593))
- A failed email send (503) says the email couldn't be sent, rather than implying one is on its way ([#353](https://github.com/components-web-app/cwa-nuxt-module/issues/353), [5467165f](https://github.com/components-web-app/cwa-nuxt-module/commit/5467165f))
- Cancel a pending email change from the admin user page ([#353](https://github.com/components-web-app/cwa-nuxt-module/issues/353), [6e0fd593](https://github.com/components-web-app/cwa-nuxt-module/commit/6e0fd593))
- `CwaUiDatePicker`, `CwaUiCalendar` and `CwaUiInputDate`, built on `reka-ui` and ported from Nuxt UI; the Publish tab and a route's go-live date use the picker ([#320](https://github.com/components-web-app/cwa-nuxt-module/issues/320), [b57599bf](https://github.com/components-web-app/cwa-nuxt-module/commit/b57599bf))
- Schedule a draft to publish at a future time from the Publish tab ([#320](https://github.com/components-web-app/cwa-nuxt-module/issues/320), [f909013a](https://github.com/components-web-app/cwa-nuxt-module/commit/f909013a))
- Ship type declarations for `ResourceModalTabs.vue`, which were empty in 2.0.0-alpha.1 ([#349](https://github.com/components-web-app/cwa-nuxt-module/issues/349), [314c6708](https://github.com/components-web-app/cwa-nuxt-module/commit/314c6708))
- `allowedComponents` accepts component names, with an auto-imported `CwaComponentNames` constant and `CwaComponentName` type ([#352](https://github.com/components-web-app/cwa-nuxt-module/issues/352), [93ca8a0a](https://github.com/components-web-app/cwa-nuxt-module/commit/93ca8a0a))
- Sync `allowedComponents` to groups with no stored list; an empty list is sent as `null` ([#351](https://github.com/components-web-app/cwa-nuxt-module/issues/351), [a995f757](https://github.com/components-web-app/cwa-nuxt-module/commit/a995f757))

## [2.0.0-alpha.1] - 2026-09-24

- First tagged release of `@cwa/nuxt`; releases are now published from `v*` tags ([7c61b7c](https://github.com/components-web-app/cwa-nuxt-module/commit/7c61b7ce331ec4a0cb8e76951a5de2ff806ed07a))

[Unreleased]: https://github.com/components-web-app/cwa-nuxt-module/compare/v2.0.0-alpha.1...HEAD
[2.0.0-alpha.1]: https://github.com/components-web-app/cwa-nuxt-module/releases/tag/v2.0.0-alpha.1

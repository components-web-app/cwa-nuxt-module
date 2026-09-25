# Changelog

Changes to `@cwa/nuxt`, newest first. Add a line under **Unreleased** with every change that affects the published package, linking the PR or commit. When tagging, rename **Unreleased** to the version: the release job publishes that section as the GitHub release notes, and refuses to publish without it.

## [Unreleased]

- Ship type declarations for `ResourceModalTabs.vue`, which were empty in 2.0.0-alpha.1 ([#349](https://github.com/components-web-app/cwa-nuxt-module/issues/349))
- `allowedComponents` accepts component names, with an auto-imported `CwaComponentNames` constant and `CwaComponentName` type ([#352](https://github.com/components-web-app/cwa-nuxt-module/issues/352))
- Sync `allowedComponents` to groups with no stored list; an empty list is sent as `null` ([#351](https://github.com/components-web-app/cwa-nuxt-module/issues/351))

## [2.0.0-alpha.1] - 2026-09-24

- First tagged release of `@cwa/nuxt`; releases are now published from `v*` tags ([7c61b7c](https://github.com/components-web-app/cwa-nuxt-module/commit/7c61b7ce331ec4a0cb8e76951a5de2ff806ed07a))

[Unreleased]: https://github.com/components-web-app/cwa-nuxt-module/compare/v2.0.0-alpha.1...HEAD
[2.0.0-alpha.1]: https://github.com/components-web-app/cwa-nuxt-module/releases/tag/v2.0.0-alpha.1

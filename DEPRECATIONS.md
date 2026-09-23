# Deprecations and temporary code

Things that exist only to support an older API, or to work around a bug someone
else will fix. Each entry says what to delete, and what has to be true first.

Add an entry whenever you leave code in place for one of those two reasons. An
entry with no precondition is not a deprecation, it is a todo.

---

## Remove when API Platform 4 support is dropped

### The per-field search parameters on admin lists

API Platform 4.4 deprecated `#[ApiFilter]`, `SearchFilter`, `OrderFilter` and
`AbstractFilter`, and 6.0 removes them. The bundle moved its own resources to
`QueryParameter` filters ([api-components-bundle#289](https://github.com/components-web-app/api-components-bundle/issues/289),
merged `ab76fc8b`), where search is a **single `search` parameter** ORed across
whichever fields each resource declares.

The admin's search box binds to `search` alone, but `ListContent` still adds the
old per-field names to the request so a list keeps working against an API that
has not migrated ([#328](https://github.com/components-web-app/cwa-nuxt-module/issues/328)).

**Delete:**

- `searchFields` from `ListContent.vue`, and the `buildRequestQuery` branch that
  expands `search` into those names
- `:search-fields` from the five list pages — `layouts.vue`, `pages.vue`,
  `routes.vue`, `users.vue`, `data/[type].vue`
- the per-property names in `SearchResource.vue`, keeping only `search`
- the transition notes in the CLAUDE.md section for #328

**Precondition:** every application entity an admin list shows declares a
`search` parameter. That is [components-web-app#89](https://github.com/components-web-app/components-web-app/issues/89)
for the template's `User` and `BlogArticleData`, and the same change in each
application for its own page data. Until then `users.vue` and `data/[type].vue`
depend on the old names.

### `OrSearchFilter` (bundle-side, recorded here because the module's behaviour depends on it)

The bundle keeps `Silverback\ApiComponentsBundle\Filter\OrSearchFilter` marked
`@deprecated`, purely so the template's `User` does not break before #89. It
goes when the applications have migrated. Nothing in the module references it —
the module only ever sent parameter names.

---

## Temporary workarounds pending an upstream fix

*(Nothing landed yet. The Nuxt prefetch workaround for
[#329](https://github.com/components-web-app/cwa-nuxt-module/issues/329) belongs
here once it is written, with the upstream issue number and the statement that it
is a no-op where paths are not symlinked.)*

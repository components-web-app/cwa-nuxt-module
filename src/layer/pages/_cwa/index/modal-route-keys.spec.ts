// @vitest-environment nuxt
import { describe, expect, test } from 'vitest'
import { useRouter } from '#app/composables/router'

describe('the create dialogs stay mounted when Create moves them to the new resource (#461)', () => {
  test.each([
    ['_cwa-pages-iri', {}],
    ['_cwa-data-type-iri', { type: 'blogArticleData' }],
    ['_cwa-layouts-iri', {}],
  ])('%s keeps one page key from …/add to the created resource, so the dialog, its focus and its route watches survive the push', (name, params) => {
    const router = useRouter()
    const adding = router.resolve({ name, params: { ...params, iri: 'add' } })
    const created = router.resolve({ name, params: { ...params, iri: '/_/pages/new' }, hash: '#routes' })

    expect(adding.meta.key).toBe(name)
    expect(created.meta.key).toBe(adding.meta.key)
  })
})

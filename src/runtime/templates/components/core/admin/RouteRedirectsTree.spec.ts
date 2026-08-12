// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import RouteRedirectsTree from './RouteRedirectsTree.vue'
import * as cwaComposable from '#cwa/composables/cwa'

const mockNavigateTo = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => mockNavigateTo)

function setup(opts: { isDataPage?: boolean, pageIri?: string, pageDataIri?: string } = {}) {
  const deleteResource = vi.fn()
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: {
      isDataPage: ref(!!opts.isDataPage),
      pageIri: ref(opts.pageIri ?? '/_/pages/p'),
      pageDataIri: ref(opts.pageDataIri ?? '/_/page_data/d'),
    },
    resourcesManager: { deleteResource },
  }))

  // route.path in the nuxt test env is '/', so a redirect on '/' is "the route we are viewing"
  const wrapper = mount(RouteRedirectsTree, {
    props: { redirects: [{ '@id': '/_/routes//', 'path': '/' }] as never },
    shallow: false,
    global: { stubs: { CwaUiIconBinIcon: { template: '<svg />' } } },
  })
  return { wrapper, deleteResource }
}

describe('RouteRedirectsTree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('deleting the redirect we are viewing navigates to the page via the _cwa-resource-page route', async () => {
    const { wrapper, deleteResource } = setup()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(deleteResource).toHaveBeenCalled()

    // the IRI is a param of the `_cwa-resource-page` route, never a path — navigating to the bare
    // IRI string matches the catch-all instead, where `cwaPage0` is unset, so the primary fetch
    // requests `/_/routes/<whole IRI>` and 404s
    const requestCompleteFn = deleteResource.mock.calls[0][0].requestCompleteFn
    requestCompleteFn()
    expect(mockNavigateTo).toHaveBeenCalledWith({ name: '_cwa-resource-page', params: { cwaPage0: '/_/pages/p' } })
  })

  test('uses the page data IRI on a data page', async () => {
    const { wrapper, deleteResource } = setup({ isDataPage: true })
    await wrapper.find('button').trigger('click')
    await flushPromises()
    deleteResource.mock.calls[0][0].requestCompleteFn()
    expect(mockNavigateTo).toHaveBeenCalledWith({ name: '_cwa-resource-page', params: { cwaPage0: '/_/page_data/d' } })
  })

  test('emits deleted for the removed redirect', async () => {
    const { wrapper } = setup()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('deleted')?.[0]?.[0]).toMatchObject({ '@id': '/_/routes//' })
  })
})

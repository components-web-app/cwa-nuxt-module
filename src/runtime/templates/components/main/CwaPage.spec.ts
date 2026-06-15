// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { KeepAlive, computed } from 'vue'
import CwaPage from './CwaPage.vue'
import * as cwaComposable from '#cwa/composables/cwa'

function mockCwa(pageIri: string | undefined) {
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: {
      pageIriAtDepth: vi.fn(() => computed(() => pageIri)),
    },
  }))
}

describe('CwaPage', () => {
  test('renders ResourceLoader with iri from pageIriAtDepth when iri is defined', () => {
    mockCwa('/_/pages/conf-uuid')
    const wrapper = mount(CwaPage, { shallow: true })
    const loader = wrapper.findComponent({ name: 'ResourceLoader' })
    expect(loader.props('iri')).toBe('/_/pages/conf-uuid')
    expect(loader.props('componentPrefix')).toBe('CwaPage')
  })

  test('renders nothing when pageIriAtDepth returns undefined', () => {
    mockCwa(undefined)
    const wrapper = mount(CwaPage, { shallow: true })
    expect(wrapper.findComponent({ name: 'ResourceLoader' }).exists()).toBe(false)
  })

  test('calls pageIriAtDepth with injected depth', () => {
    const pageIriAtDepth = vi.fn(() => computed(() => undefined))
    // @ts-expect-error
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
      resources: { pageIriAtDepth },
    }))
    mount(CwaPage, { shallow: true, global: { provide: { 'cwa-page-depth': 2 } } })
    expect(pageIriAtDepth).toHaveBeenCalledWith(2)
  })

  test('defaults to depth 0 when no depth is provided', () => {
    const pageIriAtDepth = vi.fn(() => computed(() => undefined))
    // @ts-expect-error
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
      resources: { pageIriAtDepth },
    }))
    mount(CwaPage, { shallow: true })
    expect(pageIriAtDepth).toHaveBeenCalledWith(0)
  })

  test('wraps ResourceLoader in KeepAlive', () => {
    mockCwa('/_/pages/conf-uuid')
    const wrapper = mount(CwaPage, { shallow: true })
    expect(wrapper.findComponent(KeepAlive).exists()).toBe(true)
  })

  test('sets pageIri as key on ResourceLoader so KeepAlive caches per IRI', () => {
    const iri = '/_/pages/conf-uuid'
    mockCwa(iri)
    // Explicit stub (non-shallow) gives a real component instance with $.vnode accessible
    const wrapper = mount(CwaPage, {
      global: {
        stubs: { ResourceLoader: { name: 'ResourceLoader', props: ['iri', 'componentPrefix'], template: '<div />' } },
      },
    })
    const loader = wrapper.findComponent({ name: 'ResourceLoader' })
    expect((loader.vm as any).$.vnode.key).toBe(iri)
  })

  test('provides depth + 1 to descendants', () => {
    mockCwa('/_/pages/conf-uuid')
    const wrapper = mount(CwaPage, {
      shallow: true,
      global: { provide: { 'cwa-page-depth': 1 } },
    })
    // @ts-expect-error accessing internal provides
    expect(wrapper.vm.$.provides['cwa-page-depth']).toBe(2)
  })
})

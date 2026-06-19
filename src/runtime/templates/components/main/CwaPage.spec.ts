// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { KeepAlive, computed } from 'vue'
import CwaPage from './CwaPage.vue'
import * as cwaComposable from '#cwa/composables/cwa'

function mockCwa(pageIri: string | undefined, opts: { pageDataIri?: string, depthCount?: number } = {}) {
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: {
      pageIriAtDepth: vi.fn(() => computed(() => pageIri)),
      pageDataIriAtDepth: vi.fn(() => computed(() => opts.pageDataIri)),
      depthCount: computed(() => opts.depthCount ?? 1),
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
      resources: { pageIriAtDepth, pageDataIriAtDepth: vi.fn(() => computed(() => undefined)), depthCount: computed(() => 1) },
    }))
    mount(CwaPage, { shallow: true, global: { provide: { 'cwa-page-depth': 2 } } })
    expect(pageIriAtDepth).toHaveBeenCalledWith(2)
  })

  test('defaults to depth 0 when no depth is provided', () => {
    const pageIriAtDepth = vi.fn(() => computed(() => undefined))
    // @ts-expect-error
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
      resources: { pageIriAtDepth, pageDataIriAtDepth: vi.fn(() => computed(() => undefined)), depthCount: computed(() => 1) },
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

  test('provides cwa-page-data-iri to descendants', () => {
    mockCwa('/_/pages/conf-uuid', { pageDataIri: '/page_data/event-uuid' })
    const wrapper = mount(CwaPage, { shallow: true })
    // @ts-expect-error accessing internal provides
    expect(wrapper.vm.$.provides['cwa-page-data-iri'].value).toBe('/page_data/event-uuid')
  })

  test('provides undefined cwa-page-data-iri for Page-backed depths', () => {
    mockCwa('/_/pages/conf-uuid')
    const wrapper = mount(CwaPage, { shallow: true })
    // @ts-expect-error accessing internal provides
    expect(wrapper.vm.$.provides['cwa-page-data-iri'].value).toBeUndefined()
  })

  describe('auto-fallback CwaPage', () => {
    test('does not render fallback when depthCount is 1 (flat page)', async () => {
      mockCwa('/_/pages/conf-uuid', { depthCount: 1 })
      const wrapper = mount(CwaPage, { shallow: true })
      await wrapper.vm.$nextTick()
      expect(wrapper.findAllComponents({ name: 'CwaPage' }).length).toBe(0)
    })

    test('renders fallback CwaPage after mount when depthCount > depth + 1 and no child registered', async () => {
      mockCwa('/_/pages/conf-uuid', { depthCount: 2 })
      const wrapper = mount(CwaPage, { shallow: true })
      await wrapper.vm.$nextTick()
      expect(wrapper.findComponent({ name: 'CwaPage' }).exists()).toBe(true)
    })

    test('hides fallback after a child registers at the expected depth', async () => {
      mockCwa('/_/pages/conf-uuid', { depthCount: 2 })
      const wrapper = mount(CwaPage, { shallow: true })
      await wrapper.vm.$nextTick()
      const register = (wrapper.vm.$.provides as any)['cwa-register-child-page'] as (d: number) => void
      register(1)
      await wrapper.vm.$nextTick()
      expect(wrapper.findAllComponents({ name: 'CwaPage' }).length).toBe(0)
    })

    test('non-fallback CwaPage registers itself with the parent callback', () => {
      mockCwa('/_/pages/conf-uuid')
      const register = vi.fn()
      mount(CwaPage, {
        shallow: true,
        global: { provide: { 'cwa-register-child-page': register, 'cwa-page-depth': 3 } },
      })
      expect(register).toHaveBeenCalledWith(3)
    })

    test('autoFallback=true prevents self-registration', () => {
      mockCwa('/_/pages/conf-uuid')
      const register = vi.fn()
      mount(CwaPage, {
        shallow: true,
        props: { autoFallback: true },
        global: { provide: { 'cwa-register-child-page': register } },
      })
      expect(register).not.toHaveBeenCalled()
    })
  })
})

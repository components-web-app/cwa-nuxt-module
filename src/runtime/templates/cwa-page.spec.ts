// @vitest-environment nuxt
import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import CwaPage from './cwa-page.vue'
import * as cwaComposable from '#cwa/composables/cwa'

let capturedHeadConfig: { title: () => string | null | undefined } | undefined
let capturedOgImageArgs: any[] = []

const emitRedraw = vi.fn()

// `var` + assignment inside the hoisted factory: the component watches these, so they have to be
// real refs, which vi.hoisted cannot create
// eslint-disable-next-line no-var
var mockElementSize: { width: Ref<number>, height: Ref<number> }
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  const { ref: vueRef } = await import('vue')
  mockElementSize = { width: vueRef(0), height: vueRef(0) }
  return {
    ...actual,
    useElementSize: () => mockElementSize,
  }
})

mockNuxtImport('useHead', () => (config: any) => {
  capturedHeadConfig = config
})
mockNuxtImport('useError', () => () => ref(null))
mockNuxtImport('useRoute', () => () => ({ path: '/', meta: {} }))
mockNuxtImport('defineOgImage', () => (...args: any[]) => {
  capturedOgImageArgs = args
})

function mockCwaWithDepths(
  depths: Array<{ dataTitle?: string, pageTitle?: string }>,
  fallbackTitleEnabled = false,
) {
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: {
      depthCount: { value: depths.length },
      pageDataAtDepth: (d: number) => ({
        value: depths[d]?.dataTitle ? { data: { title: depths[d].dataTitle } } : undefined,
      }),
      pageAtDepth: (d: number) => ({
        value: depths[d]?.pageTitle ? { data: { title: depths[d].pageTitle } } : undefined,
      }),
    },
    siteConfig: { config: { fallbackTitle: fallbackTitleEnabled } },
    admin: { emitRedraw },
  }))
  mount(CwaPage, { shallow: true })
}

describe('CWA page', () => {
  beforeEach(() => {
    emitRedraw.mockClear()
    mockElementSize.width.value = 0
    mockElementSize.height.value = 0
  })

  function createWrapper() {
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
      resources: {
        depthCount: { value: 1 },
        pageDataAtDepth: () => ({ value: undefined }),
        pageAtDepth: () => ({ value: undefined }),
      },
      siteConfig: {
        config: {
          fallbackTitle: true,
        },
      },
      admin: { emitRedraw },
    }))

    return mount(CwaPage, {
      shallow: true,
    })
  }

  test('should render CwaPage component', () => {
    const wrapper = createWrapper()
    expect(wrapper.findComponent({ name: 'CwaPage' }).exists()).toBe(true)
  })

  test('emits an admin redraw when the page element resizes', async () => {
    createWrapper()
    expect(emitRedraw).not.toHaveBeenCalled()

    // counts rather than exact calls: wrappers mounted by earlier tests are never unmounted and
    // share these mocked size refs, so each change fires one watcher per live instance
    mockElementSize.width.value = 800
    await nextTick()
    const afterWidth = emitRedraw.mock.calls.length
    expect(afterWidth).toBeGreaterThan(0)

    mockElementSize.height.value = 600
    await nextTick()
    expect(emitRedraw.mock.calls.length).toBeGreaterThan(afterWidth)
  })

  test('provides cwa-page-depth as 0', () => {
    const wrapper = createWrapper()
    // @ts-expect-error accessing internal provides
    expect(wrapper.vm.$.provides['cwa-page-depth']).toBe(0)
  })

  describe('snapshots', () => {
    test('renders CwaPage inside the page wrapper', () => {
      const wrapper = createWrapper()
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  describe('page title', () => {
    test('returns single title for flat page', () => {
      mockCwaWithDepths([{ dataTitle: 'Events' }])
      expect(capturedHeadConfig!.title()).toBe('Events')
    })

    test('concatenates leaf-first for nested page', () => {
      mockCwaWithDepths([{ dataTitle: 'Conference' }, { dataTitle: 'Programme' }])
      expect(capturedHeadConfig!.title()).toBe('Programme | Conference')
    })

    test('falls back to page.title when no pageData title at that depth', () => {
      mockCwaWithDepths([{ pageTitle: 'Conference' }, { pageTitle: 'Programme' }])
      expect(capturedHeadConfig!.title()).toBe('Programme | Conference')
    })

    test('skips depths with no title', () => {
      mockCwaWithDepths([{ dataTitle: 'Conference' }, {}])
      expect(capturedHeadConfig!.title()).toBe('Conference')
    })

    test('returns fallback value when no titles at any depth and fallback enabled', () => {
      mockCwaWithDepths([{}], true)
      // fallbackTitle: route.path = '/' in test env → last segment empty → null
      expect(capturedHeadConfig!.title()).toBeNull()
    })

    test('returns null when no titles and fallback disabled', () => {
      mockCwaWithDepths([{}], false)
      expect(capturedHeadConfig!.title()).toBeNull()
    })
  })

  describe('og image', () => {
    test('calls defineOgImage with CwaDefault component', () => {
      mockCwaWithDepths([{ dataTitle: 'Events' }])
      expect(capturedOgImageArgs[0]).toBe('CwaDefault')
    })

    test('passes pageTitle computed ref as title prop for flat page', () => {
      mockCwaWithDepths([{ dataTitle: 'Events' }])
      expect(capturedOgImageArgs[1].title.value).toBe('Events')
    })

    test('passes leaf-first concatenated title for nested page', () => {
      mockCwaWithDepths([{ dataTitle: 'Conference' }, { dataTitle: 'Programme' }])
      expect(capturedOgImageArgs[1].title.value).toBe('Programme | Conference')
    })

    test('passes undefined title when no depths have a title', () => {
      mockCwaWithDepths([{}])
      expect(capturedOgImageArgs[1].title.value).toBeUndefined()
    })
  })
})

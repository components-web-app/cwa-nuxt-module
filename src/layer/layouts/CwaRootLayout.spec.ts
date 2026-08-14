// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { computed, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import CwaRootLayout from './CwaRootLayout.vue'
import * as cwaComposable from '#cwa/composables/cwa'

const headOptions: Record<string, any>[] = []
const mockUseHead = vi.hoisted(() => vi.fn())
mockNuxtImport('useHead', () => mockUseHead)

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  const { ref: vueRef } = await import('vue')
  return {
    ...actual,
    useRouter: () => ({ currentRoute: vueRef({ meta: {} }) }),
  }
})

function setup(initialConcatTitle = false) {
  headOptions.length = 0
  mockUseHead.mockImplementation((options: Record<string, any>) => {
    headOptions.push(options)
  })

  // mirrors the real store: `getConfig` is a computed over reactive state that returns a FRESH
  // object each recompute (mergeConfig -> Object.assign({}, ...)), unwrapped to a plain object by
  // Pinia's reactive() wrapper on the setup store
  const state = reactive({ concatTitle: initialConcatTitle, siteName: 'Site' })
  const merged = computed(() => ({ ...state }))

  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    auth: { isAdmin: computed(() => false) },
    admin: reactive({ isEditing: false }),
    resources: {
      layout: computed(() => undefined),
      layoutIri: computed(() => undefined),
    },
    siteConfig: {
      get config() {
        return merged.value
      },
    },
  }))

  const wrapper = mount(CwaRootLayout, {
    shallow: true,
    global: {
      stubs: {
        ClientOnly: { template: '<div><slot /></div>' },
        teleport: true,
      },
    },
  })

  const titleTemplate = headOptions.find(o => o.titleTemplate)?.titleTemplate
  return { wrapper, state, titleTemplate }
}

describe('CwaRootLayout titleTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('uses the plain template when concatTitle is off', () => {
    const { titleTemplate } = setup(false)
    expect(titleTemplate).toBeTypeOf('function')
    expect(titleTemplate()).toBe('%s')
  })

  test('concatenates the site name when concatTitle is on', () => {
    const { titleTemplate } = setup(true)
    expect(titleTemplate()).toBe('%s %separator %siteName')
  })

  // the site config getter returns a NEW object on every recompute, so resolving it once at setup
  // leaves the callback reading a snapshot - changing the setting in the admin then has no effect
  // until a full page reload, and useHead never re-runs because nothing tracked the computed
  test('reacts to the site config changing after mount', async () => {
    const { state, titleTemplate } = setup(false)
    expect(titleTemplate()).toBe('%s')

    state.concatTitle = true
    expect(titleTemplate()).toBe('%s %separator %siteName')

    state.concatTitle = false
    expect(titleTemplate()).toBe('%s')
  })
})

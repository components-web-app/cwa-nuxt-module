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

type SetupOpts = {
  concatTitle?: boolean
  uiComponent?: string
  layoutIri?: string
  registeredComponents?: string[]
}

function setup(opts: SetupOpts = {}) {
  headOptions.length = 0
  mockUseHead.mockImplementation((options: Record<string, any>) => {
    headOptions.push(options)
  })

  const state = reactive({ concatTitle: opts.concatTitle ?? false, siteName: 'Site' })
  const merged = computed(() => ({ ...state }))

  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    auth: { isAdmin: computed(() => false) },
    admin: reactive({ isEditing: false }),
    resources: {
      layout: computed(() => opts.uiComponent ? { data: { uiComponent: opts.uiComponent } } : undefined),
      layoutIri: computed(() => opts.layoutIri),
    },
    siteConfig: {
      get config() {
        return merged.value
      },
    },
  } as unknown as ReturnType<typeof cwaComposable.useCwa>))

  const wrapper = mount(CwaRootLayout, {
    shallow: true,
    slots: { default: '<div class="page-content" />' },
    global: {
      components: Object.fromEntries((opts.registeredComponents ?? []).map(name => [name, { name, template: '<div><slot /></div>' }])),
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
    const { titleTemplate } = setup({ concatTitle: false })
    expect(titleTemplate).toBeTypeOf('function')
    expect(titleTemplate()).toBe('%s')
  })

  test('concatenates the site name when concatTitle is on', () => {
    const { titleTemplate } = setup({ concatTitle: true })
    expect(titleTemplate()).toBe('%s %separator %siteName')
  })

  test('reacts to the site config changing after mount', async () => {
    const { state, titleTemplate } = setup({ concatTitle: false })
    expect(titleTemplate()).toBe('%s')

    state.concatTitle = true
    expect(titleTemplate()).toBe('%s %separator %siteName')

    state.concatTitle = false
    expect(titleTemplate()).toBe('%s')
  })
})

describe('CwaRootLayout unresolvable uiComponent', () => {
  const UNRESOLVABLE = 'CwaLayoutDeletedByApp'
  const LAYOUT_IRI = '/_/layouts/abc-123'

  test('renders a warning naming the component and the layout resource', () => {
    const { wrapper } = setup({ uiComponent: UNRESOLVABLE, layoutIri: LAYOUT_IRI, registeredComponents: ['CwaLayoutPrimary'] })
    const alert = wrapper.findComponent({ name: 'CwaUiAlertWarning' })
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain(UNRESOLVABLE)
    expect(alert.text()).toContain(LAYOUT_IRI)
  })

  test('falls back to the default layout instead of emitting an unknown element', () => {
    const { wrapper } = setup({ uiComponent: UNRESOLVABLE, layoutIri: LAYOUT_IRI, registeredComponents: ['CwaLayoutPrimary'] })
    // the OPENING TAG specifically - the name legitimately appears in the warning text
    expect(wrapper.html().toLowerCase()).not.toContain(`<${UNRESOLVABLE.toLowerCase()}`)
    expect(wrapper.find('.page-content').exists()).toBe(true)
  })

  test('does not warn when the uiComponent resolves', () => {
    const { wrapper } = setup({ uiComponent: 'CwaLayoutPrimary', layoutIri: LAYOUT_IRI, registeredComponents: ['CwaLayoutPrimary'] })
    expect(wrapper.findComponent({ name: 'CwaUiAlertWarning' }).exists()).toBe(false)
    expect(wrapper.find('.page-content').exists()).toBe(true)
  })

  test('does not warn when there is no named layout at all', () => {
    const { wrapper } = setup({ registeredComponents: ['CwaLayoutPrimary'] })
    expect(wrapper.findComponent({ name: 'CwaUiAlertWarning' }).exists()).toBe(false)
    expect(wrapper.find('.page-content').exists()).toBe(true)
  })
})

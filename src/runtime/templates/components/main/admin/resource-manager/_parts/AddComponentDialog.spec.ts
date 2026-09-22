// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

vi.mock('consola')

vi.mock('#cwa/templates/components/main/admin/_common/useDynamicPositionSelectOptions', () => ({
  useDynamicPositionSelectOptions: () => ({
    getTypeOptions: vi.fn(async () => []),
    getPropertyOptions: vi.fn(async () => []),
  }),
}))

const cwaState = vi.hoisted(() => ({ cwa: null as any }))

const { useCwa } = vi.hoisted(() => ({
  useCwa: vi.fn(() => cwaState.cwa),
}))

mockNuxtImport('useCwa', () => useCwa)

const componentMetadata = {
  Title: {
    resourceName: 'Title',
    endpoint: '/component/titles',
    isPublishable: false,
    explicitAllowOnly: false,
  },
}

function makeCwa() {
  const addResourceEvent = ref<any>(undefined)
  return {
    getComponentMetadata: vi.fn(),
    resourcesConfig: { Title: { name: 'Title' } },
    resourcesManager: {
      addResourceEvent,
      clearAddResource: vi.fn(() => {
        addResourceEvent.value = undefined
      }),
    },
    resources: {
      newResource: ref(undefined),
      isDynamicPage: ref(false),
      getResource: vi.fn(() => ref(undefined)),
    },
    admin: {
      resourceStackManager: { isEditingLayout: ref(false) },
    },
  }
}

async function mountDialog() {
  const { default: AddComponentDialog } = await import('./AddComponentDialog.vue')
  return mount(AddComponentDialog, {
    global: {
      stubs: {
        DialogBox: { template: '<div class="dialog-stub"><slot /></div>' },
        Spinner: { template: '<div class="spinner-stub" />' },
        ModalSelect: true,
        CwaUiAlertWarning: { template: '<div class="alert-stub"><slot /></div>' },
      },
    },
  })
}

function openDialog() {
  cwaState.cwa.resourcesManager.addResourceEvent.value = { closest: { group: '/_/component_groups/g1' } }
}

function closeDialog() {
  cwaState.cwa.resourcesManager.addResourceEvent.value = undefined
}

describe('AddComponentDialog loading the available components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cwaState.cwa = makeCwa()
  })

  test('shows an error instead of the spinner when the components cannot be loaded', async () => {
    cwaState.cwa.getComponentMetadata.mockRejectedValueOnce(new Error('Failed to fetch'))
    const wrapper = await mountDialog()

    openDialog()
    await flushPromises()

    expect(wrapper.find('.spinner-stub').exists()).toBe(false)
    expect(wrapper.find('.alert-stub').text()).toBe('Could not load the available components')
  })

  test('loads the components when opened again after a failure', async () => {
    cwaState.cwa.getComponentMetadata
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce(componentMetadata)
    const wrapper = await mountDialog()

    openDialog()
    await flushPromises()
    closeDialog()
    await flushPromises()
    openDialog()
    await flushPromises()

    expect(wrapper.find('.alert-stub').exists()).toBe(false)
    expect(wrapper.find('.spinner-stub').exists()).toBe(false)
    expect(wrapper.find('button[aria-selected]').text()).toBe('Title')
  })

  test('shows the spinner again while a reopened dialog loads', async () => {
    cwaState.cwa.getComponentMetadata
      .mockResolvedValueOnce(componentMetadata)
      .mockReturnValueOnce(new Promise(() => {}))
    const wrapper = await mountDialog()

    openDialog()
    await flushPromises()
    closeDialog()
    await flushPromises()
    openDialog()
    await flushPromises()

    expect(wrapper.find('.spinner-stub').exists()).toBe(true)
  })
})

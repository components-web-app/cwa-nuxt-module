import { beforeEach, describe, expect, test, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import type { Ref } from 'vue'
import ResourceStackManager from './resource-stack-manager'

vi.mock('vuejs-confirm-dialog', () => ({ createConfirmDialog: vi.fn() }))
vi.mock('#cwa/templates/components/core/ConfirmDialog.vue', () => ({ default: {} }))
vi.mock('#cwa/templates/components/main/admin/resource-manager/ComponentFocus.vue', () => ({
  default: { name: 'ComponentFocus', render: () => null },
}))

const mockVueAppContainer = vi.hoisted(() => ({ value: null as null | HTMLElement }))
vi.mock('#app/nuxt', () => ({
  useNuxtApp: () => ({ vueApp: { _container: mockVueAppContainer.value } }),
}))

function createManager() {
  const adminStore = { useStore: () => ({ state: reactive({ isEditing: true }) }) }
  const resourcesStore = {
    useStore: () => ({
      state: reactive({}),
      findAllPublishableIris: (iri: string) => [iri],
      isIriPublishableEquivalent: () => true,
      findPublishedComponentIri: (iri: string) => `${iri}_published`,
      findDraftComponentIri: (iri: string) => iri,
    }),
  }
  const resources = {
    isDataPage: ref(false),
    isPageDataResource: () => ref(false),
  }
  return new ResourceStackManager(adminStore as any, resourcesStore as any, resources as any)
}

function selectResource(manager: ResourceStackManager, iri: string, domElements: Ref<HTMLElement[]>) {
  manager.addToStack({
    iri,
    domElements,
    childIris: ref([]),
    clickTarget: document.createElement('span'),
  } as any)
  manager.completeStack({ clickTarget: window }, false)
}

async function settle() {
  for (let i = 0; i < 12; i++) {
    await nextTick()
    await Promise.resolve()
  }
}

function newElements() {
  return ref([document.createElement('div')])
}

describe('Resource Stack Manager focus component', () => {
  beforeEach(() => {
    mockVueAppContainer.value?.remove()
    mockVueAppContainer.value = document.createElement('div')
    document.body.appendChild(mockVueAppContainer.value)
  })

  test('re-selecting the component already selected keeps the mounted focus component', async () => {
    const manager = createManager()
    const container = mockVueAppContainer.value!
    const domElements = newElements()

    selectResource(manager, '/component/1', domElements)
    manager.showManager.value = true
    await settle()

    const mounted = container.firstElementChild
    expect(mounted).not.toBeNull()

    selectResource(manager, '/component/1', domElements)
    await settle()

    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild).toBe(mounted)
  })

  test('selecting a different component never leaves the page without the focus component', async () => {
    const manager = createManager()
    const container = mockVueAppContainer.value!

    selectResource(manager, '/component/1', newElements())
    manager.showManager.value = true
    await settle()

    const mounted = container.firstElementChild
    expect(mounted).not.toBeNull()

    const childCounts: number[] = []
    selectResource(manager, '/component/2', newElements())
    childCounts.push(container.children.length)
    for (let i = 0; i < 12; i++) {
      await nextTick()
      await Promise.resolve()
      childCounts.push(container.children.length)
    }

    expect(childCounts).not.toContain(0)
    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild).not.toBe(mounted)
  })

  test('returning to the mounted component while another is still loading discards the one still loading', async () => {
    const manager = createManager()
    const container = mockVueAppContainer.value!
    const domElements = newElements()

    selectResource(manager, '/component/1', domElements)
    manager.showManager.value = true
    await settle()

    const mounted = container.firstElementChild
    expect(mounted).not.toBeNull()

    selectResource(manager, '/component/2', newElements())
    for (let i = 0; i < 4; i++) {
      await nextTick()
    }
    selectResource(manager, '/component/1', domElements)
    await settle()

    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild).toBe(mounted)
  })

  test('switching between the draft and published version of one element keeps the mounted focus component', async () => {
    const manager = createManager()
    const container = mockVueAppContainer.value!
    const domElements = newElements()

    selectResource(manager, '/component/1', domElements)
    manager.showManager.value = true
    await settle()

    const mounted = container.firstElementChild
    expect(mounted).not.toBeNull()

    manager.forcePublishedVersion.value = true
    await settle()
    manager.refreshFocusForIri('/component/1', domElements)
    await settle()

    expect(manager.currentIri.value).toBe('/component/1_published')
    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild).toBe(mounted)
  })
})

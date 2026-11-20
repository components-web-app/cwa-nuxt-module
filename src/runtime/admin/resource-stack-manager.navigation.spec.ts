import { afterEach, describe, expect, test, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import ResourceStackManager from './resource-stack-manager'

vi.mock('#app/nuxt', () => ({ useNuxtApp: () => ({ vueApp: { _container: null } }) }))
vi.mock('#cwa/templates/components/main/admin/resource-manager/ComponentFocus.vue', () => ({ default: { name: 'ComponentFocus', props: ['iri', 'domElements'], render: () => null } }))

function setup() {
  const displayPageIri = ref<string | undefined>('/_/pages/home')
  const manager = new ResourceStackManager(
    { useStore: () => ({ state: reactive({ isEditing: true }) }) } as any,
    { useStore: () => ({ state: reactive({}), isIriPublishableEquivalent: () => false, findDraftComponentIri: () => undefined, findPublishedComponentIri: () => undefined }) } as any,
    { displayPageIri } as any,
    {} as any,
  )
  const select = (elements: HTMLElement[]) => {
    const domElements = ref(elements)
    ;(manager as any).currentResourceStack.value = [
      { iri: '/component/c1', domElements, childIris: ref([]) },
      { iri: '/_/component_positions/home-1', domElements, childIris: ref([]) },
      { iri: '/_/component_groups/home', domElements, childIris: ref([]) },
    ]
    manager.showManager.value = true
  }
  return { manager, displayPageIri, select }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ResourceStackManager when the page on screen changes (#461)', () => {
  test('drops the selection whose elements left the document with the page, so a delete never acts on the page left behind', async () => {
    const { manager, displayPageIri, select } = setup()
    const element = document.body.appendChild(document.createElement('div'))
    select([element])
    expect(manager.currentIri.value).toBe('/component/c1')

    element.remove()
    displayPageIri.value = '/_/pages/form'
    await nextTick()
    await nextTick()

    expect(manager.resourceStack.value).toEqual([])
    expect(manager.showManager.value).toBe(false)
    expect(manager.getClosestStackItemByType('COMPONENT_POSITION' as any)).toBeUndefined()
  })

  test('keeps a selection still on screen, as a layout component is on every page', async () => {
    const { manager, displayPageIri, select } = setup()
    select([document.body.appendChild(document.createElement('header'))])

    displayPageIri.value = '/_/pages/form'
    await nextTick()
    await nextTick()

    expect(manager.currentIri.value).toBe('/component/c1')
    expect(manager.showManager.value).toBe(true)
  })
})

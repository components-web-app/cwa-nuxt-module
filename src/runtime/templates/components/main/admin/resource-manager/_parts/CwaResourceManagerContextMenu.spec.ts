// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, ref, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../../../../test/utils/axe'
import CwaResourceManagerContextMenu from './CwaResourceManagerContextMenu.vue'

const state = vi.hoisted(() => ({ cwa: null as any, route: null as any }))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: vi.fn(() => state.cwa),
}))

vi.mock('#app/composables/router', () => ({
  useRouter: vi.fn(() => ({ currentRoute: state.route })),
}))

enableAutoUnmount(afterEach)

const STACK = [
  { iri: '/component/html_contents/1', displayName: 'Rich text' },
  { iri: '/_/component_positions/1', displayName: 'Component position' },
  { iri: '/_/component_groups/main', displayName: 'Main content group' },
  { iri: '/_/pages/home', displayName: 'Page' },
  { iri: '/_/layouts/main', displayName: 'Layout' },
]

function makeCwa(stack = STACK, currentIri?: string, { confirms = true } = {}) {
  const contextStack = shallowRef(stack)
  const current = shallowRef(currentIri ? { iri: currentIri } : undefined)
  return {
    admin: {
      resourceStackManager: {
        contextStack: computed(() => contextStack.value),
        currentStackItem: computed(() => current.value),
        selectStackIndex: vi.fn(async (index: number) => {
          if (confirms) {
            current.value = contextStack.value[index]
            contextStack.value = []
          }
        }),
      },
    },
    resources: {
      displayPageIri: ref<string | undefined>('/_/pages/home'),
    },
  }
}

async function openMenu(cwa = makeCwa(), expectPanel = true) {
  state.cwa = cwa
  state.route = ref({ fullPath: '/' })
  const onUpdate = vi.fn()
  const wrapper = mount(CwaResourceManagerContextMenu, {
    props: { 'modelValue': true, 'point': { x: 10, y: 20, key: 1 }, 'onUpdate:modelValue': onUpdate },
    attachTo: document.body,
  })
  await flushPromises()
  expectPanel && await vi.waitFor(() => expect(document.querySelector('[data-testid="resource-stack"]')).not.toBeNull(), { timeout: 5000 })
  return { wrapper, onUpdate, cwa, panel: document.querySelector<HTMLElement>('[data-testid="resource-stack"]') }
}

function names(panel: HTMLElement) {
  return [...panel.querySelectorAll('[role="treeitem"]')].map(level => level.getAttribute('aria-label'))
}

describe('CwaResourceManagerContextMenu (#461)', () => {
  test('opens the resource stack with the components, positions and groups under the pointer, never the page or layout', async () => {
    const { panel } = await openMenu()

    expect(names(panel!)).toEqual(['Main content group', 'Component position', 'Rich text'])
    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('marks the level that is selected now', async () => {
    const { panel } = await openMenu(makeCwa(STACK, '/_/component_positions/1'))

    expect(panel!.querySelector('[aria-selected="true"]')!.getAttribute('aria-label')).toBe('Component position')
  })

  test('choosing a level selects its index in the context stack', async () => {
    const { panel, cwa } = await openMenu()

    panel!.querySelectorAll<HTMLElement>('[data-stack-name]')[1]!.click()
    await flushPromises()
    expect(cwa.admin.resourceStackManager.selectStackIndex).toHaveBeenCalledWith(1, true)
  })

  test('closing it closes the context menu', async () => {
    const { panel, onUpdate } = await openMenu()

    panel!.querySelectorAll<HTMLElement>('[data-stack-name]')[0]!.click()
    await flushPromises()
    expect(onUpdate).toHaveBeenCalledWith(false)
    expect(document.querySelector('[data-testid="resource-stack"]')).toBeNull()
  })

  test('choosing a level says "<name> selected" in its live region, which stays after the stack closes', async () => {
    const { panel, wrapper } = await openMenu()

    panel!.querySelector<HTMLElement>('[aria-label="Component position"] > [data-stack-name]')!.click()
    await vi.waitFor(() => expect(wrapper.get('[data-testid="resource-stack-announcer"]').text()).toBe('Component position selected'))
    expect(document.querySelector('[data-testid="resource-stack"]')).toBeNull()
  })

  test('a choice cancelled at the layout/page confirm closes it and announces nothing', async () => {
    const { panel, wrapper, onUpdate } = await openMenu(makeCwa(STACK, undefined, { confirms: false }))

    panel!.querySelector<HTMLElement>('[aria-label="Component position"] > [data-stack-name]')!.click()
    await flushPromises()
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(onUpdate).toHaveBeenCalledWith(false)
    expect(wrapper.get('[data-testid="resource-stack-announcer"]').text()).toBe('')
  })

  test('closes when another page is shown', async () => {
    const { cwa, onUpdate } = await openMenu()

    cwa.resources.displayPageIri.value = '/_/pages/about'
    await flushPromises()
    expect(document.querySelector('[data-testid="resource-stack"]')).toBeNull()
    expect(onUpdate).toHaveBeenCalledWith(false)
  })

  test('closes when the route changes', async () => {
    const { onUpdate } = await openMenu()

    state.route.value = { fullPath: '/_cwa/layouts' }
    await flushPromises()
    expect(document.querySelector('[data-testid="resource-stack"]')).toBeNull()
    expect(onUpdate).toHaveBeenCalledWith(false)
  })

  test('shows nothing when no component, position or group was under the pointer', async () => {
    const { panel } = await openMenu(makeCwa([{ iri: '/_/pages/home', displayName: 'Page' }]), false)

    expect(panel).toBeNull()
  })

  test('shows nothing while closed', async () => {
    state.cwa = makeCwa()
    state.route = ref({ fullPath: '/' })
    mount(CwaResourceManagerContextMenu, { props: { modelValue: false, point: { x: 10, y: 20, key: 1 } }, attachTo: document.body })
    await flushPromises()

    expect(document.querySelector('[data-testid="resource-stack"]')).toBeNull()
  })
})

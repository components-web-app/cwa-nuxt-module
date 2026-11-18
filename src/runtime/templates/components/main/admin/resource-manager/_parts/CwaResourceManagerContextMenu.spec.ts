// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../../../../test/utils/axe'
import CwaResourceManagerContextMenu from './CwaResourceManagerContextMenu.vue'

const state = vi.hoisted(() => ({ cwa: null as any }))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: vi.fn(() => state.cwa),
}))

enableAutoUnmount(afterEach)

const STACK = [
  { iri: '/component/html_contents/1', displayName: 'Rich text' },
  { iri: '/_/component_positions/1', displayName: 'Component position' },
  { iri: '/_/component_groups/main', displayName: 'Main content group' },
  { iri: '/_/pages/home', displayName: 'Page' },
  { iri: '/_/layouts/main', displayName: 'Layout' },
]

function makeCwa(stack = STACK, currentIri?: string) {
  const contextStack = shallowRef(stack)
  return {
    admin: {
      resourceStackManager: {
        contextStack: computed(() => contextStack.value),
        currentStackItem: computed(() => currentIri ? { iri: currentIri } : undefined),
        selectStackIndex: vi.fn(async () => undefined),
      },
    },
  }
}

async function openMenu(cwa = makeCwa(), expectPanel = true) {
  state.cwa = cwa
  const onUpdate = vi.fn()
  const wrapper = mount(CwaResourceManagerContextMenu, {
    props: { 'modelValue': true, 'point': { x: 10, y: 20, key: 1 }, 'onUpdate:modelValue': onUpdate },
    attachTo: document.body,
  })
  await flushPromises()
  expectPanel && await vi.waitFor(() => expect(document.querySelector('[data-testid="resource-stack"]')).not.toBeNull())
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

  test('shows nothing when no component, position or group was under the pointer', async () => {
    const { panel } = await openMenu(makeCwa([{ iri: '/_/pages/home', displayName: 'Page' }]), false)

    expect(panel).toBeNull()
  })

  test('shows nothing while closed', async () => {
    state.cwa = makeCwa()
    mount(CwaResourceManagerContextMenu, { props: { modelValue: false, point: { x: 10, y: 20, key: 1 } }, attachTo: document.body })
    await flushPromises()

    expect(document.querySelector('[data-testid="resource-stack"]')).toBeNull()
  })
})

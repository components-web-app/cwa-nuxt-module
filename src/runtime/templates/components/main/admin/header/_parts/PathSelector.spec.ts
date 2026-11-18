// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { computed, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../../../../test/utils/focus-ring'
import PathSelector from './PathSelector.vue'

const state = vi.hoisted(() => ({ cwa: null as any }))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: vi.fn(() => state.cwa),
}))

enableAutoUnmount(afterEach)

beforeAll(async () => {
  await import('#cwa/templates/components/ui/ResourceStack.vue')
})

const STACK = [
  { iri: '/component/html_contents/1', displayName: 'Rich text' },
  { iri: '/_/component_positions/1', displayName: 'Component position' },
  { iri: '/_/component_groups/main', displayName: 'Main content group' },
  { iri: '/_/pages/home', displayName: 'Page' },
]

function makeCwa(stack = STACK) {
  const resourceStack = shallowRef(stack)
  return {
    admin: {
      resourceStackManager: {
        resourceStack: computed(() => resourceStack.value),
        selectStackIndex: vi.fn(async () => undefined),
      },
    },
  }
}

async function mountSelector(cwa = makeCwa()) {
  state.cwa = cwa
  const wrapper = mount(PathSelector, { attachTo: document.body })
  await flushPromises()
  return { wrapper, cwa, selector: wrapper.get<HTMLButtonElement>('[data-testid="path-selector"]').element }
}

async function openStack(selector: HTMLButtonElement) {
  selector.click()
  await vi.waitFor(() => expect(document.querySelector('[data-testid="resource-stack"]')).not.toBeNull())
  return document.querySelector<HTMLElement>('[data-testid="resource-stack"]')!
}

describe('PathSelector (#461)', () => {
  test('names the selected resource and, with parents to choose, is a button that opens a tree', async () => {
    const { selector } = await mountSelector()

    expect(selector.textContent).toContain('Rich text')
    expect(selector.textContent).toContain('▾')
    expect(selector.getAttribute('aria-haspopup')).toBe('tree')
    expect(selector.getAttribute('aria-expanded')).toBe('false')
    expect(selector.getAttribute('aria-label')).toBe('Rich text, choose a parent')
    expect(drawsFocusRing(selector.className.split(/\s+/))).toBe(true)
    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('with no parents it has no ▾, does not open and is aria-disabled', async () => {
    const { selector } = await mountSelector(makeCwa([STACK[2]!, STACK[3]!]))

    expect(selector.textContent).not.toContain('▾')
    expect(selector.getAttribute('aria-disabled')).toBe('true')
    expect(selector.hasAttribute('aria-haspopup')).toBe(false)
    selector.click()
    await flushPromises()
    await flushPromises()
    expect(document.querySelector('[data-testid="resource-stack"]')).toBeNull()
    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('opens the stack of the selection without the page, the selection selected and its label hidden under it', async () => {
    const { selector } = await mountSelector()
    const panel = await openStack(selector)

    expect([...panel.querySelectorAll('[role="treeitem"]')].map(level => level.getAttribute('aria-label'))).toEqual(['Main content group', 'Component position', 'Rich text'])
    expect(panel.querySelector('[aria-selected="true"]')!.getAttribute('aria-label')).toBe('Rich text')
    expect(selector.getAttribute('aria-expanded')).toBe('true')
    expect(selector.querySelector('span')!.className).toContain('cwa:invisible')
    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('choosing a parent selects it from the current stack and returns focus to the selector', async () => {
    const { selector, cwa } = await mountSelector()
    const panel = await openStack(selector)

    panel.querySelector<HTMLElement>('[aria-label="Main content group"] > [data-stack-name]')!.click()
    await flushPromises()
    expect(cwa.admin.resourceStackManager.selectStackIndex).toHaveBeenCalledWith(2, false)
    expect(document.querySelector('[data-testid="resource-stack"]')).toBeNull()
    expect(document.activeElement).toBe(selector)
    expect(selector.getAttribute('aria-expanded')).toBe('false')
  })

  test('a second click on the selector closes the stack', async () => {
    const { selector } = await mountSelector()
    await openStack(selector)

    selector.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    selector.click()
    await flushPromises()
    expect(document.querySelector('[data-testid="resource-stack"]')).toBeNull()
  })
})

// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { computed, ref, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../../../../test/utils/focus-ring'
import PathSelector from './PathSelector.vue'

const state = vi.hoisted(() => ({ cwa: null as any, route: null as any }))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: vi.fn(() => state.cwa),
}))

vi.mock('#app/composables/router', () => ({
  useRouter: vi.fn(() => ({ currentRoute: state.route })),
}))

enableAutoUnmount(afterEach)

afterEach(() => {
  vi.restoreAllMocks()
})

beforeAll(async () => {
  await import('#cwa/templates/components/core/ui/ResourceStack.vue')
})

const STACK = [
  { iri: '/component/html_contents/1', displayName: 'Rich text' },
  { iri: '/_/component_positions/1', displayName: 'Component position' },
  { iri: '/_/component_groups/main', displayName: 'Main content group' },
  { iri: '/_/pages/home', displayName: 'Page' },
]

function makeCwa(stack = STACK, { confirms = true } = {}) {
  const resourceStack = shallowRef(stack)
  const selectStackIndex = vi.fn(async (index: number) => {
    if (confirms) {
      resourceStack.value = resourceStack.value.slice(index)
    }
  })
  return {
    admin: {
      resourceStackManager: {
        resourceStack: computed(() => resourceStack.value),
        currentStackItem: computed(() => resourceStack.value[0]),
        selectStackIndex,
      },
    },
    resources: {
      displayPageIri: ref<string | undefined>('/_/pages/home'),
    },
  }
}

async function mountSelector(cwa = makeCwa()) {
  state.cwa = cwa
  state.route = ref({ fullPath: '/' })
  const wrapper = mount(PathSelector, { attachTo: document.body })
  await flushPromises()
  return { wrapper, cwa, selector: wrapper.get<HTMLButtonElement>('[data-testid="path-selector"]').element }
}

function pointerFocus() {
  const matches = Element.prototype.matches
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector: string) {
    return selector === ':focus-visible' ? false : matches.call(this, selector)
  })
}

async function openStack(selector: HTMLButtonElement) {
  selector.click()
  await vi.waitFor(() => expect(document.querySelector('[data-testid="resource-stack"]')).not.toBeNull())
  return document.querySelector<HTMLElement>('[data-testid="resource-stack"]')!
}

describe('PathSelector (#461)', () => {
  test('names the selected resource and, with parents to choose, is a button that opens a dialog', async () => {
    const { selector } = await mountSelector()

    expect(selector.textContent).toContain('Rich text')
    expect(selector.textContent).toContain('▾')
    expect(selector.getAttribute('aria-haspopup')).toBe('dialog')
    expect(selector.hasAttribute('aria-controls')).toBe(false)
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

  test.each([
    ['page', { iri: '/_/pages/home', displayName: 'Home page' }],
    ['layout', { iri: '/_/layouts/main', displayName: 'Main layout' }],
  ])('with a %s selected it still names it, but opens nothing and is aria-disabled', async (_type, item) => {
    const { selector } = await mountSelector(makeCwa([item]))

    expect(selector.textContent!.trim()).toBe(item.displayName)
    expect(selector.getAttribute('aria-disabled')).toBe('true')
    expect(selector.hasAttribute('aria-haspopup')).toBe(false)
    selector.click()
    await flushPromises()
    await flushPromises()
    expect(document.querySelector('[data-testid="resource-stack"]')).toBeNull()
  })

  test('open, it controls the stack\'s panel by its id', async () => {
    const { selector } = await mountSelector()
    const panel = await openStack(selector)

    await vi.waitFor(() => expect(selector.getAttribute('aria-controls')).toBe(panel.id))
    expect(panel.id).not.toBe('')
    expect(panel.getAttribute('role')).toBe('dialog')
  })

  test('opened by keyboard, the ring shows on the selected level', async () => {
    pointerFocus()
    const { selector } = await mountSelector()
    selector.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    await vi.waitFor(() => expect(document.querySelector('[data-testid="resource-stack"]')).not.toBeNull())

    const ringed = [...document.querySelectorAll<HTMLElement>('[role="treeitem"]')].filter(level => level.className.split(/\s+/).includes('cwa:outline-accent-fg'))
    expect(ringed.map(level => level.getAttribute('aria-label'))).toEqual(['Rich text'])
  })

  test('opened by pointer, it starts without the keyboard ring', async () => {
    pointerFocus()
    const { selector } = await mountSelector()
    selector.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    await vi.waitFor(() => expect(document.querySelector('[data-testid="resource-stack"]')).not.toBeNull())

    expect([...document.querySelectorAll<HTMLElement>('[role="treeitem"]')].some(level => level.className.split(/\s+/).includes('cwa:outline-accent-fg'))).toBe(false)
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

    panel.querySelector<HTMLElement>('[aria-label="Component position"] > [data-stack-name]')!.click()
    await flushPromises()
    expect(cwa.admin.resourceStackManager.selectStackIndex).toHaveBeenCalledWith(1, false)
    expect(document.querySelector('[data-testid="resource-stack"]')).toBeNull()
    expect(document.activeElement).toBe(selector)
    expect(selector.getAttribute('aria-expanded')).toBe('false')
  })

  test('choosing a parent says "<name> selected" in the header\'s live region', async () => {
    const { selector, wrapper } = await mountSelector()
    const panel = await openStack(selector)

    panel.querySelector<HTMLElement>('[aria-label="Main content group"] > [data-stack-name]')!.click()
    const region = wrapper.get('[data-testid="path-selector-announcer"]').element
    await vi.waitFor(() => expect(region.textContent).toBe('Main content group selected'))
    expect(region.getAttribute('role')).toBe('status')
  })

  test('a choice cancelled at the layout/page confirm closes the stack and announces nothing', async () => {
    const { selector, wrapper } = await mountSelector(makeCwa(STACK, { confirms: false }))
    const panel = await openStack(selector)

    panel.querySelector<HTMLElement>('[aria-label="Main content group"] > [data-stack-name]')!.click()
    await flushPromises()
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(document.querySelector('[data-testid="resource-stack"]')).toBeNull()
    expect(wrapper.get('[data-testid="path-selector-announcer"]').text()).toBe('')
  })

  test('a second click on the selector closes the stack and leaves focus on the selector', async () => {
    const { selector } = await mountSelector()
    await openStack(selector)
    expect(document.activeElement).not.toBe(selector)

    selector.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    selector.click()
    await flushPromises()
    expect(document.querySelector('[data-testid="resource-stack"]')).toBeNull()
    expect(document.activeElement).toBe(selector)
    expect(selector.getAttribute('aria-expanded')).toBe('false')
  })

  test('closes when another page is shown', async () => {
    const { selector, cwa } = await mountSelector()
    await openStack(selector)

    cwa.resources.displayPageIri.value = '/_/pages/about'
    await flushPromises()
    expect(document.querySelector('[data-testid="resource-stack"]')).toBeNull()
    expect(selector.getAttribute('aria-expanded')).toBe('false')
  })

  test('closes when the route changes', async () => {
    const { selector } = await mountSelector()
    await openStack(selector)

    state.route.value = { fullPath: '/_cwa/layouts' }
    await flushPromises()
    expect(document.querySelector('[data-testid="resource-stack"]')).toBeNull()
  })
})

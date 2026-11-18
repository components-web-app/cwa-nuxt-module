// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../test/utils/focus-ring'
import { placeResourceStack } from '../core/ui/resource-stack'
import ResourceStack from './ResourceStack.vue'

vi.mock('../core/ui/resource-stack', async (importOriginal) => {
  const original = await importOriginal<typeof import('../core/ui/resource-stack')>()
  return { ...original, placeResourceStack: vi.fn(original.placeResourceStack) }
})

enableAutoUnmount(afterEach)

const names = ['Rich text', 'Component position', 'Left column group', 'Two columns', 'Component position', 'Main content group', 'Tabs']
const levels = (count: number) => names.slice(0, count).map((label, index) => ({ key: String(index), label }))

async function openStack(props: Record<string, unknown> = {}) {
  const returnTo = document.createElement('button')
  returnTo.textContent = 'Opener'
  returnTo.dataset.testid = 'opener'
  document.body.append(returnTo)
  const select = vi.fn<(key: string) => unknown>()
  const onClose = vi.fn()
  const wrapper = mount(ResourceStack, {
    props: { levels: levels(3), at: { x: 400, y: 300 }, select, returnTo, onClose, ...props },
    attachTo: document.body,
  })
  await flushPromises()
  const panel = document.querySelector<HTMLElement>('[data-testid="resource-stack"]')!
  const tree = panel.querySelector<HTMLElement>('[role="tree"]')!
  return { wrapper, panel, tree, select, onClose, returnTo }
}

function items(panel: HTMLElement) {
  return [...panel.querySelectorAll<HTMLElement>('[role="treeitem"]')]
}

function item(panel: HTMLElement, label: string, nth = 0) {
  return items(panel).filter(element => element.getAttribute('aria-label') === label)[nth]!
}

function nameRow(level: HTMLElement) {
  return level.querySelector<HTMLElement>(':scope > [data-stack-name]')!
}

async function press(tree: HTMLElement, key: string) {
  tree.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  await flushPromises()
}

function highlighted(tree: HTMLElement) {
  return document.getElementById(tree.getAttribute('aria-activedescendant')!)!.getAttribute('aria-label')
}

afterEach(() => {
  document.querySelectorAll('[data-testid="opener"]').forEach(element => element.remove())
  vi.mocked(placeResourceStack).mockClear()
})

describe('CwaUiResourceStack (#461)', () => {
  test('is a tree titled Select a resource, each level a treeitem inside its parent\'s group, named by its display name alone, the outermost at level 1', async () => {
    const { panel, tree } = await openStack()

    expect(panel.getAttribute('aria-label')).toBe('Select a resource')
    expect(tree.getAttribute('aria-label')).toBe('Select a resource')
    const outer = tree.querySelector<HTMLElement>(':scope > [role="treeitem"]')!
    expect(outer.getAttribute('aria-label')).toBe('Left column group')
    expect(outer.getAttribute('aria-level')).toBe('1')
    expect(outer.getAttribute('aria-expanded')).toBe('true')
    const middle = outer.querySelector<HTMLElement>(':scope > [role="group"] > [role="treeitem"]')!
    expect(middle.getAttribute('aria-label')).toBe('Component position')
    expect(middle.getAttribute('aria-level')).toBe('2')
    const inner = middle.querySelector<HTMLElement>(':scope > [role="group"] > [role="treeitem"]')!
    expect(inner.getAttribute('aria-label')).toBe('Rich text')
    expect(inner.getAttribute('aria-level')).toBe('3')
    expect(inner.hasAttribute('aria-expanded')).toBe(false)
  })

  test('shows the names and nothing else: no icons, second lines, counts or key hints', async () => {
    const { panel } = await openStack()

    expect([...panel.querySelectorAll('[data-stack-name]')].map(row => row.textContent)).toEqual(['Rich text', 'Component position', 'Left column group'])
    expect(panel.textContent).toBe('Rich textComponent positionLeft column group')
    expect(panel.querySelectorAll('svg')).toHaveLength(0)
  })

  test('each box\'s name sits below the child box it contains, and the outermost box is the panel\'s edge', async () => {
    const { panel, tree } = await openStack()
    const outer = item(panel, 'Left column group')

    expect([...outer.children].map(child => child.getAttribute('role') ?? (child.hasAttribute('data-stack-name') ? 'name' : ''))).toEqual(['group', 'name'])
    expect(tree.parentElement).toBe(panel)
    expect(panel.className).not.toMatch(/(^|\s)cwa:p[xytrbl]?-/)
    expect(outer.className).toContain('cwa:border-dashed')
  })

  test('the selected level has a check, a heavier name and the accent edge on its own name row only', async () => {
    const { panel } = await openStack({ selected: '1' })
    const selected = item(panel, 'Component position')

    expect(selected.getAttribute('aria-selected')).toBe('true')
    expect(item(panel, 'Rich text').getAttribute('aria-selected')).toBe('false')
    expect(nameRow(selected).querySelector('svg')).not.toBeNull()
    expect(nameRow(selected).className).toContain('cwa:font-semibold')
    expect(nameRow(selected).className).toContain('inset_3px_0_0_var(--cwa-color-accent-fg)')
    expect(selected.className).not.toContain('inset_3px')
    expect(panel.querySelectorAll('svg')).toHaveLength(1)
  })

  test('opens with focus on the tree and the highlight on the selected level, shown only as selected, or on the innermost when nothing is selected', async () => {
    const { tree, panel } = await openStack({ selected: '1' })

    expect(document.activeElement).toBe(tree)
    expect(highlighted(tree)).toBe('Component position')
    expect(items(panel).some(level => level.className.includes('cwa:outline-accent-fg') || level.className.includes('cwa:bg-field-hover'))).toBe(false)
  })

  test('starts on the innermost level when nothing is selected', async () => {
    const { tree } = await openStack()

    expect(highlighted(tree)).toBe('Rich text')
  })

  test('Up and Down follow the names on screen, Up to the child and Down to the parent; Left goes to the parent and Right to the child', async () => {
    const { tree } = await openStack()

    await press(tree, 'ArrowDown')
    expect(highlighted(tree)).toBe('Component position')
    await press(tree, 'ArrowDown')
    expect(highlighted(tree)).toBe('Left column group')
    await press(tree, 'ArrowUp')
    expect(highlighted(tree)).toBe('Component position')
    await press(tree, 'ArrowRight')
    expect(highlighted(tree)).toBe('Rich text')
    await press(tree, 'ArrowLeft')
    expect(highlighted(tree)).toBe('Component position')
  })

  test('Home goes to the innermost, End to the outermost, and a letter to the next level starting with it', async () => {
    const { tree } = await openStack({ levels: levels(5) })

    await press(tree, 'End')
    expect(highlighted(tree)).toBe('Component position')
    expect(document.getElementById(tree.getAttribute('aria-activedescendant')!)!.getAttribute('aria-level')).toBe('1')
    await press(tree, 'Home')
    expect(highlighted(tree)).toBe('Rich text')
    await press(tree, 'c')
    expect(highlighted(tree)).toBe('Component position')
    expect(document.getElementById(tree.getAttribute('aria-activedescendant')!)!.getAttribute('aria-level')).toBe('4')
    await press(tree, 'c')
    expect(document.getElementById(tree.getAttribute('aria-activedescendant')!)!.getAttribute('aria-level')).toBe('1')
  })

  test('the keyboard highlight is a 2px accent ring on that box and on no other', async () => {
    const { tree, panel } = await openStack()

    await press(tree, 'ArrowDown')
    const ringed = items(panel).filter(level => level.className.includes('cwa:outline-accent-fg'))
    expect(ringed.map(level => level.getAttribute('aria-label'))).toEqual(['Component position'])
    expect(ringed[0]!.className).toContain('cwa:outline-2')
    expect(ringed[0]!.className).not.toContain('outline-none')
  })

  test('hovering a name row marks that one level with a solid border and fill, while the boxes inside it keep the surface', async () => {
    const { panel } = await openStack()

    nameRow(item(panel, 'Left column group')).dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    await flushPromises()
    const hovered = items(panel).filter(level => level.className.includes('cwa:bg-field-hover'))
    expect(hovered.map(level => level.getAttribute('aria-label'))).toEqual(['Left column group'])
    expect(hovered[0]!.className).toContain('cwa:border-solid')
    expect(item(panel, 'Rich text').className).toContain('cwa:bg-surface-menu')
  })

  test('Enter or Space chooses the highlighted level', async () => {
    const { tree, select } = await openStack()

    await press(tree, 'ArrowDown')
    await press(tree, 'Enter')
    expect(select).toHaveBeenCalledWith('1')
  })

  test('Space chooses the highlighted level', async () => {
    const { tree, select } = await openStack()

    await press(tree, ' ')
    expect(select).toHaveBeenCalledWith('0')
  })

  test('a level is chosen only from its own name row, never from the padding of its box around a child', async () => {
    const { panel, select } = await openStack()
    const outer = item(panel, 'Left column group')

    outer.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(select).not.toHaveBeenCalled()

    nameRow(outer).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(select).toHaveBeenCalledWith('2')
  })

  test('stays open until the choice resolves, ignoring outside clicks meanwhile, then closes and returns focus', async () => {
    let resolve!: (value: unknown) => void
    const { panel, tree, select, onClose, returnTo } = await openStack()
    select.mockImplementation(() => new Promise((done) => {
      resolve = done
    }))

    await press(tree, 'Enter')
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(onClose).not.toHaveBeenCalled()
    expect(panel.isConnected).toBe(true)
    expect(tree.getAttribute('aria-busy')).toBe('true')

    resolve(true)
    await flushPromises()
    expect(onClose).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(returnTo)
  })

  test('a choice that is cancelled keeps the panel open with the highlight where it was', async () => {
    const { tree, select, onClose } = await openStack()
    select.mockResolvedValue(false)

    await press(tree, 'ArrowDown')
    await press(tree, 'Enter')
    expect(onClose).not.toHaveBeenCalled()
    expect(highlighted(tree)).toBe('Component position')
    expect(document.activeElement).toBe(tree)
  })

  test('Escape and Tab close it and return focus', async () => {
    for (const key of ['Escape', 'Tab']) {
      const { tree, onClose, returnTo, wrapper } = await openStack()

      await press(tree, key)
      expect(onClose, key).toHaveBeenCalledOnce()
      expect(document.activeElement, key).toBe(returnTo)
      wrapper.unmount()
    }
  })

  test('a pointerdown outside closes it, except a right-click, which the page\'s context menu handles', async () => {
    const { onClose } = await openStack()

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 2 }))
    await flushPromises()
    expect(onClose).not.toHaveBeenCalled()

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('scrolling the page closes it, but a scroll event that moved nothing does not', async () => {
    const { onClose } = await openStack()

    document.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(onClose).not.toHaveBeenCalled()

    window.scrollTo(0, 40)
    document.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(onClose).toHaveBeenCalledOnce()
    window.scrollTo(0, 0)
  })

  test('scrolling a container on the page closes it', async () => {
    const { onClose } = await openStack()
    const container = document.createElement('div')
    container.dataset.testid = 'opener'
    document.body.append(container)

    container.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('is placed from the pointer and the innermost box', async () => {
    await openStack({ at: { x: 123, y: 45 } })

    expect(placeResourceStack).toHaveBeenCalledWith({ x: 123, y: 45 }, expect.objectContaining({ inner: expect.any(Object), panel: expect.any(Object) }), expect.any(Object), undefined)
  })

  test('opened over an element, it is placed from that element and the one it must not cover, and a pointerdown on the element leaves it to the element', async () => {
    const anchor = document.createElement('button')
    anchor.textContent = 'Rich text'
    anchor.dataset.testid = 'opener'
    const avoid = document.createElement('div')
    avoid.dataset.testid = 'opener'
    document.body.append(anchor, avoid)
    const { onClose } = await openStack({ at: anchor, avoid })

    expect(placeResourceStack).toHaveBeenCalledWith(anchor.getBoundingClientRect(), expect.any(Object), expect.any(Object), avoid.getBoundingClientRect())
    anchor.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(onClose).not.toHaveBeenCalled()
  })

  describe('long stacks', () => {
    test('shows the 5 innermost levels and a Show 2 more parents button outside the tree\'s nesting, levels counted from the whole stack', async () => {
      const { panel, tree } = await openStack({ levels: levels(7) })

      expect(items(panel)).toHaveLength(5)
      expect(item(panel, 'Rich text').getAttribute('aria-level')).toBe('7')
      const more = panel.querySelector<HTMLElement>('[data-testid="resource-stack-more"]')!
      expect(more.textContent!.trim()).toBe('Show 2 more parents')
      expect(tree.contains(more)).toBe(false)
      expect(drawsFocusRing(more.className.split(/\s+/))).toBe(true)
    })

    test('says parent for one', async () => {
      const { panel } = await openStack({ levels: levels(6) })

      expect(panel.querySelector('[data-testid="resource-stack-more"]')!.textContent!.trim()).toBe('Show 1 more parent')
    })

    test('Down from the outermost level shown moves to the button and Up returns to the tree', async () => {
      const { panel, tree } = await openStack({ levels: levels(7) })
      const more = panel.querySelector<HTMLElement>('[data-testid="resource-stack-more"]')!

      await press(tree, 'End')
      await press(tree, 'ArrowDown')
      expect(document.activeElement).toBe(more)
      await press(more, 'ArrowUp')
      expect(document.activeElement).toBe(tree)
      expect(highlighted(tree)).toBe('Component position')
    })

    test('showing them keeps the highlight and announces how many were shown', async () => {
      const { panel, tree } = await openStack({ levels: levels(7) })

      await press(tree, 'ArrowDown')
      panel.querySelector<HTMLElement>('[data-testid="resource-stack-more"]')!.click()
      await flushPromises()
      expect(items(panel)).toHaveLength(7)
      expect(item(panel, 'Rich text').getAttribute('aria-level')).toBe('7')
      expect(highlighted(tree)).toBe('Component position')
      expect(panel.querySelector('[data-testid="resource-stack-more"]')).toBeNull()
      expect(panel.querySelector('[role="status"]')!.textContent).toBe('2 more parents shown')
    })
  })

  describe('axe', () => {
    test('has no violations when opened, highlighted by keyboard, hovered, and with the overflow shown and expanded', async () => {
      const { tree, panel } = await openStack({ levels: levels(7), selected: '1' })
      expect(await axe(document.body)).toHaveNoViolations()

      await press(tree, 'ArrowDown')
      expect(await axe(document.body)).toHaveNoViolations()

      nameRow(item(panel, 'Rich text')).dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
      await flushPromises()
      expect(await axe(document.body)).toHaveNoViolations()

      panel.querySelector<HTMLElement>('[data-testid="resource-stack-more"]')!.click()
      await flushPromises()
      expect(await axe(document.body)).toHaveNoViolations()
    })
  })
})

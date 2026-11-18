// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { AlertDialogContent, AlertDialogDescription, AlertDialogPortal, AlertDialogRoot, AlertDialogTitle } from 'reka-ui'
import { axe } from '../../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../../test/utils/focus-ring'
import { placeResourceStack } from './resource-stack'
import { announceKey } from './field-keys'
import ResourceStack from './ResourceStack.vue'

vi.mock('./resource-stack', async (importOriginal) => {
  const original = await importOriginal<typeof import('./resource-stack')>()
  return { ...original, placeResourceStack: vi.fn(original.placeResourceStack) }
})

enableAutoUnmount(afterEach)

const names = ['Rich text', 'Component position', 'Left column group', 'Two columns', 'Component position', 'Main content group', 'Tabs']
const levels = (count: number) => names.slice(0, count).map((label, index) => ({ key: String(index), label }))

async function openStack(props: Record<string, unknown> = {}, announce = vi.fn()) {
  const returnTo = document.createElement('button')
  returnTo.textContent = 'Opener'
  returnTo.dataset.testid = 'opener'
  document.body.append(returnTo)
  const select = vi.fn<(key: string) => unknown>()
  const onClose = vi.fn()
  const wrapper = mount(ResourceStack, {
    props: { levels: levels(3), at: { x: 400, y: 300 }, select, returnTo, onClose, ...props },
    attachTo: document.body,
    global: { provide: { [announceKey as symbol]: announce } },
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

async function press(tree: HTMLElement, key: string, modifiers: KeyboardEventInit = {}) {
  tree.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers }))
  await flushPromises()
}

function highlighted(tree: HTMLElement) {
  return document.getElementById(tree.getAttribute('aria-activedescendant')!)!.getAttribute('aria-label')
}

const matches = Element.prototype.matches

function showsFocus(onTree: boolean) {
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector: string) {
    return selector === ':focus-visible' ? onTree && this.getAttribute('role') === 'tree' : matches.call(this, selector)
  })
}

beforeEach(() => showsFocus(false))

afterEach(() => {
  document.querySelectorAll('[data-testid="opener"]').forEach(element => element.remove())
  vi.mocked(placeResourceStack).mockClear()
  vi.restoreAllMocks()
})

describe('ResourceStack (#461)', () => {
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

  test('shows the names and nothing else, with something selected: no icons, second lines, counts or key hints', async () => {
    const { panel } = await openStack({ selected: '1' })

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
    expect(outer.className.split(/\s+/)).toEqual(expect.arrayContaining(['cwa:border', 'cwa:border-line-strong']))
    expect(panel.innerHTML).not.toMatch(/dashed|dotted/)
  })

  test('the selected level is marked by an accent border on its box, and its name keeps the weight, classes and padding of every other name', async () => {
    const { panel } = await openStack({ selected: '1' })
    const selected = item(panel, 'Component position')
    const others = items(panel).filter(level => level !== selected)

    expect(selected.getAttribute('aria-selected')).toBe('true')
    expect(item(panel, 'Rich text').getAttribute('aria-selected')).toBe('false')
    expect(selected.className.split(/\s+/)).toContain('cwa:border-accent-fg')
    expect(selected.className.split(/\s+/)).not.toContain('cwa:border-line-strong')
    for (const other of others) {
      expect(other.className.split(/\s+/)).toContain('cwa:border-line-strong')
      expect(nameRow(selected).className).toBe(nameRow(other).className)
      expect(nameRow(selected).querySelector('[data-stack-label]')!.className).toBe(nameRow(other).querySelector('[data-stack-label]')!.className)
    }
    expect(panel.innerHTML).not.toMatch(/font-(semibold|bold|medium)|inset_3px/)
    expect(panel.querySelectorAll('svg')).toHaveLength(0)
  })

  test('hovering the selected level shows both: its accent border stays and the hover fill is added', async () => {
    const { panel } = await openStack({ selected: '1' })
    const selected = item(panel, 'Component position')

    nameRow(selected).dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    await flushPromises()
    expect(selected.className.split(/\s+/)).toEqual(expect.arrayContaining(['cwa:border-accent-fg', 'cwa:bg-field-hover']))
    expect(selected.className.split(/\s+/)).not.toContain('cwa:border-fg')

    nameRow(item(panel, 'Rich text')).dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    await flushPromises()
    expect(item(panel, 'Rich text').className.split(/\s+/)).toEqual(expect.arrayContaining(['cwa:border-fg', 'cwa:bg-field-hover']))
    expect(selected.className.split(/\s+/)).toEqual(expect.arrayContaining(['cwa:border-accent-fg', 'cwa:bg-surface-menu']))
  })

  test('opens with focus on the tree and the highlight on the selected level, shown only as selected, or on the innermost when nothing is selected', async () => {
    const { tree, panel } = await openStack({ selected: '1' })

    expect(document.activeElement).toBe(tree)
    expect(highlighted(tree)).toBe('Component position')
    expect(items(panel).some(level => level.className.includes('cwa:outline-accent-fg') || level.className.includes('cwa:bg-field-hover'))).toBe(false)
  })

  test('opened by keyboard, the ring shows on the level it starts on, and the tree takes visible focus', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    const { panel, tree } = await openStack({ selected: '1', keyboard: true })

    const ringed = items(panel).filter(level => level.className.split(/\s+/).includes('cwa:outline-accent-fg'))
    expect(ringed.map(level => level.getAttribute('aria-label'))).toEqual(['Component position'])
    expect(ringed[0]!.className).toContain('cwa:outline-2')
    const onTree = focus.mock.calls.filter((_call, index) => focus.mock.contexts[index] === tree)
    expect(onTree).toEqual([[{ preventScroll: true }]])
  })

  test('opened by pointer, the tree takes focus without showing it, and no level draws a ring even where the browser would show focus', async () => {
    showsFocus(true)
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    const { panel, tree } = await openStack({ selected: '1' })

    const onTree = focus.mock.calls.filter((_call, index) => focus.mock.contexts[index] === tree)
    expect(onTree).toEqual([[{ preventScroll: true, focusVisible: false }]])
    expect(items(panel).some(level => level.className.includes('outline-accent-fg'))).toBe(false)
  })

  test('opened by pointer, the ring appears once the keyboard moves the highlight', async () => {
    const { panel, tree } = await openStack({ selected: '1' })

    await press(tree, 'ArrowUp')
    const ringed = items(panel).filter(level => level.className.split(/\s+/).includes('cwa:outline-accent-fg'))
    expect(ringed.map(level => level.getAttribute('aria-label'))).toEqual(['Rich text'])
  })

  test('the outermost level draws its ring inside its edge, since the panel scrolls and would clip it', async () => {
    const { panel, tree } = await openStack()

    await press(tree, 'End')
    expect(item(panel, 'Left column group').className.split(/\s+/)).toContain('cwa:-outline-offset-2')
    await press(tree, 'Home')
    expect(item(panel, 'Rich text').className.split(/\s+/)).toContain('cwa:outline-offset-1')
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

  test('arrow keys with Alt or Meta held are left to the browser', async () => {
    const { tree } = await openStack()

    for (const modifiers of [{ altKey: true }, { metaKey: true }]) {
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true, ...modifiers })
      tree.dispatchEvent(event)
      await flushPromises()
      expect(event.defaultPrevented).toBe(false)
      expect(highlighted(tree)).toBe('Rich text')
    }
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

  test('hovering a name row marks that one level with a stronger border and fill, while the boxes inside it keep the surface', async () => {
    const { panel } = await openStack()

    nameRow(item(panel, 'Left column group')).dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    await flushPromises()
    const hovered = items(panel).filter(level => level.className.includes('cwa:bg-field-hover'))
    expect(hovered.map(level => level.getAttribute('aria-label'))).toEqual(['Left column group'])
    expect(hovered[0]!.className.split(/\s+/)).toContain('cwa:border-fg')
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

  test('a choice says "<name> selected" through the surface\'s announcer', async () => {
    const announce = vi.fn()
    const { tree } = await openStack({}, announce)

    await press(tree, 'ArrowDown')
    await press(tree, 'Enter')
    expect(announce).toHaveBeenCalledWith('Component position selected')
  })

  test('a choice that is cancelled (the layout/page confirm) closes the panel, returns focus and announces nothing', async () => {
    const announce = vi.fn()
    const { tree, select, onClose, returnTo } = await openStack({}, announce)
    select.mockResolvedValue(false)

    await press(tree, 'Enter')
    expect(onClose).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(returnTo)
    expect(announce).not.toHaveBeenCalled()
  })

  test('while a choice waits on the kit confirm, Escape reaches the confirm and the stack stays open', async () => {
    let resolve!: (value: unknown) => void
    const { tree, select, onClose, panel } = await openStack()
    select.mockImplementation(() => new Promise((done) => {
      resolve = done
    }))
    await press(tree, 'Enter')
    const onDialogClose = vi.fn()
    mount(defineComponent(() => () => h(AlertDialogRoot, { 'open': true, 'onUpdate:open': onDialogClose }, () => h(AlertDialogPortal, () => h(AlertDialogContent, () => [h(AlertDialogTitle, () => 'Edit the page?'), h(AlertDialogDescription, () => 'Changes appear on this page only.'), h('button', { type: 'button' }, 'Cancel')])))), { attachTo: document.body })
    await flushPromises()

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    ;(document.activeElement ?? document.body).dispatchEvent(escape)
    await flushPromises()
    expect(onDialogClose).toHaveBeenCalledWith(false)
    expect(onClose).not.toHaveBeenCalled()
    expect(panel.isConnected).toBe(true)

    resolve(false)
    await flushPromises()
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('while a choice is pending, Escape on the tree does not close it', async () => {
    const { tree, select, onClose } = await openStack()
    select.mockImplementation(() => new Promise(() => {}))
    await press(tree, 'Enter')

    await press(tree, 'Escape')
    expect(onClose).not.toHaveBeenCalled()
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

  test('resizing the window closes it', async () => {
    const { onClose } = await openStack()

    window.dispatchEvent(new Event('resize'))
    await flushPromises()
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('a tall panel scrolls inside the viewport, and is no wider than the viewport without its scrollbar, less 8px each side', async () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000)
    const { panel } = await openStack()

    expect(panel.className.split(/\s+/)).toEqual(expect.arrayContaining(['cwa:max-h-[calc(100dvh-1rem)]', 'cwa:overflow-y-auto']))
    expect(panel.className).not.toContain('100vw')
    expect(panel.style.maxWidth).toBe('984px')
  })

  test('shows itself at the point when the innermost box cannot be measured, never staying hidden', async () => {
    const { panel } = await openStack({ levels: [], at: { x: 123, y: 45 } })

    expect(panel.style.visibility).not.toBe('hidden')
    expect(placeResourceStack).not.toHaveBeenCalled()
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

  test('opened over an element, it puts the innermost level\'s name text on that element, measured from the name text, not its box', async () => {
    const anchor = document.createElement('span')
    anchor.dataset.testid = 'opener'
    document.body.append(anchor)
    const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, x: left, y: top, right: left + width, bottom: top + height, toJSON: () => ({}) }) as DOMRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute('data-stack-label') && this.closest('[data-stack-innermost]')) {
        return rect(130, 120, 50, 16)
      }
      if (this.hasAttribute('data-stack-innermost')) {
        return rect(110, 110, 90, 40)
      }
      if (this.querySelector('[data-stack-innermost]')) {
        return rect(100, 100, 200, 120)
      }
      return rect(0, 0, 0, 0)
    })
    await openStack({ at: anchor })

    expect(placeResourceStack).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ inner: { left: 30, top: 20, width: 50, height: 16 } }), expect.any(Object), undefined)
  })

  test('opened at a point, it is still placed from the innermost box', async () => {
    const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, x: left, y: top, right: left + width, bottom: top + height, toJSON: () => ({}) }) as DOMRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute('data-stack-label') && this.closest('[data-stack-innermost]')) {
        return rect(130, 120, 50, 16)
      }
      if (this.hasAttribute('data-stack-innermost')) {
        return rect(110, 110, 90, 40)
      }
      if (this.querySelector('[data-stack-innermost]')) {
        return rect(100, 100, 200, 120)
      }
      return rect(0, 0, 0, 0)
    })
    await openStack({ at: { x: 5, y: 5 } })

    expect(placeResourceStack).toHaveBeenCalledWith({ x: 5, y: 5 }, expect.objectContaining({ inner: { left: 10, top: 10, width: 90, height: 40 } }), expect.any(Object), undefined)
  })

  test.each([
    ['at the pointer', () => ({ x: 400, y: 300 })],
    ['over the header\'s path selector', () => {
      const selector = document.createElement('button')
      selector.textContent = 'Rich text'
      document.body.append(selector)
      return selector
    }],
  ])('opened %s, stays hidden until the panel stands where it was placed, so it never shows moving, then fades in with a small downward settle on the panel itself, never the wrapper whose transform places it, and never sideways (#461)', async (_, anchor) => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    const animated: HTMLElement[] = []
    const animate = vi.fn(function (this: HTMLElement) {
      animated.push(this)
      return { finish: vi.fn() }
    })
    vi.spyOn(HTMLElement.prototype, 'animate' as any).mockImplementation(animate as any)
    const at = { left: 400, top: 300 }
    const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, x: left, y: top, right: left + width, bottom: top + height, toJSON: () => ({}) }) as DOMRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute('data-stack-innermost')) {
        return rect(at.left + 10, at.top + 10, 90, 40)
      }
      if (this.querySelector('[data-stack-innermost]')) {
        return rect(at.left, at.top, 200, 120)
      }
      return rect(0, 0, 0, 0)
    })
    vi.mocked(placeResourceStack).mockReturnValueOnce({ left: 390, top: 290 })
    try {
      const { panel } = await openStack({ at: anchor() })

      expect(panel.style.visibility).toBe('hidden')
      expect(animate).not.toHaveBeenCalled()
      frames.splice(0).forEach(callback => callback(0))
      await flushPromises()
      expect(panel.style.visibility).toBe('hidden')

      at.left = 390
      at.top = 290
      frames.splice(0).forEach(callback => callback(0))
      await flushPromises()
      expect(panel.style.visibility).not.toBe('hidden')
      expect(animate).toHaveBeenCalledOnce()
      const [keyframes] = animate.mock.calls[0] as unknown as [Keyframe[]]
      expect(keyframes).toEqual([{ translate: '0 -4px', opacity: 0 }, { translate: '0 0', opacity: 1 }])
      expect(keyframes.some(keyframe => 'transform' in keyframe || 'scale' in keyframe)).toBe(false)
      expect(animate.mock.calls[0]![1]).toMatchObject({ duration: 120 })
      expect(animated).toEqual([panel])
      expect(panel.style.transformOrigin).toBe('')
    }
    finally {
      vi.unstubAllGlobals()
    }
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

    test('showing them finishes the opening animation before measuring again', async () => {
      vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
      const finish = vi.fn()
      HTMLElement.prototype.animate = vi.fn(() => ({ finish }) as unknown as Animation)
      try {
        const { panel } = await openStack({ levels: levels(7) })
        vi.mocked(placeResourceStack).mockClear()

        panel.querySelector<HTMLElement>('[data-testid="resource-stack-more"]')!.click()
        await flushPromises()
        expect(finish).toHaveBeenCalledOnce()
        expect(placeResourceStack).toHaveBeenCalledOnce()
        expect(finish.mock.invocationCallOrder[0]!).toBeLessThan(vi.mocked(placeResourceStack).mock.invocationCallOrder[0]!)
      }
      finally {
        delete (HTMLElement.prototype as { animate?: unknown }).animate
        vi.unstubAllGlobals()
      }
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

  describe('on a phone', () => {
    const phone = '(max-width: 639.98px)'

    beforeEach(() => {
      vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query === phone, media: query, addEventListener() {}, removeEventListener() {} })))
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    test('below sm it opens as a modal bottom sheet labelled by its Select a resource header, with Close, holding the same tree', async () => {
      const { panel, tree } = await openStack()

      expect(panel.getAttribute('role')).toBe('dialog')
      expect(panel.getAttribute('aria-modal')).toBe('true')
      expect(document.getElementById(panel.getAttribute('aria-labelledby')!)!.textContent).toBe('Select a resource')
      expect([...panel.querySelectorAll('button')].map(button => button.textContent?.trim())).toContain('Close')
      expect(tree.getAttribute('role')).toBe('tree')
      expect(items(panel).map(level => level.getAttribute('aria-label'))).toEqual(['Left column group', 'Component position', 'Rich text'])
      expect(document.activeElement).toBe(tree)
      expect(placeResourceStack).not.toHaveBeenCalled()
    })

    test('sits along the bottom edge at full width, at most 70vh tall, square, above a scrim', async () => {
      const { panel } = await openStack()

      expect(panel.className).toContain('cwa:inset-x-0')
      expect(panel.className).toContain('cwa:bottom-0')
      expect(panel.className).toContain('cwa:max-h-[70vh]')
      expect(panel.className).not.toMatch(/rounded/)
      expect(document.querySelector('[data-testid="resource-stack-scrim"]')).not.toBeNull()
    })

    test('Tab is left to move between the tree, the overflow button and Close, and does not close it', async () => {
      const { panel, tree, onClose } = await openStack({ levels: levels(7) })

      expect(panel.querySelector('[data-testid="resource-stack-more"]')!.getAttribute('tabindex')).not.toBe('-1')
      const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
      tree.dispatchEvent(tab)
      await flushPromises()

      expect(tab.defaultPrevented).toBe(false)
      expect(onClose).not.toHaveBeenCalled()
      expect(document.querySelector('[data-testid="resource-stack"]')).not.toBeNull()
    })

    test('Close, and Escape, close it and return focus to the opener', async () => {
      const { panel, onClose, returnTo } = await openStack()

      ;[...panel.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Close')!.click()
      await flushPromises()
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(document.activeElement).toBe(returnTo)

      const again = await openStack()
      again.tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      await flushPromises()
      expect(again.onClose).toHaveBeenCalledTimes(1)
      expect(document.activeElement).toBe(again.returnTo)
    })

    test('the page behind is inert while it is open, and not after', async () => {
      const { wrapper, panel } = await openStack()
      const container = (wrapper.vm.$.appContext.app as unknown as { _container: HTMLElement })._container

      expect(container.hasAttribute('inert')).toBe(true)
      expect(container.contains(panel)).toBe(false)
      ;[...panel.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Close')!.click()
      await flushPromises()
      expect(container.hasAttribute('inert')).toBe(false)
    })

    test('choosing a level selects it and closes the sheet', async () => {
      const { panel, select, onClose } = await openStack()

      nameRow(item(panel, 'Component position')).click()
      await flushPromises()

      expect(select).toHaveBeenCalledWith('1')
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    test('a phone\'s address bar resizing the window, or a scroll, leaves it open', async () => {
      const { onClose } = await openStack()

      window.dispatchEvent(new Event('resize'))
      window.scrollTo(0, 40)
      document.dispatchEvent(new Event('scroll'))
      await flushPromises()

      expect(onClose).not.toHaveBeenCalled()
    })

    test('has no axe violations', async () => {
      const { panel } = await openStack({ levels: levels(7) })

      expect(await axe(panel)).toHaveNoViolations()
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

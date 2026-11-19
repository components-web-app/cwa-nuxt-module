// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../../test/utils/axe'
import { drag, onPhone, stubVisualViewport } from '../../../../../../test/utils/sheet-media'
import BottomSheet from './BottomSheet.vue'

enableAutoUnmount(afterEach)

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openSheet(props: Record<string, unknown> = {}) {
  const open = ref(true)
  const onApply = vi.fn()
  const onDiscard = vi.fn()
  const onPick = vi.fn()
  const shown = ref(true)
  const opener = ref<HTMLElement>()
  const Host = defineComponent({
    setup() {
      return () => h('div', [
        h('button', { ref: opener, type: 'button' }, 'Opener'),
        shown.value && h(BottomSheet, {
          'open': open.value,
          'onUpdate:open': (value: boolean) => {
            open.value = value
          },
          'label': 'Style',
          'returnTo': opener.value,
          'panelId': 'style-sheet',
          onApply,
          onDiscard,
          ...props,
        }, {
          header: () => h('input', { 'aria-label': 'Search Style', 'data-sheet-focus': '', 'value': 'Dar' }),
          default: () => h('ul', [h('li', [h('button', { 'type': 'button', 'data-testid': 'pick', 'onClick': onPick }, 'Dark')]), h('li', 'Padding')]),
        }),
      ])
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  await flushPromises()
  const sheet = document.querySelector<HTMLElement>('[data-testid="sheet"]')!
  return { wrapper, open, shown, opener: opener.value!, sheet, container: wrapper.element.parentElement!, onApply, onDiscard, onPick }
}

function part(name: string) {
  return document.querySelector<HTMLElement>(`[data-testid="sheet-${name}"]`)!
}

function body(sheet: HTMLElement) {
  return sheet.querySelector<HTMLElement>('[data-sheet-body]')!
}

function settled() {
  return new Promise(resolve => setTimeout(resolve, 260))
}

describe('BottomSheet (#461)', () => {
  test('is a modal dialog titled by its label, with a grab handle hidden from screen readers, its header and a scrolling body, and as a menu has no buttons of its own', async () => {
    const { sheet } = await openSheet()

    expect(sheet.getAttribute('role')).toBe('dialog')
    expect(sheet.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(sheet.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('Style')
    expect(part('handle').getAttribute('aria-hidden')).toBe('true')
    expect(sheet.querySelector('#style-sheet')!.contains(sheet.querySelector('ul'))).toBe(true)
    expect(sheet.querySelector('#style-sheet')!.contains(sheet.querySelector('input'))).toBe(true)
    expect([...sheet.querySelectorAll('button')].map(button => button.dataset.testid)).toEqual(['pick'])
  })

  test('a picker has Discard changes (×) at the top left and Apply (✓) at the top right, both at the hit size, either side of the title', async () => {
    const { sheet } = await openSheet({ actions: true })
    const discard = part('discard')
    const apply = part('apply')
    const row = discard.parentElement!

    expect(discard.getAttribute('aria-label')).toBe('Discard changes')
    expect(apply.getAttribute('aria-label')).toBe('Apply')
    expect([...row.children]).toEqual([discard, sheet.querySelector('h2'), apply])
    for (const button of [discard, apply]) {
      expect(button.className).toContain('cwa:size-hit')
      expect(button.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
    }
  })

  test.each([
    ['Apply', 'apply', 'onApply'],
    ['Discard changes', 'discard', 'onDiscard'],
  ] as const)('a picker\'s %s says so, then closes and returns focus', async (_, button, said) => {
    const sheet = await openSheet({ actions: true })

    part(button).click()
    await flushPromises()

    expect(sheet[said]).toHaveBeenCalledTimes(1)
    expect(sheet[said === 'onApply' ? 'onDiscard' : 'onApply']).not.toHaveBeenCalled()
    expect(sheet.open.value).toBe(false)
    expect(document.activeElement).toBe(sheet.opener)
  })

  test('sits along the bottom edge at full width, at most 70vh tall, square, above a scrim, and slides up only with motion allowed', async () => {
    const { sheet } = await openSheet()

    expect(sheet.className).toContain('cwa:inset-x-0')
    expect(sheet.className).toContain('cwa:bottom-0')
    expect(sheet.className).toContain('cwa:max-h-[70vh]')
    expect(sheet.className).toContain('cwa:motion-safe:animate-[cwa-sheet-in_var(--cwa-duration-base)_cubic-bezier(0.2,0.8,0.2,1)]')
    expect(sheet.className).not.toMatch(/rounded/)
    const scrim = document.querySelector<HTMLElement>('[data-testid="sheet-scrim"]')!
    expect(scrim.className).toContain('cwa:inset-0')
    expect(scrim.className).toContain('cwa:motion-safe:animate-[cwa-line-in_var(--cwa-duration-base)_ease-out]')
  })

  test('focuses the element its content marks on opening, with the caret after any text already typed', async () => {
    const { sheet } = await openSheet()
    const input = sheet.querySelector('input')!

    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(3)
    expect(input.selectionEnd).toBe(3)
  })

  test('the page behind is inert while it is open, and not after', async () => {
    const { container, sheet, open } = await openSheet()

    expect(container.hasAttribute('inert')).toBe(true)
    expect(container.contains(sheet)).toBe(false)
    open.value = false
    await flushPromises()
    expect(container.hasAttribute('inert')).toBe(false)
  })

  test.each([
    ['Escape', () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))],
    ['a tap on the scrim', () => document.querySelector<HTMLElement>('[data-testid="sheet-scrim"]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))],
  ])('%s closes it, discarding a picker\'s changes, and returns focus to what opened it', async (_, act) => {
    const { open, opener, onApply, onDiscard } = await openSheet({ actions: true })
    await new Promise(resolve => setTimeout(resolve))

    act()
    await flushPromises()

    expect(open.value).toBe(false)
    expect(document.querySelector('[data-testid="sheet"]')).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(onApply).not.toHaveBeenCalled()
  })

  test('unmounting it while open still frees the page and returns focus', async () => {
    const { shown, container, opener } = await openSheet()

    shown.value = false
    await flushPromises()

    expect(container.hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(opener)
  })

  test('sits above the on-screen keyboard and never taller than the visible viewport, sized from visualViewport as it changes', async () => {
    vi.stubGlobal('innerHeight', 844)
    const viewport = stubVisualViewport({ height: 844 })
    const { sheet, open } = await openSheet()

    expect(sheet.style.bottom).toBe('0px')
    expect(sheet.style.maxHeight).toBe('590.8px')
    expect(sheet.style.height).toBe('')

    viewport.resize({ height: 500, offsetTop: 0 })
    await flushPromises()
    expect(sheet.style.bottom).toBe('344px')
    expect(sheet.style.maxHeight).toBe('484px')

    open.value = false
    await flushPromises()
    expect(viewport.listening()).toBe(0)
  })

  test('a search sheet has a fixed 60vh height, so results do not jump as they load, kept within the visible viewport', async () => {
    vi.stubGlobal('innerHeight', 844)
    const viewport = stubVisualViewport({ height: 844 })
    const { sheet } = await openSheet({ search: true })

    expect(sheet.className).toContain('cwa:h-[60vh]')
    expect(sheet.style.height).toBe('506.4px')
    viewport.resize({ height: 400 })
    await flushPromises()
    expect(sheet.style.height).toBe('384px')
  })

  test.each([
    ['a menu', {}],
    ['a picker', { actions: true }],
  ])('has no axe violations as %s', async (_, props) => {
    await openSheet(props)

    expect(await axe(document.body)).toHaveNoViolations()
  })
})

describe('BottomSheet swiped down (#461)', () => {
  test('its handle and title row take the drag from the browser, and the sheet follows the finger down but never up', async () => {
    const { sheet } = await openSheet()

    expect(part('grip').className).toContain('cwa:touch-none')
    expect(part('grip').contains(part('handle'))).toBe(true)
    expect(part('grip').contains(sheet.querySelector('h2'))).toBe(true)
    drag(part('handle'), 100, [130, 160], { release: false })
    await flushPromises()
    expect(sheet.style.translate).toBe('0px 60px')
    expect(sheet.className).not.toContain('cwa:transition-[translate]')
    sheet.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientY: 40 }))
    await flushPromises()
    expect(sheet.style.translate).toBe('0px 0px')
  })

  test.each([
    ['a menu', {}, 'onPick'],
    ['a picker, applying its changes', { actions: true }, 'onApply'],
  ] as const)('released past the threshold, %s slides away and closes, returning focus', async (_, props, said) => {
    const opened = await openSheet(props)

    drag(part('grip'), 100, [150, 200, 260])
    await flushPromises()
    expect(opened.open.value).toBe(true)
    expect(opened.sheet.className).toContain('cwa:transition-[translate]')
    expect(opened.sheet.style.translate).toBe(`0px ${window.innerHeight}px`)
    await settled()
    await flushPromises()

    expect(opened.open.value).toBe(false)
    expect(document.activeElement).toBe(opened.opener)
    if (said === 'onApply') {
      expect(opened.onApply).toHaveBeenCalledTimes(1)
    }
    expect(opened.onDiscard).not.toHaveBeenCalled()
    expect(opened.onPick).not.toHaveBeenCalled()
  })

  test('released short of the threshold and slowly, it springs back and stays open', async () => {
    const { sheet, open, onApply } = await openSheet({ actions: true })

    drag(part('grip'), 100, [120, 140, 150, 160, 170], { step: 80 })
    await flushPromises()
    await settled()

    expect(sheet.style.translate).toBe('0px 0px')
    expect(sheet.className).toContain('cwa:transition-[translate]')
    expect(open.value).toBe(true)
    expect(onApply).not.toHaveBeenCalled()
  })

  test('a fast downward flick closes it even short of the threshold', async () => {
    const { open, onApply } = await openSheet({ actions: true })

    drag(part('grip'), 100, [115, 140], { step: 10 })
    await settled()
    await flushPromises()

    expect(open.value).toBe(false)
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  test('with reduced motion it closes at once, never sliding', async () => {
    onPhone(true, { reducedMotion: true })
    const { open, sheet } = await openSheet()

    drag(part('grip'), 100, [150, 200, 260])
    expect(sheet.className).not.toContain('cwa:transition-[translate]')
    await flushPromises()

    expect(open.value).toBe(false)
  })

  test('its body drags it only while scrolled to the top, where the browser keeps only scrolling down for itself, and a tap that became a drag picks nothing', async () => {
    const { sheet, open, onPick } = await openSheet()
    const scroller = body(sheet)

    expect(scroller.className).toContain('cwa:touch-pan-down')
    drag(sheet.querySelector('[data-testid="pick"]')!, 100, [150, 200, 260])
    sheet.querySelector<HTMLElement>('[data-testid="pick"]')!.click()
    expect(onPick).not.toHaveBeenCalled()
    await settled()
    await flushPromises()
    expect(open.value).toBe(false)
  })

  test('a body scrolled down scrolls, never drags, and lets the browser scroll it both ways', async () => {
    const { sheet, open, onPick } = await openSheet()
    const scroller = body(sheet)
    scroller.scrollTop = 40
    scroller.dispatchEvent(new Event('scroll'))
    await flushPromises()

    expect(scroller.className).toContain('cwa:touch-pan-y')
    drag(scroller, 100, [150, 200, 260])
    await settled()
    expect(sheet.style.translate).toBe('')
    expect(open.value).toBe(true)
    sheet.querySelector<HTMLElement>('[data-testid="pick"]')!.click()
    expect(onPick).toHaveBeenCalledTimes(1)
  })

  test('a drag that starts in the search box never moves the sheet', async () => {
    const { sheet, open } = await openSheet()

    drag(sheet.querySelector('input')!, 100, [150, 200, 260])
    await settled()

    expect(sheet.style.translate).toBe('')
    expect(open.value).toBe(true)
  })
})

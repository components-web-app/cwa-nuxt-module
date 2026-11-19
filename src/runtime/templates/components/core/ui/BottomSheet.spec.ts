// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../../test/utils/axe'
import { stubVisualViewport } from '../../../../../../test/utils/sheet-media'
import BottomSheet from './BottomSheet.vue'

enableAutoUnmount(afterEach)

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openSheet(props: Record<string, unknown> = {}) {
  const open = ref(true)
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
          ...props,
        }, {
          header: () => h('input', { 'aria-label': 'Search Style', 'data-sheet-focus': '', 'value': 'Dar' }),
          default: () => h('ul', [h('li', 'Dark'), h('li', 'Padding')]),
        }),
      ])
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  await flushPromises()
  const sheet = document.querySelector<HTMLElement>('[data-testid="sheet"]')!
  return { wrapper, open, shown, opener: opener.value!, sheet, container: wrapper.element.parentElement! }
}

describe('BottomSheet (#461)', () => {
  test('is a modal dialog titled by its label, with a grab handle, its header, a scrolling body and a named close button', async () => {
    const { sheet } = await openSheet()

    expect(sheet.getAttribute('role')).toBe('dialog')
    expect(sheet.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(sheet.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('Style')
    expect(sheet.querySelector('[data-testid="sheet-handle"]')!.getAttribute('aria-hidden')).toBe('true')
    expect(sheet.querySelector<HTMLElement>('[data-testid="sheet-close"]')!.textContent!.trim()).toBe('Close')
    expect(sheet.querySelector('#style-sheet')!.contains(sheet.querySelector('ul'))).toBe(true)
    expect(sheet.querySelector('#style-sheet')!.contains(sheet.querySelector('input'))).toBe(true)
  })

  test('the close button can read Done', async () => {
    const { sheet } = await openSheet({ closeLabel: 'Done' })

    expect(sheet.querySelector<HTMLElement>('[data-testid="sheet-close"]')!.textContent!.trim()).toBe('Done')
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
    ['its close button', () => document.querySelector<HTMLElement>('[data-testid="sheet-close"]')!.click()],
    ['Escape', () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))],
    ['a tap on the scrim', () => document.querySelector<HTMLElement>('[data-testid="sheet-scrim"]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))],
  ])('%s closes it and returns focus to what opened it', async (_, act) => {
    const { open, opener } = await openSheet()
    await new Promise(resolve => setTimeout(resolve))

    act()
    await flushPromises()

    expect(open.value).toBe(false)
    expect(document.querySelector('[data-testid="sheet"]')).toBeNull()
    expect(document.activeElement).toBe(opener)
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

  test('has no axe violations', async () => {
    await openSheet()

    expect(await axe(document.body)).toHaveNoViolations()
  })
})

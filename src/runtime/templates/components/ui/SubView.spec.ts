// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../test/utils/focus-ring'
import SubView from './SubView.vue'
import MultiSelect from './MultiSelect.vue'

enableAutoUnmount(afterEach)

function mountSubView(props: Record<string, unknown> = {}, extra: () => unknown[] = () => []) {
  const open = ref(false)
  const onBack = vi.fn(() => {
    open.value = false
  })
  const Host = defineComponent({
    setup() {
      return () => h('div', { 'data-cwa-scroll': '', 'style': 'overflow:auto' }, [
        h(SubView, { open: open.value, title: 'Hero section', backLabel: 'Components', onBack, ...props }, {
          main: () => [
            h('input', { 'aria-label': 'Search components', 'data-testid': 'search' }),
            h('button', { 'type': 'button', 'data-testid': 'opener', 'onClick': () => (open.value = true) }, 'Hero section'),
          ],
          default: () => [h('button', { 'type': 'button', 'data-testid': 'add' }, 'Add'), ...extra()],
        }),
      ])
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  return { wrapper, open, onBack }
}

const main = () => document.querySelector<HTMLElement>('[data-testid="sub-view-main"]')!
const sub = () => document.querySelector<HTMLElement>('[data-testid="sub-view"]')

async function openFrom(opener: HTMLElement, open: { value: boolean }) {
  opener.focus()
  open.value = true
  await flushPromises()
}

describe('CwaUiSubView (#461)', () => {
  test('shows only the main view until it opens', async () => {
    mountSubView()
    await flushPromises()

    expect(sub()).toBeNull()
    expect(main().hidden).toBe(false)
    expect(main().hasAttribute('inert')).toBe(false)
  })

  test('opening hides the main view and makes it inert, keeping it in the page with its state', async () => {
    const { open } = mountSubView()
    await flushPromises()
    const search = document.querySelector<HTMLInputElement>('[data-testid="search"]')!
    search.value = 'hero'

    await openFrom(document.querySelector('[data-testid="opener"]')!, open)

    expect(main().hidden).toBe(true)
    expect(main().hasAttribute('inert')).toBe(true)
    expect(document.querySelector<HTMLInputElement>('[data-testid="search"]')!.value).toBe('hero')
  })

  test('is a group named by its title, a level 3 heading under a back link named Back to Components', async () => {
    const { open } = mountSubView()
    await openFrom(document.querySelector('[data-testid="opener"]')!, open)

    expect(sub()!.getAttribute('role')).toBe('group')
    const title = document.getElementById(sub()!.getAttribute('aria-labelledby')!)!
    expect(title.tagName).toBe('H3')
    expect(title.textContent?.trim()).toBe('Hero section')
    const back = sub()!.querySelector<HTMLButtonElement>('[data-testid="sub-view-back"]')!
    expect(back.getAttribute('aria-label')).toBe('Back to Components')
    expect(back.textContent?.trim()).toBe('Components')
  })

  test('focus goes to the title by default', async () => {
    const { open } = mountSubView()
    await openFrom(document.querySelector('[data-testid="opener"]')!, open)

    expect(document.activeElement?.getAttribute('data-testid')).toBe('sub-view-title')
  })

  test('focus goes to the control the consumer names', async () => {
    const { open } = mountSubView({ initialFocus: () => document.querySelector<HTMLElement>('[data-testid="add"]') })
    await openFrom(document.querySelector('[data-testid="opener"]')!, open)

    expect(document.activeElement?.getAttribute('data-testid')).toBe('add')
  })

  test.each([
    ['the back link', () => sub()!.querySelector<HTMLButtonElement>('[data-testid="sub-view-back"]')!.click()],
    ['Escape', () => sub()!.querySelector('[data-testid="add"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))],
    ['Alt+Left', () => sub()!.querySelector('[data-testid="add"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true, cancelable: true }))],
  ])('%s goes back and returns focus to what opened it', async (_, goBack) => {
    const { open, onBack } = mountSubView()
    await openFrom(document.querySelector('[data-testid="opener"]')!, open)

    goBack()
    await flushPromises()

    expect(onBack).toHaveBeenCalledTimes(1)
    expect(sub()).toBeNull()
    expect(main().hidden).toBe(false)
    expect(document.activeElement?.getAttribute('data-testid')).toBe('opener')
  })

  test('Escape in the sub-view never reaches the dialog around it', async () => {
    const { open } = mountSubView()
    await openFrom(document.querySelector('[data-testid="opener"]')!, open)
    const outer = vi.fn()
    window.addEventListener('keydown', outer)

    sub()!.querySelector('[data-testid="add"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    window.removeEventListener('keydown', outer)

    expect(outer).not.toHaveBeenCalled()
  })

  test('Escape goes back from anywhere in the dialog around it, such as its footer', async () => {
    const { open, onBack } = mountSubView()
    await openFrom(document.querySelector('[data-testid="opener"]')!, open)
    const host = document.querySelector<HTMLElement>('[data-cwa-scroll]')!
    host.setAttribute('role', 'dialog')
    const footer = document.createElement('button')
    host.appendChild(footer)
    open.value = false
    await flushPromises()
    await openFrom(document.querySelector('[data-testid="opener"]')!, open)

    footer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  test('an Escape another control already handled does not go back', async () => {
    const { open, onBack } = mountSubView()
    await openFrom(document.querySelector('[data-testid="opener"]')!, open)
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    event.preventDefault()

    sub()!.querySelector('[data-testid="add"]')!.dispatchEvent(event)

    expect(onBack).not.toHaveBeenCalled()
  })

  test.each([
    ['a text input', () => h('input', { 'aria-label': 'Path', 'data-testid': 'editable' })],
    ['a textarea', () => h('textarea', { 'aria-label': 'Notes', 'data-testid': 'editable' })],
    ['a contenteditable', () => h('div', { 'contenteditable': 'true', 'role': 'textbox', 'aria-label': 'Body', 'data-testid': 'editable' }, [h('p', { 'data-testid': 'editable-inner' }, 'Text')])],
  ])('Alt+Left in %s moves the caret, and Escape there still goes back', async (_, field) => {
    const { open, onBack } = mountSubView({}, () => [field()])
    await openFrom(document.querySelector('[data-testid="opener"]')!, open)
    const target = sub()!.querySelector('[data-testid="editable-inner"]') ?? sub()!.querySelector('[data-testid="editable"]')!

    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true, cancelable: true }))
    await flushPromises()
    expect(onBack).not.toHaveBeenCalled()

    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  describe('a menu open in the sub-view (#461)', () => {
    const styles = [{ label: 'Dark', value: 'dark' }, { label: 'Boxed', value: 'boxed' }]
    const multi = () => document.querySelector<HTMLElement>('[data-testid="multi-input"]')!
    const menu = () => document.querySelector('[data-testid="multi-menu"]')

    async function openMenu() {
      const opened = mountSubView({}, () => [h(MultiSelect, { label: 'Style', options: styles, modelValue: [] })])
      await openFrom(document.querySelector('[data-testid="opener"]')!, opened.open)
      multi().click()
      await flushPromises()
      expect(menu()).not.toBeNull()
      return opened
    }

    test.each([
      ['Escape', { key: 'Escape' }],
      ['Alt+Left', { key: 'ArrowLeft', altKey: true }],
    ])('%s in an open MultiSelect is left to the menu', async (_, init) => {
      const { onBack } = await openMenu()

      multi().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
      await flushPromises()

      expect(onBack).not.toHaveBeenCalled()
      expect(sub()).not.toBeNull()
    })

    test('Escape in an open MultiSelect closes the menu, and the next Escape goes back', async () => {
      const { onBack } = await openMenu()

      multi().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      await flushPromises()
      expect(menu()).toBeNull()
      multi().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      await flushPromises()

      expect(onBack).toHaveBeenCalledTimes(1)
    })

    test('Escape in an expanded control with no layer of its own, such as an inline combobox, is left to it', async () => {
      const { open, onBack } = mountSubView({}, () => [h('input', { 'role': 'combobox', 'aria-label': 'Field', 'aria-expanded': 'true', 'data-testid': 'inline' })])
      await openFrom(document.querySelector('[data-testid="opener"]')!, open)

      sub()!.querySelector('[data-testid="inline"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

      expect(onBack).not.toHaveBeenCalled()
    })

    test('Escape from elsewhere in the dialog is left alone while a layer is open above it', async () => {
      const { open, onBack } = mountSubView()
      await openFrom(document.querySelector('[data-testid="opener"]')!, open)
      const layer = document.createElement('div')
      layer.setAttribute('data-dismissable-layer', '')
      document.body.appendChild(layer)

      sub()!.querySelector('[data-testid="add"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      layer.remove()

      expect(onBack).not.toHaveBeenCalled()
    })

    test('a layer in the hidden main view, or one under the dialog, does not stop Escape going back', async () => {
      const under = document.createElement('div')
      under.setAttribute('data-dismissable-layer', '')
      document.body.prepend(under)
      const { open, onBack } = mountSubView()
      await openFrom(document.querySelector('[data-testid="opener"]')!, open)
      const inMain = document.createElement('div')
      inMain.setAttribute('data-dismissable-layer', '')
      main().appendChild(inMain)

      sub()!.querySelector('[data-testid="add"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      under.remove()

      expect(onBack).toHaveBeenCalledTimes(1)
    })
  })

  test('focus returns to the control the consumer names', async () => {
    const { open } = mountSubView({ returnFocus: () => document.querySelector<HTMLElement>('[data-testid="search"]') })
    await openFrom(document.querySelector('[data-testid="opener"]')!, open)

    open.value = false
    await flushPromises()

    expect(document.activeElement?.getAttribute('data-testid')).toBe('search')
  })

  test('the main view comes back scrolled where it was', async () => {
    const { open } = mountSubView()
    await flushPromises()
    const container = document.querySelector<HTMLElement>('[data-cwa-scroll]')!
    container.scrollTop = 120

    await openFrom(document.querySelector('[data-testid="opener"]')!, open)
    expect(container.scrollTop).toBe(0)
    open.value = false
    await flushPromises()

    expect(container.scrollTop).toBe(120)
  })

  test('the back link draws its focus ring when focused from the keyboard', async () => {
    const { open } = mountSubView()
    await openFrom(document.querySelector('[data-testid="opener"]')!, open)

    expect(drawsFocusRing([...sub()!.querySelector('[data-testid="sub-view-back"]')!.classList])).toBe(true)
  })

  test('inside a padded body its header still spans the body and sticks to its top edge', async () => {
    const { open } = mountSubView({ padded: true })
    await openFrom(document.querySelector('[data-testid="opener"]')!, open)
    const header = sub()!.querySelector<HTMLElement>('[data-testid="sub-view-header"]')!

    expect([...header.classList]).toEqual(expect.arrayContaining(['cwa:-mx-6', 'cwa:-mt-6', 'cwa:mb-6', 'cwa:-top-6', 'cwa:px-6']))
    expect(header.classList.contains('cwa:max-sm:px-4')).toBe(false)
  })

  test('in a flush body its header keeps to its own padding', async () => {
    const { open } = mountSubView()
    await openFrom(document.querySelector('[data-testid="opener"]')!, open)
    const header = sub()!.querySelector<HTMLElement>('[data-testid="sub-view-header"]')!

    expect([...header.classList]).toEqual(expect.arrayContaining(['cwa:top-0', 'cwa:px-6', 'cwa:max-sm:px-4']))
    expect(header.classList.contains('cwa:-mx-6')).toBe(false)
  })

  test('has no axe violations open or closed', async () => {
    const { wrapper, open } = mountSubView()
    await flushPromises()
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()

    await openFrom(document.querySelector('[data-testid="opener"]')!, open)
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })
})

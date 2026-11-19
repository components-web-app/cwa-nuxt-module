// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, provide, ref } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import { announceKey } from '../core/ui/field-keys'
import Combobox from './Combobox.vue'
import type { ComboboxSection } from './Combobox.vue'

enableAutoUnmount(afterEach)

const allSections: ComboboxSection[] = [
  { key: 'text', label: 'Text', options: [
    { value: 'RichText', label: 'Rich text', description: 'Paragraphs and links' },
    { value: 'Button', label: 'Button' },
  ] },
  { key: 'media', label: 'Media', options: [
    { value: 'Image', label: 'Image', description: 'One image with alt text' },
  ] },
]

function mountCombobox(props: Record<string, unknown> = {}) {
  const query = ref('')
  const sections = ref(allSections)
  const onChoose = vi.fn()
  const onLeaveTop = vi.fn()
  const announce = vi.fn()
  const Host = defineComponent({
    setup() {
      provide(announceKey, announce)
      return () => h(Combobox, {
        'label': 'Search components',
        'sections': sections.value,
        'query': query.value,
        'noun': ['component', 'components'],
        'noneText': 'No component called map',
        'onUpdate:query': (value: string) => (query.value = value),
        onChoose,
        onLeaveTop,
        ...props,
      }, {
        lead: ({ option }: { option: { value: string } }) => h('i', { 'data-lead': option.value }),
        empty: () => h('p', 'Nothing here'),
      })
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  return { wrapper, query, sections, onChoose, onLeaveTop, announce }
}

const input = () => document.querySelector<HTMLInputElement>('[data-testid="combobox-input"]')!
const options = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')]
const highlighted = () => document.querySelector<HTMLElement>('[role="option"][data-highlighted]')?.dataset.value

async function key(name: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init })
  input().dispatchEvent(event)
  await flushPromises()
  return event
}

async function type(value: string) {
  input().value = value
  input().dispatchEvent(new Event('input'))
  await flushPromises()
}

describe('CwaUiCombobox, inline-open (#461)', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  test('is a combobox whose listbox is always open, with labelled sections', async () => {
    mountCombobox()
    await flushPromises()

    expect(input().getAttribute('role')).toBe('combobox')
    expect(input().getAttribute('aria-expanded')).toBe('true')
    const listbox = document.getElementById(input().getAttribute('aria-controls')!)!
    expect(listbox.getAttribute('role')).toBe('listbox')
    const groups = [...listbox.querySelectorAll<HTMLElement>('[role="group"]')]
    expect(groups.map(group => document.getElementById(group.getAttribute('aria-labelledby')!)!.textContent!.trim())).toEqual(['Text', 'Media'])
  })

  test('an option is named by its label and described by its description and section', async () => {
    mountCombobox()
    await flushPromises()

    const image = options().find(option => option.dataset.value === 'Image')!
    expect(document.getElementById(image.getAttribute('aria-labelledby')!)!.textContent).toBe('Image')
    expect(document.getElementById(image.getAttribute('aria-describedby')!)!.textContent).toBe('One image with alt text, Media')
  })

  test('nothing is highlighted until an arrow key, so Enter chooses nothing, and then the highlight is the active descendant', async () => {
    const { onChoose } = mountCombobox()
    await flushPromises()

    expect(highlighted()).toBeUndefined()
    expect(input().hasAttribute('aria-activedescendant')).toBe(false)
    await key('Enter')
    expect(onChoose).not.toHaveBeenCalled()

    await key('ArrowDown')
    expect(highlighted()).toBe('RichText')
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[0]!.id)
  })

  test('arrows move the highlight across sections and wrap, and Enter chooses it', async () => {
    const { onChoose } = mountCombobox()
    await flushPromises()

    await key('ArrowDown')
    await key('ArrowDown')
    await key('ArrowDown')
    expect(highlighted()).toBe('Image')
    await key('ArrowDown')
    expect(highlighted()).toBe('RichText')
    await key('ArrowUp')
    expect(highlighted()).toBe('Image')
    await key('Enter')

    expect(onChoose).toHaveBeenCalledWith('Image')
  })

  test('Ctrl+Home and Ctrl+End jump to the first and last option', async () => {
    mountCombobox()
    await flushPromises()

    await key('End', { ctrlKey: true })
    expect(highlighted()).toBe('Image')
    await key('Home', { ctrlKey: true })
    expect(highlighted()).toBe('RichText')
  })

  test('the keyboard highlight shows the focus ring, the pointer highlight does not', async () => {
    mountCombobox()
    await flushPromises()

    options()[1]!.dispatchEvent(new Event('pointermove'))
    await flushPromises()
    expect(highlighted()).toBe('Button')
    expect(options()[1]!.className).not.toContain('cwa:outline-accent-fg')

    await key('ArrowDown')
    expect(options()[2]!.className).toContain('cwa:outline-accent-fg')
  })

  test('a click chooses, and pressing keeps focus in the search', async () => {
    const { onChoose } = mountCombobox()
    await flushPromises()

    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    options()[1]!.dispatchEvent(press)
    options()[1]!.click()

    expect(press.defaultPrevented).toBe(true)
    expect(onChoose).toHaveBeenCalledWith('Button')
  })

  test('Up from the first keyboard-highlighted option leaves the top when asked to', async () => {
    const { onLeaveTop } = mountCombobox({ upLeaves: true })
    await flushPromises()

    await key('ArrowDown')
    await key('ArrowDown')
    await key('ArrowUp')
    await key('ArrowUp')

    expect(onLeaveTop).toHaveBeenCalledTimes(1)
  })

  test('Up with nothing highlighted leaves the top when asked to', async () => {
    const { onLeaveTop } = mountCombobox({ upLeaves: true })
    await flushPromises()

    expect(highlighted()).toBeUndefined()
    const event = await key('ArrowUp')

    expect(onLeaveTop).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  test('Up with nothing highlighted goes to the last option when nothing is above', async () => {
    const { onLeaveTop } = mountCombobox()
    await flushPromises()

    await key('ArrowUp')

    expect(onLeaveTop).not.toHaveBeenCalled()
    expect(highlighted()).toBe('Image')
  })

  test('the highlight stays when the pointer leaves the list, so Enter still chooses it', async () => {
    const { onChoose } = mountCombobox()
    await flushPromises()
    options()[1]!.dispatchEvent(new Event('pointermove'))
    await flushPromises()

    input().closest('[data-testid="combobox"]')!.querySelector('[dir]')!.dispatchEvent(new PointerEvent('pointerleave'))
    await flushPromises()

    expect(highlighted()).toBe('Button')
    await key('Enter')
    expect(onChoose).toHaveBeenCalledWith('Button')
  })

  test('the highlight comes back when focus returns to the search', async () => {
    const { onChoose } = mountCombobox()
    await flushPromises()
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    input().focus()
    await key('ArrowDown')
    await key('ArrowDown')

    outside.focus()
    await flushPromises()
    input().focus()
    await flushPromises()
    outside.remove()

    expect(highlighted()).toBe('Button')
    await key('Enter')
    expect(onChoose).toHaveBeenCalledWith('Button')
  })

  test('Home and End without Ctrl move the caret in the search, not the highlight', async () => {
    mountCombobox()
    await flushPromises()
    await key('ArrowDown')
    await key('ArrowDown')

    const home = await key('Home')
    const end = await key('End')

    expect(home.defaultPrevented).toBe(false)
    expect(end.defaultPrevented).toBe(false)
    expect(highlighted()).toBe('Button')
  })

  test('typing clears the highlight, so no result looks chosen, and the match is bold', async () => {
    const { sections, onChoose } = mountCombobox()
    await flushPromises()
    await key('ArrowDown')
    await key('ArrowDown')
    expect(highlighted()).toBe('Button')

    await type('i')
    expect(highlighted()).toBeUndefined()
    expect(options().some(option => option.hasAttribute('data-highlighted'))).toBe(false)
    expect(input().hasAttribute('aria-activedescendant')).toBe(false)
    await key('Enter')
    expect(onChoose).not.toHaveBeenCalled()

    sections.value = [allSections[1]!]
    await type('ima')
    expect(options()[0]!.querySelector('mark')!.textContent).toBe('Ima')
    await key('ArrowDown')
    expect(highlighted()).toBe('Image')
  })

  test('the count is announced once typing settles, never per keystroke', async () => {
    vi.useFakeTimers()
    const { announce } = mountCombobox()
    await flushPromises()

    await type('i')
    await type('im')
    vi.advanceTimersByTime(399)
    expect(announce).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce).toHaveBeenCalledWith('3 components')
    vi.useRealTimers()
  })

  test('the count is announced whenever the search changes, also when it is cleared without typing', async () => {
    vi.useFakeTimers()
    const { query, announce } = mountCombobox()
    await flushPromises()

    query.value = 'ima'
    await flushPromises()
    vi.advanceTimersByTime(400)
    query.value = ''
    await flushPromises()
    vi.advanceTimersByTime(400)

    expect(announce).toHaveBeenCalledTimes(2)
    expect(announce).toHaveBeenLastCalledWith('3 components')
    vi.useRealTimers()
  })

  test('Escape clearing the search announces the count', async () => {
    vi.useFakeTimers()
    const { query, announce } = mountCombobox()
    await flushPromises()
    query.value = 'ima'
    await flushPromises()
    vi.advanceTimersByTime(400)
    announce.mockClear()

    await key('Escape')
    vi.advanceTimersByTime(400)

    expect(announce).toHaveBeenCalledWith('3 components')
    vi.useRealTimers()
  })

  test('no results announces the none text and shows the empty slot outside the listbox', async () => {
    vi.useFakeTimers()
    const { sections, announce } = mountCombobox()
    await flushPromises()

    sections.value = []
    await type('map')
    vi.advanceTimersByTime(400)

    expect(announce).toHaveBeenCalledWith('No component called map')
    const empty = document.querySelector('[data-testid="combobox-empty"]')!
    expect(empty.textContent).toBe('Nothing here')
    expect(empty.closest('[role="listbox"]')).toBeNull()
    expect(input().hasAttribute('aria-activedescendant')).toBe(false)
    vi.useRealTimers()
  })

  test('Escape clears a search without reaching the dialog, and is left alone when empty', async () => {
    const { query } = mountCombobox()
    await flushPromises()
    query.value = 'ima'
    await flushPromises()
    const outer = vi.fn()
    window.addEventListener('keydown', outer)

    const first = await key('Escape')
    expect(query.value).toBe('')
    expect(first.defaultPrevented).toBe(true)
    expect(outer).not.toHaveBeenCalled()

    const second = await key('Escape')
    window.removeEventListener('keydown', outer)
    expect(second.defaultPrevented).toBe(false)
    expect(outer).toHaveBeenCalledTimes(1)
  })

  test('every option has the same fixed leading slot', async () => {
    mountCombobox()
    await flushPromises()

    const slots = options().map(option => option.querySelector('[data-lead]')!.parentElement!.className)
    expect(new Set(slots).size).toBe(1)
    expect(slots[0]).toContain('cwa:h-8 cwa:w-12')
  })

  test('has no axe violations with results, while searching and with none', async () => {
    const { wrapper, sections } = mountCombobox()
    await flushPromises()
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()

    await type('ima')
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()

    sections.value = []
    await type('map')
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })
})

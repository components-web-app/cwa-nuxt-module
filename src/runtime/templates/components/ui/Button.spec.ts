// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import { drawsOpenLine, drawsOpenState, failingInk, shownFill, trimsToLetters } from '../../../../../test/utils/kit-css'
import Button from './Button.vue'
import Spinner from './Spinner.vue'
import { announceKey } from '../core/ui/field-keys'

const Plus = { name: 'PlusIcon', render: () => h('svg', { 'data-testid': 'plus' }) }

function hoverClasses(classes: string[]) {
  return classes.filter(c => c.includes('hover:'))
}

describe('CwaUiButton (#456)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('is a square, soft, accent-toned button named by its label, which never submits a form by accident', () => {
    const wrapper = mount(Button, { props: { label: 'Cancel' } })

    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
    expect(wrapper.text()).toBe('Cancel')
    expect(wrapper.attributes('aria-label')).toBeUndefined()
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:bg-button', 'cwa:text-fg', 'cwa:hover:bg-field-hover', 'cwa:font-semibold', 'cwa:text-label']))
    expect(wrapper.classes().some(c => c.includes('rounded'))).toBe(false)
    expect(wrapper.classes().some(c => c.includes('border'))).toBe(false)
  })

  test('a submit button submits', () => {
    expect(mount(Button, { props: { label: 'Save', type: 'submit' } }).attributes('type')).toBe('submit')
  })

  test.each([
    ['solid', 'accent', ['cwa:bg-accent', 'cwa:text-white'], ['cwa:hover:bg-accent-hover']],
    ['solid', 'danger', ['cwa:bg-danger-fill', 'cwa:text-white'], ['cwa:hover:bg-danger-fill-hover']],
    ['soft', 'accent', ['cwa:bg-button', 'cwa:text-fg'], ['cwa:hover:bg-field-hover']],
    ['soft', 'danger', ['cwa:bg-button', 'cwa:text-danger-fg'], ['cwa:hover:bg-field-danger', 'cwa:hover:text-fg']],
    ['ghost', 'accent', ['cwa:bg-transparent', 'cwa:text-fg'], ['cwa:hover:bg-button']],
    ['ghost', 'danger', ['cwa:bg-transparent', 'cwa:text-danger-fg'], ['cwa:hover:bg-button']],
  ] as const)('%s %s has its fill and text, and its own hover', (variant, tone, look, hover) => {
    const wrapper = mount(Button, { props: { label: 'Go', variant, tone } })

    expect(wrapper.classes()).toEqual(expect.arrayContaining([...look, ...hover]))
    expect(hoverClasses(wrapper.classes()).sort()).toEqual([...hover].sort())
  })

  test('follows the control height, which grows on touch, with 1rem of padding, or 0.75rem before an icon', () => {
    const plain = mount(Button, { props: { label: 'Go' } })
    expect(plain.classes()).toEqual(expect.arrayContaining(['cwa:h-control', 'cwa:pointer-coarse:h-hit', 'cwa:px-4']))

    const withIcon = mount(Button, { props: { label: 'Page', icon: Plus } })
    expect(withIcon.classes()).toEqual(expect.arrayContaining(['cwa:h-control', 'cwa:pl-3', 'cwa:pr-4']))
    expect(withIcon.classes()).not.toContain('cwa:px-4')
    const icon = withIcon.get('[data-testid="plus"]')
    expect(icon.attributes('aria-hidden')).toBe('true')
    expect(icon.classes()).toContain('cwa:size-4')
    expect(withIcon.text()).toBe('Page')
  })

  test('small is the helper type with less padding, at the control height every single-line field shares, so it matches the fields beside it', () => {
    const wrapper = mount(Button, { props: { label: 'Undo', size: 'sm' } })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:h-control', 'cwa:pointer-coarse:h-hit', 'cwa:px-3', 'cwa:text-helper']))
    expect(wrapper.classes()).not.toContain('cwa:h-8')
    expect(wrapper.classes()).not.toContain('cwa:text-label')
  })

  test('a small split button\'s ⋮ is as tall as its main action, at the control height', () => {
    const wrapper = mount(Button, { props: { label: 'Publish now', size: 'sm', options: [{ group: null, items: [{ label: 'Schedule', value: 'schedule' }] }] } })
    const [main, more] = wrapper.findAll('button')
    expect(main!.classes()).toContain('cwa:h-control')
    expect(more!.classes()).toEqual(expect.arrayContaining(['cwa:size-control', 'cwa:pointer-coarse:size-hit']))
    expect(more!.classes()).not.toContain('cwa:size-8')
  })

  test('icon-only is a square named by its label, which is not shown', () => {
    const wrapper = mount(Button, { props: { label: 'Close', icon: Plus, iconOnly: true, variant: 'ghost' } })

    expect(wrapper.attributes('aria-label')).toBe('Close')
    expect(wrapper.text()).toBe('')
    expect(wrapper.find('[data-testid="plus"]').exists()).toBe(true)
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:h-control', 'cwa:w-control', 'cwa:pointer-coarse:h-hit', 'cwa:pointer-coarse:w-hit', 'cwa:px-0']))

    const small = mount(Button, { props: { label: 'Close', icon: Plus, iconOnly: true, size: 'sm' } })
    expect(small.classes()).toEqual(expect.arrayContaining(['cwa:h-8', 'cwa:w-8', 'cwa:pointer-coarse:h-hit', 'cwa:pointer-coarse:w-hit']))
  })

  test('a labelled button that opens a popover shows it open with its hover fill and a line under its label; an icon-only one has its fill and no line', () => {
    const labelled = mount(Button, { props: { label: 'Filters' }, attrs: { 'aria-expanded': 'true' } })
    expect(drawsOpenLine(labelled.element)).toBe(true)
    expect(shownFill(labelled.element)).toBe('field-hover')

    const iconOnly = mount(Button, { props: { label: 'Filters', icon: Plus, iconOnly: true }, attrs: { 'aria-expanded': 'true' } })
    expect(drawsOpenLine(iconOnly.element)).toBe(false)
    expect(shownFill(iconOnly.element)).toBe('field-hover')
  })

  test('an icon-only button keeps the 16px row-action icon; a dialog header\'s asks for the large one, 5/9 of the control (24px in its 44px button), without changing its box', () => {
    const wrapper = mount(Button, { props: { label: 'Edit', icon: Plus, iconOnly: true, variant: 'ghost' } })
    expect(wrapper.get('[data-testid="plus"]').classes()).toContain('cwa:size-4')

    const large = mount(Button, { props: { label: 'View', icon: Plus, iconOnly: true, variant: 'ghost', largeIcon: true } })
    expect(large.get('[data-testid="plus"]').classes()).toContain('cwa:size-[calc(var(--cwa-spacing-control)*5/9)]')
    expect(large.classes()).toEqual(expect.arrayContaining(['cwa:h-control', 'cwa:w-control']))

    const small = mount(Button, { props: { label: 'View', icon: Plus, iconOnly: true, size: 'sm' } })
    expect(small.get('[data-testid="plus"]').classes()).toContain('cwa:size-4')

    const labelled = mount(Button, { props: { label: 'Page', icon: Plus } })
    expect(labelled.get('[data-testid="plus"]').classes()).toContain('cwa:size-4')
  })

  test('shows a square focus ring in accent-fg, offset 2px', () => {
    const wrapper = mount(Button, { props: { label: 'Go' } })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:focus-visible:outline-2', 'cwa:focus-visible:outline-offset-2', 'cwa:focus-visible:outline-accent-fg']))
  })

  test('keeps a visible box in forced colours, where its fill is dropped, from a transparent outline that takes no space', () => {
    const wrapper = mount(Button, { props: { label: 'Go', variant: 'ghost' } })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:outline-1', 'cwa:outline-transparent']))
    expect(wrapper.classes().some(c => /(^|:)border/.test(c))).toBe(false)
  })

  test('colours change over 120 ms, and not at all under reduced motion', () => {
    const wrapper = mount(Button, { props: { label: 'Go' } })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:transition-colors', 'cwa:duration-(--cwa-duration-fast)', 'cwa:motion-reduce:transition-none']))
  })

  test('emits click when it can act', async () => {
    const wrapper = mount(Button, { props: { label: 'Go' } })

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  test('disabled stays focusable, so its name and state are still read out, but does nothing, shows no hover and is dimmed', async () => {
    const wrapper = mount(Button, { props: { label: 'Save', type: 'submit', disabled: true } })

    expect(wrapper.attributes('disabled')).toBeUndefined()
    expect(wrapper.attributes('aria-disabled')).toBe('true')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:opacity-50', 'cwa:cursor-not-allowed']))
    expect(hoverClasses(wrapper.classes())).toEqual([])

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    wrapper.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  test('loading keeps its label beside a spinner in place of the icon, is busy, and does nothing until it finishes', async () => {
    const wrapper = mount(Button, { props: { label: 'Saving', icon: Plus, loading: true, variant: 'solid' } })

    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.attributes('aria-disabled')).toBe('true')
    expect(wrapper.text()).toBe('Saving')
    expect(wrapper.findComponent(Spinner).exists()).toBe(true)
    expect(wrapper.find('[data-testid="plus"]').exists()).toBe(false)
    expect(wrapper.classes()).toContain('cwa:pl-3')
    expect(wrapper.classes()).not.toContain('cwa:opacity-50')
    expect(hoverClasses(wrapper.classes())).toEqual([])

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    wrapper.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('click')).toBeUndefined()

    await wrapper.setProps({ loading: false })
    expect(wrapper.attributes('aria-busy')).toBeUndefined()
    expect(wrapper.attributes('aria-disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="plus"]').exists()).toBe(true)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  test('a loading icon-only button keeps its name and swaps its icon for the spinner', () => {
    const wrapper = mount(Button, { props: { label: 'Delete', icon: Plus, iconOnly: true, loading: true } })

    expect(wrapper.attributes('aria-label')).toBe('Delete')
    expect(wrapper.findComponent(Spinner).exists()).toBe(true)
    expect(wrapper.find('[data-testid="plus"]').exists()).toBe(false)
  })

  test('a disabled button with a reason gives it as its description and as a tooltip, without changing its name', () => {
    const wrapper = mount(Button, { props: { label: 'Publish', disabled: true, disabledReason: 'Nothing has changed since the last save' } })

    const id = wrapper.attributes('aria-describedby')
    expect(id).toBeTruthy()
    const reason = wrapper.get(`[id="${id}"]`)
    expect(reason.text()).toBe('Nothing has changed since the last save')
    expect(reason.classes()).toContain('cwa:sr-only')
    expect(reason.attributes('aria-hidden')).toBe('true')
    expect(wrapper.attributes('title')).toBe('Nothing has changed since the last save')
    expect(wrapper.get('span:not([aria-hidden])').text()).toBe('Publish')
  })

  test('pressing a disabled button with a reason shows the reason beside it and announces it, without moving focus, where a touch screen has no tooltip (#476 review 6)', async () => {
    const announce = vi.fn()
    const clicked = vi.fn()
    const wrapper = mount(Button, {
      props: { label: 'Add', disabled: true, disabledReason: 'This group already holds its 3 components', onClick: clicked },
      global: { provide: { [announceKey as symbol]: announce } },
      attachTo: document.body,
    })
    wrapper.element.focus()

    await wrapper.trigger('click')
    await vi.waitFor(() => expect(document.querySelector('[data-testid="button-reason"]')).not.toBeNull())

    const popover = document.querySelector<HTMLElement>('[data-testid="button-reason"]')
    expect(popover?.textContent?.trim()).toBe('This group already holds its 3 components')
    expect(popover?.getAttribute('aria-label')).toBe('Why Add is unavailable')
    expect([...popover!.classList]).toEqual(expect.arrayContaining(['cwa:bg-surface-info', 'cwa:text-white', 'cwa:leading-normal', 'cwa:ring-1', 'cwa:ring-white/15']))
    expect(popover!.querySelector('svg')!.getAttribute('class')).toContain('cwa:stroke-white/15')
    expect(failingInk(popover!)).toEqual([])
    expect(trimsToLetters(popover!.querySelector('p')!)).toBe(true)
    expect(announce).toHaveBeenCalledWith('This group already holds its 3 components')
    expect(clicked).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(wrapper.element)
    expect(await axe(document.body)).toHaveNoViolations()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(document.querySelector('[data-testid="button-reason"]')).toBeNull()
    wrapper.unmount()
  })

  test('pressing a disabled button without a reason, or a loading one, shows nothing (#476 review 6)', async () => {
    const wrapper = mount(Button, { props: { label: 'Add', disabled: true }, attachTo: document.body })
    await wrapper.trigger('click')
    await wrapper.setProps({ disabled: false, loading: true, disabledReason: 'Not used while loading' })
    await wrapper.trigger('click')
    await flushPromises()

    expect(document.querySelector('[data-testid="button-reason"]')).toBeNull()
    expect(wrapper.element.tagName).toBe('BUTTON')
    wrapper.unmount()
  })

  test('each button on a page has its own reason id', () => {
    const wrapper = mount({
      render: () => [
        h(Button, { label: 'Publish', disabled: true, disabledReason: 'One' }),
        h(Button, { label: 'Delete', disabled: true, disabledReason: 'Two' }),
      ],
    })

    const [first, second] = wrapper.findAll('button')
    expect(first!.attributes('aria-describedby')).not.toBe(second!.attributes('aria-describedby'))
    expect(wrapper.get(`[id="${second!.attributes('aria-describedby')}"]`).text()).toBe('Two')
  })

  test('a reason is only given while the button is disabled', async () => {
    const wrapper = mount(Button, { props: { label: 'Publish', disabledReason: 'Nothing has changed since the last save' } })

    expect(wrapper.attributes('aria-describedby')).toBeUndefined()
    expect(wrapper.attributes('title')).toBeUndefined()
    expect(wrapper.text()).toBe('Publish')

    await wrapper.setProps({ disabled: true })
    expect(wrapper.attributes('aria-describedby')).toBeTruthy()

    await wrapper.setProps({ loading: true, disabled: false })
    expect(wrapper.attributes('aria-describedby')).toBeUndefined()
  })

  describe('has no axe violations', () => {
    const states = {
      'rest': {},
      'with an icon': { icon: Plus },
      'disabled': { disabled: true },
      'disabled with a reason': { disabled: true, disabledReason: 'Nothing has changed since the last save' },
      'loading': { loading: true },
      'small': { size: 'sm' },
      'icon-only': { icon: Plus, iconOnly: true },
      'icon-only, small': { icon: Plus, iconOnly: true, size: 'sm' },
      'icon-only, loading': { icon: Plus, iconOnly: true, loading: true },
      'icon-only, disabled with a reason': { icon: Plus, iconOnly: true, disabled: true, disabledReason: 'Nothing to remove' },
    } as const
    const cases = (['solid', 'soft', 'ghost'] as const).flatMap(variant => (['accent', 'danger'] as const).flatMap(tone =>
      Object.entries(states).map(([state, props]) => [`${variant} ${tone}, ${state}`, { variant, tone, ...props }] as const)))

    test.each(cases)('%s', async (_, props) => {
      const wrapper = mount(Button, { props: { label: 'Publish', ...props }, attachTo: document.body })

      expect(await axe(wrapper.element)).toHaveNoViolations()
    })
  })

  describe('as a split button (#459)', () => {
    const options = [{ group: null, items: [{ label: 'Clone', value: 'clone', testId: 'menu-clone' }] }]

    test('the main action and a named ⋮ sit side by side; the main action clicks, the menu selects', async () => {
      const onClick = vi.fn()
      const onSelect = vi.fn()
      const wrapper = mount(Button, { props: { label: 'Publish now', options, onClick, onSelect }, attachTo: document.body })

      const buttons = wrapper.findAll('button')
      expect(buttons.map(button => button.text() || button.attributes('aria-label'))).toEqual(['Publish now', 'More actions'])
      expect(wrapper.get('[data-testid="button-options"] svg').classes()).toContain('cwa:size-4')
      await buttons[0]!.trigger('click')
      expect(onClick).toHaveBeenCalledTimes(1)

      await wrapper.get('[data-testid="button-options"]').trigger('keydown', { key: 'Enter' })
      await flushPromises()
      document.querySelector<HTMLElement>('[data-testid="menu-clone"]')!.click()
      await flushPromises()
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ value: 'clone' }))
    })

    test('the ⋮ on the solid CTA shows its menu open with a darker fill of its own, never a line under it, and goes back to the CTA\'s fill once it closes, with no axe violations open', async () => {
      const wrapper = mount(Button, { props: { label: 'Publish now', variant: 'solid', options }, attachTo: document.body })
      const more = wrapper.get('[data-testid="button-options"]')
      expect(drawsOpenState(more.element)).toBe(false)
      expect(shownFill(more.element)).toBe('accent')

      await more.trigger('keydown', { key: 'Enter' })
      await flushPromises()
      expect(drawsOpenState(more.element)).toBe(true)
      expect(drawsOpenLine(more.element)).toBe(false)
      expect(shownFill(more.element)).toBe('accent-open')
      expect(await axe(document.body, { rules: { region: { enabled: false } } })).toHaveNoViolations()

      document.querySelector<HTMLElement>('[data-testid="menu-clone"]')!.click()
      await flushPromises()
      expect(drawsOpenState(more.element)).toBe(false)
      expect(shownFill(more.element)).toBe('accent')
      wrapper.unmount()
    })

    test('with no main action only the ⋮ is shown, and it is held while loading', () => {
      const wrapper = mount(Button, { props: { options, loading: true } })

      expect(wrapper.findAll('button')).toHaveLength(1)
      expect(wrapper.get('[data-testid="button-options"]').attributes('disabled')).toBeDefined()
    })

    test('a solid ⋮ beside its main action, and a soft one alone, such as a live component\'s with no draft to publish', () => {
      const beside = mount(Button, { props: { label: 'Publish now', variant: 'solid', options } }).get('[data-testid="button-options"]')
      expect(beside.classes()).toEqual(expect.arrayContaining(['cwa:bg-accent', 'cwa:text-white', 'cwa:hover:bg-accent-hover']))

      const alone = mount(Button, { props: { variant: 'solid', options } }).get('[data-testid="button-options"]')
      expect(alone.classes()).toEqual(expect.arrayContaining(['cwa:bg-button', 'cwa:text-fg', 'cwa:hover:bg-field-hover']))
      expect(alone.classes()).not.toContain('cwa:bg-accent')
    })

    test('stretched, as in the bar\'s tab row, the main action and a square ⋮ fill the height they are given', () => {
      const wrapper = mount(Button, { props: { label: 'Publish now', size: 'sm', stretch: true, options } })

      expect(wrapper.classes()).toContain('cwa:h-full')
      const [main, more] = wrapper.findAll('button')
      expect(main!.classes()).toContain('cwa:h-full')
      expect(main!.classes()).not.toContain('cwa:h-8')
      expect(more!.classes()).toEqual(expect.arrayContaining(['cwa:h-full', 'cwa:aspect-square']))
      expect(more!.classes()).not.toContain('cwa:size-8')
    })

    test('a disabled main action leaves the menu usable', () => {
      const wrapper = mount(Button, { props: { label: 'Schedule', disabled: true, disabledReason: 'Choose a date first', options } })

      expect(wrapper.get('[data-testid="button-options"]').attributes('disabled')).toBeUndefined()
    })

    test('has no axe violations', async () => {
      const wrapper = mount(Button, { props: { label: 'Publish now', options }, attachTo: document.body })

      expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
    })
  })

  test('a short label shows below sm instead of the label, which shows from sm, and only one is ever displayed (#460)', async () => {
    const wrapper = mount(Button, { props: { label: 'Publish now', shortLabel: 'Publish' }, attachTo: document.body })
    const short = wrapper.get('[data-testid="button-short-label"]')
    const full = wrapper.findAll('span').find(span => span.text() === 'Publish now')!

    expect(short.text()).toBe('Publish')
    expect(short.classes()).toContain('cwa:sm:hidden')
    expect(full.classes()).toEqual(expect.arrayContaining(['cwa:hidden', 'cwa:sm:inline']))
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test('a split button\'s ⋮ is 16px unless it asks for the large icon, which its main action does not take', () => {
    const options = [{ group: null, items: [{ label: 'Clone', value: 'clone' }] }]
    const large = mount(Button, { props: { label: 'Publish now', icon: Plus, options, size: 'sm', largeIcon: true } })
    expect(large.get('[data-testid="button-options"] svg').classes()).toContain('cwa:size-[calc(var(--cwa-spacing-control)*5/9)]')
    expect(large.get('[data-testid="plus"]').classes()).toContain('cwa:size-4')
  })

  test('a truncating button may shrink to its container and ends its label with an ellipsis, so a long page name in the phone header gives way to the items beside it', () => {
    const wrapper = mount(Button, { props: { label: 'A very long page name', truncate: true } })
    const label = wrapper.findAll('span').find(span => span.text() === 'A very long page name')!

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:min-w-0', 'cwa:max-w-full']))
    expect(wrapper.classes()).not.toContain('cwa:shrink-0')
    expect(label.classes()).toContain('cwa:truncate')
  })

  test('a button keeps its width by default', () => {
    const wrapper = mount(Button, { props: { label: 'Save' } })

    expect(wrapper.classes()).toContain('cwa:shrink-0')
    expect(wrapper.findAll('span').find(span => span.text() === 'Save')!.classes()).not.toContain('cwa:truncate')
  })

  test('a split button passes its short label to the main action', () => {
    const wrapper = mount(Button, { props: { label: 'Publish now', shortLabel: 'Publish', options: [{ label: 'Clone', value: 'clone' }] } })

    expect(wrapper.get('[data-testid="button-short-label"]').text()).toBe('Publish')
  })
})

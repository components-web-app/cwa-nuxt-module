// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../../test/utils/axe'
import Confirm from './Confirm.vue'
import { typedCanStillMatch, typedMatches } from '#cwa/composables/cwa-confirm'

enableAutoUnmount(afterEach)

const typed = {
  title: 'Delete “Shaker kitchens”?',
  lines: [
    { text: '3 pages built from this template are deleted too. Visitors to their 3 addresses get “Page not found”.', emphasis: 'strong' as const },
    { text: 'The route /kitchens/shaker is kept, and visitors to it get “Page not found”.', emphasis: 'muted' as const },
    { text: 'This can\'t be undone.' },
  ],
  keep: 'Don\'t delete',
  go: 'Delete page',
  typed: { noun: 'page name', value: 'Shaker kitchens' },
}

function mountConfirm(props: Record<string, unknown> = typed) {
  return mount(Confirm, { props: props as any, attachTo: document.body })
}

const panel = () => document.querySelector<HTMLElement>('[data-testid="confirm"]')!
const q = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const go = () => q<HTMLButtonElement>('[data-testid="confirm-go"]')

async function type(value: string) {
  const input = q<HTMLInputElement>('[data-testid="confirm-typed"]')
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

describe('typed confirm matching (#461)', () => {
  test.each([
    ['Shaker kitchens', true],
    ['  shaker KITCHENS ', true],
    ['Shaker kitchen', false],
    ['Shakerkitchens', false],
  ])('“%s” matches: %s', (text, expected) => {
    expect(typedMatches(text, 'Shaker kitchens')).toBe(expected)
  })

  test.each([
    ['', true],
    ['  sha', true],
    ['Shaker kitchens', true],
    ['Kitx', false],
    ['Shaker  ', false],
  ])('“%s” can still become the name: %s', (text, expected) => {
    expect(typedCanStillMatch(text, 'Shaker kitchens')).toBe(expected)
  })
})

describe('CwaUiConfirm (#461)', () => {
  test('stays centred above a slide-over editing dialog, never sliding over itself', async () => {
    mountConfirm()
    await flushPromises()

    const classes = panel().className.split(' ')
    expect(classes).toEqual(expect.arrayContaining(['cwa:top-1/2', 'cwa:left-1/2', 'cwa:-translate-x-1/2', 'cwa:-translate-y-1/2', 'cwa:z-context']))
    expect(classes.some(name => name.includes('slide-over') || name.includes('right-0'))).toBe(false)
  })

  test('is an alert dialog with its title and text linked, the consequence in order, and Don\'t delete first', async () => {
    mountConfirm()
    await flushPromises()

    expect(panel().getAttribute('role')).toBe('alertdialog')
    expect(document.getElementById(panel().getAttribute('aria-labelledby')!)?.textContent?.trim()).toBe('Delete “Shaker kitchens”?')
    const description = document.getElementById(panel().getAttribute('aria-describedby')!)!
    expect([...description.querySelectorAll('[data-testid="confirm-line"]')].map(line => line.textContent?.trim())).toEqual(typed.lines.map(line => line.text))
    expect(description.querySelector('[data-testid="confirm-line"]')!.className).toContain('cwa:font-semibold')
    const buttons = [...panel().querySelectorAll('button')].map(button => button.getAttribute('data-testid'))
    expect(buttons).toEqual(['confirm-keep', 'confirm-go'])
  })

  test('the typed field takes focus, is labelled with what to type and is never pre-filled', async () => {
    mountConfirm()
    await flushPromises()

    const input = q<HTMLInputElement>('[data-testid="confirm-typed"]')
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('')
    expect(document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim()).toBe('Type the page name, “Shaker kitchens”, to confirm')
  })

  test('Delete page stays off with its reason until the name matches, then does nothing different from any button', async () => {
    const wrapper = mountConfirm()
    await flushPromises()

    expect(go().getAttribute('aria-disabled')).toBe('true')
    expect(document.getElementById(go().getAttribute('aria-describedby')!)?.textContent).toBe('Type the page name in the field above to turn this on.')
    go().click()
    await flushPromises()
    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(q('[data-testid="confirm-helper"]').textContent?.trim()).toBe('Delete page stays off until it matches.')
  })

  test('text that can no longer become the name is invalid, with aria-invalid true and the hint', async () => {
    mountConfirm()
    await flushPromises()

    await type('Sha')
    const input = q<HTMLInputElement>('[data-testid="confirm-typed"]')
    expect(input.hasAttribute('aria-invalid')).toBe(false)

    await type('Kitx')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(q('[data-testid="confirm-helper"]').textContent?.trim()).toBe('That doesn\'t match. Type Shaker kitchens.')
    expect(input.getAttribute('aria-describedby')).toBe(q('[data-testid="confirm-helper"]').id)
  })

  test('a match ignoring case and spaces turns Delete page on, says so once, and Enter confirms', async () => {
    const wrapper = mountConfirm()
    await flushPromises()

    await type('  shaker KITCHENS ')

    expect(go().hasAttribute('aria-disabled')).toBe(false)
    expect(q('[data-testid="confirm-helper"]').textContent?.trim()).toBe('Matches. Delete page is on.')
    expect(q('[data-testid="confirm-announcer"]').textContent).toBe('Matches. Delete page is on.')
    q('[data-testid="confirm-typed"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flushPromises()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  test('Enter before it matches does nothing', async () => {
    const wrapper = mountConfirm()
    await flushPromises()
    await type('Shaker')

    q('[data-testid="confirm-typed"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flushPromises()

    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  test.each([
    ['Don\'t delete', () => q<HTMLButtonElement>('[data-testid="confirm-keep"]').click()],
    ['Escape', () => panel().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))],
    ['the scrim', () => q('[data-testid="confirm-scrim"]').click()],
  ])('%s cancels, once', async (_how, cancel) => {
    const wrapper = mountConfirm()
    await flushPromises()

    cancel()
    await flushPromises()

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  test('a simple confirm has no field, focuses the safe action and confirms at once', async () => {
    const wrapper = mountConfirm({ title: 'Remove this component?', description: 'It is used in 3 places.', keep: 'Keep it', go: 'Remove' })
    await flushPromises()

    expect(document.querySelector('[data-testid="confirm-typed"]')).toBeNull()
    expect(document.activeElement).toBe(q('[data-testid="confirm-keep"]'))
    go().click()
    await flushPromises()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  test('a second action sits between the safe action and the main one, takes focus, and answers extra; the main one answers go', async () => {
    const wrapper = mountConfirm({ title: 'Delete this component?', description: 'It is used in 3 places.', keep: 'Cancel', extra: 'Remove from this location only', go: 'Delete from all 3 places' })
    await flushPromises()

    const buttons = [...panel().querySelectorAll('button')].map(button => button.getAttribute('data-testid'))
    expect(buttons).toEqual(['confirm-keep', 'confirm-extra', 'confirm-go'])
    expect(document.activeElement).toBe(q('[data-testid="confirm-extra"]'))
    q<HTMLButtonElement>('[data-testid="confirm-extra"]').click()
    await flushPromises()
    expect(wrapper.emitted('confirm')).toEqual([['extra']])
  })

  test('a third action sits after the second, keeps focus on the second, and answers alternative', async () => {
    const wrapper = mountConfirm({ title: 'Delete this component?', keep: 'Don\'t delete', extra: 'Remove from here', alternative: 'Discard unpublished changes', go: 'Delete from all 3 places' })
    await flushPromises()

    const buttons = [...panel().querySelectorAll('button')].map(button => button.textContent?.trim())
    expect(buttons).toEqual(['Don\'t delete', 'Remove from here', 'Discard unpublished changes', 'Delete from all 3 places'])
    expect(document.activeElement).toBe(q('[data-testid="confirm-extra"]'))
    q<HTMLButtonElement>('[data-testid="confirm-alternative"]').click()
    await flushPromises()
    expect(wrapper.emitted('confirm')).toEqual([['alternative']])
  })

  test('the main action answers go', async () => {
    const wrapper = mountConfirm({ title: 'Remove this component?', keep: 'Keep it', go: 'Remove' })
    await flushPromises()

    go().click()
    await flushPromises()
    expect(wrapper.emitted('confirm')).toEqual([['go']])
  })

  test('Escape answers cancel with a second action', async () => {
    const wrapper = mountConfirm({ title: 'Delete this component?', keep: 'Cancel', extra: 'Remove from this location only', go: 'Delete from all 3 places' })
    await flushPromises()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  test.each(['empty', 'wrong', 'right'] as const)('has no axe violations when the typed field is %s', async (state) => {
    mountConfirm()
    await flushPromises()
    state !== 'empty' && await type(state === 'wrong' ? 'Kitx' : 'Shaker kitchens')

    expect(await axe(document.body)).toHaveNoViolations()
  })
})

// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { CwaToastOptions } from '#cwa/admin/toaster'
import Toast from './Toast.vue'
import Toaster from './Toaster.vue'

interface ToasterApi {
  show: (options: CwaToastOptions) => void
  dismiss: (id: string) => void
}

let wrapper: VueWrapper | undefined

function mountToaster() {
  wrapper = mount(Toaster, { attachTo: document.body })
  return { wrapper, api: wrapper.vm as unknown as ToasterApi }
}

async function show(api: ToasterApi, options: CwaToastOptions) {
  api.show(options)
  await nextTick()
}

function titles(w: VueWrapper) {
  return w.findAll('[data-testid="toast-title"]').map(title => title.text())
}

function toastEl(w: VueWrapper, id: string) {
  return w.get(`[data-toast-id="${id}"]`)
}

function live(w: VueWrapper) {
  return w.get('[data-testid="toaster-live"]')
}

function rect(left: number, top: number, width: number, height: number) {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Toaster (#457)', () => {
  test('the region is fixed below the admin header, transparent and lets clicks through, while each toast takes them', async () => {
    const { wrapper, api } = mountToaster()
    await show(api, { id: 'a', tone: 'success', title: 'Published' })

    const region = wrapper.get('[data-testid="toaster"]')
    expect(region.classes()).toEqual(expect.arrayContaining(['cwa:fixed', 'cwa:z-notifications', 'cwa:pointer-events-none', 'cwa:top-20', 'cwa:right-4', 'cwa:w-[22rem]']))
    expect(region.classes().filter(c => /(^|:)(bg|p|px|py|shadow|backdrop)-/.test(c))).toEqual([])
    expect(toastEl(wrapper, 'a').classes()).toContain('cwa:pointer-events-auto')
  })

  test('on a phone the stack is full width less 0.5rem gutters, and starts below a full-screen dialog\'s header and tabs', () => {
    const { wrapper } = mountToaster()

    expect(wrapper.get('[data-testid="toaster"]').classes()).toEqual(expect.arrayContaining([
      'cwa:max-sm:left-2',
      'cwa:max-sm:right-2',
      'cwa:max-sm:w-auto',
      'cwa:max-sm:in-[.cwa-fullscreen-dialog]:top-26',
    ]))
  })

  test('the newest toast is on top, and at most 3 are shown: the oldest leaves and is closed', async () => {
    const { wrapper, api } = mountToaster()
    const onClose = vi.fn()
    await show(api, { tone: 'error', title: 'One', onClose })
    await show(api, { tone: 'error', title: 'Two' })
    await show(api, { tone: 'error', title: 'Three' })
    expect(titles(wrapper)).toEqual(['Three', 'Two', 'One'])
    expect(onClose).not.toHaveBeenCalled()

    await show(api, { tone: 'error', title: 'Four' })
    expect(titles(wrapper)).toEqual(['Four', 'Three', 'Two'])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('an unchanged upsert neither rebuilds the toast, announces it again nor restarts its time, but its newest callbacks are used', async () => {
    const { wrapper, api } = mountToaster()
    const first = vi.fn()
    const second = vi.fn()
    await show(api, { id: 'a', tone: 'success', title: 'Published', description: 'Hero', actions: [{ label: 'Undo', onClick: first }] })
    await vi.advanceTimersByTimeAsync(50)
    expect(live(wrapper).text()).toBe('Published. Hero')
    const element = toastEl(wrapper, 'a').element
    const instance = wrapper.findComponent(Toast).vm.$.uid
    live(wrapper).element.textContent = ''

    await vi.advanceTimersByTimeAsync(3000)
    await show(api, { id: 'a', tone: 'success', title: 'Published', description: 'Hero', actions: [{ label: 'Undo', onClick: second }] })
    await vi.advanceTimersByTimeAsync(50)

    expect(live(wrapper).text()).toBe('')
    expect(toastEl(wrapper, 'a').element).toBe(element)
    expect(wrapper.findComponent(Toast).vm.$.uid).toBe(instance)
    expect(wrapper.findAllComponents(Toast)).toHaveLength(1)

    await toastEl(wrapper, 'a').findAll('button').find(button => button.text() === 'Undo')!.trigger('click')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  test('an unchanged upsert keeps the toast\'s original time', async () => {
    const { wrapper, api } = mountToaster()
    await show(api, { id: 'a', tone: 'success', title: 'Published' })
    await vi.advanceTimersByTimeAsync(3000)
    await show(api, { id: 'a', tone: 'success', title: 'Published' })
    await vi.advanceTimersByTimeAsync(1000)

    expect(wrapper.find('[data-toast-id="a"]').exists()).toBe(false)
  })

  test('a changed upsert updates the toast in place, announces the new text and restarts its time for its tone', async () => {
    const { wrapper, api } = mountToaster()
    await show(api, { id: 'a', tone: 'info', title: 'Saving' })
    await show(api, { id: 'b', tone: 'info', title: 'Other' })
    const element = toastEl(wrapper, 'a').element
    await vi.advanceTimersByTimeAsync(3000)

    await show(api, { id: 'a', tone: 'warning', title: 'Still saving', description: 'Slow connection' })
    await vi.advanceTimersByTimeAsync(50)

    expect(toastEl(wrapper, 'a').element).toBe(element)
    expect(titles(wrapper)).toEqual(['Other', 'Still saving'])
    expect(live(wrapper).text()).toBe('Still saving. Slow connection')
    await vi.advanceTimersByTimeAsync(5900)
    expect(wrapper.find('[data-toast-id="a"]').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(wrapper.find('[data-toast-id="a"]').exists()).toBe(false)
  })

  test.each([
    ['success', 4000],
    ['info', 4000],
    ['warning', 6000],
  ] as const)('a %s toast goes after %i ms and is closed', async (tone, ms) => {
    const { wrapper, api } = mountToaster()
    const onClose = vi.fn()
    await show(api, { id: 'a', tone, title: 'Hello', onClose })

    await vi.advanceTimersByTimeAsync(ms - 1)
    expect(wrapper.find('[data-toast-id="a"]').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.find('[data-toast-id="a"]').exists()).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test.each([
    ['an error', { tone: 'error' } as const],
    ['a success with actions', { tone: 'success', actions: [{ label: 'Undo', onClick: () => {} }] } as const],
  ])('%s stays until dismissed', async (_name, options) => {
    const { wrapper, api } = mountToaster()
    await show(api, { id: 'a', title: 'Hello', ...options })

    await vi.advanceTimersByTimeAsync(60_000)
    expect(wrapper.find('[data-toast-id="a"]').exists()).toBe(true)
  })

  test('the pointer over a toast holds it, and it gets its full time again when the pointer leaves', async () => {
    const { wrapper, api } = mountToaster()
    await show(api, { id: 'a', tone: 'success', title: 'Published' })
    await vi.advanceTimersByTimeAsync(3000)

    await toastEl(wrapper, 'a').trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(wrapper.find('[data-toast-id="a"]').exists()).toBe(true)

    await toastEl(wrapper, 'a').trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(3999)
    expect(wrapper.find('[data-toast-id="a"]').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.find('[data-toast-id="a"]').exists()).toBe(false)
  })

  test('focus inside a toast holds it, and it gets its full time again when focus leaves', async () => {
    const { wrapper, api } = mountToaster()
    const field = document.createElement('input')
    document.body.appendChild(field)
    await show(api, { id: 'a', tone: 'success', title: 'Published' })
    await vi.advanceTimersByTimeAsync(3000)

    const dismiss = toastEl(wrapper, 'a').get('button[aria-label="Dismiss"]')
    await toastEl(wrapper, 'a').trigger('focusin', { relatedTarget: field })
    await toastEl(wrapper, 'a').trigger('focusout', { relatedTarget: dismiss.element })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(wrapper.find('[data-toast-id="a"]').exists()).toBe(true)

    await toastEl(wrapper, 'a').trigger('focusout', { relatedTarget: field })
    await vi.advanceTimersByTimeAsync(3999)
    expect(wrapper.find('[data-toast-id="a"]').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.find('[data-toast-id="a"]').exists()).toBe(false)
  })

  test('the dismiss button and dismiss(id) remove a toast and close it', async () => {
    const { wrapper, api } = mountToaster()
    const onCloseA = vi.fn()
    const onCloseB = vi.fn()
    await show(api, { id: 'a', tone: 'error', title: 'A', onClose: onCloseA })
    await show(api, { id: 'b', tone: 'error', title: 'B', onClose: onCloseB })

    await toastEl(wrapper, 'a').get('button[aria-label="Dismiss"]').trigger('click')
    expect(titles(wrapper)).toEqual(['B'])
    expect(onCloseA).toHaveBeenCalledTimes(1)

    api.dismiss('b')
    await nextTick()
    expect(titles(wrapper)).toEqual([])
    expect(onCloseB).toHaveBeenCalledTimes(1)

    api.dismiss('missing')
    expect(onCloseB).toHaveBeenCalledTimes(1)
  })

  test('an action runs, then the toast leaves and is closed', async () => {
    const { wrapper, api } = mountToaster()
    const order: string[] = []
    await show(api, {
      id: 'a',
      tone: 'error',
      title: 'Title wasn\'t saved',
      actions: [{ label: 'Retry', onClick: () => order.push('retry') }],
      onClose: () => order.push('close'),
    })

    await toastEl(wrapper, 'a').findAll('button').find(button => button.text() === 'Retry')!.trigger('click')
    expect(order).toEqual(['retry', 'close'])
    expect(wrapper.find('[data-toast-id="a"]').exists()).toBe(false)
  })

  test('dismissing returns focus to where it was before it entered the toast', async () => {
    const { wrapper, api } = mountToaster()
    const field = document.createElement('input')
    document.body.appendChild(field)
    field.focus()
    await show(api, { id: 'a', tone: 'error', title: 'Failed' })

    const dismiss = toastEl(wrapper, 'a').get('button[aria-label="Dismiss"]')
    ;(dismiss.element as HTMLElement).focus()
    await toastEl(wrapper, 'a').trigger('focusin', { relatedTarget: field })
    expect(document.activeElement).toBe(dismiss.element)

    await dismiss.trigger('click')
    expect(document.activeElement).toBe(field)
  })

  test('moving between a toast\'s own buttons keeps where focus came from', async () => {
    const { wrapper, api } = mountToaster()
    const field = document.createElement('input')
    document.body.appendChild(field)
    await show(api, { id: 'a', tone: 'error', title: 'Failed', actions: [{ label: 'Reset', onClick: () => {} }] })

    const dismiss = toastEl(wrapper, 'a').get('button[aria-label="Dismiss"]')
    const reset = toastEl(wrapper, 'a').findAll('button').find(button => button.text() === 'Reset')!
    field.focus()
    ;(dismiss.element as HTMLElement).focus()
    ;(reset.element as HTMLElement).focus()
    expect(document.activeElement).toBe(reset.element)

    await reset.trigger('click')
    expect(document.activeElement).toBe(field)
  })

  test('after an action focus stays where the action put it, or returns to where it was', async () => {
    const { wrapper, api } = mountToaster()
    const field = document.createElement('input')
    const status = document.createElement('button')
    document.body.append(field, status)
    await show(api, {
      id: 'a',
      tone: 'error',
      title: 'Failed',
      actions: [{ label: 'Retry', onClick: () => status.focus() }, { label: 'Reset', onClick: () => {} }],
    })
    await show(api, { id: 'b', tone: 'error', title: 'Failed', actions: [{ label: 'Reset', onClick: () => {} }] })

    const retry = toastEl(wrapper, 'a').findAll('button').find(button => button.text() === 'Retry')!
    ;(retry.element as HTMLElement).focus()
    await toastEl(wrapper, 'a').trigger('focusin', { relatedTarget: field })
    await retry.trigger('click')
    expect(document.activeElement).toBe(status)

    const reset = toastEl(wrapper, 'b').findAll('button').find(button => button.text() === 'Reset')!
    ;(reset.element as HTMLElement).focus()
    await toastEl(wrapper, 'b').trigger('focusin', { relatedTarget: field })
    await reset.trigger('click')
    expect(document.activeElement).toBe(field)
  })

  test('a toast that goes by itself while focused also returns focus', async () => {
    const { wrapper, api } = mountToaster()
    const field = document.createElement('input')
    document.body.appendChild(field)
    await show(api, { id: 'a', tone: 'success', title: 'Published', actions: [] })
    const dismiss = toastEl(wrapper, 'a').get('button[aria-label="Dismiss"]')
    ;(dismiss.element as HTMLElement).focus()
    await toastEl(wrapper, 'a').trigger('focusin', { relatedTarget: field })
    await toastEl(wrapper, 'a').trigger('focusout', { relatedTarget: field })

    api.dismiss('a')
    await nextTick()
    expect(document.activeElement).toBe(field)
  })

  test('there is one polite announcement for the region, never assertive, replaced by the newest toast', async () => {
    const { wrapper, api } = mountToaster()

    expect(wrapper.findAll('[aria-live]')).toHaveLength(1)
    expect(live(wrapper).attributes('aria-live')).toBe('polite')
    expect(live(wrapper).attributes('aria-atomic')).toBe('true')
    expect(live(wrapper).classes()).toContain('cwa:sr-only')

    await show(api, { tone: 'success', title: 'Published', description: 'Hero section on Kitchens.' })
    await show(api, { tone: 'error', title: 'Title wasn\'t saved' })
    await vi.advanceTimersByTimeAsync(50)
    expect(live(wrapper).text()).toBe('Title wasn\'t saved')
    expect(wrapper.findAll('[aria-live]')).toHaveLength(1)
  })

  test('the stack turns see-through and lets clicks through while it entirely covers the focused element, and returns when focus moves on', async () => {
    const { wrapper, api } = mountToaster()
    await show(api, { id: 'a', tone: 'error', title: 'Failed' })
    vi.spyOn(toastEl(wrapper, 'a').element, 'getBoundingClientRect').mockReturnValue(rect(900, 80, 352, 100))
    const region = () => wrapper.get('[data-testid="toaster"]')

    const hidden = document.createElement('button')
    const partly = document.createElement('button')
    const elsewhere = document.createElement('button')
    document.body.append(hidden, partly, elsewhere)
    vi.spyOn(hidden, 'getBoundingClientRect').mockReturnValue(rect(950, 100, 80, 24))
    vi.spyOn(partly, 'getBoundingClientRect').mockReturnValue(rect(880, 100, 80, 24))
    vi.spyOn(elsewhere, 'getBoundingClientRect').mockReturnValue(rect(10, 10, 80, 24))

    expect(region().classes()).toEqual(expect.arrayContaining(['cwa:transition-opacity', 'cwa:duration-(--cwa-duration-fast)', 'cwa:reduced-motion:transition-none']))

    hidden.focus()
    await nextTick()
    expect(region().classes()).toContain('cwa:opacity-15')
    expect(toastEl(wrapper, 'a').classes()).toContain('cwa:pointer-events-none')
    expect(toastEl(wrapper, 'a').classes()).not.toContain('cwa:pointer-events-auto')
    expect(document.activeElement).toBe(hidden)

    partly.focus()
    await nextTick()
    expect(region().classes()).not.toContain('cwa:opacity-15')
    expect(toastEl(wrapper, 'a').classes()).toContain('cwa:pointer-events-auto')

    hidden.focus()
    await nextTick()
    elsewhere.focus()
    await nextTick()
    expect(region().classes()).not.toContain('cwa:opacity-15')
  })

  test('the stack turns see-through when a new toast entirely covers the element already focused, and stops once no toast does', async () => {
    const { wrapper, api } = mountToaster()
    const hidden = document.createElement('button')
    document.body.append(hidden)
    vi.spyOn(hidden, 'getBoundingClientRect').mockReturnValue(rect(950, 100, 80, 24))
    hidden.focus()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(900, 80, 352, 100))

    await show(api, { id: 'a', tone: 'error', title: 'Failed' })
    await nextTick()
    expect(wrapper.get('[data-testid="toaster"]').classes()).toContain('cwa:opacity-15')

    api.dismiss('a')
    await nextTick()
    await nextTick()
    expect(wrapper.get('[data-testid="toaster"]').classes()).not.toContain('cwa:opacity-15')
  })

  test('focus moving into a toast never turns the stack see-through', async () => {
    const { wrapper, api } = mountToaster()
    await show(api, { id: 'a', tone: 'error', title: 'Failed' })
    vi.spyOn(toastEl(wrapper, 'a').element, 'getBoundingClientRect').mockReturnValue(rect(900, 80, 352, 100))
    const dismiss = toastEl(wrapper, 'a').get('button[aria-label="Dismiss"]').element as HTMLElement
    vi.spyOn(dismiss, 'getBoundingClientRect').mockReturnValue(rect(1210, 88, 32, 32))

    dismiss.focus()
    await nextTick()
    expect(wrapper.get('[data-testid="toaster"]').classes()).not.toContain('cwa:opacity-15')
  })

  test('an element with no size is never treated as hidden', async () => {
    const { wrapper, api } = mountToaster()
    await show(api, { id: 'a', tone: 'error', title: 'Failed' })
    vi.spyOn(toastEl(wrapper, 'a').element, 'getBoundingClientRect').mockReturnValue(rect(900, 80, 352, 100))
    const empty = document.createElement('button')
    document.body.append(empty)
    vi.spyOn(empty, 'getBoundingClientRect').mockReturnValue(rect(950, 100, 0, 0))

    empty.focus()
    await nextTick()
    expect(wrapper.get('[data-testid="toaster"]').classes()).not.toContain('cwa:opacity-15')
  })
})

// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import LinkPopover from './LinkPopover.vue'
import ResourceSearch from './ResourceSearch.vue'

const cwa = vi.hoisted(() => ({
  fetch: vi.fn(() => ({ response: Promise.resolve({ _data: { member: [{ '@id': '/_/routes/kitchens', 'path': '/kitchens' }, { '@id': '/_/routes/about', 'path': '/about' }], totalItems: 2 } }) })),
  fetchResource: vi.fn(),
  resources: { getResource: () => ({ value: undefined }) },
}))
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => cwa }))

enableAutoUnmount(afterEach)

async function openPopover(props: Record<string, unknown> = {}) {
  const onApply = vi.fn()
  const onRemove = vi.fn()
  const onUpdateOpen = vi.fn()
  const wrapper = mount(LinkPopover, {
    props: { 'open': true, 'at': { x: 200, y: 120 }, onApply, onRemove, 'onUpdate:open': onUpdateOpen, ...props },
    attachTo: document.body,
  })
  await flushPromises()
  const panel = document.querySelector<HTMLElement>('[data-testid="link-popover"]')!
  const url = panel.querySelector<HTMLInputElement>('input[type="url"]')!
  const button = (name: string) => [...panel.querySelectorAll<HTMLButtonElement>('button')].find(candidate => candidate.textContent?.trim() === name)
  return { wrapper, panel, url, button, onApply, onRemove, onUpdateOpen }
}

function type(input: HTMLInputElement, text: string) {
  input.value = text
  input.dispatchEvent(new Event('input'))
}

describe('CwaUiLinkPopover (#461)', () => {
  test('is a dialog named Link, with focus in the URL field holding the current link', async () => {
    const { panel, url } = await openPopover({ href: '/kitchens' })

    expect(panel.getAttribute('role')).toBe('dialog')
    expect(panel.getAttribute('aria-label')).toBe('Link')
    expect(url.value).toBe('/kitchens')
    expect(document.activeElement).toBe(url)
  })

  test('Apply sends the URL and whether it opens in a new tab, and closes', async () => {
    const { url, panel, button, onApply, onUpdateOpen } = await openPopover()
    type(url, 'https://example.com/a')
    panel.querySelector<HTMLButtonElement>('[role="switch"]')!.click()
    await flushPromises()

    button('Apply')!.click()
    await flushPromises()

    expect(onApply).toHaveBeenCalledWith({ href: 'https://example.com/a', newTab: true })
    expect(onUpdateOpen).toHaveBeenCalledWith(false)
  })

  test('Enter in the URL applies it', async () => {
    const { url, onApply } = await openPopover({ newTab: true })
    type(url, '/about')
    url.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await flushPromises()

    expect(onApply).toHaveBeenCalledWith({ href: '/about', newTab: true })
  })

  test('a URL that is neither /path nor http(s) is not applied and says why', async () => {
    const { url, panel, button, onApply } = await openPopover()
    type(url, 'example')
    await flushPromises()

    expect(button('Apply')!.getAttribute('aria-disabled') === 'true' || button('Apply')!.disabled).toBe(true)
    button('Apply')!.click()
    url.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(onApply).not.toHaveBeenCalled()
    expect(panel.textContent).toContain('Use /path or https://…')
  })

  test('choosing a page from the search puts its path in the URL, from the results or by fetching the route', async () => {
    const { wrapper, url } = await openPopover()
    const search = wrapper.findComponent(ResourceSearch)
    expect(search.props('endpoint')).toBe('/_/routes')

    const page = await search.props('load')('kit', 1)
    expect(page.items.map((route: { path: string }) => route.path)).toEqual(['/kitchens', '/about'])
    expect(cwa.fetch).toHaveBeenCalledWith({ path: '/_/routes?perPage=20&page=1&search=kit&path=kit' })
    search.vm.$emit('update:modelValue', '/_/routes/about')
    await flushPromises()
    expect(url.value).toBe('/about')
    expect(cwa.fetchResource).not.toHaveBeenCalled()

    cwa.fetchResource.mockResolvedValueOnce({ '@id': '/_/routes/blog', 'path': '/blog' } as never)
    search.vm.$emit('update:modelValue', '/_/routes/blog')
    await flushPromises()
    expect(cwa.fetchResource).toHaveBeenCalledTimes(1)
    expect(cwa.fetchResource).toHaveBeenCalledWith({ path: '/_/routes/blog', shallowFetch: true })
    expect(url.value).toBe('/blog')
  })

  test('Remove link is offered only for an existing link, and removes it', async () => {
    const without = await openPopover()
    expect(without.button('Remove link')).toBeUndefined()
    without.wrapper.unmount()
    document.body.innerHTML = ''

    const { button, onRemove } = await openPopover({ href: '/kitchens' })
    button('Remove link')!.click()
    await flushPromises()
    expect(onRemove).toHaveBeenCalled()
  })

  test('focus moving out of it, as an editor taking focus back does, leaves it open; Escape closes it', async () => {
    const { panel, onUpdateOpen } = await openPopover()
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    outside.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await flushPromises()
    expect(onUpdateOpen).not.toHaveBeenCalled()

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(onUpdateOpen).toHaveBeenCalledWith(false)
    outside.remove()
  })

  test('has no axe violations', async () => {
    const { panel } = await openPopover({ href: '/kitchens' })

    expect(await axe(panel)).toHaveNoViolations()
  })
})

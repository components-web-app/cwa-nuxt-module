// @vitest-environment nuxt
import { afterEach, describe, test, expect } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import RoutesTabRedirects from './RoutesTabRedirects.vue'
import CwaUiInput from '#cwa/templates/components/ui/Input.vue'
import { axe } from '../../../../../../test/utils/axe'

enableAutoUnmount(afterEach)

const redirects = [
  { '@id': '/_/routes//shaker', 'path': '/shaker', 'redirectedFrom': [{ '@id': '/_/routes//shaker-style', 'path': '/shaker-style', 'redirectedFrom': [] }] },
  { '@id': '/_/routes//old-kitchens', 'path': '/old-kitchens', 'redirectedFrom': [] },
]

function mountRedirects(props: Record<string, unknown> = {}) {
  return mount(RoutesTabRedirects, {
    props: { path: '/kitchens/shaker', redirects, ...props } as any,
    attachTo: document.body,
  })
}

const rowTexts = () => [...document.querySelectorAll('[role="row"]')].map(row => row.querySelector('[data-testid="tree-label"]')!.textContent!.replace(/\s+/g, ' ').trim())

describe('RoutesTabRedirects', () => {
  test('the old address explains itself behind ⓘ, not as a line under the field (#461)', () => {
    const input = mountRedirects({ form: true, modelValue: '' }).findComponent(CwaUiInput)
    expect(input.props('info')).toBe('A path on this site, starting with /.')
    expect(input.props('description')).toBeUndefined()
  })

  test('an old address typed with spaces is previewed with a hyphen for each run, becomes that in the field once it is left, and one with ? or # says why it can\'t be added', async () => {
    const wrapper = mountRedirects({ 'form': true, 'modelValue': '/old  shaker ', 'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }) })
    await flushPromises()
    expect(wrapper.find('[data-testid="route-redirect-preview"] .cwa\\:font-mono').text()).toBe('/old-shaker')

    await wrapper.findComponent(CwaUiInput).vm.$emit('focusout')
    await flushPromises()
    expect(wrapper.props('modelValue')).toBe('/old-shaker')

    await wrapper.setProps({ modelValue: '/old?shaker' })
    expect(wrapper.findComponent(CwaUiInput).props('invalid')).toBe('A path can\'t contain ? or #. They start a query or a page anchor.')
    await wrapper.setProps({ error: 'Start with /, for example /old-kitchens.' })
    expect(wrapper.findComponent(CwaUiInput).props('invalid')).toBe('Start with /, for example /old-kitchens.')
  })

  test('lists old addresses as a tree, each saying where it sends visitors, nested under the one it redirects to', async () => {
    const wrapper = mountRedirects()
    await flushPromises()
    expect(rowTexts()).toEqual([
      '/shaker → redirects to this page',
      '/shaker-style → redirects to /shaker',
      '/old-kitchens → redirects to this page',
    ])
    expect(document.querySelector('[role="treegrid"]')!.getAttribute('aria-label')).toBe('Redirected from')
    expect(wrapper.find('[data-testid="route-redirect-add"]').attributes('aria-label')).toBe('Add an old address')
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test('each old address has its own delete, named for it, which hands the redirect over', async () => {
    const wrapper = mountRedirects()
    await flushPromises()
    const button = [...document.querySelectorAll<HTMLButtonElement>('[data-testid="tree-action"]')][1]!
    expect(button.getAttribute('aria-label')).toBe('Delete the redirect from /shaker-style')
    button.click()
    expect(wrapper.emitted('delete')).toEqual([[redirects[0]!.redirectedFrom[0]]])
  })

  test('nothing is deleted while another change is being saved', async () => {
    const wrapper = mountRedirects({ busy: true })
    await flushPromises()
    document.querySelector<HTMLButtonElement>('[data-testid="tree-action"]')!.click()
    expect(wrapper.emitted('delete')).toBeUndefined()
    expect(wrapper.find('[data-testid="route-redirect-add"]').attributes('aria-disabled')).toBe('true')
  })

  test('says so when no old addresses send visitors here', async () => {
    mountRedirects({ redirects: [] })
    await flushPromises()
    expect(document.querySelector('[data-testid="tree-empty"]')!.textContent!.trim()).toBe('No old addresses send visitors here.')
  })

  test('Add opens the form', async () => {
    const wrapper = mountRedirects()
    await wrapper.find('[data-testid="route-redirect-add"]').trigger('click')
    expect(wrapper.emitted('start')).toHaveLength(1)
  })

  test('the form previews the redirect as it is typed and shows a check that failed', async () => {
    const wrapper = mountRedirects({ form: true, modelValue: '' })
    expect(wrapper.find('[data-testid="route-redirect-preview"]').exists()).toBe(false)
    await wrapper.setProps({ modelValue: '/old-shaker' })
    expect(wrapper.find('[data-testid="route-redirect-preview"]').text().replace(/\s+/g, ' ')).toBe('/old-shaker → will redirect to this page (/kitchens/shaker)')

    await wrapper.setProps({ error: 'Start with / and leave out spaces, for example /old-kitchens.' })
    expect(wrapper.find('[data-testid="input-invalid"]').text()).toContain('Start with /')
    expect(wrapper.find('input').attributes('aria-invalid')).toBe('true')
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })
})

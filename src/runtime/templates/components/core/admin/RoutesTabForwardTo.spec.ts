// @vitest-environment nuxt
import { afterEach, describe, test, expect } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import RoutesTabForwardTo from './RoutesTabForwardTo.vue'
import CwaUiResourceSearch from '#cwa/templates/components/ui/ResourceSearch.vue'
import { axe } from '../../../../../../test/utils/axe'

enableAutoUnmount(afterEach)

function mountForward(props: Record<string, unknown> = {}) {
  return mount(RoutesTabForwardTo, {
    props: { path: '/kitchens/shaker', currentRouteIri: '/_/routes//kitchens/shaker', ...props },
    global: { stubs: { CwaUiResourceSearch: true } },
    attachTo: document.body,
  })
}

const text = (wrapper: ReturnType<typeof mountForward>, selector: string) => wrapper.find(selector).text().replace(/\s+/g, ' ').trim()

describe('RoutesTabForwardTo', () => {
  test('the search explains itself behind ⓘ, not as a line under the field (#461)', () => {
    const search = mountForward({ form: true }).findComponent(CwaUiResourceSearch)
    expect(search.props('info')).toBe('Any page on this site.')
    expect(search.props('description')).toBeUndefined()
  })

  test('when not redirecting it says visitors see this page and offers Redirect to another page', async () => {
    const wrapper = mountForward()
    expect(text(wrapper, '[data-testid="route-forward-off"]')).toBe('Not redirecting. Visitors to /kitchens/shaker see this page.')
    await wrapper.find('[data-set-forward]').trigger('click')
    expect(wrapper.emitted('start')).toHaveLength(1)
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test('when redirecting it shows the direction, read as "redirects to", with Change and Remove', async () => {
    const wrapper = mountForward({ forwardToPath: '/kitchens/range' })
    expect(text(wrapper, '[data-testid="route-forward-direction"]')).toBe('/kitchens/shaker → redirects to /kitchens/range')
    expect(wrapper.find('[data-testid="route-forward-direction"] [aria-hidden="true"]').text()).toBe('→')
    await wrapper.find('[data-edit-forward]').trigger('click')
    await wrapper.find('[data-remove-forward]').trigger('click')
    expect(wrapper.emitted('start')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  test('while removing, Remove shows it and Change waits', () => {
    const wrapper = mountForward({ forwardToPath: '/kitchens/range', removing: true })
    expect(wrapper.find('[data-remove-forward]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-edit-forward]').attributes('aria-disabled')).toBe('true')
  })

  test('the form searches routes by path, sending the legacy path filter too until every app has migrated (#328), and warns that visitors will no longer see this page once one is chosen', async () => {
    const wrapper = mountForward({ form: true })
    const search = wrapper.findComponent(CwaUiResourceSearch)
    expect(search.props('endpoint')).toBe('/_/routes')
    expect(search.props('label')).toBe('Send visitors to')
    expect(search.props('searchParams')).toEqual(['search', 'path'])
    expect((search.props('labelOf') as (resource: Record<string, string>) => string)({ '@id': '/_/routes//a', 'path': '/a' })).toBe('/a')
    expect(wrapper.find('[data-testid="route-forward-warning"]').exists()).toBe(false)

    await wrapper.setProps({ modelValue: '/_/routes//kitchens/range', pickedPath: '/kitchens/range' })
    expect(text(wrapper, '[data-testid="route-forward-warning"]')).toContain('Visitors to /kitchens/shaker will be sent to /kitchens/range.')
  })

  test('says a route cannot redirect to itself', async () => {
    const wrapper = mountForward({ form: true, modelValue: '/_/routes//kitchens/shaker' })
    await flushPromises()
    expect(wrapper.find('[data-testid="route-forward-self"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="route-forward-warning"]').exists()).toBe(false)
  })

  test('shows the outcome of a change with a tick', () => {
    const wrapper = mountForward({ status: 'Visitors to /kitchens/shaker are now sent to /kitchens/range.' })
    expect(wrapper.find('[data-testid="routes-status"]').text()).toBe('Visitors to /kitchens/shaker are now sent to /kitchens/range.')
  })
})

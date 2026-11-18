// @vitest-environment nuxt
import { afterEach, describe, test, expect } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import RoutesTabChildRoutes from './RoutesTabChildRoutes.vue'
import CwaUiTree from '#cwa/templates/components/ui/Tree.vue'
import type { TreeNode } from '#cwa/templates/components/ui/Tree.vue'
import type { MenuItem } from '#cwa/templates/components/core/ui/menu-entries'
import { axe } from '../../../../../../test/utils/axe'

enableAutoUnmount(afterEach)

const children = [
  { route: '/_/routes//kitchens/shaker/painted', path: '/kitchens/shaker/painted', children: [{ route: '/_/routes//kitchens/shaker/painted/blue', path: '/kitchens/shaker/painted/blue', children: [] }] },
  { route: '/_/routes//kitchens/shaker/oak', path: '/kitchens/shaker/oak', children: [] },
]

const details = {
  '/_/routes//kitchens/shaker/painted': { state: 'loaded', publication: { liveAt: '2020-01-01T00:00:00Z', effectiveLiveAt: '2020-01-01T00:00:00Z' }, page: '/_/pages/painted' },
  '/_/routes//kitchens/shaker/oak': { state: 'loaded', publication: { liveAt: null, effectiveLiveAt: null } },
}

function mountChildren(props: Record<string, unknown> = {}) {
  return mount(RoutesTabChildRoutes, { props: { children, details, ...props }, attachTo: document.body })
}

function menuOf(wrapper: ReturnType<typeof mountChildren>, key: string) {
  const actions = wrapper.findComponent(CwaUiTree).props('actions') as (node: TreeNode) => { label: string, menu: MenuItem[] }[]
  return actions({ key, label: key.replace('/_/routes/', '') })[0]!
}

describe('RoutesTabChildRoutes', () => {
  test('is a tree of the nested routes with the status badges of those loaded', async () => {
    const wrapper = mountChildren()
    await flushPromises()
    const rows = [...document.querySelectorAll('[role="row"]')]
    expect(rows.map(row => row.getAttribute('aria-level'))).toEqual(['1', '2', '1'])
    expect(rows.map(row => row.querySelector('[data-route-publication]')?.textContent?.trim())).toEqual(['Live', undefined, 'Not live'])
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test('each row has a ⋮ named for it with Edit settings and Go to page', async () => {
    const wrapper = mountChildren()
    const menu = menuOf(wrapper, '/_/routes//kitchens/shaker/painted')
    expect(menu.label).toBe('More actions for /kitchens/shaker/painted')
    expect(menu.menu.map(item => item.label)).toEqual(['Edit settings', 'Go to page'])

    menu.menu[0]!.onSelect!()
    menu.menu[1]!.onSelect!()
    expect(wrapper.emitted('edit')).toEqual([['/_/pages/painted']])
    expect(wrapper.emitted('go')).toEqual([['/kitchens/shaker/painted']])
  })

  test.each([
    ['still loading', { '/_/routes//kitchens/shaker/oak': { state: 'loading' } }, 'Still loading this page.'],
    ['not asked for yet', {}, 'Still loading this page.'],
    ['loaded with no page', details, 'This route has no page.'],
  ])('Edit settings is off for a route %s, saying why', (_, given, reason) => {
    const wrapper = mountChildren({ details: given })
    const menu = menuOf(wrapper, '/_/routes//kitchens/shaker/oak')
    expect(menu.menu.map(item => item.label)).toEqual(['Edit settings', 'Go to page'])
    expect(menu.menu[0]!.disabled).toBe(true)
    expect(menu.menu[0]!.disabledReason).toBe(reason)
    menu.menu[0]!.onSelect!()
    expect(wrapper.emitted('edit')).toBeUndefined()
  })

  test('a route that failed to load says so on its row and offers Retry loading, which asks for it again', async () => {
    const wrapper = mountChildren({ details: { ...details, '/_/routes//kitchens/shaker/oak': { state: 'failed' } } })
    await flushPromises()
    const menu = menuOf(wrapper, '/_/routes//kitchens/shaker/oak')

    expect(menu.menu.map(item => item.label)).toEqual(['Edit settings', 'Retry loading', 'Go to page'])
    expect(menu.menu[0]!.disabledReason).toBe('This route didn\'t load. Retry to load it again.')
    expect(document.querySelector('[data-testid="route-child-failed"]')!.textContent!.trim()).toBe('Didn\'t load')
    menu.menu[1]!.onSelect!()
    expect(wrapper.emitted('retry')).toEqual([['/_/routes//kitchens/shaker/oak']])
  })

  test('tells which routes are shown, so only those are loaded', async () => {
    const wrapper = mountChildren()
    await flushPromises()
    expect(wrapper.emitted('shown')![0]).toEqual([['/_/routes//kitchens/shaker/painted', '/_/routes//kitchens/shaker/painted/blue', '/_/routes//kitchens/shaker/oak']])
  })

  test('says so when no page is nested under this one', async () => {
    mountChildren({ children: [] })
    await flushPromises()
    expect(document.querySelector('[data-testid="tree-empty"]')!.textContent!.trim()).toBe('No pages are nested under this one.')
  })
})

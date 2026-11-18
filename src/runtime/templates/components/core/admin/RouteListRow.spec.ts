// @vitest-environment nuxt
import { describe, test, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RouteListRow from './RouteListRow.vue'
import { formatDateTime } from '#cwa/resources/date-time-input'

function mountRow(data: Record<string, any> = {}, associatedResources: Record<string, any> | undefined = { page: 'My Page' }, linkFn = vi.fn((iri: string) => `/_cwa/routes/${encodeURIComponent(iri)}`)) {
  return mountSuspended(RouteListRow, {
    props: {
      data: {
        '@id': '/_/routes//topic-1',
        '@type': 'Route',
        'path': '/topic-1',
        'page': '/_/pages/abc',
        ...data,
      },
      linkFn,
      associatedResources,
    } as any,
  })
}

const publication = async (data: Record<string, any>) => (await mountRow(data)).find('[data-route-publication]').text()

describe('RouteListRow', () => {
  describe('publication state', () => {
    test('answers why a route is missing from the site when it has no go-live date', async () => {
      expect(await publication({ liveAt: undefined })).toContain('Not live')
    })

    test('shows when a scheduled route goes live', async () => {
      const liveAt = '2999-01-01T09:00:00Z'
      const text = await publication({ liveAt, _metadata: { persisted: true, effectiveLiveAt: liveAt } })
      expect(text).toContain('Scheduled')
      expect(text).toContain(formatDateTime(liveAt))
    })

    test('shows a route with a past go-live date as live', async () => {
      const liveAt = '2020-01-01T00:00:00+00:00'
      expect(await publication({ liveAt, _metadata: { persisted: true, effectiveLiveAt: liveAt } })).toContain('Live')
    })

    test('lists a live child route whose parent goes live next week as inheriting the parent\'s schedule', async () => {
      const text = await publication({ liveAt: '2020-01-01T00:00:00+00:00', _metadata: { persisted: true, effectiveLiveAt: '2999-01-01T09:00:00Z' } })
      expect(text).toBe(`Inherited scheduled · ${formatDateTime('2999-01-01T09:00:00Z')}`)
    })

    test('reports a live route the API resolved no effective date for as inheriting not live, as the Routes tab does', async () => {
      expect(await publication({ liveAt: '2020-01-01T00:00:00+00:00', _metadata: { persisted: true } })).toBe('Inherited not live')
    })
  })

  describe('the row (#461)', () => {
    test('a page\'s route opens the page\'s settings on its Routes tab, and names the page', async () => {
      const linkFn = vi.fn((iri: string) => `/_cwa/routes/${encodeURIComponent(iri)}`)
      const wrapper = await mountRow({}, { page: 'My Page' }, linkFn)

      expect(linkFn).toHaveBeenCalledWith('/_/pages/abc', '_cwa-routes', '#routes')
      expect(wrapper.get('[data-testid="list-row-link"]').text()).toBe('/topic-1')
      expect(wrapper.get('[data-testid="list-row-sub"]').text()).toBe('Page: My Page')
    })

    test('a page\'s route offers Edit, opening the page\'s settings, and View, going to the route on the site, named by the path', async () => {
      const wrapper = await mountRow()

      expect(wrapper.get('[data-testid="list-row-edit"]').attributes()).toMatchObject({ 'href': '/_cwa/routes/%2F_%2Fpages%2Fabc', 'aria-label': 'Edit /topic-1' })
      expect(wrapper.get('[data-testid="list-row-view"]').attributes()).toMatchObject({ 'href': '/topic-1', 'aria-label': 'View /topic-1' })
    })

    test('a page data\'s route offers View too', async () => {
      const wrapper = await mountRow({ page: undefined, pageData: '/page_data/1' }, { pageData: 'An article' })

      expect(wrapper.get('[data-testid="list-row-view"]').attributes('href')).toBe('/topic-1')
    })

    test('a page data\'s route opens the page data\'s settings', async () => {
      const linkFn = vi.fn(() => '/x')
      const wrapper = await mountRow({ page: undefined, pageData: '/page_data/1' }, { pageData: 'An article', pageDataType: 'BlogArticleData' }, linkFn)

      expect(linkFn).toHaveBeenCalledWith('/page_data/1', '_cwa-routes', '#routes')
      expect(wrapper.get('[data-testid="list-row-sub"]').text()).toBe('BlogArticleData: An article')
    })

    test('a page data class sent with its namespace is named by its class alone', async () => {
      const wrapper = await mountRow({ page: undefined, pageData: '/page_data/1' }, { pageData: 'An article', pageDataType: 'App\\Entity\\BlogArticleData' })

      expect(wrapper.get('[data-testid="list-row-sub"]').text()).toBe('BlogArticleData: An article')
    })

    test('a redirect says where it goes, has nothing to open and cannot be deleted from the list', async () => {
      const wrapper = await mountRow({ page: undefined, redirect: '/_/routes//new' }, { redirect: '/new' })

      expect(wrapper.find('[data-testid="list-row-link"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="list-row-edit"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="list-row-view"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="list-row-sub"]').text()).toBe('Redirects to /new')
      expect(wrapper.find('[data-testid="route-delete"]').exists()).toBe(false)
    })

    test('a route nothing uses says it can be deleted, with a delete button named by its path', async () => {
      const wrapper = await mountRow({ page: undefined }, {})

      expect(wrapper.get('[data-testid="list-row-sub"]').text()).toBe('Nothing uses this route, so it can be deleted.')
      expect(wrapper.find('[data-testid="list-row-view"]').exists()).toBe(false)
      const remove = wrapper.get('[data-testid="list-row-actions"] [data-testid="route-delete"]')
      expect(remove.attributes('aria-label')).toBe('Delete the route /topic-1')
      expect(remove.get('svg').classes()).toContain('cwa:size-4')
      await remove.trigger('click')
      expect(wrapper.emitted('delete')).toEqual([['/_/routes//topic-1']])
    })

    test('a used route has no delete button', async () => {
      expect((await mountRow()).find('[data-testid="route-delete"]').exists()).toBe(false)
    })
  })
})

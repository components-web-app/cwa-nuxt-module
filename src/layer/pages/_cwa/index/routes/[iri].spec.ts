// @vitest-environment nuxt
import { describe, test, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RouteItemPage from './[iri].vue'

const { mockRoute } = vi.hoisted(() => ({ mockRoute: { params: { iri: '' } as Record<string, string> } }))

vi.mock('vue-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue-router')>()
  return { ...mod, useRoute: () => mockRoute }
})

function mountWith(iri: string) {
  mockRoute.params = { iri }
  return mount(RouteItemPage, {
    global: {
      stubs: {
        PageResourceAdminModal: { name: 'PageResourceAdminModal', props: ['resourceType'], template: '<div />' },
      },
    },
  })
}

describe('routes/[iri] page', () => {
  test('a page data route opens the modal without a fixed type, so its concrete @type (e.g. BlogArticleData) does not close it', () => {
    const wrapper = mountWith('/page_data/blog_article_datas/uuid')
    expect(wrapper.findComponent({ name: 'PageResourceAdminModal' }).props('resourceType')).toBeUndefined()
  })

  test('a page route still requires the loaded resource to be a Page', () => {
    const wrapper = mountWith('/_/pages/uuid')
    expect(wrapper.findComponent({ name: 'PageResourceAdminModal' }).props('resourceType')).toBe('Page')
  })
})

// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CollectionSearch from './CollectionSearch.vue'

const router = vi.hoisted(() => ({ replace: vi.fn() }))

vi.mock('vue-router', async () => {
  const { reactive } = await import('vue')
  const query = reactive({})
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return { ...actual, useRoute: () => ({ query }), useRouter: () => router }
})

describe('CollectionSearch: the blog articles search box', () => {
  test('typing sends the search as `search`, the only text filter the API\'s page data collection reads (api-components-bundle#289), so the list reloads with matches', async () => {
    const wrapper = mount(CollectionSearch)

    await wrapper.find('input[name=search]').setValue('spring')

    await vi.waitFor(() => expect(router.replace).toHaveBeenCalled(), { timeout: 1000 })
    expect(router.replace.mock.calls.at(-1)![0].query).toEqual({ search: 'spring' })
  })
})

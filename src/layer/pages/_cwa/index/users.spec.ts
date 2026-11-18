// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UsersListPage from './users.vue'
import ListRow from '#cwa/templates/components/core/admin/ListRow.vue'

vi.mock('#cwa-layer/_composables/useListPage', () => ({
  useListPage: () => ({ goToAdd: vi.fn(), triggerReload: vi.fn(), computedItemLink: vi.fn(() => '/_cwa/users/x') }),
}))

describe('/_cwa/users', () => {
  test('opens a user in the kit dialog without the old overlay around it', () => {
    const wrapper = mount(UsersListPage, { shallow: true })

    expect(wrapper.findComponent({ name: 'ResourceModalOverlay' }).props('overlay')).toBe(false)
  })

  test('a user row offers Edit only, as a user has no page to view', () => {
    const item = { '@id': '/users/1', 'username': 'admin', 'roles': [], 'enabled': true }
    const wrapper = mount(UsersListPage, {
      shallow: true,
      global: {
        stubs: {
          ListContent: {
            name: 'ListContent',
            props: ['fetchUrl', 'searchFields', 'columns'],
            setup: () => ({ item }),
            template: '<div><slot name="item" :data="item" /></div>',
          },
        },
      },
    })

    expect(wrapper.findComponent(ListRow).props()).toMatchObject({ actions: true, to: '/_cwa/users/x', view: undefined })
    expect(wrapper.findComponent({ name: 'ListContent' }).props('columns').at(-1)).toMatchObject({ label: 'Actions', labelHidden: true })
  })
})

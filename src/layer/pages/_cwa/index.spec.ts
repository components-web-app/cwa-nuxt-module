// @vitest-environment nuxt
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import AdminWrapper from './index.vue'

enableAutoUnmount(afterEach)

function mountWrapper() {
  return mount(AdminWrapper, {
    global: {
      stubs: {
        NuxtPage: { template: '<main data-testid="admin-page" />' },
        BottomBar: { template: '<nav data-testid="admin-bottom-bar" />' },
        CwaLogo: true,
      },
    },
  })
}

describe('the /_cwa wrapper (#518)', () => {
  test('mounts the phone bottom bar around every admin page', () => {
    const wrapper = mountWrapper()

    expect(wrapper.find('[data-testid="admin-page"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="admin-bottom-bar"]').exists()).toBe(true)
  })

  test('below sm, leaves room at the bottom for the bar and the home indicator, so no content hides behind it', () => {
    const wrapper = mountWrapper()

    expect(wrapper.classes()).toContain('cwa:max-sm:pb-[calc(var(--cwa-spacing-hit)+1px+env(safe-area-inset-bottom))]')
  })
})

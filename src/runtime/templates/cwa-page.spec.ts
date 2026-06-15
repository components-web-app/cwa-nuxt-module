// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CwaPage from './cwa-page.vue'
import * as cwaComposable from '#cwa/composables/cwa'

describe('CWA page', () => {
  function createWrapper() {
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
      resources: {},
      siteConfig: {
        config: {
          fallbackTitle: true,
        },
      },
    }))

    return mount(CwaPage, {
      shallow: true,
    })
  }

  test('should render CwaPage component', () => {
    const wrapper = createWrapper()
    expect(wrapper.findComponent({ name: 'CwaPage' }).exists()).toBe(true)
  })

  test('provides cwa-page-depth as 0', () => {
    const wrapper = createWrapper()
    // @ts-expect-error accessing internal provides
    expect(wrapper.vm.$.provides['cwa-page-depth']).toBe(0)
  })

  describe('snapshots', () => {
    test('renders CwaPage inside the page wrapper', () => {
      const wrapper = createWrapper()
      expect(wrapper.element).toMatchSnapshot()
    })
  })
})

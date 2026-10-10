// @vitest-environment nuxt
import { describe, test, expect, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import ResourceModalOverlayTemplate from './ResourceModalOverlayTemplate.vue'

describe('ResourceModalOverlayTemplate', () => {
  test('clicks on the overlay or its content do not reach a parent click listener', async () => {
    const parentClick = vi.fn()
    const wrapper = mount(defineComponent({
      setup() {
        return () => h('div', { 'data-parent': '', 'onClick': parentClick }, [
          h(ResourceModalOverlayTemplate, { show: true }, {
            default: () => h('button', { 'type': 'button', 'data-content': '' }, 'Inside'),
          }),
        ])
      },
    }))
    const backdrop = wrapper.findComponent(ResourceModalOverlayTemplate).find('div')
    expect(backdrop.element.contains(wrapper.find('[data-content]').element)).toBe(true)
    await backdrop.trigger('click')
    await wrapper.find('[data-content]').trigger('click')
    expect(parentClick).not.toHaveBeenCalled()
  })
})

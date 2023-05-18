// @vitest-environment nuxt
import { describe, expect, test } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Info from './Info.vue'

function createWrapper (content: string) {
  return shallowMount(Info, {
    slots: {
      default: content
    }
  })
}
describe('Info', () => {
  describe('snapshots', () => {
    test('should match snapshot with passed content', () => {
      const wrapper = createWrapper('<div>CWA</div>')

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})

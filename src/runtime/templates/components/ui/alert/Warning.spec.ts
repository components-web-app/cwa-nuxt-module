// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Warning from './Warning.vue'

function createWrapper(content: string) {
  return shallowMount(Warning, {
    slots: {
      default: content,
    },
  })
}
describe('Warning', () => {
  describe('snapshots', () => {
    test('should match snapshot with passed content', () => {
      const wrapper = createWrapper('<div>CWA</div>')

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})

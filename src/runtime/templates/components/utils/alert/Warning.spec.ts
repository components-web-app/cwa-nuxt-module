// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Warning from './Warning.vue'

function createWrapper (slot: string) {
  return shallowMount(Warning, {
    slots: {
      default: slot
    }
  })
}

describe('Warning', () => {
  describe('snapshot', () => {
    test('should match snapshot with passed slot content', () => {
      const wrapper = createWrapper('<div>This is test</div>')

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})

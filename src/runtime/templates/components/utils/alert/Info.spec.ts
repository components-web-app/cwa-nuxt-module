// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Info from './Info.vue'

function createWrapper (slot: string) {
  return shallowMount(Info, {
    slots: {
      default: slot
    }
  })
}

describe('Info', () => {
  describe('snapshot', () => {
    test('should match snapshot with passed slot content', () => {
      const wrapper = createWrapper('<div>This is test</div>')

      // expect(wrapper.element).toMatchSnapshot()
    })
  })
})

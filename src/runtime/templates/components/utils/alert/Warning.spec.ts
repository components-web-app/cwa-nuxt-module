// @vitest-environment nuxt
import { describe, expect, test } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Warning from './Warning'

function createWrapper (content: string) {
  return shallowMount(Warning, {
    slots: {
      default: content
    }
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

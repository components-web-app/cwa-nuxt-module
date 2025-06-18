// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import ProgressBar from './ProgressBar.vue'

function createWrapper(percent?: number) {
  return shallowMount(ProgressBar, {
    props: {
      show: percent !== undefined,
      percent: percent || 0,
    },
  })
}
describe('ProgressBar', () => {
  describe('snapshots', () => {
    test('should match snapshot IF progress bar is shown', () => {
      const wrapper = createWrapper(0)

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF progress bar is NOT shown', () => {
      const wrapper = createWrapper()

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF progress bar has percentage', () => {
      const wrapper = createWrapper(75)

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})

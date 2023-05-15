// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import ProgressBar from './ProgressBar.vue'

function createWrapper (loading: boolean, percent: number) {
  return shallowMount(ProgressBar, {
    props: {
      show: loading,
      percent
    }
  })
}

describe('ProgressBar', () => {
  describe('snapshot', () => {
    test('should match snapshot IF bar is shown with specified percentage', () => {
      const wrapper = createWrapper(true, 75)

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF bar is NOT shown', () => {
      const wrapper = createWrapper(false, 0)

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})

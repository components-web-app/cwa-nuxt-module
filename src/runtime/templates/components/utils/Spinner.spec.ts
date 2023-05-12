import { describe, test, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Spinner from './Spinner.vue'

function createWrapper (loading: boolean) {
  return shallowMount(Spinner, {
    props: {
      show: loading
    }
  })
}

describe('Spinner', () => {
  describe('snapshot', () => {
    test('should match snapshot IF spinner is shown', () => {
      const wrapper = createWrapper(true)

      expect(wrapper.element).toMatchSnapshot()
    })

    test('should match snapshot IF spinner is NOT shown', () => {
      const wrapper = createWrapper(false)

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})

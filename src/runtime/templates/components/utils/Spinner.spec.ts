// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Spinner from './Spinner.vue'

function createWrapper(show: boolean) {
  return shallowMount(Spinner, {
    props: {
      show,
    },
  })
}
describe('Spinner', () => {
  describe('snapshots', () => {
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

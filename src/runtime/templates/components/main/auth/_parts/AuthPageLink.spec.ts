// @vitest-environment nuxt
import { describe, expect, test } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AuthPageLink from './AuthPageLink.vue'

function createWrapper() {
  return shallowMount(AuthPageLink, {
    props: {
      linkText: 'Click here to get money',
      linkTo: '/bank/loan',
    },
  })
}

describe('AuthPageLink', () => {
  describe('snapshots', () => {
    test('should match snapshot', () => {
      const wrapper = createWrapper()

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})

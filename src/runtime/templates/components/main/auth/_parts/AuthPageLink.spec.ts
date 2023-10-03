// @vitest-environment nuxt
import { describe, expect, test } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import LoginPageLink from './LoginPageLink.vue'

function createWrapper () {
  return shallowMount(LoginPageLink, {
    props: {
      linkText: 'Click here to get money',
      linkTo: '/bank/loan'
    }
  })
}

describe('LoginPageLink', () => {
  describe('snapshots', () => {
    test('should match snapshot', () => {
      const wrapper = createWrapper()

      expect(wrapper.element).toMatchSnapshot()
    })
  })
})

// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { drawsFocusRing } from '../../../../../../../test/utils/focus-ring'
import AuthPageLink from './AuthPageLink.vue'

describe('AuthPageLink', () => {
  test('links to its page in the kit\'s link colour, underlined and at least the 24px target size', () => {
    const wrapper = mount(AuthPageLink, {
      props: { linkText: 'Forgot your password?', linkTo: '/forgot-password' },
      global: { stubs: { NuxtLink: RouterLinkStub } },
    })
    const link = wrapper.getComponent(RouterLinkStub)

    expect(link.props('to')).toBe('/forgot-password')
    expect(link.text()).toBe('Forgot your password?')
    expect(link.classes()).toEqual(expect.arrayContaining(['cwa:text-accent-fg', 'cwa:underline', 'cwa:min-h-target']))
  })
  test('draws its focus ring when focused from the keyboard', () => {
    const wrapper = mount(AuthPageLink, {
      props: { linkText: 'Forgot your password?', linkTo: '/forgot-password' },
      global: { stubs: { NuxtLink: RouterLinkStub } },
    })

    expect(drawsFocusRing(wrapper.getComponent(RouterLinkStub).classes())).toBe(true)
  })
})

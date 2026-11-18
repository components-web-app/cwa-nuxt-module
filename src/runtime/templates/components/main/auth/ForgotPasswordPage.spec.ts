// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount, RouterLinkStub } from '@vue/test-utils'
import { h } from 'vue'
import { axe } from '../../../../../../test/utils/axe'
import ForgotPasswordPage from './ForgotPasswordPage.vue'

enableAutoUnmount(afterEach)

function mountPage(props: Record<string, unknown> = {}) {
  return mount(ForgotPasswordPage, {
    props: { submitting: false, success: false, modelValue: { username: '' }, ...props },
    global: { stubs: { CwaLogo: { render: () => h('svg') }, NuxtLink: RouterLinkStub } },
    attachTo: document.body,
  })
}

describe('ForgotPasswordPage', () => {
  test('asks for the username in a kit input marked for password managers, and links back to sign-in', () => {
    const wrapper = mountPage()
    const input = wrapper.get('input[name="username"]')

    expect(input.attributes('autocomplete')).toBe('username')
    expect(input.element.required).toBe(true)
    expect(wrapper.get('button[type="submit"]').text()).toBe('Reset Password')
    expect(wrapper.getComponent(RouterLinkStub).props('to')).toBe('/login')
  })

  test('reports what is typed', async () => {
    const wrapper = mountPage()

    await wrapper.get('input').setValue('admin')

    expect((wrapper.props('modelValue') as { username: string }).username).toBe('admin')
  })

  test('once sent, says to check the inbox and offers Back to Login in place of the field (#353)', () => {
    const wrapper = mountPage({ success: true })

    expect(wrapper.get('[data-testid="auth-success"]').text()).toContain('Please check your inbox')
    expect(wrapper.get('[data-testid="auth-success"]').text()).toContain('we\'ve sent an email with a link to reset your password')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.get('button[type="submit"]').text()).toBe('Back to Login')
  })

  test('a throttled request shows its message as an error, with no countdown (#353)', () => {
    const wrapper = mountPage({ error: 'A reset email was already sent recently. Please check your inbox and spam folder.' })

    expect(wrapper.get('[data-testid="auth-error"]').text()).toBe('A reset email was already sent recently. Please check your inbox and spam folder.')
    expect(wrapper.text()).not.toMatch(/\d+\s*s\b|second/)
  })

  test.each([
    ['idle', {}],
    ['submitting', { submitting: true }],
    ['error', { error: 'The email couldn\'t be sent. Please try again.' }],
    ['throttled', { error: 'A reset email was already sent recently. Please check your inbox and spam folder.' }],
    ['success', { success: true }],
  ])('has no axe violations when %s', async (_state, props) => {
    mountPage(props)

    expect(await axe(document.body)).toHaveNoViolations()
  })
})

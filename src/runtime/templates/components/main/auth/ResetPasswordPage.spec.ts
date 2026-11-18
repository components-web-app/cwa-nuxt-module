// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { axe } from '../../../../../../test/utils/axe'
import ResetPasswordPage from './ResetPasswordPage.vue'

enableAutoUnmount(afterEach)

function mountPage(props: Record<string, unknown> = {}) {
  return mount(ResetPasswordPage, {
    props: { submitting: false, success: false, error: null, modelValue: { first: '', second: '' }, ...props },
    global: { stubs: { CwaLogo: { render: () => h('svg') } } },
    attachTo: document.body,
  })
}

describe('ResetPasswordPage', () => {
  test('asks for the new password twice, both marked as new passwords for password managers', () => {
    const wrapper = mountPage()
    const inputs = wrapper.findAll('input')

    expect(inputs.map(input => input.attributes('name'))).toEqual(['firstPassword', 'secondPassword'])
    expect(inputs.map(input => input.attributes('autocomplete'))).toEqual(['new-password', 'new-password'])
    expect(inputs.map(input => input.attributes('type'))).toEqual(['password', 'password'])
  })

  test('each new password can be shown, with its own toggle, and the form is stacked', () => {
    const wrapper = mountPage()
    const toggles = wrapper.findAll('[data-testid="input-reveal"]')
    expect(toggles.map(toggle => toggle.attributes('aria-controls'))).toEqual(wrapper.findAll('input').map(input => input.attributes('id')))
    expect(wrapper.find('form').classes()).toContain('cwa:flex-col')
  })

  test('the API\'s password errors are the line below the first field, which they describe', () => {
    const wrapper = mountPage({ inputErrors: { password: ['This value is too short.', 'Use a number.'] } })
    const line = wrapper.get('[data-testid="field-error"]')
    const first = wrapper.get('input[name="firstPassword"]')

    expect(line.text()).toBe('This value is too short. Use a number.')
    expect(first.attributes('aria-invalid')).toBe('true')
    expect(first.attributes('aria-describedby')?.split(' ')).toContain(line.attributes('id'))
    expect(wrapper.get('input[name="secondPassword"]').attributes('aria-invalid')).toBeUndefined()
  })

  test('password errors arriving after a submit are announced with the field\'s label and focus the first field', async () => {
    const wrapper = mountPage()
    wrapper.get('input[name="secondPassword"]').element.focus()

    await wrapper.setProps({ inputErrors: { password: ['This value is too short.'] } })
    await nextTick()

    expect(wrapper.get('[role="status"]').text()).toBe('Enter new password: This value is too short.')
    expect(document.activeElement).toBe(wrapper.get('input[name="firstPassword"]').element)
  })

  test('once reset, focuses the success alert', async () => {
    const wrapper = mountPage()
    wrapper.get('input[name="firstPassword"]').element.focus()

    await wrapper.setProps({ success: true })
    await nextTick()

    expect(document.activeElement).toBe(wrapper.get('[data-testid="auth-success"]').element)
  })

  test('form errors take the place of the page error in the alert', () => {
    const wrapper = mountPage({ error: 'Unexpected error', inputErrors: { form: ['The passwords do not match.'] } })

    expect(wrapper.get('[data-testid="auth-error"]').text()).toBe('The passwords do not match.')
  })

  test('once reset, says so and offers Go to login in place of the fields', () => {
    const wrapper = mountPage({ success: true })

    expect(wrapper.get('[data-testid="auth-success"]').text()).toContain('You have successfully reset your password.')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.get('button[type="submit"]').text()).toBe('Go to login')
  })

  test.each([
    ['idle', {}],
    ['invalid', { inputErrors: { password: ['This value is too short.'] } }],
    ['submitting', { submitting: true }],
    ['error', { error: 'The reset link is invalid or has expired. Please restart the reset password process.' }],
    ['success', { success: true }],
  ])('has no axe violations when %s', async (_state, props) => {
    mountPage(props)

    expect(await axe(document.body)).toHaveNoViolations()
  })
})

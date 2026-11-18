// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { h } from 'vue'
import { axe } from '../../../../../../../test/utils/axe'
import CwaUiInput from '../../../ui/Input.vue'
import AuthTemplate from './AuthTemplate.vue'

enableAutoUnmount(afterEach)

function createWrapper(props: Record<string, unknown> = {}, slots: Record<string, () => unknown> = {}) {
  return mount(AuthTemplate, {
    props: { submitButtonText: 'Sign In', submitting: false, ...props },
    slots,
    global: { stubs: { CwaLogo: { render: () => h('svg') } } },
    attachTo: document.body,
  })
}

describe('AuthTemplate', () => {
  test('emits submit when its form is submitted', async () => {
    const wrapper = createWrapper()

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  test('the submit button is the kit\'s solid button, busy while submitting so a click does not submit again', async () => {
    const idle = createWrapper()
    const button = idle.get('button[type="submit"]')
    expect(button.text()).toBe('Sign In')
    expect(button.classes()).toContain('cwa:bg-accent')
    expect(button.attributes('aria-busy')).toBeUndefined()

    const submitting = createWrapper({ submitting: true })
    const busy = submitting.get('button[type="submit"]')
    expect(busy.attributes('aria-busy')).toBe('true')
    expect(busy.attributes('aria-disabled')).toBe('true')
    const click = new MouseEvent('click', { cancelable: true, bubbles: true })
    busy.element.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
  })

  test('hideSubmit leaves the submit button out', () => {
    expect(createWrapper({ hideSubmit: true }).find('button[type="submit"]').exists()).toBe(false)
  })

  test('the title is the page\'s heading', () => {
    expect(createWrapper({ title: 'Sign in' }).get('h1').text()).toBe('Sign in')
  })

  test('an error is a danger alert, announced in the status region', () => {
    const wrapper = createWrapper({ error: 'Invalid credentials.' })

    expect(wrapper.get('[data-testid="auth-error"]').attributes('data-tone')).toBe('danger')
    expect(wrapper.get('[data-testid="auth-error"]').text()).toBe('Invalid credentials.')
    expect(wrapper.get('[role="status"]').text()).toBe('Invalid credentials.')
  })

  test('a list of errors is one alert', () => {
    const wrapper = createWrapper({ error: ['The token has expired.', 'Please start again.'] })

    expect(wrapper.get('[data-testid="auth-error"]').text()).toBe('The token has expired. Please start again.')
  })

  test('success is a success alert with the success slot below its title, announced in the status region', () => {
    const wrapper = createWrapper({ success: 'Please check your inbox' }, { success: () => h('p', 'We sent a link.') })
    const alert = wrapper.get('[data-testid="auth-success"]')

    expect(alert.attributes('data-tone')).toBe('success')
    expect(alert.text()).toBe('Please check your inboxWe sent a link.')
    expect(wrapper.get('[role="status"]').text()).toBe('Please check your inbox')
  })

  test('the status region is in the page before anything is announced, so the first message is read', () => {
    expect(createWrapper().get('[role="status"]').text()).toBe('')
  })

  test('fields inside are on the page surface: label above and their error as the line below', () => {
    const wrapper = createWrapper({}, { default: () => h(CwaUiInput, { label: 'Enter new password', modelValue: '', invalid: 'Too short.' }) })

    expect(wrapper.get('[data-testid="field-error"]').text()).toBe('Too short.')
  })

  test.each([
    ['idle', {}],
    ['submitting', { submitting: true }],
    ['error', { error: 'Invalid credentials.' }],
    ['success', { success: 'Your email address is now verified', hideSubmit: true }],
  ])('has no axe violations when %s', async (_state, props) => {
    createWrapper({ title: 'Sign in', ...props }, { default: () => h(CwaUiInput, { label: 'Username or Email', modelValue: '' }) })

    expect(await axe(document.body)).toHaveNoViolations()
  })
})

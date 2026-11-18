// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import { axe } from '../../../../../../../test/utils/axe'
import CwaUiInput from '../../../ui/Input.vue'
import AuthTemplate from './AuthTemplate.vue'

enableAutoUnmount(afterEach)

function createWrapper(props: Record<string, unknown> = {}, slots: Record<string, () => unknown> = {}) {
  return mount(AuthTemplate, {
    props: { submitButtonText: 'Sign in', submitting: false, ...props },
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
    expect(button.text()).toBe('Sign in')
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

  test('field errors arriving after a submit are announced once in the status region and focus the first invalid input', async () => {
    const invalid = ref<string>()
    const wrapper = createWrapper({}, {
      default: () => [
        h(CwaUiInput, { label: 'Username', modelValue: '' }),
        h(CwaUiInput, { label: 'Enter new password', modelValue: '', invalid: invalid.value }),
      ],
    })
    expect(wrapper.get('[role="status"]').text()).toBe('')

    invalid.value = 'Too short.'
    await wrapper.setProps({ fieldErrors: 'Enter new password: Too short.' })
    await nextTick()

    expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
    expect(wrapper.get('[role="status"]').text()).toBe('Enter new password: Too short.')
    expect(document.activeElement).toBe(wrapper.get('input[aria-invalid="true"]').element)
  })

  test('a page error is announced in place of the field errors', () => {
    const wrapper = createWrapper({ error: 'Unexpected error', fieldErrors: 'Enter new password: Too short.' })

    expect(wrapper.get('[role="status"]').text()).toBe('Unexpected error')
  })

  test('success focuses its alert, so focus does not drop to the page when the fields go', async () => {
    const sent = ref(false)
    const wrapper = createWrapper({}, { default: () => sent.value ? [] : h(CwaUiInput, { label: 'Username', modelValue: '' }) })
    wrapper.get('input').element.focus()

    sent.value = true
    await wrapper.setProps({ success: 'Please check your inbox' })
    await nextTick()

    expect(document.activeElement).toBe(wrapper.get('[data-testid="auth-success"]').element)
  })

  test('the card is in a main landmark by default, and in none when the app\'s layout has its own', () => {
    expect(createWrapper().findAll('main')).toHaveLength(1)

    const nested = createWrapper({ main: false })
    expect(nested.find('main').exists()).toBe(false)
    expect(nested.find('[data-testid="auth-card"]').exists()).toBe(true)
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

// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createSSRApp, defineComponent, h, reactive } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { axe } from '../../../../../../test/utils/axe'
import LoginPage from './LoginPage.vue'

function loginApp(credentials: { username: string, password: string }, onSubmit: () => void = () => {}) {
  const app = createSSRApp(defineComponent({
    render: () => h(LoginPage, {
      'submitButtonText': 'Sign in',
      'submitting': false,
      'modelValue': credentials,
      'onUpdate:modelValue': (value: { username: string, password: string }) => Object.assign(credentials, value),
      'onSubmit': onSubmit,
    }, { footer: () => h('div') }),
  }))
  app.component('CwaLogo', { render: () => h('svg') })
  return app
}

describe('LoginPage', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('submits credentials a password manager filled in before hydration', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = await renderToString(loginApp({ username: '', password: '' }))
    const username = container.querySelector('input[name="username"]') as HTMLInputElement
    const password = container.querySelector('input[name="password"]') as HTMLInputElement
    username.value = 'admin@example.com'
    password.value = 'secret'

    const credentials = reactive({ username: '', password: '' })
    const submitted: { username: string, password: string }[] = []
    loginApp(credentials, () => submitted.push({ ...credentials })).mount(container)
    await flushPromises()
    container.querySelector('form')?.dispatchEvent(new Event('submit'))

    expect(username.value).toBe('admin@example.com')
    expect(password.value).toBe('secret')
    expect(submitted).toEqual([{ username: 'admin@example.com', password: 'secret' }])
  })

  test('its fields are named and marked for password managers, and its heading defaults to Sign in', () => {
    const wrapper = mountLogin()

    expect(wrapper.get('h1').text()).toBe('Sign in')
    const username = wrapper.get('input[name="username"]')
    const password = wrapper.get('input[name="password"]')
    expect(username.attributes('autocomplete')).toBe('username')
    expect(password.attributes('autocomplete')).toBe('current-password')
    expect(password.attributes('type')).toBe('password')
    expect(wrapper.get(`label[for="${username.attributes('id')}"]`).text()).toBe('Username or Email')
    expect(wrapper.get(`label[for="${password.attributes('id')}"]`).text()).toBe('Password')
    wrapper.unmount()
  })

  test('passes main to the template, so an app whose layout has a main landmark can turn its own off', () => {
    expect(mountLogin().findAll('main')).toHaveLength(1)
    expect(mountLogin({ main: false }).find('main').exists()).toBe(false)
  })

  test.each([
    ['idle', {}],
    ['submitting', { submitting: true }],
    ['error', { error: 'Invalid credentials.' }],
  ])('has no axe violations when %s', async (_state, props) => {
    const wrapper = mountLogin(props)

    expect(await axe(document.body)).toHaveNoViolations()
    wrapper.unmount()
  })
})

function mountLogin(props: Record<string, unknown> = {}) {
  return mount(LoginPage, {
    props: { submitButtonText: 'Sign in', submitting: false, modelValue: { username: '', password: '' }, ...props },
    global: { stubs: { CwaLogo: { render: () => h('svg') }, NuxtLink: RouterLinkStub } },
    attachTo: document.body,
  })
}

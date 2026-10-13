// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createSSRApp, defineComponent, h, reactive } from 'vue'
import { renderToString } from 'vue/server-renderer'
import LoginPage from './LoginPage.vue'

function loginApp(credentials: { username: string, password: string }, onSubmit: () => void = () => {}) {
  const app = createSSRApp(defineComponent({
    render: () => h(LoginPage, {
      'submitButtonText': 'Sign In',
      'submitting': false,
      'modelValue': credentials,
      'onUpdate:modelValue': (value: { username: string, password: string }) => Object.assign(credentials, value),
      'onSubmit': onSubmit,
    }, { footer: () => h('div') }),
  }))
  app.component('CwaLogo', { render: () => h('svg') })
  app.component('CwaUiAlertWarning', { render: () => h('div') })
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
})

// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import AccountPage from './account.vue'
import { axe } from '../../../../../test/utils/axe'
import * as cwaComposable from '#cwa/composables/cwa'
import Select from '#cwa/templates/components/ui/Select.vue'
import Toggle from '#cwa/templates/components/ui/Toggle.vue'

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('#cwa/composables/cwa-toast', () => ({
  useCwaToast: () => ({ show: showToast, dismiss: vi.fn() }),
}))

enableAutoUnmount(afterEach)

afterEach(() => {
  document.body.innerHTML = ''
})

const ME = '/_/users/me-uuid'
const me = {
  '@id': ME,
  '@type': 'User',
  'username': 'editor',
  'emailAddress': 'editor@example.com',
  'emailAddressVerified': true,
  'roles': ['ROLE_ADMIN', 'ROLE_USER'],
}

const rejected = 'You have not entered your current password correctly. Please try again.'

async function setup(user: Record<string, any> = me, opts: { loadFails?: boolean } = {}) {
  const errors: any[] = []
  const fetch = vi.fn(async () => ({ ...user }))
  if (opts.loadFails) {
    fetch.mockRejectedValueOnce(new Error('offline'))
  }
  const updateResource = vi.fn(async (event: any) => {
    const resource = { ...user, ...event.data }
    event.onRequest?.(event.endpoint, Promise.resolve({ resource }))
    return resource
  })
  const resendVerifyNewEmail = vi.fn(async () => ({}))
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    cwaFetch: { fetch },
    auth: { user: { ...user }, hasRole: (role: string) => user.roles.includes(role), resendVerifyNewEmail, resendVerifyEmail: vi.fn() },
    resourcesManager: { updateResource, removeError: vi.fn(), get errors() { return errors } },
  }))
  const wrapper = mount(AccountPage, { attachTo: document.body })
  await flushPromises()

  function refuseOldPassword() {
    updateResource.mockImplementationOnce(async (event: any) => {
      const violations = [{ propertyPath: 'oldPassword', message: rejected }]
      errors.push({ timestamp: 3, event })
      event.onRequest?.(event.endpoint, Promise.resolve({ error: Object.assign(new Error('422'), { statusCode: 422, data: { violations } }) }))
      return undefined
    })
  }

  return { wrapper, fetch, updateResource, resendVerifyNewEmail, refuseOldPassword }
}

function fieldByLabel(label: string) {
  const labelEl = [...document.querySelectorAll('label')].find(element => element.textContent?.trim() === label)
  return labelEl ? document.getElementById(labelEl.getAttribute('for')!) as HTMLInputElement | null : null
}

async function type(label: string, value: string) {
  const input = fieldByLabel(label)!
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

function errorOf(label: string) {
  const described = fieldByLabel(label)!.getAttribute('aria-describedby')?.split(' ') ?? []
  return described.map(id => document.getElementById(id)).find(element => element?.dataset.testid === 'field-error')?.textContent?.trim()
}

async function click(selector: string) {
  document.querySelector<HTMLElement>(selector)!.click()
  await flushPromises()
}

describe('the account page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders for a user with only ROLE_ADMIN, from /me', async () => {
    const { fetch } = await setup({ ...me, roles: ['ROLE_ADMIN'] })

    expect(fetch).toHaveBeenCalledWith('/me')
    expect(document.querySelector('h1')?.textContent?.trim()).toBe('My account')
    expect([...document.querySelectorAll('h2')].map(heading => heading.textContent?.trim())).toEqual(['Email', 'Password'])
    expect(document.body.textContent).toContain('Your email is editor@example.com.')
    expect(await axe(document.body.innerHTML)).toHaveNoViolations()
  })

  test('never shows username, role or enabled controls', async () => {
    const { wrapper } = await setup({ ...me, roles: ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_USER_ADMIN'] })

    const labels = [...document.querySelectorAll('label')].map(label => label.textContent?.trim())
    expect(labels).toEqual(['New email', 'Current password', 'New password', 'Repeat new password'])
    expect(wrapper.findComponent(Select).exists()).toBe(false)
    expect(wrapper.findComponent(Toggle).exists()).toBe(false)
    expect(document.querySelector('[role="switch"], select, [role="combobox"]')).toBeNull()
  })

  test('a failed load offers Try again, which reads /me again', async () => {
    const { fetch } = await setup(me, { loadFails: true })
    expect(document.querySelector('[data-testid="account-load-error"]')).not.toBeNull()
    expect(fieldByLabel('New email')).toBeNull()

    await click('[data-testid="account-retry"]')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(document.querySelector('[data-testid="account-load-error"]')).toBeNull()
    expect(fieldByLabel('New email')).not.toBeNull()
  })

  test('changing the email asks for the current password and shows the pending change, with resend and cancel', async () => {
    const { updateResource, resendVerifyNewEmail } = await setup()

    expect(fieldByLabel('Your current password')).toBeNull()
    await type('New email', 'next@example.com')
    await type('Your current password', 'secret')
    await click('[data-testid="account-change-email"]')

    expect(updateResource).toHaveBeenCalledTimes(1)
    expect(updateResource.mock.calls[0]![0]).toMatchObject({ endpoint: ME, data: { newEmailAddress: 'next@example.com', oldPassword: 'secret' } })
    expect(document.querySelector('[data-testid="account-pending-email"]')?.textContent).toContain('Waiting for next@example.com to be confirmed')

    await click('[data-resend-email]')
    expect(resendVerifyNewEmail).toHaveBeenCalledWith('editor')

    updateResource.mockImplementationOnce(async (event: any) => {
      const resource = { ...me }
      event.onRequest?.(event.endpoint, Promise.resolve({ resource }))
      return resource
    })
    await click('[data-cancel-email-change]')
    expect(updateResource).toHaveBeenCalledTimes(2)
    expect(updateResource.mock.calls[1]![0].data).toStrictEqual({ newEmailAddress: null })
    expect(document.querySelector('[data-testid="account-pending-email"]')).toBeNull()
  })

  test('a rejected current password shows on its field until it is changed', async () => {
    const { updateResource, refuseOldPassword } = await setup()
    refuseOldPassword()

    await type('Current password', 'wrong')
    await type('New password', 'next-secret')
    await type('Repeat new password', 'next-secret')
    await click('[data-testid="account-change-password"]')

    expect(updateResource).toHaveBeenCalledTimes(1)
    expect(updateResource.mock.calls[0]![0].data).toStrictEqual({ oldPassword: 'wrong', plainPassword: 'next-secret' })
    expect(errorOf('Current password')).toBe(rejected)
    expect(showToast).not.toHaveBeenCalled()

    await type('Current password', 'wrong!')
    expect(errorOf('Current password')).toBeUndefined()
  })

  test('a changed password says so and empties the fields', async () => {
    await setup()

    await type('Current password', 'secret')
    await type('New password', 'next-secret')
    await type('Repeat new password', 'next-secret')
    await click('[data-testid="account-change-password"]')

    expect(document.querySelector('[data-password-saved]')?.textContent?.trim()).toBe('Your password has been changed.')
    expect(fieldByLabel('New password')!.value).toBe('')
  })
})

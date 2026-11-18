// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import UserItemPage from './[iri].vue'
import { axe } from '../../../../../../test/utils/axe'
import * as cwaComposable from '#cwa/composables/cwa'
import Select from '#cwa/templates/components/ui/Select.vue'

const { mockUseResendVerifyEmail, mockConfirm, route } = vi.hoisted(() => ({
  mockUseResendVerifyEmail: vi.fn(),
  mockConfirm: vi.fn(),
  route: { name: '_cwa-users-user-iri', params: { iri: '/users/uuid-user' } as Record<string, string>, query: {}, hash: '' },
}))

vi.mock('#cwa/composables/useResendVerifyEmail', () => ({
  useResendVerifyEmail: mockUseResendVerifyEmail,
}))

vi.mock('#cwa/composables/cwa-confirm', () => ({
  useCwaConfirm: () => mockConfirm,
}))

vi.mock('vue-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue-router')>()
  return {
    ...mod,
    useRoute: () => route,
    useRouter: () => ({ push: vi.fn() }),
  }
})

enableAutoUnmount(afterEach)

const userIri = '/users/uuid-user'
const stored = {
  '@id': userIri,
  '@type': 'User',
  'username': 'someone',
  'enabled': true,
  'emailAddress': 'old@example.com',
  'emailAddressVerified': true,
  'roles': ['ROLE_USER'],
  'createdAt': '2026-01-01T00:00:00Z',
  'updatedAt': '2026-01-02T00:00:00Z',
}

const message = 'This value should be the user\'s current password.'

function resendState(opts: { error?: string, retryIn?: number, success?: boolean } = {}) {
  const state = {
    resendVerifyEmail: vi.fn(),
    submitting: ref(false),
    success: ref(!!opts.success),
    error: ref(opts.error),
    retryIn: ref(opts.retryIn ?? 0),
  }
  mockUseResendVerifyEmail.mockReturnValue(state)
  return state
}

async function setup(user: Record<string, any> = stored, opts: { adding?: boolean } = {}) {
  route.params = { iri: opts.adding ? 'add' : userIri }
  const store = reactive<Record<string, any>>({})
  const errors = ref<any[]>([])
  const updateResource = vi.fn(async ({ data }: { endpoint: string, data: Record<string, any> }) => {
    const { oldPassword: _sent, plainPassword: _plain, ...kept } = data
    store[userIri].data = { ...store[userIri].data, ...kept }
    return store[userIri].data
  })
  const createResource = vi.fn()
  const deleteResource = vi.fn()
  const removeError = vi.fn((timestamp: number) => {
    errors.value = errors.value.filter(error => error.timestamp !== timestamp)
  })
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: { getResource: vi.fn((iri: string) => computed(() => store[iri])) },
    resourcesManager: {
      updateResource,
      createResource,
      deleteResource,
      addError: vi.fn(),
      removeError,
      storeResource: vi.fn(),
      get errors() { return errors.value },
    },
    fetchResource: vi.fn(async () => {
      store[userIri] = { data: { ...user }, apiState: { status: 'SUCCESS' } }
      return store[userIri].data
    }),
  }))

  const wrapper = mount(UserItemPage, { attachTo: document.body })
  await flushPromises()

  function refuseWith422(property: string, text: string) {
    updateResource.mockImplementationOnce(async (event: any) => {
      const violations = [{ property, propertyPath: property, message: text }]
      errors.value = [...errors.value, { timestamp: 1, event, detail: text, violations }]
      event.onRequest?.(userIri, Promise.resolve({ error: Object.assign(new Error('422'), { statusCode: 422, data: { violations } }) }))
      return undefined
    })
  }

  return { wrapper, store, errors, updateResource, createResource, deleteResource, removeError, refuseWith422 }
}

const dialog = () => document.querySelector<HTMLElement>('[data-testid="dialog"]')!
const q = <T extends HTMLElement = HTMLElement>(selector: string) => dialog().querySelector<T>(selector)
const qa = (selector: string) => [...dialog().querySelectorAll<HTMLElement>(selector)]
const save = () => q<HTMLButtonElement>('[data-testid="dialog-save"]')!
const tab = (label: string) => qa('[role="tab"]').find(element => element.textContent?.trim() === label)!

function fieldByLabel(label: string) {
  const labelEl = qa('label').find(element => element.textContent?.trim() === label)
  return labelEl ? document.getElementById(labelEl.getAttribute('for')!) as HTMLInputElement | null : null
}

function shown(element: HTMLElement) {
  const copy = element.cloneNode(true) as HTMLElement
  copy.querySelectorAll('.cwa\\:sr-only').forEach(hidden => hidden.remove())
  return copy.textContent?.trim()
}

async function type(label: string, value: string) {
  const input = fieldByLabel(label)!
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

async function clickSave() {
  save().click()
  await flushPromises()
}

function errorOf(label: string) {
  return fieldByLabel(label)!.closest('[data-cwa-field]')!.querySelector('[data-testid="field-error"]')?.textContent?.trim()
}

describe('admin user dialog (#461)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resendState()
  })

  test('is a kit dialog named by the username, with Details, Password and Info tabs and only Cancel and Save', async () => {
    await setup()

    expect(document.getElementById(dialog().getAttribute('aria-labelledby')!)?.textContent?.trim()).toBe('someone')
    expect(qa('[role="tab"]').map(shown)).toEqual(['Details', 'Password', 'Info'])
    expect(qa('footer button').map(shown)).toEqual(['Cancel', 'Save'])
    expect(document.querySelector('[data-testid="dialog-overlay"]')).not.toBeNull()
  })

  test('creating a user has only Details, with both password fields, and Create user', async () => {
    const { createResource } = await setup(stored, { adding: true })

    expect(document.getElementById(dialog().getAttribute('aria-labelledby')!)?.textContent?.trim()).toBe('New user')
    expect(qa('[role="tab"]').map(shown)).toEqual(['Details'])
    expect(fieldByLabel('Password')!.getAttribute('autocomplete')).toBe('new-password')
    expect(fieldByLabel('Repeat password')!.getAttribute('autocomplete')).toBe('new-password')
    expect(save().getAttribute('aria-label')).toBe('Create user')

    await type('Email', 'new@example.com')
    await type('Password', 'secret')
    await type('Repeat password', 'secret')
    await clickSave()

    expect(createResource).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: '/users',
      data: { '@type': 'User', 'enabled': true, 'roles': ['ROLE_USER'], 'emailAddress': 'new@example.com', 'plainPassword': 'secret' },
    }))
  })

  test('the role select edits `roles` as the highest chosen role', async () => {
    const { wrapper, updateResource } = await setup({ ...stored, roles: ['ROLE_USER', 'ROLE_ADMIN'] })
    const role = wrapper.findAllComponents(Select).find(select => select.props('label') === 'Role')!

    expect(role.props('model').model.value).toBe('ROLE_ADMIN')
    role.props('model').model.value = 'ROLE_SUPER_ADMIN'
    await flushPromises()
    expect(shown(save())).toBe('Save 1 change')
    await clickSave()

    expect(updateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { roles: ['ROLE_SUPER_ADMIN'] } }))
  })

  describe('changing the email (#449)', () => {
    test('asks for your current password and sends it as `oldPassword` with `newEmailAddress`; the password is not a change of its own', async () => {
      const { updateResource } = await setup()

      expect(fieldByLabel('Your current password')).toBeNull()
      await type('Email', 'new@example.com')

      const password = fieldByLabel('Your current password')!
      expect(password.type).toBe('password')
      expect(password.getAttribute('autocomplete')).toBe('current-password')

      await type('Your current password', 'my-own-password')
      expect(shown(save())).toBe('Save 1 change')
      await clickSave()

      expect(updateResource).toHaveBeenCalledTimes(1)
      expect(updateResource).toHaveBeenCalledWith({
        endpoint: userIri,
        data: { newEmailAddress: 'new@example.com', oldPassword: 'my-own-password' },
        onRequest: expect.any(Function),
      })
    })

    test('the password is not kept after a successful save', async () => {
      const { updateResource } = await setup()

      await type('Email', 'new@example.com')
      await type('Your current password', 'my-own-password')
      await clickSave()

      expect(fieldByLabel('Your current password')).toBeNull()

      await type('Email', 'newer@example.com')
      expect(fieldByLabel('Your current password')!.value).toBe('')

      await clickSave()
      expect(updateResource).toHaveBeenLastCalledWith({
        endpoint: userIri,
        data: { newEmailAddress: 'newer@example.com' },
        onRequest: expect.any(Function),
      })
    })

    test('a field other than Email changed alone sends no password', async () => {
      const { updateResource } = await setup()

      q<HTMLButtonElement>('[data-cwa-field="enabled"] [role="switch"]')!.click()
      await flushPromises()
      await clickSave()

      expect(updateResource).toHaveBeenCalledWith({ endpoint: userIri, data: { enabled: false }, onRequest: expect.any(Function) })
    })

    test('an email edited back to the pending address hides and forgets the password, and sends none', async () => {
      const { updateResource } = await setup({ ...stored, newEmailAddress: 'pending@example.com' })

      await type('Email', 'other@example.com')
      await type('Your current password', 'my-own-password')
      await type('Email', 'pending@example.com')
      expect(fieldByLabel('Your current password')).toBeNull()
      await type('Email', 'other@example.com')
      expect(fieldByLabel('Your current password')!.value).toBe('')
      await type('Email', 'pending@example.com')

      q<HTMLButtonElement>('[data-cwa-field="enabled"] [role="switch"]')!.click()
      await flushPromises()
      await clickSave()

      expect(updateResource).toHaveBeenCalledWith({ endpoint: userIri, data: { enabled: false }, onRequest: expect.any(Function) })
    })

    test('a 422 on `oldPassword` shows its message on that field and in the dialog alert, not as a stored error, until the password is retyped', async () => {
      const { refuseWith422, errors, removeError } = await setup()
      refuseWith422('oldPassword', message)

      await type('Email', 'new@example.com')
      await type('Your current password', 'wrong-password')
      await clickSave()

      expect(errorOf('Your current password')).toBe(message)
      expect(fieldByLabel('Your current password')!.getAttribute('aria-invalid')).toBe('true')
      expect(q('[data-testid="dialog-alert"]')?.textContent).toContain('Your current password')
      expect(removeError).toHaveBeenCalledWith(1)
      expect(errors.value).toEqual([])

      await type('Your current password', 'right-password')
      expect(errorOf('Your current password')).toBeUndefined()
    })

    test('a 422 on another field is not shown on the password', async () => {
      const { refuseWith422 } = await setup()
      refuseWith422('newEmailAddress', 'This email is taken.')

      await type('Email', 'taken@example.com')
      await type('Your current password', 'my-own-password')
      await clickSave()

      expect(errorOf('Email')).toBe('This email is taken.')
      expect(errorOf('Your current password')).toBeUndefined()
    })
  })

  describe('setting a password', () => {
    test('passwords that don\'t match show on Repeat password and send nothing', async () => {
      const { updateResource } = await setup()
      tab('Password').click()
      await flushPromises()

      await type('New password', 'one')
      await type('Repeat password', 'two')
      await clickSave()

      expect(updateResource).not.toHaveBeenCalled()
      expect(errorOf('Repeat password')).toBe('The passwords don\'t match.')
    })

    test('matching passwords send only `plainPassword`, as one change, and both fields empty afterwards', async () => {
      const { updateResource } = await setup()
      tab('Password').click()
      await flushPromises()

      await type('New password', 'secret')
      await type('Repeat password', 'secret')
      expect(shown(save())).toBe('Save 1 change')
      await clickSave()

      expect(updateResource).toHaveBeenCalledWith({ endpoint: userIri, data: { plainPassword: 'secret' }, onRequest: expect.any(Function) })
      expect(fieldByLabel('New password')!.value).toBe('')
      expect(fieldByLabel('Repeat password')!.value).toBe('')
    })
  })

  describe('email requests (#353)', () => {
    test('a pending email change can be cancelled, sending only the cleared address and none of the unsaved edits', async () => {
      const { updateResource } = await setup({ ...stored, newEmailAddress: 'new@example.com' })
      await type('Username', 'edited-but-not-saved')

      q<HTMLButtonElement>('[data-cancel-email-change]')!.click()
      await flushPromises()

      expect(updateResource).toHaveBeenCalledTimes(1)
      expect(updateResource).toHaveBeenCalledWith({
        endpoint: userIri,
        data: { newEmailAddress: null },
      })
      expect(fieldByLabel('Email')!.value).toBe('old@example.com')
    })

    test('the cancel sits beside the resend in the pending change notice', async () => {
      await setup({ ...stored, newEmailAddress: 'new@example.com' })

      const notice = q('[data-testid="user-pending-email"]')!
      expect(notice.textContent).toContain('new@example.com')
      expect(q('[data-cancel-email-change]')!.parentElement).toBe(q('[data-resend-email]')!.parentElement)
      expect(notice.contains(q('[data-cancel-email-change]'))).toBe(true)
    })

    test('resend asks for the new address while a change is pending, and the current one when unverified', async () => {
      const resend = resendState()
      await setup({ ...stored, newEmailAddress: 'new@example.com' })
      q<HTMLButtonElement>('[data-resend-email]')!.click()
      expect(resend.resendVerifyEmail).toHaveBeenCalledWith('someone', 'new')
    })

    test('an unverified address offers a resend for the current address and no cancel', async () => {
      const resend = resendState()
      await setup({ ...stored, emailAddressVerified: false })

      expect(q('[data-cancel-email-change]')).toBeNull()
      expect(q('[data-testid="user-unverified-email"]')?.textContent).toContain('Email not verified')
      q<HTMLButtonElement>('[data-resend-email]')!.click()
      expect(resend.resendVerifyEmail).toHaveBeenCalledWith('someone', 'current')
    })

    test('a verified address with nothing pending offers neither', async () => {
      await setup()

      expect(q('[data-resend-email]')).toBeNull()
      expect(q('[data-cancel-email-change]')).toBeNull()
    })

    test('a failed request says why', async () => {
      resendState({ error: 'A confirmation email was already sent. You can send another in 4 minutes.' })
      await setup({ ...stored, newEmailAddress: 'new@example.com' })

      expect(q('[data-email-request-error]')!.textContent?.trim()).toBe('A confirmation email was already sent. You can send another in 4 minutes.')
    })

    test('a sent email says so', async () => {
      resendState({ success: true })
      await setup({ ...stored, newEmailAddress: 'new@example.com' })

      expect(q('[data-email-request-sent]')!.textContent?.trim()).toBe('Verification email sent.')
    })

    test.each([
      ['a pending change', { newEmailAddress: 'new@example.com' }],
      ['an unverified address', { emailAddressVerified: false }],
    ])('while throttled, resending %s is disabled with a countdown', async (_, opts) => {
      const resend = resendState({ retryIn: 239 })
      await setup({ ...stored, ...opts })

      const button = q<HTMLButtonElement>('[data-resend-email]')!
      expect(button.getAttribute('aria-disabled')).toBe('true')
      expect(shown(button)).toBe('Resend verification email (3:59)')
      button.click()
      expect(resend.resendVerifyEmail).not.toHaveBeenCalled()
    })

    test('once the wait is over, resending is available again', async () => {
      await setup({ ...stored, newEmailAddress: 'new@example.com' })

      const button = q<HTMLButtonElement>('[data-resend-email]')!
      expect(button.getAttribute('aria-disabled')).toBeNull()
      expect(shown(button)).toBe('Resend verification email')
    })
  })

  describe('deleting', () => {
    test('is the Info tab\'s last section, confirmed by typing the user\'s email', async () => {
      mockConfirm.mockResolvedValue(true)
      const { deleteResource } = await setup()
      tab('Info').click()
      await flushPromises()

      const sections = qa('[data-tab="info"] section')
      expect(sections.at(-1)!.getAttribute('data-testid')).toBe('user-delete-section')
      expect(sections.at(-1)!.querySelector('h3')!.textContent?.trim()).toBe('Delete this user')
      expect(sections.at(-1)!.contains(q('[data-testid="user-delete"]'))).toBe(true)
      q<HTMLButtonElement>('[data-testid="user-delete"]')!.click()
      await flushPromises()

      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Delete “someone”?',
        go: 'Delete user',
        keep: 'Don\'t delete',
        typed: { noun: 'email', value: 'old@example.com' },
      }))
      expect(deleteResource).toHaveBeenCalledWith(expect.objectContaining({ endpoint: userIri }), true)
    })

    test('a cancelled confirm deletes nothing', async () => {
      mockConfirm.mockResolvedValue(false)
      const { deleteResource } = await setup()
      tab('Info').click()
      await flushPromises()
      q<HTMLButtonElement>('[data-testid="user-delete"]')!.click()
      await flushPromises()

      expect(deleteResource).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    test.each([
      ['idle', stored, async () => {}],
      ['unsaved', stored, async () => type('Username', 'renamed')],
      ['changing the email', stored, async () => type('Email', 'new@example.com')],
      ['a pending change', { ...stored, newEmailAddress: 'new@example.com' }, async () => {}],
      ['unverified', { ...stored, emailAddressVerified: false }, async () => {}],
      ['the password tab', stored, async () => {
        tab('Password').click()
        await flushPromises()
      }],
      ['the info tab', stored, async () => {
        tab('Info').click()
        await flushPromises()
      }],
    ])('has no axe violations: %s', async (_, user, act) => {
      await setup(user)
      await act()
      expect(await axe(document.body)).toHaveNoViolations()
    })

    test('has no axe violations with a refused password and a failed request', async () => {
      resendState({ error: 'The email couldn\'t be sent. Please try again.' })
      const { refuseWith422 } = await setup({ ...stored, newEmailAddress: 'pending@example.com' })
      refuseWith422('oldPassword', message)
      await type('Email', 'new@example.com')
      await type('Your current password', 'wrong')
      await clickSave()
      expect(errorOf('Your current password')).toBe(message)
      expect(await axe(document.body)).toHaveNoViolations()
    })

    test('has no axe violations while creating', async () => {
      await setup(stored, { adding: true })
      expect(await axe(document.body)).toHaveNoViolations()
    })
  })
})

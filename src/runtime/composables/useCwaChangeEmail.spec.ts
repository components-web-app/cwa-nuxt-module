// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createFetchError } from 'ofetch'
import * as cwaComposable from '#cwa/composables/cwa'
import { useCwaChangeEmail } from '#cwa/composables/useCwaChangeEmail'

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('#cwa/composables/cwa-toast', () => ({
  useCwaToast: () => ({ show: showToast, dismiss: vi.fn() }),
}))

const ME = '/_/users/me-uuid'

function violationError(propertyPath: string, message: string) {
  return createFetchError({
    options: { method: 'PATCH' },
    response: { status: 422, statusText: '', _data: { violations: [{ propertyPath, message }] } },
  })
}

function mockCwa(answer: (event: any) => { resource?: any, error?: any }, user: Record<string, any> = {}) {
  const errors: any[] = []
  const removeError = vi.fn()
  const updateResource = vi.fn(async (event: any) => {
    const { resource, error } = answer(event)
    if (error) {
      errors.push({ timestamp: 2, event })
    }
    event.onRequest?.(event.endpoint, Promise.resolve({ resource, error }))
    return resource
  })
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue({
    auth: { user: { '@id': ME, 'roles': ['ROLE_ADMIN'], ...user } },
    resourcesManager: { updateResource, removeError, get errors() { return errors } },
  })
  return { updateResource, removeError }
}

afterEach(() => {
  vi.restoreAllMocks()
})

beforeEach(() => {
  showToast.mockReset()
})

describe('useCwaChangeEmail', () => {
  test('it sends the new address with the current password to the signed-in user\'s IRI', async () => {
    const { updateResource } = mockCwa(() => ({ resource: { '@id': ME, 'newEmailAddress': 'new@example.com' } }))
    const { newEmail, oldPassword, submit } = useCwaChangeEmail()
    newEmail.value = 'new@example.com'
    oldPassword.value = 'secret'
    expect(await submit()).toBe(true)
    expect(updateResource).toHaveBeenCalledTimes(1)
    expect(updateResource.mock.calls[0]![0].endpoint).toBe(ME)
    expect(updateResource.mock.calls[0]![0].data).toStrictEqual({ newEmailAddress: 'new@example.com', oldPassword: 'secret' })
    expect([newEmail.value, oldPassword.value]).toStrictEqual(['', ''])
  })

  test('pending is the loaded user\'s address until a write returns the user, then the returned one', async () => {
    const { updateResource } = mockCwa(() => ({ resource: { '@id': ME, 'newEmailAddress': 'returned@example.com' } }), { newEmailAddress: 'loaded@example.com' })
    const { newEmail, oldPassword, submit, pending } = useCwaChangeEmail()
    expect(pending.value).toBe('loaded@example.com')
    newEmail.value = 'returned@example.com'
    oldPassword.value = 'secret'
    await submit()
    expect(updateResource).toHaveBeenCalledTimes(1)
    expect(pending.value).toBe('returned@example.com')
  })

  test('cancel sends exactly a null new address, with no password, and nothing is pending after it', async () => {
    const { updateResource } = mockCwa(() => ({ resource: { '@id': ME } }), { newEmailAddress: 'loaded@example.com' })
    const { oldPassword, cancel, pending } = useCwaChangeEmail()
    oldPassword.value = 'typed but not for cancelling'
    expect(await cancel()).toBe(true)
    expect(updateResource).toHaveBeenCalledTimes(1)
    expect(updateResource.mock.calls[0]![0].endpoint).toBe(ME)
    expect(updateResource.mock.calls[0]![0].data).toStrictEqual({ newEmailAddress: null })
    expect(pending.value).toBeUndefined()
  })

  test.each(['newEmailAddress', 'oldPassword'])('a 422 on %s lands on that field', async (field) => {
    const { updateResource, removeError } = mockCwa(() => ({ error: violationError(field, 'Not this one.') }))
    const { newEmail, oldPassword, submit, fieldErrors } = useCwaChangeEmail()
    newEmail.value = 'taken@example.com'
    oldPassword.value = 'secret'
    expect(await submit()).toBe(false)
    expect(updateResource).toHaveBeenCalledTimes(1)
    expect(fieldErrors.value).toStrictEqual({ [field]: 'Not this one.' })
    expect(removeError).toHaveBeenCalledWith(2)
    expect(showToast).not.toHaveBeenCalled()
    expect(newEmail.value).toBe('taken@example.com')
  })
})

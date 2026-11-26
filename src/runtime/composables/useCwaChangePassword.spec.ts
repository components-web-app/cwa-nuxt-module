// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createFetchError } from 'ofetch'
import * as cwaComposable from '#cwa/composables/cwa'
import { useCwaChangePassword } from '#cwa/composables/useCwaChangePassword'

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

function mockCwa(answer: (event: any) => { resource?: any, error?: any }) {
  const errors: any[] = []
  const removeError = vi.fn()
  const updateResource = vi.fn(async (event: any) => {
    const { resource, error } = answer(event)
    if (error) {
      errors.push({ timestamp: 1, event })
    }
    event.onRequest?.(event.endpoint, Promise.resolve({ resource, error }))
    return resource
  })
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue({
    auth: { user: { '@id': ME, 'roles': ['ROLE_ADMIN'] } },
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

describe('useCwaChangePassword', () => {
  test('it sends only the current and new password to the signed-in user\'s IRI', async () => {
    const { updateResource } = mockCwa(() => ({ resource: { '@id': ME } }))
    const { oldPassword, password, repeatPassword, submit } = useCwaChangePassword()
    oldPassword.value = 'old-secret'
    password.value = 'new-secret'
    repeatPassword.value = 'new-secret'
    await submit()
    expect(updateResource).toHaveBeenCalledTimes(1)
    expect(updateResource.mock.calls[0]![0].endpoint).toBe(ME)
    expect(updateResource.mock.calls[0]![0].data).toStrictEqual({ oldPassword: 'old-secret', plainPassword: 'new-secret' })
  })

  test('a repeat that does not match is a repeatPassword error and sends nothing', async () => {
    const { updateResource } = mockCwa(() => ({ resource: { '@id': ME } }))
    const { oldPassword, password, repeatPassword, submit, fieldErrors, saved } = useCwaChangePassword()
    oldPassword.value = 'old-secret'
    password.value = 'new-secret'
    repeatPassword.value = 'other'
    expect(await submit()).toBe(false)
    expect(fieldErrors.value).toStrictEqual({ repeatPassword: 'The passwords don\'t match.' })
    expect(saved.value).toBe(false)
    expect(updateResource).not.toHaveBeenCalled()
  })

  test('a 422 on oldPassword lands in fieldErrors.oldPassword, and its stored error is dismissed without a toast', async () => {
    const message = 'You have not entered your current password correctly. Please try again.'
    const { updateResource, removeError } = mockCwa(() => ({ error: violationError('oldPassword', message) }))
    const { oldPassword, password, repeatPassword, submit, fieldErrors, saved } = useCwaChangePassword()
    oldPassword.value = 'wrong'
    password.value = 'new-secret'
    repeatPassword.value = 'new-secret'
    expect(await submit()).toBe(false)
    expect(updateResource).toHaveBeenCalledTimes(1)
    expect(fieldErrors.value).toStrictEqual({ oldPassword: message })
    expect(removeError).toHaveBeenCalledWith(1)
    expect(showToast).not.toHaveBeenCalled()
    expect(saved.value).toBe(false)
    expect(oldPassword.value).toBe('wrong')
  })

  test('a failure no field can show is toasted', async () => {
    mockCwa(() => ({ error: createFetchError({ options: { method: 'PATCH' }, response: { status: 500, statusText: '', _data: {} } }) }))
    const { password, repeatPassword, submit, fieldErrors } = useCwaChangePassword()
    password.value = 'new-secret'
    repeatPassword.value = 'new-secret'
    await submit()
    expect(fieldErrors.value).toStrictEqual({})
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }))
  })

  test('success clears all three fields and sets saved', async () => {
    const { updateResource } = mockCwa(() => ({ resource: { '@id': ME } }))
    const { oldPassword, password, repeatPassword, submit, saved, fieldErrors } = useCwaChangePassword()
    fieldErrors.value = { oldPassword: 'earlier' }
    oldPassword.value = 'old-secret'
    password.value = 'new-secret'
    repeatPassword.value = 'new-secret'
    expect(await submit()).toBe(true)
    expect(updateResource).toHaveBeenCalledTimes(1)
    expect([oldPassword.value, password.value, repeatPassword.value]).toStrictEqual(['', '', ''])
    expect(saved.value).toBe(true)
    expect(fieldErrors.value).toStrictEqual({})
  })
})

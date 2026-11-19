// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import RequestErrors from './RequestErrors.vue'
import { ErrorType } from '#cwa/storage/stores/error/state'
import type { CwaErrorEvent } from '#cwa/storage/stores/error/state'
import type { CwaToastOptions } from '#cwa/composables/cwa-toast'

const store = vi.hoisted(() => ({ errors: [] as CwaErrorEvent[], removeError: vi.fn() }))
vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    resourcesManager: {
      get errors() {
        return store.errors
      },
      removeError: store.removeError,
    },
  }),
}))

const claims = vi.hoisted(() => ({ unclaimedViolations: vi.fn((_cwa: unknown, error: { violations?: unknown[] }) => error.violations ?? []) }))
vi.mock('#cwa/admin/write-violations', () => claims)

const toast = vi.hoisted(() => ({ show: vi.fn(), dismiss: vi.fn() }))
vi.mock('#cwa/composables/cwa-toast', () => ({ useCwaToast: () => toast }))

function serverError(timestamp: number, statusCode: number, detail: string): CwaErrorEvent {
  return { type: ErrorType.SERVER, statusCode, detail, violations: [], timestamp }
}

function shown(): CwaToastOptions[] {
  return toast.show.mock.calls.map(([options]) => options)
}

afterEach(() => {
  store.errors = []
  toast.dismiss.mockReset()
  claims.unclaimedViolations.mockReset()
  claims.unclaimedViolations.mockImplementation((_cwa, error) => error.violations ?? [])
})

describe('RequestErrors (#457)', () => {
  test('shows each request error as an error toast with the same words as before', () => {
    store.errors = reactive([
      serverError(1, 500, 'Internal Server Error'),
      { type: ErrorType.NETWORK, statusCode: undefined, detail: 'Failed to fetch', violations: [], timestamp: 2 },
      {
        type: ErrorType.VALIDATION,
        statusCode: 422,
        detail: 'title: This value should not be blank.',
        violations: [{ property: 'title', message: 'This value should not be blank.' }, { property: 'path', message: 'This path is taken.' }],
        timestamp: 3,
      },
    ])
    mount(RequestErrors)

    expect(shown()).toEqual([
      expect.objectContaining({ id: 'cwa-request-error-1', tone: 'error', title: 'Oops! There was a problem.', description: '500: Internal Server Error' }),
      expect.objectContaining({ id: 'cwa-request-error-2', tone: 'error', title: 'Oops! There was a problem.', description: 'Network Error: Failed to fetch' }),
      expect.objectContaining({ id: 'cwa-request-error-3', tone: 'error', title: 'Oops! There was a problem.', description: 'title: This value should not be blank.\npath: This path is taken.' }),
    ])
    expect(shown().every(options => !options.actions)).toBe(true)
  })

  test('a detail that is not a string is shown as it was before', () => {
    store.errors = reactive([serverError(1, 500, { title: 'Oops' } as unknown as string)])
    mount(RequestErrors)

    expect(shown()[0]!.description).toBe('500: {\n  "title": "Oops"\n}')
  })

  test('closing a toast removes its error, and an error removed elsewhere dismisses its toast', async () => {
    store.errors = reactive([serverError(1, 500, 'One'), serverError(2, 500, 'Two')])
    mount(RequestErrors)

    shown()[0]!.onClose!()
    expect(store.removeError).toHaveBeenCalledWith(1)

    store.errors.splice(1, 1)
    await nextTick()
    expect(toast.dismiss).toHaveBeenCalledWith('cwa-request-error-2')
    expect(toast.dismiss).not.toHaveBeenCalledWith('cwa-request-error-1')
  })

  test('a validation error without violations has an empty description, as it had no lines before', () => {
    store.errors = reactive([{ type: ErrorType.VALIDATION, statusCode: 422, detail: 'Invalid', violations: undefined as unknown as [], timestamp: 1 }])
    mount(RequestErrors)

    expect(shown()[0]!.description).toBe('')
  })

  test('a later error gets its own toast', async () => {
    store.errors = reactive([serverError(1, 500, 'One')])
    mount(RequestErrors)
    toast.show.mockClear()

    store.errors.push(serverError(2, 404, 'Not Found'))
    await nextTick()
    expect(shown()).toContainEqual(expect.objectContaining({ id: 'cwa-request-error-2', description: '404: Not Found' }))
  })

  test('a save failure a field model reports through onRequest shows in its field and outline, never as a toast (#461)', () => {
    const endpoint = '/component/html_contents/one'
    store.errors = reactive([
      { ...serverError(1, 500, 'Field save'), event: { endpoint, data: { html: '<p>x</p>' }, onRequest: () => {} } },
      { ...serverError(2, 500, 'Modal save'), event: { endpoint, data: { html: '<p>x</p>' } } },
    ])
    mount(RequestErrors)

    expect(shown().map(options => options.id)).toEqual(['cwa-request-error-2'])
  })

  test('leaving the admin dismisses the toasts it raised, so no error stays on the public page', async () => {
    store.errors = reactive([serverError(1, 500, 'One'), serverError(2, 500, 'Two')])
    const wrapper = mount(RequestErrors)
    store.errors.splice(0, 1)
    await nextTick()
    toast.dismiss.mockClear()

    wrapper.unmount()
    expect(toast.dismiss.mock.calls).toEqual([['cwa-request-error-2']])
  })

  test('violations the bar put on the selected resource\'s fields are left out of the toast, which lists only the rest (#461)', () => {
    const credit = { property: 'credit', message: 'This value is too long.' }
    const error = { type: ErrorType.VALIDATION, statusCode: 422, detail: '', violations: [{ property: 'file', message: 'Upload a file.' }, credit], timestamp: 1 } as CwaErrorEvent
    claims.unclaimedViolations.mockImplementation(() => [credit])
    store.errors = reactive([error])
    mount(RequestErrors)

    expect(claims.unclaimedViolations).toHaveBeenCalledWith(expect.anything(), error)
    expect(shown()).toEqual([expect.objectContaining({ id: 'cwa-request-error-1', description: 'credit: This value is too long.' })])
    expect(store.removeError).not.toHaveBeenCalled()
  })

  test('a refusal whose every violation went to a field raises no toast and leaves the store, so the fields alone show it (#461)', () => {
    store.errors = reactive([
      { type: ErrorType.VALIDATION, statusCode: 422, detail: '', violations: [{ property: 'file', message: 'Upload a file.' }], timestamp: 1 },
      serverError(2, 500, 'Other'),
    ])
    claims.unclaimedViolations.mockImplementation(() => [])
    mount(RequestErrors)

    expect(shown().map(options => options.id)).toEqual(['cwa-request-error-2'])
    expect(store.removeError).toHaveBeenCalledExactlyOnceWith(1)
  })
})

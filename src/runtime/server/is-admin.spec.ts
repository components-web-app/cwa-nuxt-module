// @vitest-environment node

import { describe, expect, test, vi, beforeEach } from 'vitest'

const mockFetcher = vi.fn()

vi.mock('./useFetcher', () => ({
  default: () => ({ fetcher: mockFetcher }),
}))

const importIsAdmin = async () => (await import('./is-admin')).isAdmin

describe('isAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('does not call the API without a cookie', async () => {
    const isAdmin = await importIsAdmin()

    await expect(isAdmin(undefined, 3000)).resolves.toBe(false)
    expect(mockFetcher).not.toHaveBeenCalled()
  })

  test.each([['ROLE_ADMIN'], ['ROLE_SUPER_ADMIN'], ['ROLE_USER', 'ROLE_ADMIN']])('confirms an admin with roles %s', async (...roles) => {
    mockFetcher.mockResolvedValue({ roles })
    const isAdmin = await importIsAdmin()

    await expect(isAdmin('api_component=jwt', 3000)).resolves.toBe(true)
  })

  test('forwards the cookie and the timeout to the API', async () => {
    mockFetcher.mockResolvedValue({ roles: ['ROLE_ADMIN'] })
    const isAdmin = await importIsAdmin()

    await isAdmin('api_component=jwt; cwa_auth=1', 1234)

    expect(mockFetcher).toHaveBeenCalledWith('/me', { headers: { cookie: 'api_component=jwt; cwa_auth=1' }, timeout: 1234 })
  })

  test.each([
    ['a user without an admin role', { roles: ['ROLE_USER'] }],
    ['a response with no roles', {}],
    ['a response whose roles are not an array', { roles: 'ROLE_ADMIN' }],
  ])('refuses %s', async (_name, user) => {
    mockFetcher.mockResolvedValue(user)
    const isAdmin = await importIsAdmin()

    await expect(isAdmin('api_component=jwt', 3000)).resolves.toBe(false)
  })

  test('refuses when the API request fails', async () => {
    mockFetcher.mockRejectedValue(new Error('timeout'))
    const isAdmin = await importIsAdmin()

    await expect(isAdmin('api_component=jwt', 3000)).resolves.toBe(false)
  })
})

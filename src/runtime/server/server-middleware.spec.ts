// @vitest-environment node

import { describe, expect, test, vi, beforeEach } from 'vitest'

const mockParseCookies = vi.fn()
const mockGetRequestURL = vi.fn()
const mockJwtDecode = vi.fn()
const mockUpdateSiteConfig = vi.fn()
const mockResolveConfigEventHandler = vi.fn()
const mockResolvedConfigToSiteConfig = vi.fn(c => c)

vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  parseCookies: (...args: any[]) => mockParseCookies(...args),
  getRequestURL: (...args: any[]) => mockGetRequestURL(...args),
  createError: (opts: any) => {
    const err = new Error(opts.statusMessage) as any
    err.statusCode = opts.statusCode
    err.statusMessage = opts.statusMessage
    return err
  },
}))

vi.mock('jwt-decode', () => ({
  jwtDecode: (...args: any[]) => mockJwtDecode(...args),
}))

vi.mock('#cwa/composables/useCwaSiteConfig', () => ({
  default: () => ({ resolvedConfigToSiteConfig: mockResolvedConfigToSiteConfig }),
}))

vi.mock('#site-config/server/composables', () => ({
  updateSiteConfig: (...args: any[]) => mockUpdateSiteConfig(...args),
}))

vi.mock('#cwa/server/useFetcher', () => ({
  resolveConfigEventHandler: (...args: any[]) => mockResolveConfigEventHandler(...args),
}))

const importHandler = async () => (await import('./server-middleware')).default

const createEvent = (overrides: Partial<{ path: string, context: any }> = {}) => ({
  path: overrides.path ?? '/',
  context: overrides.context ?? {},
})

const validAdminToken = () => ({ roles: ['ROLE_ADMIN'], exp: Math.floor(Date.now() / 1e3) + 3600 })

describe('server-middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolvedConfigToSiteConfig.mockImplementation(c => c)
  })

  test('does nothing when no resolved config', async () => {
    mockResolveConfigEventHandler.mockResolvedValue(undefined)
    const handler = await importHandler()

    await expect(handler(createEvent())).resolves.toBeUndefined()
    expect(mockUpdateSiteConfig).not.toHaveBeenCalled()
  })

  test('updates site config and returns when maintenance disabled', async () => {
    mockResolveConfigEventHandler.mockResolvedValue({ maintenanceModeEnabled: false })
    const handler = await importHandler()
    const e = createEvent()

    await expect(handler(e)).resolves.toBeUndefined()
    expect(mockUpdateSiteConfig).toHaveBeenCalledWith(e, { maintenanceModeEnabled: false })
  })

  test('skips maintenance checks when context.skipMaintenanceChecks is true', async () => {
    mockResolveConfigEventHandler.mockResolvedValue({ maintenanceModeEnabled: true })
    const handler = await importHandler()

    await expect(handler(createEvent({ context: { skipMaintenanceChecks: true } }))).resolves.toBeUndefined()
    expect(mockParseCookies).not.toHaveBeenCalled()
  })

  test.each(['/sitemap.xml', '/sitemap_index.xml', '/robots.txt'])('skips maintenance checks for allowed path %s', async (path) => {
    mockResolveConfigEventHandler.mockResolvedValue({ maintenanceModeEnabled: true })
    const handler = await importHandler()

    await expect(handler(createEvent({ path }))).resolves.toBeUndefined()
    expect(mockParseCookies).not.toHaveBeenCalled()
  })

  test('skips maintenance checks for __sitemap__ regex path', async () => {
    mockResolveConfigEventHandler.mockResolvedValue({ maintenanceModeEnabled: true })
    const handler = await importHandler()

    await expect(handler(createEvent({ path: '/__sitemap__/cwa-urls' }))).resolves.toBeUndefined()
    expect(mockParseCookies).not.toHaveBeenCalled()
  })

  test('throws 503 when maintenance enabled and no auth cookies', async () => {
    mockResolveConfigEventHandler.mockResolvedValue({ maintenanceModeEnabled: true })
    mockParseCookies.mockReturnValue({})
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/some-page'))
    const handler = await importHandler()

    await expect(handler(createEvent({ path: '/some-page' }))).rejects.toMatchObject({ statusCode: 503 })
  })

  test('throws 503 when cwa_auth cookie is not "1"', async () => {
    mockResolveConfigEventHandler.mockResolvedValue({ maintenanceModeEnabled: true })
    mockParseCookies.mockReturnValue({ cwa_auth: '0', api_component: 'token' })
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/some-page'))
    const handler = await importHandler()

    await expect(handler(createEvent({ path: '/some-page' }))).rejects.toMatchObject({ statusCode: 503 })
    expect(mockJwtDecode).not.toHaveBeenCalled()
  })

  test('bypasses maintenance for valid admin JWT', async () => {
    mockResolveConfigEventHandler.mockResolvedValue({ maintenanceModeEnabled: true })
    mockParseCookies.mockReturnValue({ cwa_auth: '1', api_component: 'token' })
    mockJwtDecode.mockReturnValue(validAdminToken())
    const handler = await importHandler()

    await expect(handler(createEvent({ path: '/some-page' }))).resolves.toBeUndefined()
    expect(mockGetRequestURL).not.toHaveBeenCalled()
  })

  test('throws 503 when JWT has no admin role', async () => {
    mockResolveConfigEventHandler.mockResolvedValue({ maintenanceModeEnabled: true })
    mockParseCookies.mockReturnValue({ cwa_auth: '1', api_component: 'token' })
    mockJwtDecode.mockReturnValue({ roles: ['ROLE_USER'], exp: Math.floor(Date.now() / 1e3) + 3600 })
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/some-page'))
    const handler = await importHandler()

    await expect(handler(createEvent({ path: '/some-page' }))).rejects.toMatchObject({ statusCode: 503 })
  })

  test('throws 503 when JWT roles missing or not an array', async () => {
    mockResolveConfigEventHandler.mockResolvedValue({ maintenanceModeEnabled: true })
    mockParseCookies.mockReturnValue({ cwa_auth: '1', api_component: 'token' })
    mockJwtDecode.mockReturnValue({ exp: Math.floor(Date.now() / 1e3) + 3600 })
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/some-page'))
    const handler = await importHandler()

    await expect(handler(createEvent({ path: '/some-page' }))).rejects.toMatchObject({ statusCode: 503 })
  })

  test('throws 503 when JWT has no exp', async () => {
    mockResolveConfigEventHandler.mockResolvedValue({ maintenanceModeEnabled: true })
    mockParseCookies.mockReturnValue({ cwa_auth: '1', api_component: 'token' })
    mockJwtDecode.mockReturnValue({ roles: ['ROLE_ADMIN'] })
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/some-page'))
    const handler = await importHandler()

    await expect(handler(createEvent({ path: '/some-page' }))).rejects.toMatchObject({ statusCode: 503 })
  })

  test('throws 503 when JWT is expired', async () => {
    mockResolveConfigEventHandler.mockResolvedValue({ maintenanceModeEnabled: true })
    mockParseCookies.mockReturnValue({ cwa_auth: '1', api_component: 'token' })
    mockJwtDecode.mockReturnValue({ roles: ['ROLE_ADMIN'], exp: Math.floor(Date.now() / 1e3) - 10 })
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/some-page'))
    const handler = await importHandler()

    await expect(handler(createEvent({ path: '/some-page' }))).rejects.toMatchObject({ statusCode: 503 })
  })

  test('throws 503 when jwtDecode throws', async () => {
    mockResolveConfigEventHandler.mockResolvedValue({ maintenanceModeEnabled: true })
    mockParseCookies.mockReturnValue({ cwa_auth: '1', api_component: 'bad-token' })
    mockJwtDecode.mockImplementation(() => {
      throw new Error('invalid')
    })
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/some-page'))
    const handler = await importHandler()

    await expect(handler(createEvent({ path: '/some-page' }))).rejects.toMatchObject({ statusCode: 503 })
  })

  test.each(['/__nuxt_error', '/login'])('does not throw for allowed path %s during maintenance', async (pathname) => {
    mockResolveConfigEventHandler.mockResolvedValue({ maintenanceModeEnabled: true })
    mockParseCookies.mockReturnValue({})
    mockGetRequestURL.mockReturnValue(new URL(`https://example.com${pathname}`))
    const handler = await importHandler()

    await expect(handler(createEvent({ path: pathname }))).resolves.toBeUndefined()
  })

  test('does not throw for /_cwa paths during maintenance', async () => {
    mockResolveConfigEventHandler.mockResolvedValue({ maintenanceModeEnabled: true })
    mockParseCookies.mockReturnValue({})
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/_cwa/healthcheck'))
    const handler = await importHandler()

    await expect(handler(createEvent({ path: '/_cwa/healthcheck' }))).resolves.toBeUndefined()
  })
})

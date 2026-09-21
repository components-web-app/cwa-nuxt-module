// @vitest-environment nuxt

import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('#build/cwa-options', () => ({
  options: { auth: { clearCachesOnSessionEnd: ['cwa-api'] } },
  currentModulePackageInfo: { name: '@cwa/nuxt', version: '0.0.0' },
}))

const importPlugin = async () => (await import('./plugin-session-caches.client')).default

describe('cwa session caches plugin', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('registers a session end handler that deletes the configured caches', async () => {
    const cacheStorage = { delete: vi.fn(async () => true) }
    vi.stubGlobal('caches', cacheStorage)
    const onSessionEnd = vi.fn()
    const plugin = await importPlugin()

    plugin.setup({ $cwa: { auth: { onSessionEnd } } } as never)

    expect(onSessionEnd).toHaveBeenCalledTimes(1)
    await onSessionEnd.mock.calls[0][0]()
    expect(cacheStorage.delete).toHaveBeenCalledWith('cwa-api')
    expect(cacheStorage.delete).toHaveBeenCalledTimes(1)
  })

  test('runs after the cwa plugin', async () => {
    const plugin = await importPlugin()

    expect(plugin.dependsOn).toEqual(['cwa-plugin'])
  })
})

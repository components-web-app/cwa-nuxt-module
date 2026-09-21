import { afterEach, describe, expect, test, vi } from 'vitest'
import { clearSessionCaches } from './session-caches'

function stubCacheStorage(names: string[]) {
  const store = new Set(names)
  const cacheStorage = {
    delete: vi.fn(async (name: string) => store.delete(name)),
  }
  vi.stubGlobal('caches', cacheStorage)
  return { store, cacheStorage }
}

describe('clearSessionCaches', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('deletes each configured cache', async () => {
    const { store, cacheStorage } = stubCacheStorage(['cwa-api', 'cwa-images'])

    await clearSessionCaches(['cwa-api', 'cwa-images'])

    expect(cacheStorage.delete).toHaveBeenCalledWith('cwa-api')
    expect(cacheStorage.delete).toHaveBeenCalledWith('cwa-images')
    expect([...store]).toEqual([])
  })

  test('does not delete the Workbox precache', async () => {
    const precache = 'workbox-precache-v2-https://example.test/'
    const { store, cacheStorage } = stubCacheStorage([precache, 'cwa-api'])

    await clearSessionCaches(['cwa-api'])

    expect([...store]).toEqual([precache])
    expect(cacheStorage.delete).toHaveBeenCalledTimes(1)
  })

  test('does nothing for an empty list', async () => {
    const { cacheStorage } = stubCacheStorage(['cwa-api'])

    await clearSessionCaches([])

    expect(cacheStorage.delete).not.toHaveBeenCalled()
  })

  test('resolves without deleting anything when Cache Storage is unavailable', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'caches')
    Reflect.deleteProperty(globalThis, 'caches')

    try {
      expect('caches' in globalThis).toBe(false)
      await expect(clearSessionCaches(['cwa-api'])).resolves.toBeUndefined()
    }
    finally {
      if (original) {
        Object.defineProperty(globalThis, 'caches', original)
      }
    }
  })

  test('a failing delete never rejects and does not stop the other caches being deleted', async () => {
    const { store, cacheStorage } = stubCacheStorage(['cwa-api', 'cwa-images'])
    cacheStorage.delete.mockImplementationOnce(async () => {
      throw new Error('SecurityError')
    })

    await expect(clearSessionCaches(['cwa-api', 'cwa-images'])).resolves.toBeUndefined()

    expect([...store]).toEqual(['cwa-api'])
  })

  test('a delete that throws synchronously never rejects', async () => {
    const { cacheStorage } = stubCacheStorage(['cwa-api'])
    cacheStorage.delete.mockImplementationOnce(() => {
      throw new Error('SecurityError')
    })

    await expect(clearSessionCaches(['cwa-api'])).resolves.toBeUndefined()
  })
})

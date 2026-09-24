// @vitest-environment nuxt

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { computed, ref } from 'vue'
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'

const mockEvent = vi.hoisted(() => ({ value: undefined as undefined | { context: Record<string, unknown>, headers: Headers } }))
mockNuxtImport('useRequestEvent', () => () => mockEvent.value)

vi.mock('#build/cwa-options', () => ({
  options: { pageCache: { enabled: true, sharedMaxAge: 300, staleWhileRevalidate: 0 } },
  currentModulePackageInfo: { name: '@cwa/nuxt', version: '0.0.0' },
}))

const importPlugin = async () => (await import('./plugin-page-cache.server')).default

function createNuxtApp(cwa: Record<string, unknown>) {
  const hooks: Record<string, () => void> = {}
  return {
    nuxtApp: {
      $cwa: cwa,
      hook: (name: string, fn: () => void) => {
        hooks[name] = fn
      },
    },
    rendered: () => hooks['app:rendered']?.(),
  }
}

function createCwa(overrides: Record<string, any> = {}) {
  return {
    auth: { signedIn: computed(() => false) },
    resources: { allIds: ['/_api/_/routes//', '/_api/component/titles/abc'] },
    apiHttpCacheState: { storable: true, sharedMaxAge: undefined },
    ...overrides,
  }
}

describe('cwa page cache plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ResourceTypeFromIri.setPathPrefix('/_api')
    mockEvent.value = { context: {}, headers: new Headers() }
  })

  afterEach(() => {
    ResourceTypeFromIri.setPathPrefix(undefined)
  })

  test('marks the request as a CWA render during setup, before anything renders', async () => {
    const plugin = await importPlugin()
    const { nuxtApp } = createNuxtApp(createCwa())

    plugin.setup(nuxtApp as never)

    expect(mockEvent.value!.context.cwaPageCache).toEqual({})
  })

  test('writes the computed decision onto the request event context at app:rendered', async () => {
    const plugin = await importPlugin()
    const { nuxtApp, rendered } = createNuxtApp(createCwa())

    plugin.setup(nuxtApp as never)
    rendered()

    expect(mockEvent.value!.context.cwaPageCache).toEqual({
      surrogateKey: 'cwa-html, /_api/_/routes//, /_api/component/titles/abc',
      cacheControl: 'public, max-age=0, s-maxage=300',
    })
  })

  test('caps the TTL at an API supplied bound', async () => {
    const plugin = await importPlugin()
    const { nuxtApp, rendered } = createNuxtApp(createCwa({
      apiHttpCacheState: { storable: true, sharedMaxAge: 45 },
    }))

    plugin.setup(nuxtApp as never)
    rendered()

    expect((mockEvent.value!.context.cwaPageCache as { cacheControl: string }).cacheControl)
      .toBe('public, max-age=0, s-maxage=45')
  })

  test('declines for a signed-in render even when every API response was storable', async () => {
    const plugin = await importPlugin()
    const { nuxtApp, rendered } = createNuxtApp(createCwa({
      auth: { signedIn: ref(true) },
    }))

    plugin.setup(nuxtApp as never)
    rendered()

    expect(mockEvent.value!.context.cwaPageCache).toEqual({ unstorable: true })
  })

  test('does nothing when there is no request event', async () => {
    mockEvent.value = undefined
    const plugin = await importPlugin()
    const { nuxtApp, rendered } = createNuxtApp(createCwa())

    expect(() => plugin.setup(nuxtApp as never)).not.toThrow()
    expect(() => rendered()).not.toThrow()
  })

  describe('#340 the internal error render', () => {
    beforeEach(() => {
      mockEvent.value = { context: {}, headers: new Headers({ 'x-nuxt-error': 'true' }) }
    })

    test('declines, although Nitro sees the error render itself as a 200', async () => {
      const plugin = await importPlugin()
      const { nuxtApp, rendered } = createNuxtApp(createCwa())

      plugin.setup(nuxtApp as never)
      rendered()

      expect(mockEvent.value!.context.cwaPageCache).toEqual({ unstorable: true })
    })

    test('declines even when every API response the error page made was storable', async () => {
      const plugin = await importPlugin()
      const { nuxtApp, rendered } = createNuxtApp(createCwa({
        apiHttpCacheState: { storable: true, sharedMaxAge: 600 },
      }))

      plugin.setup(nuxtApp as never)
      rendered()

      expect(mockEvent.value!.context.cwaPageCache).not.toHaveProperty('surrogateKey')
      expect(mockEvent.value!.context.cwaPageCache).toEqual({ unstorable: true })
    })
  })
})

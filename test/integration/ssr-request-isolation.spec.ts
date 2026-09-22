// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { executeAsync, getContext } from 'unctx'
import { createNuxtApp, useNuxtApp } from '#app/nuxt'
import type { NuxtApp } from '#app/nuxt'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import FetchStatusManager from '#cwa/api/fetcher/fetch-status-manager'
import { createCwaResourceError } from '#cwa/errors/cwa-resource-error'

const ROUTE = '/_api/_/routes//page'
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let nuxtAppContext: ReturnType<typeof getContext<NuxtApp>>
let testNuxtApp: NuxtApp | null

function createRequestApp() {
  const app = createNuxtApp({ vueApp: createApp({}) } as never)
  app.runWithContext = (fn => nuxtAppContext.callAsync(app, fn as never)) as NuxtApp['runWithContext']
  return app
}

function createRequestManager(app: NuxtApp) {
  setActivePinia(createPinia())
  const manager = new FetchStatusManager(
    new FetcherStore('cwa'),
    { setMercureHubFromLinkHeader() {} } as never,
    { setDocsPathFromLinkHeader() {} } as never,
    new ResourcesStore('cwa'),
    undefined,
    app,
  )
  const { token } = manager.startFetch({ path: ROUTE, isPrimary: true })
  return { manager, token }
}

function leakContextFromTransformedCode(app: NuxtApp) {
  return nuxtAppContext.callAsync(app, async () => {
    const [pending, restore] = executeAsync(() => wait(5))
    await pending
    restore()
    await wait(30)
  })
}

describe('#313 concurrent SSR requests keep their own Nuxt app', () => {
  beforeEach(() => {
    nuxtAppContext ||= getContext<NuxtApp>(useNuxtApp()._id)
    testNuxtApp = nuxtAppContext.tryUse()
    nuxtAppContext.unset()
  })

  afterEach(() => {
    nuxtAppContext.unset()
    if (testNuxtApp) {
      nuxtAppContext.set(testNuxtApp)
    }
  })

  test('a primary 404 sets the error on its own request and not on a concurrent one', async () => {
    const appA = createRequestApp()
    const appB = createRequestApp()
    const { manager, token } = createRequestManager(appA)

    await Promise.all([
      nuxtAppContext.callAsync(appA, async () => {
        await wait(15)
        manager.finishFetchResource({
          resource: ROUTE,
          path: ROUTE,
          token,
          success: false,
          error: createCwaResourceError({ statusCode: 404, statusMessage: 'Not Found' }),
        })
      }),
      leakContextFromTransformedCode(appB),
    ])

    expect(appA.payload.error?.statusCode).toBe(404)
    expect(appB.payload.error).toBeUndefined()
  })

  test('a primary success does not clear the error page of a concurrent request', async () => {
    const appA = createRequestApp()
    const appB = createRequestApp()
    const errorPagePayload: Record<string, unknown> = { error: true, statusCode: 404, statusMessage: 'Not Found', url: '/missing' }
    appB.payload.error = errorPagePayload as unknown as NuxtApp['payload']['error']
    const { manager, token } = createRequestManager(appA)

    await Promise.all([
      nuxtAppContext.callAsync(appA, async () => {
        await wait(15)
        manager.finishFetchResource({
          resource: ROUTE,
          path: ROUTE,
          token,
          success: true,
          fetchResponse: {
            _data: { '@id': ROUTE, '@type': 'Route', 'path': '/page', '_metadata': { persisted: true } },
            headers: new Headers(),
          } as never,
          headers: {},
        })
      }),
      leakContextFromTransformedCode(appB),
    ])

    expect(appA.payload.error).toBeUndefined()
    expect(appB.payload.error?.statusCode).toBe(404)
  })
})

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { START_LOCATION } from 'vue-router'
import routerOptions from './router.options'
import { SCROLL_TARGET_TIMEOUT } from './scroll/wait-for-scroll-target'
import type { WaitForScrollTargetOps } from './scroll/wait-for-scroll-target'

const { hooks, routerState, waitForScrollTarget, cwaState, useNuxtApp } = vi.hoisted(() => ({
  hooks: { pageLoadingEnd: [] as (() => void)[] },
  routerState: { fullPath: '/target', scrollBehaviorType: 'auto' as string },
  cwaState: { loading: false },
  waitForScrollTarget: vi.fn(),
  useNuxtApp: vi.fn(),
}))

vi.mock('#app/nuxt', () => ({ useNuxtApp }))

vi.mock('#app/composables/router', () => ({
  useRouter: () => ({
    options: { scrollBehaviorType: routerState.scrollBehaviorType },
    currentRoute: {
      get value() {
        return { fullPath: routerState.fullPath }
      },
    },
  }),
}))

vi.mock('./scroll/wait-for-scroll-target', async () => {
  const actual = await vi.importActual<typeof import('./scroll/wait-for-scroll-target')>('./scroll/wait-for-scroll-target')
  return {
    ...actual,
    waitForScrollTarget,
  }
})

const scrollBehavior = routerOptions.scrollBehavior!

function route(path: string, extra: Record<string, unknown> = {}) {
  return {
    path,
    hash: '',
    fullPath: path,
    meta: {},
    matched: [],
    ...extra,
  } as never
}

async function flushPageLoad() {
  for (const cb of hooks.pageLoadingEnd.splice(0)) {
    cb()
  }
  await new Promise(resolve => requestAnimationFrame(() => resolve(null)))
  await Promise.resolve()
  await Promise.resolve()
}

describe('CWA router options scrollBehavior', () => {
  beforeEach(() => {
    hooks.pageLoadingEnd.length = 0
    routerState.fullPath = '/target'
    routerState.scrollBehaviorType = 'auto'
    cwaState.loading = false
    waitForScrollTarget.mockResolvedValue(true)
    useNuxtApp.mockImplementation(() => ({
      hooks: {
        hookOnce: (name: string, cb: () => void) => {
          if (name === 'page:loading:end') {
            hooks.pageLoadingEnd.push(cb)
          }
        },
      },
      $cwa: { resources: { isLoading: { value: cwaState.loading } } },
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('navigations that must not wait for content', () => {
    test('an in-page anchor on the same path resolves synchronously with the configured behaviour', () => {
      routerState.scrollBehaviorType = 'smooth'

      const result = scrollBehavior(route('/about', { hash: '#contact', fullPath: '/about#contact' }), route('/about'), null)

      expect(result).toEqual({ el: '#contact', top: 0, behavior: 'smooth' })
      expect(waitForScrollTarget).not.toHaveBeenCalled()
    })

    test('leaving an anchor for the bare same path restores the saved position', () => {
      const saved = { left: 0, top: 120 }

      const result = scrollBehavior(route('/about'), route('/about', { hash: '#contact' }), saved)

      expect(result).toBe(saved)
    })

    test('leaving an anchor for the bare same path with nothing saved goes to the top', () => {
      const result = scrollBehavior(route('/about'), route('/about', { hash: '#contact' }), null)

      expect(result).toEqual({ left: 0, top: 0 })
    })

    test('the same path with no anchor at either end does not scroll', () => {
      const result = scrollBehavior(route('/about'), route('/about'), null)

      expect(result).toBe(false)
    })

    test('a route opting out of scrolling does not scroll', () => {
      const result = scrollBehavior(route('/about', { meta: { scrollToTop: false } }), route('/'), null)

      expect(result).toBe(false)
    })

    test('a route opting out of scrolling through a function does not scroll', () => {
      const result = scrollBehavior(route('/about', { meta: { scrollToTop: () => false } }), route('/'), null)

      expect(result).toBe(false)
    })

    test('a plain forward navigation goes to the top without waiting for content', async () => {
      routerState.fullPath = '/about'
      const result = scrollBehavior(route('/about'), route('/'), null)

      await flushPageLoad()

      await expect(result).resolves.toEqual({ left: 0, top: 0 })
      expect(waitForScrollTarget).not.toHaveBeenCalled()
    })
  })

  describe('navigations that wait for content', () => {
    test('a restored position waits for the document to be tall enough to honour it', async () => {
      routerState.fullPath = '/about'
      const saved = { left: 0, top: 900 }

      const result = scrollBehavior(route('/about'), route('/'), saved)
      await flushPageLoad()

      await expect(result).resolves.toBe(saved)
      const ops = waitForScrollTarget.mock.calls[0][0] as WaitForScrollTargetOps
      expect(ops.target).toEqual({ height: 900 + window.innerHeight })
      expect(ops.timeout).toBe(SCROLL_TARGET_TIMEOUT)
    })

    test('the wait reads the loading state from the CWA resources getter', async () => {
      routerState.fullPath = '/about'
      cwaState.loading = true

      const result = scrollBehavior(route('/about'), route('/'), { left: 0, top: 900 })
      await flushPageLoad()
      await result

      const ops = waitForScrollTarget.mock.calls[0][0] as WaitForScrollTargetOps
      expect(ops.isLoading()).toBe(true)
    })

    test('the nuxt app is read while the navigation context is live, not from the animation frame', async () => {
      routerState.fullPath = '/about'

      const result = scrollBehavior(route('/about'), route('/'), { left: 0, top: 900 })
      const callsWhileInContext = useNuxtApp.mock.calls.length
      await flushPageLoad()
      await result

      expect(callsWhileInContext).toBeGreaterThan(0)
      expect(useNuxtApp).toHaveBeenCalledTimes(callsWhileInContext)
    })

    test('a cross-page anchor waits for its element and scrolls instantly when it had to wait', async () => {
      routerState.fullPath = '/about#contact'

      const result = scrollBehavior(route('/about', { hash: '#contact', fullPath: '/about#contact' }), route('/'), null)
      await flushPageLoad()

      await expect(result).resolves.toEqual({ el: '#contact', top: 0, behavior: 'instant' })
      const ops = waitForScrollTarget.mock.calls[0][0] as WaitForScrollTargetOps
      expect(ops.target).toEqual({ selector: '#contact' })
    })

    test('a cross-page anchor whose element is already present keeps the configured behaviour', async () => {
      routerState.fullPath = '/about#contact'
      routerState.scrollBehaviorType = 'smooth'
      waitForScrollTarget.mockResolvedValue(false)

      const result = scrollBehavior(route('/about', { hash: '#contact', fullPath: '/about#contact' }), route('/'), null)
      await flushPageLoad()

      await expect(result).resolves.toEqual({ el: '#contact', top: 0, behavior: 'smooth' })
    })

    test('a deep-linked anchor on a first load waits without a page load hook', async () => {
      routerState.fullPath = '/about#contact'

      const result = scrollBehavior(route('/about', { hash: '#contact', fullPath: '/about#contact' }), START_LOCATION as never, null)

      await expect(result).resolves.toEqual({ el: '#contact', top: 0, behavior: 'instant' })
      expect(waitForScrollTarget).toHaveBeenCalled()
    })

    test('a first load with no anchor goes to the top without waiting', async () => {
      routerState.fullPath = '/about'

      const result = scrollBehavior(route('/about'), START_LOCATION as never, null)

      await expect(result).resolves.toEqual({ left: 0, top: 0 })
      expect(waitForScrollTarget).not.toHaveBeenCalled()
    })
  })

  describe('superseded navigations', () => {
    test('a navigation replaced before the page loads does not scroll', async () => {
      routerState.fullPath = '/elsewhere'

      const result = scrollBehavior(route('/about'), route('/'), { left: 0, top: 900 })
      await flushPageLoad()

      await expect(result).resolves.toBe(false)
      expect(waitForScrollTarget).not.toHaveBeenCalled()
    })

    test('a navigation replaced while waiting for content does not scroll', async () => {
      routerState.fullPath = '/about'
      waitForScrollTarget.mockImplementation(() => {
        routerState.fullPath = '/elsewhere'
        return Promise.resolve(true)
      })

      const result = scrollBehavior(route('/about'), route('/'), { left: 0, top: 900 })
      await flushPageLoad()

      await expect(result).resolves.toBe(false)
    })
  })
})

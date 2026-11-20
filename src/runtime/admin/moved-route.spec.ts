import { describe, test, expect, vi } from 'vitest'
import { followMovedRoute } from './moved-route'

function setup(options: { path?: string, key?: string, data?: Record<string, any>, fails?: boolean, navigationDisabled?: boolean } = {}) {
  const fetch = vi.fn(() => ({
    response: options.fails ? Promise.reject(new Error('offline')) : Promise.resolve({ _data: options.data ?? {} }),
  }))
  const $cwa = { fetch, navigationDisabled: options.navigationDisabled ?? false }
  const replace = vi.fn()
  const router = {
    currentRoute: { value: { path: options.path ?? '/blog/my-post', query: { tab: 'a' }, hash: '#comments', meta: { key: options.key ?? 'cwa-page' } } },
    replace,
  }
  return { $cwa, router, fetch, replace }
}

describe('following a route moved with its page (api-components-bundle#603)', () => {
  test('the path on screen, now a redirect, is replaced by where it leads, keeping the query and hash', async () => {
    const { $cwa, router, fetch, replace } = setup({ data: { redirectPath: '/news/my-post' } })
    await followMovedRoute($cwa as any, router as any)
    expect(fetch).toHaveBeenCalledWith({ path: '/_/routes//blog/my-post' })
    expect(replace).toHaveBeenCalledWith({ path: '/news/my-post', query: { tab: 'a' }, hash: '#comments' })
  })

  test('while editing it carries cwa_force, so the editing guard lets it through', async () => {
    const { $cwa, router, replace } = setup({ data: { redirectPath: '/news/my-post' }, navigationDisabled: true })
    await followMovedRoute($cwa as any, router as any)
    expect(replace).toHaveBeenCalledWith({ path: '/news/my-post', query: { tab: 'a', cwa_force: 'true' }, hash: '#comments' })
  })

  test('a path that still leads to its page is left as it is', async () => {
    const { $cwa, router, replace } = setup({ data: { path: '/blog/my-post' } })
    await followMovedRoute($cwa as any, router as any)
    expect(replace).not.toHaveBeenCalled()
  })

  test('an admin page is never looked up', async () => {
    const { $cwa, router, fetch, replace } = setup({ path: '/_cwa/pages', key: undefined })
    router.currentRoute.value.meta = {} as any
    await followMovedRoute($cwa as any, router as any)
    expect(fetch).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  test('a lookup that fails leaves the address as it is', async () => {
    const { $cwa, router, replace } = setup({ fails: true })
    await expect(followMovedRoute($cwa as any, router as any)).resolves.toBeUndefined()
    expect(replace).not.toHaveBeenCalled()
  })
})

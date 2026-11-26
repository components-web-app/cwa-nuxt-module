// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import * as nuxt from 'nuxt/app'
import extensionAreaMiddleware from './extension-area-middleware'

vi.mock('#build/cwa-extension-areas', () => ({
  extensionAreas: [{
    segment: 'ecommerce',
    label: 'E-commerce',
    pages: [
      { path: 'orders', label: 'Orders', role: 'ROLE_SHOP_ORDERS' },
      { path: 'products', label: 'Products', role: 'ROLE_SHOP_PRODUCTS' },
      { path: 'payments', label: 'Payments', role: 'ROLE_ADMIN' },
    ],
  }],
}))

function route(name: string): RouteLocationNormalized {
  return { name, path: '', fullPath: '', query: { q: '1' }, hash: '#top', matched: [], params: {}, meta: {}, redirectedFrom: undefined }
}

function withRoles(roles: string[]) {
  vi.spyOn(nuxt, 'useNuxtApp').mockImplementation(() => ({ $cwa: { auth: { hasRole: (role: string) => roles.includes(role) } } }) as never)
}

describe('opening an extension area', () => {
  beforeEach(() => {
    vi.spyOn(nuxt, 'navigateTo').mockImplementation(() => 'redirected' as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('/_cwa/ecommerce goes to the first page the user\'s roles open, skipping the ones they cannot, keeping the query and hash', async () => {
    withRoles(['ROLE_SHOP_PRODUCTS', 'ROLE_ADMIN'])

    expect(await extensionAreaMiddleware(route('_cwa-ecommerce'), route('_cwa-pages'))).toBe('redirected')
    expect(nuxt.navigateTo).toHaveBeenCalledWith({ name: '_cwa-ecommerce-products', query: { q: '1' }, hash: '#top' }, { replace: true })
  })

  test('a user who can open every page goes to the first declared', async () => {
    withRoles(['ROLE_SHOP_ORDERS', 'ROLE_SHOP_PRODUCTS', 'ROLE_ADMIN'])

    await extensionAreaMiddleware(route('_cwa-ecommerce'), route('_cwa-pages'))
    expect(nuxt.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ name: '_cwa-ecommerce-orders' }), { replace: true })
  })

  test('leaves a page in the area alone', async () => {
    withRoles(['ROLE_ADMIN'])

    expect(await extensionAreaMiddleware(route('_cwa-ecommerce-payments'), route('_cwa-pages'))).toBeUndefined()
    expect(nuxt.navigateTo).not.toHaveBeenCalled()
  })
})

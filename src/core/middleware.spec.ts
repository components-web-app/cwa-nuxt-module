import { jest } from '@jest/globals'
import routeLoaderMiddleware from './middleware'

describe('middleware', () => {
  it('should not call fetchRoute because cwa is disabled', async () => {
    const route = {
      matched: [{ components: [{ _Ctor: { 0: { options: { cwa: false } } } }] }]
    }
    const $cwa = {
      fetchRoute: jest.fn(),
      $storage: {
        setState: jest.fn()
      }
    }

    await routeLoaderMiddleware({ $cwa, route })

    expect($cwa.fetchRoute).not.toHaveBeenCalled()
    expect($cwa.$storage.setState).toHaveBeenCalledWith('loadedRoute', null)
  })

  it('should call fetchRoute', async () => {
    process.client = true
    const route = { matched: [{ components: [{ _Ctor: {} }] }], path: '/' }
    const $cwa = { fetchRoute: jest.fn(), initMercure: jest.fn() }

    await routeLoaderMiddleware({ $cwa, route })

    expect($cwa.fetchRoute).toHaveBeenCalledWith(route.path)
    expect($cwa.initMercure).toHaveBeenCalled()
  })

  it('should call fetchRoute', async () => {
    const err = new TypeError('An error message')
    const route = { matched: [{ components: [{ _Ctor: {} }] }], path: '/' }
    const $cwa = {
      fetchRoute: jest.fn(() => {
        throw err
      }),
      withError: jest.fn(),
      initMercure: jest.fn()
    }

    await routeLoaderMiddleware({ $cwa, route })

    expect($cwa.fetchRoute).toHaveBeenCalledWith(route.path)
    expect($cwa.withError).toHaveBeenCalledWith(route, err)
  })
})

import axiosist from 'axiosist'
import { jest } from '@jest/globals'
import ApiServer from '../../scripts/api'
import Fetcher from './fetcher'

// ReferenceError: require is not defined
// see: https://github.com/facebook/jest/issues/10025
// see: https://github.com/facebook/jest/pull/10976
jest.unstable_mockModule('~/.nuxt/cwa/components', () => ({}), {
  virtual: true
})

const state = {}

describe('fetcher', () => {
  it('should', async () => {
    const server = new ApiServer()
    const app = await server.create()
    const $axios = axiosist(app)
    const error = jest.fn()
    const apiUrl = 'http://api'
    const storage = {
      resetCurrentResources: jest.fn(),
      setState: jest.fn((key: string, value) => {
        state[key] = value
      }),
      getState: jest.fn((key: string) => {
        return state[key]
      }),
      state: {
        mercureHub: null,
        resources: {
          new: {},
          current: {}
        }
      },
      setResource: jest.fn(),
      setCurrentRoute: jest.fn(),
      getCategoryFromIri: jest.fn(() => {
        return 'Default'
      })
    }
    const router = {
      currentRoute: {
        query: {}
      }
    }

    const redirect = jest.fn()

    const fetcher = new Fetcher(
      { $axios, error, apiUrl, storage, router, redirect },
      { fetchConcurrency: 1 }
    )
    await fetcher.fetchRoute('/')

    expect(storage.getState).toHaveBeenNthCalledWith(1, Fetcher.loadingEndpoint)
    expect(storage.getState).toHaveBeenNthCalledWith(
      2,
      Fetcher.loadedRoutePathKey
    )
    expect(storage.resetCurrentResources).toHaveBeenCalled()
    expect(storage.setState).toHaveBeenNthCalledWith(
      1,
      Fetcher.loadingEndpoint,
      '/'
    )
    expect(storage.setState).toHaveBeenCalledWith(
      Fetcher.loadedRoutePathKey,
      '/'
    )
    expect(storage.setState).toHaveBeenLastCalledWith(
      Fetcher.loadingEndpoint,
      false
    )
    expect(storage.setResource).toHaveBeenCalledTimes(6)
    expect(storage.setCurrentRoute).toHaveBeenCalledWith(
      '/_/routes/a76a56f1-ab30-49c9-873b-d70b4e1d3946'
    )
  })
})

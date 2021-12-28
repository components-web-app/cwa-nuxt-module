import axiosist from 'axiosist'
import createApi from '../../scripts/mock-api'
import Fetcher from './fetcher'

const state = {}

describe('fetcher', () => {
  it('should', async () => {
    const app = await createApi()
    const $axios = axiosist(app)
    const error = jest.fn()
    const apiUrl = 'http://api'
    const storage = {
      resetCurrentResources: jest.fn(),
      setState: jest.fn((key, value) => {
        state[key] = value
      }),
      getState: jest.fn((key) => {
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

    expect(storage.resetCurrentResources).toHaveBeenCalled()
    expect(storage.getState).toHaveBeenNthCalledWith(1, Fetcher.loadedRouteKey)
    expect(storage.getState).toHaveBeenNthCalledWith(2, Fetcher.loadingRouteKey)

    expect(storage.setState).toHaveBeenNthCalledWith(
      1,
      Fetcher.loadingRouteKey,
      '/'
    )
    expect(storage.setState).toHaveBeenCalledWith(Fetcher.loadedRouteKey, '/')
    expect(storage.setState).toHaveBeenLastCalledWith(
      Fetcher.loadingRouteKey,
      false
    )

    expect(storage.setResource).toHaveBeenCalledTimes(6)
    expect(storage.setCurrentRoute).toHaveBeenCalledWith(
      '/_/routes/a76a56f1-ab30-49c9-873b-d70b4e1d3946'
    )
  })
})

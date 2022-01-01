import { jest } from '@jest/globals'
import Cwa from './cwa'

// ReferenceError: require is not defined
// see: https://github.com/facebook/jest/issues/10025
// see: https://github.com/facebook/jest/pull/10976
jest.unstable_mockModule('~/.nuxt/cwa/components', () => ({}), {
  virtual: true
})

describe('Cwa', () => {
  it('should call fetcher fetchRoute', async () => {
    const store = {
      registerModule: jest.fn(),
      state: { cwa: { resources: { current: {}, new: {} } } },
      commit: jest.fn()
    }
    const $axios = { get: jest.fn() }
    const app = { router: { currentRoute: { query: {} } } }

    const cwa = new Cwa(
      {
        store,
        error: jest.fn(),
        $axios,
        $config: { API_URL: 'localhost' },
        app
      },
      { vuex: { namespace: 'cwa' }, fetchConcurrency: 1 }
    )

    await cwa.fetchRoute('/')

    expect(store.commit).toHaveBeenCalled()
    expect($axios.get).toHaveBeenCalled()
  })
})

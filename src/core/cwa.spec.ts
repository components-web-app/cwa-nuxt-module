import Cwa from './cwa'

describe('Cwa', () => {
  it('should call fetcher fetchRoute', async () => {
    const store = {
      registerModule: jest.fn(),
      state: { cwa: { resources: { current: {}, new: {} } } },
      commit: jest.fn()
    }
    const $axios = { get: jest.fn() }
    const $route = { query: {} }

    const cwa = new Cwa(
      {
        store,
        error: jest.fn(),
        $axios,
        $config: { API_URL: 'localhost' },
        $route
      },
      { vuex: { namespace: 'cwa' }, fetchConcurrency: 1 }
    )

    await cwa.fetchRoute('/')

    expect(store.commit).toHaveBeenCalled()
    expect($axios.get).toHaveBeenCalled()
  })
})

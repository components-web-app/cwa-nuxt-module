import Cwa from './cwa'

describe('Cwa', () => {
  it('should call fetcher fetchRoute', async () => {
    const store = { registerModule: jest.fn(), state: { cwa: {} }, commit: jest.fn() }
    const $axios = { get: jest.fn() }

    const cwa = new Cwa({
      store,
      error: jest.fn(),
      $axios,
      $config: { API_URL: 'localhost' }
    }, { vuex: { namespace: 'cwa' }, fetchConcurrency: 1 })

    await cwa.fetchRoute('/')

    expect(store.commit).toHaveBeenCalled()
    expect($axios.get).toHaveBeenCalled()
  })
})

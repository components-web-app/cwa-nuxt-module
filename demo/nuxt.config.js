import coreModuleDist from '../src/module'

export default {
  mode: 'universal',
  buildModules: [
    '@nuxt/typescript-build',
    '@nuxtjs/dotenv'
  ],
  modules: [
    '@nuxtjs/axios',
    '@nuxtjs/auth-next',
    '@nuxtjs/dotenv',
    coreModuleDist
  ],
  router: {
    middleware: ['auth', 'routeLoader']
  },
  axios: {
    credentials: true,
    baseURL: 'https://localhost:8443'
  },
  auth: {
    redirect: {
      login: '/login',
      logout: '/login',
      home: '/home',
      callback: false
    },
    strategies: {
      local: {
        user: {
          autoFetch: true,
          property: ''
        },
        endpoints: {
          login: { url: '/login', method: 'post' },
          logout: { url: '/logout', method: 'post' },
          user: { url: '/me', method: 'get' }
        },
        token: {
          required: false,
          type: false
        }
      }
    }
  }
}

import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
import coreModuleDist from '../src/module'

const baseUrl = process.env.BASE_URL || 'https://localhost:8443'

export default {
  env: {
    baseUrl
  },
  mode: 'universal',
  buildModules: [
    '@nuxt/typescript-build',
    '@nuxtjs/dotenv',
    '@nuxt/components'
  ],
  modules: [
    '@nuxtjs/axios',
    '@nuxtjs/auth-next',
    coreModuleDist
  ],
  router: {
    middleware: ['auth', 'routeLoader']
  },
  axios: {
    credentials: true,
    baseURL: baseUrl
  },
  auth: {
    redirect: {
      login: '/login',
      logout: '/login',
      home: '/',
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
          global: false,
          required: false
        }
      }
    }
  },
  cwa: {
    allowUnauthorizedTls: true
  },
  components: true,
  build: {
    extend (config, _) {
      if (!config.resolve) {
        config.resolve = {}
      }
      if (!config.resolve.plugins) {
        config.resolve.plugins = []
      }

      config.resolve.plugins.push(new TsconfigPathsPlugin({ configFile: `${__dirname}/tsconfig.json` }))
    }
  }
}

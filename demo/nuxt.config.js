import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
import coreModuleDist from '../src/module'

const API_URL_BROWSER = process.env.API_URL_BROWSER || 'https://localhost:8443'

export default {
  env: {
    API_URL: process.env.API_URL_BROWSER || API_URL_BROWSER,
    API_URL_BROWSER: API_URL_BROWSER
  },
  mode: 'universal',
  buildModules: [
    '@nuxt/typescript-build',
    '@nuxtjs/dotenv'
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
    credentials: true
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
  build: {
    // this is for dev so that @cwa aliases will work
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

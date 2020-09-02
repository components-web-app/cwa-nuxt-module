import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
import coreModuleDist from '../src/module'

const API_URL = process.env.API_URL || 'https://localhost:8443'

export default {
  publicRuntimeConfig: {
    API_URL
  },
  mode: 'universal',
  css: ['~/assets/sass/main.sass'],
  buildModules: [
    '@nuxt/typescript-build'
  ],
  modules: [
    '@nuxtjs/style-resources',
    '@nuxtjs/axios',
    '@nuxtjs/auth-next',
    coreModuleDist
  ],
  plugins: [
    { src: '~/plugins/quill', ssr: false }
  ],
  router: {
    middleware: ['auth', 'routeLoader']
  },
  axios: {
    credentials: true,
    progress: false
  },
  auth: {
    redirect: {
      login: '/login',
      logout: '/login',
      home: '/',
      callback: false
    },
    defaultStrategy: 'local',
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
          required: false,
          type: false
        }
      }
    }
  },
  cwa: {
    allowUnauthorizedTls: true
  },
  build: {
    extend (config) {
      if (!config.resolve) {
        config.resolve = {}
      }
      if (!config.resolve.plugins) {
        config.resolve.plugins = []
      }

      config.resolve.plugins.push(new TsconfigPathsPlugin({ configFile: `${__dirname}/tsconfig.json` }))
    }
  },
  styleResources: {
    sass: ['~/assets/sass/vars/*.sass']
  }
}

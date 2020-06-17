import coreModuleDist from '../src/module'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'

const baseUrl = process.env.BASE_URL || 'https://localhost:8443'

export default {
  env: {
    baseUrl
  },
  mode: 'universal',
  css: [
    '../src/core/assets/milligram',
    '../src/core/assets/style'
  ],
  buildModules: [
    '@nuxt/typescript-build',
    '@nuxtjs/dotenv',
    '@nuxtjs/style-resources',
    '@nuxt/components' 
  ],
  modules: [
    '@nuxtjs/axios',
    '@nuxtjs/auth-next',
    coreModuleDist
  ],
  styleResources: {
    sass: '../src/core/assets/*.sass'
  },
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
    extend(config, ctx) {
      if (!config.resolve) {
        config.resolve = {};
      }
      if (!config.resolve.plugins) {
        config.resolve.plugins = [];
      }

      config.resolve.plugins.push(new TsconfigPathsPlugin({configFile: `${__dirname}/tsconfig.json`}));
    }
  }
}

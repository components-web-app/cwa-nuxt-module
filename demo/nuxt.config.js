import path from 'path'
import fs from 'fs'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
import coreModuleDist from '../src/module'

// Required for the mercure hub and fetcher it seems.
// Although axios does not seem to need it so maybe we can work out why and if we can remove it at a later date
const API_URL = process.env.API_URL || 'https://localhost:8443'

const https = process.env.DISABLE_HTTPS
  ? null
  : {
      key: fs.readFileSync(path.resolve(__dirname, 'ssl/localhost.key')),
      cert: fs.readFileSync(path.resolve(__dirname, 'ssl/localhost.crt'))
    }

export default {
  env: {
    TESTING: process.env.TESTING || false
  },
  server: {
    https
  },
  publicRuntimeConfig: {
    API_URL
  },
  head: {
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' }
    ]
  },
  css: ['~/assets/sass/main.sass'],
  buildModules: ['@nuxt/typescript-build'],
  modules: [coreModuleDist],
  plugins: [{ src: '~/plugins/cypress', mode: 'client' }],
  router: {
    middleware: ['auth', 'cwa']
  },
  cwa: {
    allowUnauthorizedTls: true,
    // version: '1.0.0',
    websiteName: 'CWA Test'
  },
  build: {
    extend(config) {
      if (!config.resolve) {
        config.resolve = {}
      }
      if (!config.resolve.plugins) {
        config.resolve.plugins = []
      }

      config.resolve.plugins.push(
        new TsconfigPathsPlugin({
          configFile: path.join(__dirname, 'tsconfig.json')
        })
      )

      // required for HTML component to convert anchor links to cwa-nuxt-link components
      // enables runtime compiler
      config.resolve.alias.vue = 'vue/dist/vue.common'
    }
  },
  styleResources: {
    sass: ['~/assets/sass/vars/*.sass']
  },
  loading: {
    color: '#E30A6C'
  }
}

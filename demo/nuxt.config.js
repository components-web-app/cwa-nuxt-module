import path from 'path'
import fs from 'fs'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
import coreModuleDist from '../src/module'

const API_URL =
  'http://something-else' || process.env.API_URL || 'https://localhost:8443'

const https = process.env.DISABLE_HTTPS
  ? null
  : {
      key: fs.readFileSync(path.resolve(__dirname, 'ssl/localhost.key')),
      cert: fs.readFileSync(path.resolve(__dirname, 'ssl/localhost.crt'))
    }

export default {
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
  plugins: [{ src: '~/plugins/quill', ssr: false }],
  router: {
    middleware: ['auth', 'routeLoader']
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
    }
  },
  styleResources: {
    sass: ['~/assets/sass/vars/*.sass']
  },
  loading: {
    color: '#E30A6C'
  }
}

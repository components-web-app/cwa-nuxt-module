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
    middleware: ['routeLoader']
  }
}

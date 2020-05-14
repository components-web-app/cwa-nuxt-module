import coreModuleDist from '../src/module'

export default {
  mode: 'universal',
  buildModules: [
    '@nuxt/typescript-build'
  ],
  modules: [
    '@nuxtjs/axios',
    '@nuxtjs/auth-next',
    coreModuleDist
  ],
  router: {
    middleware: ['routeLoader']
  }
}

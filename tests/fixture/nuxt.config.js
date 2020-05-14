import coreModuleDist from '../..'

export default {
  mode: 'universal',
  modules: [
    '@nuxtjs/axios',
    '@nuxtjs/auth-next',
    coreModuleDist
  ],
  middleware: ['routeLoader']
}

import { isEqual as isEqualOriginal } from '@types/lodash'
import Cwa from '#cwa/runtime/cwa'
import 'nuxt';
import { Router } from 'vue-router'

declare module 'lodash/isEqual.js' {
  interface isEqual extends isEqualOriginal {}
}

interface CwaInjections {
  $cwa: Cwa
  $router: Router
}

declare module 'nuxt/dist/app/nuxt' {
  interface NuxtApp extends CwaInjections {}
}

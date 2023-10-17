import { isEqual as isEqualOriginal, mergeWith as mergeWithOriginal, isArray as isArrayOriginal } from '@types/lodash'
import Cwa from '#cwa/runtime/cwa'
import 'nuxt';
import { Router } from 'vue-router'
import { CwaResourcesMeta } from '#cwa/module'

interface CwaInjections {
  $cwa: Cwa
  $router: Router
}

declare module '#app' {
  interface Nuxt {
    cwaResources: CwaResourcesMeta
  }
}

declare module 'nuxt/dist/app/nuxt' {
  interface NuxtApp extends CwaInjections {}
}

declare module 'lodash/isEqual.js' {
  interface isEqual extends isEqualOriginal {}
}

declare module 'lodash/mergeWith.js' {
  interface mergeWith extends mergeWithOriginal {}
}

declare module 'lodash/isArray.js' {
  interface isArray extends isArrayOriginal {}
}

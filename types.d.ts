import type { isEqual as isEqualOriginal, mergeWith as mergeWithOriginal, isArray as isArrayOriginal } from '@types/lodash'
import type { Router } from 'vue-router'
import type Cwa from '#cwa/runtime/cwa'
import 'nuxt'
import type { CwaResourcesMeta } from '#cwa/module'

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
  type NuxtApp = CwaInjections
}

declare module 'lodash/isEqual.js' {
  type isEqual = isEqualOriginal
}

declare module 'lodash/mergeWith.js' {
  type mergeWith = mergeWithOriginal
}

declare module 'lodash/isArray.js' {
  type isArray = isArrayOriginal
}

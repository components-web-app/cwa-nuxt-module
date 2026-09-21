import type { ObjectPlugin } from '#app/nuxt'
import { defineNuxtPlugin } from '#imports'
import type Cwa from '#cwa/cwa'
import { clearSessionCaches } from '#cwa/api/session-caches'
// @ts-ignore
import { options } from '#build/cwa-options'

export default defineNuxtPlugin({
  name: 'cwa-session-caches-plugin',
  enforce: 'post',
  dependsOn: ['cwa-plugin'] as unknown as ObjectPlugin['dependsOn'],
  setup(nuxtApp) {
    const names: string[] = options.auth?.clearCachesOnSessionEnd ?? []
    const $cwa = nuxtApp.$cwa as Cwa
    $cwa.auth.onSessionEnd(() => clearSessionCaches(names))
  },
} as ObjectPlugin)

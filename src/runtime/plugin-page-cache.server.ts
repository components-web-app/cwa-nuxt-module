import type { ObjectPlugin } from '#app/nuxt'
import { defineNuxtPlugin, useRequestEvent } from '#imports'
import type Cwa from '#cwa/cwa'
import { buildPageCacheHeaders, resolvePageCacheOptions } from '#cwa/api/http-cache'
// @ts-ignore
import { options } from '#build/cwa-options'

export default defineNuxtPlugin({
  name: 'cwa-page-cache-plugin',
  enforce: 'post',
  setup(nuxtApp) {
    const event = useRequestEvent()
    if (!event) {
      return
    }

    event.context.cwaPageCache = {}

    const isErrorRender = !!event.headers.get('x-nuxt-error')

    nuxtApp.hook('app:rendered', () => {
      if (isErrorRender) {
        event.context.cwaPageCache = { unstorable: true }
        return
      }

      const $cwa = nuxtApp.$cwa as Cwa
      if ($cwa.auth.signedIn.value) {
        event.context.cwaPageCache = { unstorable: true }
        return
      }

      event.context.cwaPageCache = buildPageCacheHeaders({
        ids: $cwa.resources.allIds,
        api: $cwa.apiHttpCacheState,
        options: resolvePageCacheOptions(options.pageCache),
      })
    })
  },
} as ObjectPlugin)

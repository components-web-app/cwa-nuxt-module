import { watch } from 'vue'
import type { Router } from 'vue-router'
import type { ObjectPlugin } from '#app/nuxt'
import { defineNuxtPlugin } from '#imports'
import type Cwa from '#cwa/cwa'
import { cwaPageLoadPercent } from '#cwa/resources/page-load-percent'

export default defineNuxtPlugin({
  name: 'cwa-page-loading-plugin',
  dependsOn: ['cwa-plugin'] as unknown as ObjectPlugin['dependsOn'],
  setup(nuxtApp) {
    const $cwa = nuxtApp.$cwa as Cwa
    const router = nuxtApp.$router as Router
    const pageLoadProgress = $cwa.resources.pageLoadProgress
    const isCwaPageLoading = () => {
      const percent = cwaPageLoadPercent(pageLoadProgress.value, router.currentRoute.value)
      return percent !== undefined && percent < 100
    }

    nuxtApp.hook('page:loading:end', () => {
      if (!isCwaPageLoading()) {
        return
      }
      return new Promise<void>((resolve) => {
        const stop = watch(isCwaPageLoading, (loading) => {
          if (!loading) {
            stop()
            resolve()
          }
        })
      })
    })
  },
} as ObjectPlugin)

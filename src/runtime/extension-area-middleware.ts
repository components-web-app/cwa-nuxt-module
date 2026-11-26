import { defineNuxtRouteMiddleware, navigateTo, useNuxtApp } from 'nuxt/app'
import type { RouteLocationNormalized } from 'vue-router'
import { extensionRouteName, openablePages } from './admin/extension-areas'
import type { CwaExtensionArea } from './admin/extension-areas'
// @ts-ignore
import { extensionAreas } from '#build/cwa-extension-areas'

export default defineNuxtRouteMiddleware((to: RouteLocationNormalized) => {
  const area = (extensionAreas as CwaExtensionArea[]).find(candidate => extensionRouteName(candidate.segment) === to.name)
  if (!area) {
    return
  }
  const { $cwa } = useNuxtApp()
  const [first] = openablePages(area, role => $cwa.auth.hasRole(role))
  if (first) {
    return navigateTo({ name: extensionRouteName(area.segment, first.path), query: to.query, hash: to.hash }, { replace: true })
  }
})

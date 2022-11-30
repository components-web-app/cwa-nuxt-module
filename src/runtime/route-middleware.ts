import { defineNuxtRouteMiddleware, useNuxtApp } from '#app'

export default defineNuxtRouteMiddleware((to) => {
  const { $cwa } = useNuxtApp()
})

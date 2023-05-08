import { useNuxtApp } from '#imports'

export const useCwa = () => useNuxtApp().$cwa
export const useCwaResources = () => useNuxtApp().$cwa.resources
export const useCwaResourcesManager = () => useNuxtApp().$cwa.resourcesManager
export const useCwaAuth = () => useNuxtApp().$cwa.auth
export const useCwaForms = () => useNuxtApp().$cwa.forms

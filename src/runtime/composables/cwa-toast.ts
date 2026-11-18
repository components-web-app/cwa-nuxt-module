import { consola } from 'consola'
import { getCurrentInstance, onMounted } from 'vue'
import type { App } from 'vue'
import { useNuxtApp } from '#app/nuxt'
import type { CwaToaster, CwaToastOptions } from '#cwa/admin/toaster'

export type { CwaToastAction, CwaToastOptions, CwaToastTone } from '#cwa/admin/toaster'

const toasters = new WeakMap<App, Promise<CwaToaster>>()

export const useCwaToast = () => {
  const { vueApp, ssrContext } = useNuxtApp()
  const load = () => {
    let toaster = toasters.get(vueApp)
    if (!toaster) {
      toaster = import('../admin/toaster').then(({ mountToaster }) => mountToaster(vueApp))
      toasters.set(vueApp, toaster)
      toaster.catch((error) => {
        toasters.delete(vueApp)
        consola.error('Could not load the toaster', error)
      })
    }
    return toaster
  }
  if (!ssrContext && getCurrentInstance()) {
    onMounted(() => load().then(undefined, () => {}))
  }
  return {
    show: (options: CwaToastOptions) => {
      if (!ssrContext) {
        load().then(toaster => toaster.show(options), () => {})
      }
    },
    dismiss: (id: string) => {
      toasters.get(vueApp)?.then(toaster => toaster.dismiss(id), () => {})
    },
  }
}

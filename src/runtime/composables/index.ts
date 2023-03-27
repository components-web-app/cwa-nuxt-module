import { useNuxtApp } from '#imports'

export const useCwa = () => {
  return useNuxtApp().$cwa
}

import { useNuxtApp } from '#imports'
import type Cwa from '#cwa/runtime/cwa'

export const useCwa = () => useNuxtApp().$cwa as Cwa

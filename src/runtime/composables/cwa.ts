import { useNuxtApp } from '#imports'
import type Cwa from '#cwa/runtime/cwa'

// This is for advanced use cases - usually there are composables exposing the specific functionality required for a developer's use case in the final application
export const useCwa = () => useNuxtApp().$cwa as Cwa

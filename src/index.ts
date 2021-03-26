import Vue from 'vue'
import _CWA from './core/cwa'

export type CWA = _CWA

export type AdminDialogOptions = {
  name: string
  component: () => Promise<Function>
}

export type CwaOptions = {
  vuex: {
    namespace: string
  }
  pagesDepth: number
  fetchConcurrency: number
  allowUnauthorizedTls: boolean
  layouts?: { [key: string]: string }
  websiteName: string
  package: {
    name: string
    version: string
  }
}

declare module 'axios' {
  interface AxiosRequestConfig {
    cwa?: boolean
  }
}

declare module '@nuxt/types' {
  interface Context {
    $cwa: CWA
  }
  interface NuxtAppOptions {
    $cwa: CWA
  }
}

declare module 'vue/types/vue' {
  interface Vue {
    $cwa: CWA
    adminDialog?: AdminDialogOptions
  }
}

// On a Vue component - the options that can be declared to customise module behaviour
declare module 'vue/types/options' {
  // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
  interface ComponentOptions<V extends Vue> {
    cwa?: boolean
    pageIriParam?: string
  }
}

declare module 'vuex/types/index' {
  // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
  interface Store<S> {
    $cwa: any
  }
}

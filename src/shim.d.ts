import Vue from 'vue'
import '@nuxt/types'
import 'axios'
import 'vuex'
import type { AdminDialogOptions, CWA } from '.'
import { CwaOptions } from '@cwa/nuxt-module/index'

declare module '@nuxt/types' {
  interface Context {
    readonly $cwa: CWA
  }
  interface NuxtAppOptions {
    readonly $cwa: CWA
  }
  interface Configuration {
    cwa?: CwaOptions
  }
}

declare module 'vue/types/vue' {
  interface Vue {
    readonly $cwa: CWA
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

declare module 'axios' {
  interface AxiosRequestConfig {
    cwa?: boolean
  }
}

declare module 'vuex/types/index' {
  // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
  interface Store<S> {
    $cwa: any
  }
}

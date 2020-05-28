import _CWA from './core/cwa'

export type CWA = _CWA

export type CwaOptions = {
  fetchConcurrency: number;
  vuex: any;
}

declare module '@nuxt/types' {
  interface Context {
    $cwa: CWA;
  }
  interface NuxtAppOptions {
    $cwa: CWA;
  }
}

declare module 'vue/types/vue' {
  interface Vue {
    $cwa: CWA;
  }
}

declare module 'vue/types/options' {
  interface ComponentOptions<V extends Vue> {
    cwa?: boolean;
  }
}

declare module 'vuex/types/index' {
  interface Store<S> {
    $cwa: any;
  }
}

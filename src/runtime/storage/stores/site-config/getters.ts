import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { CwaSiteConfigStateInterface } from './state'
import type { SiteConfigParams } from '#cwa/module'
import { defaultSiteConfig } from '#cwa/runtime/composables/useCwaSiteConfig'

export interface CwaSiteConfigGettersInterface {
  getConfig: ComputedRef<SiteConfigParams>
}

export default function (siteConfigState: CwaSiteConfigStateInterface): CwaSiteConfigGettersInterface {
  return {
    getConfig: computed<SiteConfigParams>(() => {
      return Object.assign({}, defaultSiteConfig, siteConfigState.config)
    }),
  }
}

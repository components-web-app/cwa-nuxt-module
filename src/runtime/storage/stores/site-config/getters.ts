import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { CwaSiteConfigStateInterface } from './state'
import type { SiteConfigParams } from '#cwa/module'
import { useCwaSiteConfig } from '#imports'

export interface CwaSiteConfigGettersInterface {
  getConfig: ComputedRef<SiteConfigParams>
}

export default function (siteConfigState: CwaSiteConfigStateInterface): CwaSiteConfigGettersInterface {
  return {
    getConfig: computed<SiteConfigParams>(() => {
      const { mergeConfig } = useCwaSiteConfig()
      return mergeConfig(siteConfigState.config.value)
    }),
  }
}

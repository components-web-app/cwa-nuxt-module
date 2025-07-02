import { ref } from 'vue'
import type { Ref } from 'vue'
import type { CwaResource } from '../../../resources/resource-utils'
import type { SiteConfigParams } from '#cwa/module'

export interface CwaSiteConfigParameter extends CwaResource {
  key: keyof SiteConfigParams
  value: string | undefined
}

export interface CwaSiteConfigStateInterface {
  isLoading: Ref<boolean>
  config: Ref<Partial<SiteConfigParams>>
  serverConfig: Ref<undefined | Partial<SiteConfigParams>>
}

export default function (): CwaSiteConfigStateInterface {
  return {
    isLoading: ref(false),
    config: ref<Partial<SiteConfigParams>>({}),
    serverConfig: ref<Partial<SiteConfigParams>>(),
  }
}

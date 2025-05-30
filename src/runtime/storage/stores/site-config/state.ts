import { reactive, type Ref, ref } from 'vue'
import type { CwaResource } from '../../../resources/resource-utils'
import type { SiteConfigParams } from '#cwa/runtime/storage/stores/site-config/getters'

export interface CwaSiteConfigParameter extends CwaResource {
  key: keyof SiteConfigParams
  value: string | undefined
}

export interface CwaSiteConfigStateInterface {
  isLoading: Ref<boolean>
  config: {
    [key: string]: string | undefined
  }
}

export default function (): CwaSiteConfigStateInterface {
  return {
    isLoading: ref(false),
    config: reactive({}),
  }
}

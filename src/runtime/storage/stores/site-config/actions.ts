import type { CwaSiteConfigStateInterface } from '#cwa/runtime/storage/stores/site-config/state'
import type { SiteConfigParams } from '#cwa/module'

export interface CwaSiteConfigActionsInterface {
  setConfigParameters(configuration: { key: string, value: string }[]): void
  setConfigParameter(key: string, value: string): void
}

function processApiValue(configValue: any) {
  let value = configValue
  if (configValue === '1' || configValue === 'false') {
    value = Boolean(value)
  }
  return value
}

export default function (siteConfigState: CwaSiteConfigStateInterface): CwaSiteConfigActionsInterface {
  function setConfigParameter(key: keyof SiteConfigParams, value: string) {
    siteConfigState.config.value[key] = processApiValue(value)
  }

  return {
    setConfigParameters(configuration: { key: keyof SiteConfigParams, value: any }[]) {
      for (const configParam of configuration) {
        setConfigParameter(configParam.key, configParam.value)
      }
    },
    setConfigParameter,
  }
}

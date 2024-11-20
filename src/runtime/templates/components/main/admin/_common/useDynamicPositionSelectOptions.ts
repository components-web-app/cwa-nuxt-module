import type { SelectOption } from '#cwa/runtime/composables/cwa-select-input'
import type Cwa from '#cwa/runtime/cwa'

export const useDynamicPositionSelectOptions = ($cwa: Cwa) => {
  async function getOptions() {
    const newOptions: SelectOption[] = [{
      label: 'None',
      value: null,
    }]
    const docs = await $cwa.getApiDocumentation()
    // todo: we can look up the current Page Data resource and in _metadata.pageDataMetadata.properties is an array of { componentShortName: string, property: string } - we can display the resolved component name and value of the property
    // todo: so why can't we decided which page data resource(s) are allowed to use this template and then only show the properties which this page can be used for. Probably limit to 1 page data resource so we don't get complicated situations
    const pageDataMeta = docs?.pageDataMetadata?.['hydra:member']
    if (pageDataMeta) {
      for (const { properties } of pageDataMeta) {
        newOptions.push(...properties.map(({ property }) => ({ label: property, value: property })))
      }
    }
    return newOptions
  }

  return {
    getOptions,
  }
}

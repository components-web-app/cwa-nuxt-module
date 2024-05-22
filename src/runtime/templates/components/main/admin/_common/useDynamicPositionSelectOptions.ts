import type { SelectOption } from '#cwa/runtime/templates/components/ui/form/Select.vue'
import type Cwa from '#cwa/runtime/cwa'

export const useDynamicPositionSelectOptions = ($cwa: Cwa) => {
  async function getOptions () {
    const newOptions: SelectOption[] = [{
      label: 'None',
      value: null
    }]
    const docs = await $cwa.getApiDocumentation()
    const pageDataMeta = docs?.pageDataMetadata?.['hydra:member']
    if (pageDataMeta) {
      for (const { properties } of pageDataMeta) {
        newOptions.push(...properties.map(({ property }) => ({ label: property, value: property })))
      }
    }
    return newOptions
  }

  return {
    getOptions
  }
}

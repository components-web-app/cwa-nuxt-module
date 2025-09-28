import { computed, type MaybeRef, toValue } from 'vue'
import { useRoute } from 'vue-router'
import { useCwa } from '#cwa/composables/cwa'

export const useDataType = (dataClass: MaybeRef<string> | undefined = undefined) => {
  const $cwa = useCwa()
  const route = useRoute()
  // todo: getStringFromParam is a function used localised in a few places, generalise it
  function getStringFromParam(paramName: string): string {
    const paramValue = route.params[paramName]
    return (Array.isArray(paramValue) ? paramValue[0] : paramValue) || ''
  }

  const dataType = computed<string>(() => {
    if (dataClass) return toValue(dataClass)
    return getStringFromParam('type')
  })
  const dataTypeClassName = computed(() => {
    if (!dataType.value) {
      return
    }
    return dataType.value.charAt(0).toUpperCase() + dataType.value.slice(1)
  })
  const pageDataConfig = computed(() => {
    if (!dataTypeClassName.value) return
    return $cwa.pageDataConfig?.[dataTypeClassName.value]
  })
  const pageDataClassName = computed<string>(() => {
    if (!dataTypeClassName.value) {
      return 'Unknown'
    }
    return pageDataConfig.value?.name || dataType.value
  })

  return {
    dataTypeClassName,
    dataType,
    pageDataClassName,
    pageDataConfig,
  }
}

import { computed, type MaybeRef, toValue } from 'vue'
import { useRoute } from 'vue-router'
import { useCwa } from '#cwa/composables/cwa'

export const useDataType = (dataClass: MaybeRef<string> | undefined = undefined) => {
  const $cwa = useCwa()
  const route = useRoute()
  const dataType = computed(() => {
    if (dataClass) return toValue(dataClass)
    const typeParam = route.params.type
    return Array.isArray(typeParam) ? typeParam[0] : typeParam
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
  const pageDataClassName = computed(() => {
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

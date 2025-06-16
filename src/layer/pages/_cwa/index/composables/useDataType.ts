import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useCwa } from '#cwa/runtime/composables/cwa'

export const useDataType = () => {
  const $cwa = useCwa()
  const route = useRoute()
  const dataType = computed(() => {
    const typeParam = route.params.type
    return Array.isArray(typeParam) ? typeParam[0] : typeParam
  })
  const dataTypeClassName = computed(() => {
    if (!dataType.value) {
      return
    }
    return dataType.value.charAt(0).toUpperCase() + dataType.value.slice(1)
  })
  const pageDataClassName = computed(() => {
    if (!dataTypeClassName.value) {
      return 'Unknown'
    }
    return $cwa.pageDataConfig?.[dataTypeClassName.value]?.name || dataType.value
  })

  return {
    dataTypeClassName,
    dataType,
    pageDataClassName,
  }
}

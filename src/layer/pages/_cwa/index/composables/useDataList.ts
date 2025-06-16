import { onMounted, ref } from 'vue'
import { useCwa } from '#cwa/runtime/composables/cwa'
import type { PageDataMetadataResource } from '#cwa/runtime/storage/stores/api-documentation/state'

export const useDataList = () => {
  const $cwa = useCwa()
  const dataTypes = ref<PageDataMetadataResource[]>([])
  const isLoadingDataTypes = ref(true)

  function fqcnToEntrypointKey(fqcn: string) {
    // e.g. App\\Entity\\BlogArticleData -> blogArticleData
    const className = fqcn.split('\\').pop()
    if (!className) {
      return
    }
    return className.charAt(0).toLowerCase() + className.slice(1)
  }

  function displayPageDataClassName(cls: string) {
    const clsName = cls.split('\\').pop()
    const configName = clsName ? $cwa.pageDataConfig?.[clsName]?.name : undefined
    return configName || clsName || cls
  }

  onMounted(async () => {
    if (!$cwa.auth.user?.['@id']) {
      return
    }
    isLoadingDataTypes.value = true
    // need to fetch a resource to get the docs from link header if not set - user should always be there as we are logged in
    await $cwa.fetchResource({
      path: $cwa.auth.user?.['@id'],
    })
    const docs = await $cwa.getApiDocumentation()
    const allMetadata = docs?.pageDataMetadata?.['hydra:member']
    if (!allMetadata) {
      isLoadingDataTypes.value = false
      return
    }
    dataTypes.value = allMetadata.filter(data => (!data.resourceClass.endsWith('\\AbstractPageData')))
    isLoadingDataTypes.value = false
  })

  return {
    displayPageDataClassName,
    dataTypes,
    fqcnToEntrypointKey,
    isLoadingDataTypes,
  }
}

import { onMounted, ref } from 'vue'
import { useCwa } from '#cwa/runtime/composables/cwa'
import type { PageDataMetadataResource } from '#cwa/runtime/storage/stores/api-documentation/state'

export const useDataList = () => {
  const $cwa = useCwa()
  const dataTypes = ref<PageDataMetadataResource[]>([])

  function displayPageDataClassName (cls: string) {
    const clsName = cls.split('\\').pop()
    const configName = clsName ? $cwa.pageDataConfig?.[clsName]?.name : undefined
    return configName || clsName || cls
  }

  onMounted(async () => {
    if (!$cwa.auth.user?.['@id']) {
      return
    }
    // need to fetch a resource to get the docs from link header if not set - user should always be there as we are logged in
    await $cwa.fetchResource({
      path: $cwa.auth.user?.['@id']
    })
    const docs = await $cwa.getApiDocumentation()
    const datas = docs?.pageDataMetadata?.['hydra:member']
    if (!datas) {
      return
    }
    dataTypes.value = datas.filter(data => (!data.resourceClass.endsWith('\\AbstractPageData')))
  })

  return {
    displayPageDataClassName,
    dataTypes
  }
}

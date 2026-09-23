import { ref } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import type { PageDataMetadataResource } from '#cwa/storage/stores/api-documentation/state'
import type { CwaResource } from '#cwa/resources/resource-utils'

export const useParentPageDataLoader = () => {
  const $cwa = useCwa()
  const currentTypeRequestId = ref(0)
  const currentInstanceRequestId = ref(0)
  const dataTypes = ref<PageDataMetadataResource[]>()
  const dataInstances = ref<CwaResource[]>()

  function fqcnToEntrypointKey(fqcn: string): string | undefined {
    const className = fqcn.split('\\').pop()
    if (!className) return undefined
    return className.charAt(0).toLowerCase() + className.slice(1)
  }

  async function loadDataTypes() {
    const thisRequestId = currentTypeRequestId.value + 1
    currentTypeRequestId.value = thisRequestId
    const docs = await $cwa.getApiDocumentation()
    if (thisRequestId !== currentTypeRequestId.value) return
    const allMetadata = docs?.pageDataMetadata?.member
    if (!allMetadata) {
      dataTypes.value = []
      return
    }
    dataTypes.value = allMetadata.filter(d => !d.resourceClass.endsWith('\\AbstractPageData'))
  }

  async function loadDataInstances(entrypointKey: string) {
    const thisRequestId = currentInstanceRequestId.value + 1
    currentInstanceRequestId.value = thisRequestId
    const docs = await $cwa.getApiDocumentation()
    const endpoint = docs?.entrypoint?.[entrypointKey]
    if (!endpoint) {
      if (thisRequestId === currentInstanceRequestId.value) {
        dataInstances.value = []
      }
      return
    }
    const { response } = $cwa.fetch({ path: endpoint, noQuery: true })
    const { _data: data } = await response
    if (thisRequestId === currentInstanceRequestId.value) {
      dataInstances.value = data?.member ?? []
    }
  }

  return { loadDataTypes, loadDataInstances, dataTypes, dataInstances, fqcnToEntrypointKey }
}

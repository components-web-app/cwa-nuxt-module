import { ref } from 'vue'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import { useCwa } from '#imports'

export const useDynamicPageLoader = () => {
  const $cwa = useCwa()
  const loadingDynamicPages = ref(false)
  const currentRequestId = ref(0)
  const dynamicPages = ref<CwaResource[]>()

  async function loadDynamicPageOptions () {
    const thisRequestId = currentRequestId.value + 1
    currentRequestId.value = thisRequestId
    loadingDynamicPages.value = true
    const { response } = $cwa.fetch({ path: '/_/pages?isTemplate=true', noQuery: true })
    const { _data: data } = await response
    if (thisRequestId === currentRequestId.value) {
      data && (dynamicPages.value = data['hydra:member'])
      loadingDynamicPages.value = false
    }
    return dynamicPages
  }

  return {
    loadDynamicPageOptions,
    dynamicPages
  }
}

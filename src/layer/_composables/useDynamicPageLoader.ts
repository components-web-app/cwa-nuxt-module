import { ref } from 'vue'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { useCwa } from '#imports'
import { fetchAllMembers } from './fetchAllMembers'

export const useDynamicPageLoader = () => {
  const $cwa = useCwa()
  const loadingDynamicPages = ref(false)
  const currentRequestId = ref(0)
  const dynamicPages = ref<CwaResource[]>()

  async function loadDynamicPageOptions() {
    const thisRequestId = currentRequestId.value + 1
    currentRequestId.value = thisRequestId
    loadingDynamicPages.value = true
    const pages = await fetchAllMembers($cwa, '/_/pages?isTemplate=true')
    if (thisRequestId === currentRequestId.value) {
      dynamicPages.value = pages
      loadingDynamicPages.value = false
    }
    return dynamicPages
  }

  return {
    loadDynamicPageOptions,
    dynamicPages,
  }
}

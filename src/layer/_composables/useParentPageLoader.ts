import { ref } from 'vue'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { useCwa } from '#imports'
import { fetchAllMembers } from './fetchAllMembers'

export const useParentPageLoader = () => {
  const $cwa = useCwa()
  const currentRequestId = ref(0)
  const parentPages = ref<CwaResource[]>()

  async function loadParentPageOptions() {
    const thisRequestId = currentRequestId.value + 1
    currentRequestId.value = thisRequestId
    const pages = await fetchAllMembers($cwa, '/_/pages')
    if (thisRequestId === currentRequestId.value) {
      parentPages.value = pages
    }
    return parentPages
  }

  return {
    loadParentPageOptions,
    parentPages,
  }
}

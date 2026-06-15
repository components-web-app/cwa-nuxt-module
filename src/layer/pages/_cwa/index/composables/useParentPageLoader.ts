import { ref } from 'vue'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { useCwa } from '#imports'

export const useParentPageLoader = () => {
  const $cwa = useCwa()
  const currentRequestId = ref(0)
  const parentPages = ref<CwaResource[]>()

  async function loadParentPageOptions() {
    const thisRequestId = currentRequestId.value + 1
    currentRequestId.value = thisRequestId
    const { response } = $cwa.fetch({ path: '/_/pages', noQuery: true })
    const { _data: data } = await response
    if (thisRequestId === currentRequestId.value) {
      data && (parentPages.value = data['member'])
    }
    return parentPages
  }

  return {
    loadParentPageOptions,
    parentPages,
  }
}

import { ref } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { mergeQueryIntoPath } from '#cwa/api/fetcher/query-utils'
import type { CwaResource } from '#cwa/resources/resource-utils'

export const useListRoutes = (filter: 'pages' | 'pageData') => {
  const $cwa = useCwa()
  const routes = ref<Record<string, CwaResource>>({})
  const known = ref(false)
  const now = ref(new Date())
  const property = filter === 'pages' ? 'page' : 'pageData'
  let requestId = 0

  async function load(items: CwaResource[]) {
    const thisRequestId = ++requestId
    const routed = items.filter(item => !!item.route).map(item => item['@id'])
    now.value = new Date()
    if (!routed.length) {
      routes.value = {}
      known.value = true
      return
    }
    known.value = false
    try {
      const { response } = $cwa.fetch({ path: mergeQueryIntoPath('/_/routes', { [`${filter}[]`]: routed, perPage: '100' }), noQuery: true })
      const { _data: data } = await response
      if (thisRequestId !== requestId) {
        return
      }
      routes.value = Object.fromEntries(((data?.member ?? []) as CwaResource[]).filter(route => route[property]).map(route => [route[property], route]))
      known.value = true
    }
    catch {
      if (thisRequestId === requestId) {
        routes.value = {}
      }
    }
  }

  return { routes, known, now, load }
}

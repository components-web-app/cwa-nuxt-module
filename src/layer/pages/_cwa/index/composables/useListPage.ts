import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router'
import type { Ref } from 'vue'
import { computed } from 'vue'
import type ListContent from '#cwa/runtime/templates/components/core/admin/ListContent.vue'

export const useListPage = (listContent: Ref<InstanceType<typeof ListContent> | null>, clearPageNumberQuery?: boolean) => {
  const router = useRouter()
  const route = useRoute()

  function triggerReload() {
    listContent.value?.reloadItems()
  }

  function goToAdd() {
    router.push(computedItemLink.value('add'))
  }

  const computedItemLink = computed(() => {
    return (iri: string, routeName?: string, hash?: string, params?: { [key: string]: string }): RouteLocationRaw => {
      const currentRouteName = routeName || route.name?.toString()
      if (!currentRouteName) {
        return '#'
      }
      const upperRouteName = currentRouteName.replace(/-iri$/, '')

      if (!params) {
        params = {}
      }
      params.iri = iri

      const query = { ...route.query }
      clearPageNumberQuery && delete query.page

      return { name: `${upperRouteName}-iri`, params, query, hash }
    }
  })

  return {
    goToAdd,
    triggerReload,
    computedItemLink,
  }
}

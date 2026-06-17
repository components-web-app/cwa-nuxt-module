<template>
  <ListHeading
    title="Routes"
    :hide-add="true"
  />
  <div class="cwa:flex cwa:gap-x-2 cwa:mb-4">
    <button
      v-for="option in viewOptions"
      :key="option.value"
      class="cwa:px-3 cwa:py-1.5 cwa:text-sm cwa:rounded cwa:border cwa:cursor-pointer cwa:transition-colors"
      :class="viewMode === option.value
        ? 'cwa:bg-stone-700 cwa:border-stone-500 cwa:text-white'
        : 'cwa:bg-transparent cwa:border-stone-700 cwa:text-stone-400 cwa:hover:border-stone-500'"
      :aria-current="viewMode === option.value ? 'true' : undefined"
      @click="viewMode = option.value"
    >
      {{ option.label }}
    </button>
  </div>

  <!-- Hierarchy view -->
  <template v-if="viewMode === 'hierarchy'">
    <div
      v-if="hierarchyLoading"
      class="cwa:flex cwa:justify-center cwa:py-12"
    >
      <Spinner :show="true" />
    </div>
    <CwaUiAlertWarning v-else-if="hierarchyError">
      Could not load route hierarchy. Try the flat list view or reload the page.
    </CwaUiAlertWarning>
    <div v-else-if="hierarchyNodes.length">
      <RouteHierarchyNode
        v-for="node in hierarchyNodes"
        :key="node.route"
        :node="node"
        @delete="deleteRoute"
      />
    </div>
    <p
      v-else
      class="cwa:text-stone-400 cwa:text-center cwa:py-12"
    >
      No routes found.
    </p>
  </template>

  <!-- Flat list view (search/filter/order) -->
  <template v-else>
    <ListFilter
      :order-options="orderOptions"
      :search-fields="['path']"
    />
    <ListContent
      ref="listContent"
      fetch-url="/_/routes"
    >
      <template #item="{ data, rawData }">
        <RouteListRow
          :data="data"
          :associated-resources="rawData.associatedResources"
          :link-fn="computedItemLink"
          @delete="deleteRoute"
        />
      </template>
    </ListContent>
  </template>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import ListHeading from '#cwa/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/templates/components/core/admin/ListContent.vue'
import ListFilter from '#cwa/templates/components/core/admin/ListFilter.vue'
import { useListPage } from '#cwa-layer/pages/_cwa/index/composables/useListPage'
import { definePageMeta, useCwa, useHead } from '#imports'
import RouteListRow from '#cwa/templates/components/core/admin/RouteListRow.vue'
import RouteHierarchyNode from '#cwa/templates/components/core/admin/RouteHierarchyNode.vue'
import type { RouteHierarchyNodeData } from '#cwa/templates/components/core/admin/RouteHierarchyNode.vue'
import Spinner from '#cwa/templates/components/utils/Spinner.vue'

const $cwa = useCwa()
const listContent = ref<InstanceType<typeof ListContent> | null>(null)
const { computedItemLink, triggerReload } = useListPage(listContent, true)

const viewMode = ref<'hierarchy' | 'flat'>('hierarchy')
const viewOptions = [
  { label: 'Hierarchy', value: 'hierarchy' as const },
  { label: 'Flat list', value: 'flat' as const },
]

const hierarchyLoading = ref(false)
const hierarchyError = ref(false)
const hierarchyNodes = ref<RouteHierarchyNodeData[]>([])

interface FlatRoute {
  '@id': string
  'path': string
}

function buildRouteTree(routeList: FlatRoute[]): RouteHierarchyNodeData[] {
  const sorted = [...routeList].sort((a, b) => {
    const aDepth = (a.path.match(/\//g) || []).length
    const bDepth = (b.path.match(/\//g) || []).length
    if (aDepth !== bDepth) return aDepth - bDepth
    return a.path.localeCompare(b.path)
  })

  const nodeMap = new Map<string, RouteHierarchyNodeData>()
  const roots: RouteHierarchyNodeData[] = []

  for (const route of sorted) {
    const node: RouteHierarchyNodeData = { route: route['@id'], path: route.path, children: [] }
    let parentPath = ''
    for (const [p] of nodeMap) {
      if (route.path.startsWith(p + '/') && p.length > parentPath.length) {
        parentPath = p
      }
    }
    if (parentPath) {
      nodeMap.get(parentPath)!.children.push(node)
    }
    else {
      roots.push(node)
    }
    nodeMap.set(route.path, node)
  }

  return roots
}

async function loadHierarchy() {
  hierarchyLoading.value = true
  hierarchyError.value = false
  try {
    const { response } = $cwa.fetch({ path: '/_/routes', noQuery: true })
    const { _data: data } = await response
    const routeList: FlatRoute[] = data?.member ?? data?.['hydra:member'] ?? []
    hierarchyNodes.value = buildRouteTree(routeList)
  }
  catch {
    hierarchyError.value = true
  }
  finally {
    hierarchyLoading.value = false
  }
}

onMounted(() => {
  loadHierarchy()
})

async function deleteRoute(routeIri: string) {
  await $cwa.resourcesManager.deleteResource({ endpoint: routeIri })
  triggerReload()
  await loadHierarchy()
}

const orderOptions = [
  { label: 'New - Old', value: { createdAt: 'desc' } },
  { label: 'Old - New', value: { createdAt: 'asc' } },
  { label: 'A - Z', value: { path: 'asc' } },
  { label: 'Z - A', value: { path: 'desc' } },
]

useHead({ title: 'Routes' })

definePageMeta({
  name: '_cwa-routes',
  pageTransition: false,
})
</script>

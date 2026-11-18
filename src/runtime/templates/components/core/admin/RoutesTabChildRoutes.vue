<script setup lang="ts">
import { computed } from 'vue'
import CwaUiTree from '#cwa/templates/components/ui/Tree.vue'
import type { TreeAction, TreeNode } from '#cwa/templates/components/ui/Tree.vue'
import RouteStatusBadge from '#cwa/templates/components/core/admin/RouteStatusBadge.vue'
import type { CwaRouteLiveAt } from '#cwa/resources/route-publication'

export interface RouteHierarchyNodeData {
  route: string
  path: string
  children: RouteHierarchyNodeData[]
}

export interface ChildRouteDetail {
  publication: CwaRouteLiveAt
  page?: string
}

const { children, details = {} } = defineProps<{
  children: RouteHierarchyNodeData[]
  details?: Record<string, ChildRouteDetail>
}>()

const emit = defineEmits<{
  edit: [page: string]
  go: [path: string]
}>()

function toNodes(list: RouteHierarchyNodeData[]): TreeNode[] {
  return list.map(child => ({
    key: child.route,
    label: child.path,
    children: child.children.length ? toNodes(child.children) : undefined,
  }))
}

const nodes = computed(() => toNodes(children))

function actions(node: TreeNode): TreeAction[] {
  const page = details[node.key]?.page
  return [{
    label: `More actions for ${node.label}`,
    menu: [
      { label: 'Edit settings', value: 'edit', disabled: !page, disabledReason: page ? undefined : 'Still loading this page.', onSelect: () => page && emit('edit', page) },
      { label: 'Go to page', value: 'go', onSelect: () => emit('go', node.label) },
    ],
  }]
}
</script>

<template>
  <div
    data-testid="route-children"
    class="cwa:flex cwa:flex-col cwa:gap-stack"
  >
    <p class="cwa:m-0 cwa:text-helper cwa:text-fg-muted">
      Routes of the pages nested under this one. Their badges show when visitors can reach them.
    </p>
    <CwaUiTree
      label="Child routes"
      :nodes="nodes"
      :actions="actions"
      empty="No pages are nested under this one."
    >
      <template #badge="{ node }">
        <RouteStatusBadge
          v-if="details[node.key]"
          :publication="details[node.key]!.publication"
        />
      </template>
    </CwaUiTree>
  </div>
</template>

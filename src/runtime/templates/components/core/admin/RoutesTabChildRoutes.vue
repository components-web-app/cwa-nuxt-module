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

export type ChildRouteDetail = { state: 'loading' } | { state: 'failed' } | { state: 'loaded', publication: CwaRouteLiveAt, page?: string }

const { children, details = {} } = defineProps<{
  children: RouteHierarchyNodeData[]
  details?: Record<string, ChildRouteDetail>
}>()

const emit = defineEmits<{
  edit: [page: string]
  go: [path: string]
  shown: [routes: string[]]
  retry: [route: string]
}>()

function toNodes(list: RouteHierarchyNodeData[]): TreeNode[] {
  return list.map(child => ({
    key: child.route,
    label: child.path,
    children: child.children.length ? toNodes(child.children) : undefined,
  }))
}

const nodes = computed(() => toNodes(children))

function editReason(detail: ChildRouteDetail | undefined) {
  if (detail?.state === 'failed') {
    return 'This route didn\'t load. Retry to load it again.'
  }
  if (detail?.state === 'loaded') {
    return detail.page ? undefined : 'This route has no page.'
  }
  return 'Still loading this page.'
}

function actions(node: TreeNode): TreeAction[] {
  const detail = details[node.key]
  const page = detail?.state === 'loaded' ? detail.page : undefined
  const reason = editReason(detail)
  return [{
    label: `More actions for ${node.label}`,
    menu: [
      { label: 'Edit settings', value: 'edit', disabled: !!reason, disabledReason: reason, onSelect: () => page && emit('edit', page) },
      ...(detail?.state === 'failed' ? [{ label: 'Retry loading', value: 'retry', onSelect: () => emit('retry', node.key) }] : []),
      { label: 'Go to page', value: 'go', onSelect: () => emit('go', node.label) },
    ],
  }]
}

function loaded(key: string) {
  const detail = details[key]
  return detail?.state === 'loaded' ? detail : undefined
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
      @shown="emit('shown', $event)"
    >
      <template #badge="{ node }">
        <RouteStatusBadge
          v-if="loaded(node.key)"
          :publication="loaded(node.key)!.publication"
        />
        <span
          v-else-if="details[node.key]?.state === 'failed'"
          data-testid="route-child-failed"
          class="cwa:text-helper cwa:text-fg-muted"
        >Didn't load</span>
      </template>
    </CwaUiTree>
  </div>
</template>

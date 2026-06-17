<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { computed } from 'vue'
import IconPages from '#cwa/templates/components/core/assets/IconPages.vue'
import IconData from '#cwa/templates/components/core/assets/IconData.vue'
import { useDataList } from '#cwa-layer/pages/_cwa/index/composables/useDataList'

export interface RouteHierarchyNodeData {
  route: string
  path: string
  name: string
  page: string | null
  pageData: string | null
  children: RouteHierarchyNodeData[]
}

const props = defineProps<{
  node: RouteHierarchyNodeData
  depth?: number
  linkFn: (iri: string, routeName?: string, hash?: string, params?: { [key: string]: string }) => RouteLocationRaw
}>()

defineEmits<{
  delete: [string]
}>()

const { fqcnToEntrypointKey } = useDataList()
const depth = computed(() => props.depth ?? 0)

const linkTo = computed(() => {
  if (props.node.pageData) {
    return props.linkFn(props.node.pageData, '_cwa-data-type-iri', '#routes', { type: fqcnToEntrypointKey('') || '' })
  }
  if (props.node.page) {
    return props.linkFn(props.node.page, '_cwa-pages', '#routes')
  }
  return undefined
})
</script>

<template>
  <div :style="{ marginLeft: `${depth * 1.5}rem` }">
    <div class="cwa:flex cwa:border-b cwa:border-b-stone-700 cwa:py-4 cwa:gap-x-4 cwa:items-center">
      <div
        v-if="depth > 0"
        class="cwa:text-stone-600 cwa:select-none cwa:flex-none"
        aria-hidden="true"
      >
        └
      </div>
      <div class="cwa:grow cwa:flex cwa:flex-col cwa:gap-y-1 cwa:min-w-0">
        <span class="cwa:text-xl cwa:truncate">{{ node.path }}</span>
        <span
          v-if="!node.page && !node.pageData"
          class="cwa:inline-flex cwa:truncate cwa:bg-magenta/60 cwa:text-white cwa:font-bold cwa:py-1 cwa:px-3 cwa:border cwa:border-magenta cwa:rounded cwa:text-sm"
        >
          No association — consider deleting
        </span>
      </div>
      <div v-if="linkTo">
        <CwaUiFormButton :to="linkTo">
          <IconPages
            v-if="node.page"
            class="cwa:h-6"
          />
          <IconData
            v-else
            class="cwa:h-6"
          />
          <span class="cwa:sr-only">Manage</span>
        </CwaUiFormButton>
      </div>
      <div v-else>
        <CwaUiFormButton
          color="error"
          @click="$emit('delete', node.route)"
        >
          <CwaUiIconBinIcon class="cwa:w-4 cwa:m-1" />
          <span class="cwa:sr-only">Delete</span>
        </CwaUiFormButton>
      </div>
    </div>
    <RouteHierarchyNode
      v-for="child in node.children"
      :key="child.route"
      :node="child"
      :depth="depth + 1"
      :link-fn="linkFn"
      @delete="$emit('delete', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface RouteHierarchyNodeData {
  route: string
  path: string
  children: RouteHierarchyNodeData[]
}

const props = defineProps<{
  node: RouteHierarchyNodeData
  depth?: number
}>()

defineEmits<{
  delete: [string]
}>()

const depth = computed(() => props.depth ?? 0)
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
      </div>
      <div>
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
      @delete="$emit('delete', $event)"
    />
  </div>
</template>

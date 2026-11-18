<script lang="ts" setup>
import { defineAsyncComponent, shallowRef, watch } from 'vue'
import { resourceStackLevels } from '#cwa/templates/components/core/ui/resource-stack'
import type { ResourceStackLevel, StackPoint } from '#cwa/templates/components/core/ui/resource-stack'
import { useCwa } from '#cwa/composables/cwa'

const ResourceStack = defineAsyncComponent(() => import('#cwa/templates/components/ui/ResourceStack.vue'))

const props = defineProps<{
  modelValue: boolean
  point?: StackPoint & { key: number }
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const stackManager = useCwa().admin.resourceStackManager

const opened = shallowRef<{ key: number, at: StackPoint, levels: ResourceStackLevel[], selected?: string }>()

watch(() => props.modelValue ? props.point : undefined, (point) => {
  const stack = stackManager.contextStack.value
  const levels = point ? resourceStackLevels(stack) : []
  if (!point || !levels.length) {
    opened.value = undefined
    return
  }
  const currentIri = stackManager.currentStackItem.value?.iri
  opened.value = {
    key: point.key,
    at: { x: point.x, y: point.y },
    levels,
    selected: levels.find(level => stack[Number(level.key)]?.iri === currentIri)?.key,
  }
}, { immediate: true })

function select(key: string) {
  return stackManager.selectStackIndex(Number(key), true)
}

function close() {
  opened.value = undefined
  emit('update:modelValue', false)
}
</script>

<template>
  <ResourceStack
    v-if="opened"
    :key="opened.key"
    :levels="opened.levels"
    :selected="opened.selected"
    :at="opened.at"
    :select="select"
    @close="close"
  />
</template>

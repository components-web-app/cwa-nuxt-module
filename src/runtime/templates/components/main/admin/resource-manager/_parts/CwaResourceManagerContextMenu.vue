<script lang="ts" setup>
import { defineAsyncComponent, provide, shallowRef, watch } from 'vue'
import { useRouter } from '#app/composables/router'
import { resourceStackLevels } from '#cwa/templates/components/core/ui/resource-stack'
import type { ResourceStackLevel, StackPoint } from '#cwa/templates/components/core/ui/resource-stack'
import { createAnnouncer } from '#cwa/templates/components/core/ui/field-context'
import { announceKey } from '#cwa/templates/components/core/ui/field-keys'
import { useCwa } from '#cwa/composables/cwa'

const ResourceStack = defineAsyncComponent(() => import('#cwa/templates/components/core/ui/ResourceStack.vue'))

const props = defineProps<{
  modelValue: boolean
  point?: StackPoint & { key: number }
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const $cwa = useCwa()
const stackManager = $cwa.admin.resourceStackManager
const router = useRouter()
const announcer = createAnnouncer()
provide(announceKey, announcer.announce)

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

watch([() => $cwa.resources.displayPageIri.value, () => router.currentRoute.value.fullPath], () => {
  opened.value && close()
})

async function select(key: string) {
  const item = stackManager.contextStack.value[Number(key)]
  await stackManager.selectStackIndex(Number(key), true)
  return stackManager.currentStackItem.value?.iri === item?.iri
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
  <span
    role="status"
    aria-live="polite"
    class="cwa:sr-only"
    data-testid="resource-stack-announcer"
  >{{ announcer.message.value }}</span>
</template>

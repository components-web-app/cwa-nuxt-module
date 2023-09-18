<script lang="ts" setup>
import { computed } from 'vue'
import { useCwa } from '#imports'

const $cwa = useCwa()

const props = defineProps<{ index: number }>()
defineEmits(['click'])

const stackItem = computed(() => {
  return $cwa.admin.componentManager.resourceStack.value[props.index]
})

const nextIndex = computed(() => (props.index - 1))
</script>

<template>
  <div
    class="resource-context-item cwa-border cwa-border-dashed cwa-px-2 cwa-py-1 cwa-bg-gray-900 cwa-cursor-pointer cwa-text-stone-400 cwa-transition-all
    [&:not(:has(.resource-context-item:hover)):hover]:cwa-border-gray-200
    [&:not(:has(.resource-context-item:hover)):hover]:cwa-border-solid
    [&:not(:has(.resource-context-item:hover)):hover]:cwa-text-white"
    @click="$emit('click', index)"
  >
    <resource-context-item v-if="nextIndex >= 0" :index="nextIndex" @click="childIndex => $emit('click', childIndex)" />
    <button class="cwa-px-2 cwa-py-1 cwa-w-full">
      {{ stackItem.displayName || stackItem.iri }}
    </button>
  </div>
</template>

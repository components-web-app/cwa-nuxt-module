<script lang="ts" setup>
import { computed } from 'vue'
import { useCwa } from '#imports'

const $cwa = useCwa()

const props = defineProps<{ index: number, rootWidth?: number, useCurrentStack?: boolean }>()
defineEmits(['click'])

const stack = computed(() => {
  return props.useCurrentStack
    ? $cwa.admin.resourceStackManager.resourceStack.value
    : $cwa.admin.resourceStackManager.contextStack.value
})

const stackItem = computed(() => {
  return stack.value[props.index]
})

const nextIndex = computed(() => (props.index - 1))
</script>

<template>
  <div
    class="resource-context-item cwa:border cwa:border-dashed cwa:px-1.5 cwa:py-1 cwa:cursor-pointer cwa:text-gray-300 cwa:block
    [&:not(:has(.resource-context-item:hover)):hover]:cwa:!bg-dark
    [&:not(:has(.resource-context-item:hover)):hover]:cwa:!border-gray-200
    [&:not(:has(.resource-context-item:hover)):hover]:cwa:!border-solid
    [&:not(:has(.resource-context-item:hover)):hover]:cwa:!text-white"
    :style="{ minWidth: rootWidth && index === 0 ? `${rootWidth}px` : `auto` }"
    @click="$emit('click', index)"
  >
    <resource-context-item
      v-if="nextIndex >= 0"
      :index="nextIndex"
      :root-width="rootWidth"
      :use-current-stack="useCurrentStack"
      @click="childIndex => $emit('click', childIndex)"
    />
    <button class="cwa:px-1.5 cwa:py-0.5 cwa:w-auto cwa:min-w-full cwa:cursor-pointer">
      {{ stackItem.displayName || stackItem.iri }}
    </button>
  </div>
</template>

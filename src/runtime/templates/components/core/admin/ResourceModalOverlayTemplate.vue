<template>
  <Transition v-bind="overlay">
    <div
      v-if="show"
      class="cwa:fixed cwa:z-dialog cwa:bg-dark/80 cwa:backdrop-blur-sm cwa:top-0 cwa:left-0 cwa:w-full cwa:h-full cwa:px-6 cwa:py-10 cwa:text-light cwa:flex cwa:justify-center cwa:items-center"
    >
      <slot />
    </div>
  </Transition>
</template>

<script lang="ts" setup>
import { useTransitions } from '#cwa/composables/transitions'

defineProps<{
  show: boolean
}>()
const { overlay } = useTransitions()
defineSlots<{
  default(): any
}>()
</script>

<template>
  <Transition v-bind="progressBar">
    <div
      v-show="props.show"
      class="cwa:w-full cwa:h-0.5"
    >
      <div
        :class="[colourClass]"
        class="cwa:h-0.5 cwa:transition-all cwa:duration-300"
        :style=" { width: `${props.percent}%` }"
      />
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useTransitions } from '#cwa/composables/transitions'

const { progressBar } = useTransitions()
const props = withDefaults(defineProps<{
  show: boolean
  percent: number
  colourClass?: string
}>(), { colourClass: 'cwa:bg-green' })
</script>

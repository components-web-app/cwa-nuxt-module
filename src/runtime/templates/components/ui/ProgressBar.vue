<template>
  <Transition
    enter-from-class="cwa-transform cwa-opacity-0 cwa-w-0"
    enter-active-class="cwa-duration-200 cwa-ease-out"
    enter-to-class="cwa-opacity-100"
    leave-from-class="cwa-opacity-100"
    leave-active-class="cwa-duration-300 cwa-ease-in cwa-delay-200"
    leave-to-class="cwa-transform cwa-opacity-0"
  >
    <div v-show="props.show" class="cwa-w-full cwa-h-0.5">
      <div :class="[colourClass]" class="cwa-h-0.5 cwa-transition-all cwa-duration-300" :style=" { width: `${props.percent}%` }" />
    </div>
  </Transition>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  show: boolean,
  percent: number,
  colourClass?: string
}>(), { colourClass: 'cwa-bg-green' })
</script>

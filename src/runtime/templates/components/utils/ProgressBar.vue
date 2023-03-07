<template>
  <Transition
    enter-from-class="cwa-transform cwa-opacity-0 cwa-w-0"
    enter-active-class="cwa-duration-200 cwa-ease-out"
    enter-to-class="cwa-opacity-100"
    leave-from-class="cwa-opacity-100"
    leave-active-class="cwa-duration-300 cwa-ease-in cwa-delay-200"
    leave-to-class="cwa-transform cwa-opacity-0"
  >
    <div v-show="props.show" class="cwa-w-full cwa-h-1">
      <div class="cwa-bg-green-400 cwa-h-1 cwa-transition-all cwa-duration-300" :style=" { width: `${props.percent}%` }" />
    </div>
  </Transition>
</template>

<script setup>
const props = defineProps({
  show: { required: true, type: Boolean },
  percent: { required: true, type: Number }
})
</script>

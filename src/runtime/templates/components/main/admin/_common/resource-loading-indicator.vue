<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useCwa } from '#imports'

const $cwa = useCwa()

const requestsOngoing = computed(() => {
  return $cwa.resourcesManager.requestCount.value > 0
})

const holder = ref<undefined|HTMLElement>()
const currentIndicators = ref<number[]>([])
const indicatorCount = ref(0)

onMounted(() => {
  watch(requestsOngoing, (isRequests) => {
    if (isRequests) {
      indicatorCount.value++
      if (indicatorCount.value > 100) {
        indicatorCount.value = 0
      }
      currentIndicators.value.push(indicatorCount.value)
    } else if (currentIndicators.value.length) {
      currentIndicators.value.splice(0, 1)
    }
  })
})
</script>

<template>
  <div ref="holder" class="cwa-w-full cwa-h-1">
    <TransitionGroup name="load-indicator">
      <div v-for="count in currentIndicators" :key="`load-indicator-${count}`" class="cwa-absolute cwa-h-full cwa-bg-orange cwa-top-0 cwa-left-0 cwa-right-0">
        <div class="cwa-loader-inner-indicator cwa-bg-dark/25 cwa-h-full cwa-top-0 cwa-absolute cwa-z-10" />
      </div>
    </TransitionGroup>
  </div>
</template>

<style>
.load-indicator-enter-active,
.load-indicator-leave-active {
  transition: all .5s ease;
}
.load-indicator-enter-from {
  opacity: 1;
  right: 100% !important;
}

.load-indicator-leave-to {
  opacity: 1;
  left: 100% !important;
}

@keyframes inner-indicator-animation {
  20%   {
    right: 100%;
    left: 0;
  }
  50%  {
    right: 0;
    left: 0;
  }
  80%  {
    right: 0;
    left: 100%;
  }
}

.cwa-loader-inner-indicator {
  animation: inner-indicator-animation 1.75s infinite;
}
</style>

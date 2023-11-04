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
        <div class="cwa-shadow-[inset_-20px_0_10px_-10px] cwa-shadow-orange cwa-absolute cwa-right-full cwa-w-[2rem] cwa-h-full" />
        <div class="cwa-loader-inner-holder cwa-transition cwa-left-0 cwa-right-0 cwa-top-0 cwa-h-full">
          <div class="cwa-loader-inner-indicator cwa-bg-white/60 cwa-h-full cwa-top-0 cwa-absolute cwa-z-10" />
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style>
.load-indicator-enter-active,
.load-indicator-leave-active {
  transition: all .6s ease;
}
.load-indicator-enter-from {
  opacity: 1;
  right: 100% !important;
}

.load-indicator-leave-to {
  opacity: 1;
  left: 100% !important;
  .cwa-loader-inner-holder {
    left: 100% !important;
    opacity: 0 !important;
  }
}

@keyframes inner-indicator-animation {
  0%,
  10% {
    right: 100%;
    left: 0;
    opacity: 0;
  }
  20%,
  80% {
    opacity: 1;
  }
  50% {
    right: 0;
    left: 0;
    opacity: 1;
  }
  90%,
  100% {
    right: 0;
    left: 100%;
    opacity: 0;
  }
}

.cwa-loader-inner-indicator {
  animation: inner-indicator-animation 1.5s infinite;
  animation-delay: 500ms;
  transition: all .5s;
}
</style>

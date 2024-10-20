<script lang="ts" setup>
// Based on. Credit https://codepen.io/splitti/pen/jLZjgx
import { computed, toRef } from 'vue'

const props = defineProps<{ isLoading: boolean, isPending?: boolean }>()
const isLoadingRef = toRef(props, 'isLoading')
const isPendingRef = toRef(props, 'isPending')

const circleColor = computed(() => {
  if (isPendingRef.value) {
    return 'cwa-stroke-orange cwa-fill-orange'
  }
  return isLoadingRef.value ? 'cwa-stroke-orange' : ''
})
</script>

<template>
  <svg
    class="spinner-tick cwa-w-6 cwa-h-6"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    xml:space="preserve"
    :class="[isPendingRef ? 'pending' : (isLoadingRef ? 'progress' : 'ready')]"
  >
    <circle
      class="circle"
      cx="50"
      cy="50"
      r="44"
      fill="transparent"
      :class="circleColor"
    />
    <polyline
      class="tick cwa-stroke-green"
      points="25,55 45,70 75,33"
      fill="transparent"
    />
  </svg>
</template>

<style>
.spinner-tick {
  .tick {
    stroke-width: 12;
    transition: all .6s;
  }

  .circle {
    stroke-width: 0;
    transform-origin: 50% 50% 0;
    transition: all 1s;
    stroke-dasharray: 314;
  }

  &.progress {
    .tick {
      opacity: 0;
    }
    .circle {
      stroke-width: 12;
      stroke-dasharray: 314;
      animation: spin 1.8s linear infinite;
    }
  }

  &.ready {
    .tick {
      opacity: 1;
    }
    .circle {
      stroke-dashoffset: 66;
    }
  }

  &.pending {
    .tick {
      opacity: 0;
    }
    .circle {
      stroke-width: 12;
      stroke-dasharray: 314;
      animation: pulse 2.8s ease-in-out infinite;
    }
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
  100% {
    opacity: 1;
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
    stroke-dashoffset: 66;
  }
  50% {
    transform: rotate(540deg);
    stroke-dashoffset: 314;
  }
  100% {
    transform: rotate(1080deg);
    stroke-dashoffset: 66;
  }
}
</style>

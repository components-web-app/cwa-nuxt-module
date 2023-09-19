<script lang="ts" setup>
// Based on. Credit https://codepen.io/splitti/pen/jLZjgx
import { computed, toRef } from 'vue'

const props = defineProps<{ isLoading: boolean }>()
const isLoadingRef = toRef(props, 'isLoading')

const colour = computed(() => {
  return isLoadingRef.value ? 'cwa-stroke-orange' : 'cwa-stroke-green'
})
</script>

<template>
  <svg
    class="spinner-tick cwa-w-6 cwa-h-6"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    xml:space="preserve"
    :class="[ isLoadingRef ? 'progress' : 'ready' ]"
  >
    <circle
      class="circle"
      cx="50"
      cy="50"
      r="46"
      fill="transparent"
      :class="colour"
    />
    <polyline class="tick" points="25,55 45,70 75,33" fill="transparent" :class="colour" />
  </svg>
</template>

<style>
.spinner-tick {
  .tick {
    stroke-width: 12;
    transition: all 1s;
  }

  .circle {
    stroke-width: 12;
    transform-origin: 50px 50px 0;
    transition: all 1s;
    stroke-dasharray: 500;
  }

  &.progress {
    .tick {
      opacity: 0;
    }
    .circle {
      stroke-dasharray: 314;
      stroke-dashoffset: 1000;
      animation: spin 3s linear infinite;
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

<template>
  <li
    class="cwa:pointer-events-auto cwa:w-full cwa:max-w-sm cwa:overflow-hidden cwa:rounded-lg cwa:dark-blur cwa:ring-2 cwa:ring-magenta"
    @mouseout="setEmitTimeout"
    @mouseover="clearEmitTimeout"
  >
    <div class="cwa:p-4">
      <div class="cwa:flex cwa:items-start cwa:relative">
        <div class="cwa:ml-3 cwa:w-0 cwa:flex-1 cwa:pt-0.5">
          <slot />
        </div>
        <div class="cwa:ml-4 cwa:flex cwa:shrink-0">
          <button
            type="button"
            class="cwa:inline-flex cwa:rounded-md cwa:text-stone-400 cwa:hover:text-white cwa:transition cwa:cursor-pointer"
            @click="$emit('clear')"
          >
            <span class="cwa:sr-only">Close</span>
            <CwaUiIconXMarkIcon
              class="cwa:h-5 cwa:w-5"
              aria-hidden="true"
            />
          </button>
        </div>
        <svg
          class="cwa:absolute cwa:-top-0.5 cwa:-right-0.5 countdown-icon cwa:w-6 cwa:h-6 cwa:pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 100 100"
          xml:space="preserve"
          :class="{ 'is-progressing': emitTimeout !== undefined }"
        >
          <circle
            class="circle cwa:stroke-stone-400"
            cx="50"
            cy="50"
            r="44"
            fill="transparent"
          />
        </svg>
      </div>
    </div>
  </li>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

const emitTimeout = ref<undefined | ReturnType<typeof setTimeout>>()
const emit = defineEmits(['clear'])

function setEmitTimeout() {
  emitTimeout.value = setTimeout(() => {
    emit('clear')
  }, 6000)
}

function clearEmitTimeout() {
  if (emitTimeout.value) {
    clearTimeout(emitTimeout.value)
    emitTimeout.value = undefined
  }
}

onMounted(() => {
  setTimeout(() => {
    setEmitTimeout()
  }, 20)
})
</script>

<style>
.countdown-icon {
  .circle {
    stroke-width: 12;
    transform-origin: 50% 50% 0;
    stroke-dasharray: 314;
    stroke-dashoffset: 0;
    transform: rotate(-90deg);
    transition: .6s stroke-dashoffset linear;
  }
  &.is-progressing {
    .circle {
      transition-duration: 6s;
      stroke-dashoffset: 314;
    }
  }
}
</style>

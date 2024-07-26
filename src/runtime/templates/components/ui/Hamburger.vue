<template>
  <a
    class="cwa-relative cwa-inline-block cwa-z-10 cwa-h-6"
    :class="{ 'is-open': model }"
    @click.stop="toggleMenu"
  >
    <span class="cwa-sr-only">Menu</span>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 50 50"
      class="cwa-relative cwa-block cwa-transition-[stroke] cwa-duration-300 cwa-fill-none cwa-stroke-gray-300 cwa-my-0 cwa-mx-auto [stroke-linecap:round] cwa-stroke-[5px] cwa-h-full cwa-cursor-pointer"
    >
      <g class="end">
        <path class="end-one" d="M42,8 L 25.5,25.3 L 8,8" />
        <path class="end-two" d="M8,42 L 25.5,25.3 L 42,42" />
      </g>
      <g class="middle">
        <path class="middle-one" d="M8,8 c 0 0, 2.2 4.5, 12 13.5 S 38,8,42,8" />
        <path
          class="middle-two"
          d="M8,42 c 0 0, 2.2-4.5, 12-13.5 S 38,42,42,42"
        />
      </g>
      <g id="stage" class="start">
        <path class="stage-one" d="M5,8c0,0,2.2,0,13,0s13,0,27,0" />
        <path class="stage-two" d="M5,42c0,0,2.2,0,13,0s13,0,27,0" />
        <line class="stage-line" x1="5" y1="25" x2="45" y2="25" />
      </g>
    </svg>
  </a>
</template>

<script setup lang="ts">
const model = defineModel<boolean>({
  required: true,
  default: false
})

function toggleMenu () {
  model.value = !model.value
}
</script>

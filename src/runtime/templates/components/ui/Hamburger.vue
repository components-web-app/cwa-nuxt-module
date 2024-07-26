<template>
  <a
    class="cwa-inline-block cwa-h-6"
    :class="{ 'is-open': model }"
    @click.stop="toggleMenu"
  >
    <span class="cwa-sr-only">Menu</span>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 50 50"
      class="cwa-relative cwa-block cwa-transition-[stroke] cwa-duration-300 cwa-fill-none cwa-my-0 cwa-mx-auto [stroke-linecap:round] cwa-stroke-[5px] cwa-h-full cwa-cursor-pointer"
      :class="[ model ? 'cwa-stroke-white' : 'cwa-stroke-gray-300' ]"
    >
      <!-- end - final X -->
      <g
        class="cwa-transition-[opacity,transform] cwa-duration-300 cwa-origin-center"
        :class="[ model ? 'cwa-opacity-100 cwa-rotate-0' : 'cwa-opacity-0 -cwa-rotate-45' ]"
      >
        <path class="end-one" d="M42,8 L 25.5,25.3 L 8,8" />
        <path class="end-two" d="M8,42 L 25.5,25.3 L 42,42" />
      </g>
      <!-- middle - curved X (only used in legacy gsap svg transforms) -->
      <g class="cwa-hidden">
        <path class="middle-one" d="M8,8 c 0 0, 2.2 4.5, 12 13.5 S 38,8,42,8" />
        <path
          class="middle-two"
          d="M8,42 c 0 0, 2.2-4.5, 12-13.5 S 38,42,42,42"
        />
      </g>
      <!-- start, 3 lines -->
      <g
        class="cwa-transition-[opacity,transform] cwa-duration-300 cwa-origin-center"
        :class="[ model ? 'cwa-opacity-0 cwa-rotate-180' : 'cwa-opacity-100 cwa-rotate-0' ]"
      >
        <!-- top path for morphing into middle (when legacy used gsap - may re-implement) -->
        <path class="stage-one" d="M5,8c0,0,2.2,0,13,0s13,0,27,0" />
        <!-- bottom path for morphing into middle (when legacy used gsap - may re-implement) -->
        <path class="stage-two" d="M5,42c0,0,2.2,0,13,0s13,0,27,0" />
        <!-- middle line as we just fade out -->
        <line class="cwa-origin-center" x1="5" y1="25" x2="45" y2="25" />
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

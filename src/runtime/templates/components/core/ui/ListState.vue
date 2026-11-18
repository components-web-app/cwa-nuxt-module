<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Spinner from '../../ui/Spinner.vue'

const STILL_LOADING_AFTER = 5000

const { state, noun, rows = 5, title, description } = defineProps<{
  state: 'loading' | 'empty'
  noun: string
  rows?: number
  title?: string
  description?: string
}>()

const still = ref(false)
const reduced = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  reduced.value = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  timer = setTimeout(() => {
    still.value = true
  }, STILL_LOADING_AFTER)
})

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div
    v-if="state === 'loading'"
    data-testid="list-state-loading"
  >
    <p
      v-if="still || reduced"
      data-testid="list-state-progress"
      class="cwa:m-0 cwa:flex cwa:items-center cwa:gap-2 cwa:px-4 cwa:py-3 cwa:text-helper cwa:text-fg-muted"
    >
      <Spinner size="sm" />
      {{ still ? 'Still loading…' : `Loading ${noun}…` }}
    </p>
    <div
      v-for="row in rows"
      :key="row"
      aria-hidden="true"
      data-testid="list-state-skeleton"
      class="cwa:flex cwa:h-16 cwa:items-center cwa:gap-4 cwa:border-b cwa:border-line cwa:px-4 cwa:max-md:h-[4.25rem]"
    >
      <div class="cwa:flex cwa:min-w-0 cwa:flex-1 cwa:flex-col cwa:gap-2">
        <span class="cwa:skeleton cwa:block cwa:h-3.5 cwa:w-2/5" />
        <span class="cwa:skeleton cwa:block cwa:h-3 cwa:w-1/4" />
      </div>
      <span class="cwa:skeleton cwa:block cwa:h-3.5 cwa:w-24 cwa:max-md:hidden" />
    </div>
  </div>
  <div
    v-else
    data-testid="list-state-empty"
    class="cwa:flex cwa:flex-col cwa:items-center cwa:gap-2 cwa:px-4 cwa:py-12 cwa:text-center"
  >
    <p class="cwa:m-0 cwa:text-control cwa:font-semibold cwa:text-fg">
      {{ title ?? `No ${noun} yet` }}
    </p>
    <p
      v-if="description"
      class="cwa:m-0 cwa:text-helper cwa:text-fg-muted"
    >
      {{ description }}
    </p>
    <div
      v-if="$slots.default"
      class="cwa:mt-2"
    >
      <slot />
    </div>
  </div>
</template>

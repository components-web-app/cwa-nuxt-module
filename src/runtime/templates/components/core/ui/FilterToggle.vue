<script setup lang="ts">
import CheckGlyph from './CheckGlyph.vue'

export type FilterToggleColour = 'static' | 'dynamic'

const { label, colour } = defineProps<{
  label: string
  colour: FilterToggleColour
}>()

const pressed = defineModel<boolean>({ default: false })

const looks: Record<FilterToggleColour, { mark: string, on: string }> = {
  static: { mark: 'cwa:rounded-full cwa:bg-type-static', on: 'cwa:bg-type-static cwa:text-stone-900' },
  dynamic: { mark: 'cwa:rounded-full cwa:bg-type-dynamic', on: 'cwa:bg-type-dynamic cwa:text-stone-900' },
}
</script>

<template>
  <button
    type="button"
    :aria-pressed="pressed ? 'true' : 'false'"
    data-testid="filter-toggle"
    :data-colour="colour"
    class="cwa:inline-flex cwa:h-control cwa:shrink-0 cwa:cursor-pointer cwa:items-center cwa:gap-2 cwa:whitespace-nowrap cwa:ps-3 cwa:pe-3.5 cwa:text-label cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:ease-out cwa:motion-reduce:transition-none cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:pointer-coarse:h-hit"
    :class="pressed ? looks[colour].on : 'cwa:bg-field cwa:text-fg cwa:hover:bg-field-hover'"
    @click="pressed = !pressed"
  >
    <CheckGlyph
      v-if="pressed"
      class="cwa:size-3"
    />
    <span
      v-else
      aria-hidden="true"
      data-testid="filter-toggle-mark"
      class="cwa:size-2.5 cwa:shrink-0"
      :class="looks[colour].mark"
    />
    {{ label }}
  </button>
</template>

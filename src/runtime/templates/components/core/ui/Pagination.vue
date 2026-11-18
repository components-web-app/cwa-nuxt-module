<script setup lang="ts">
import { computed } from 'vue'
import ChevronGlyph from './ChevronGlyph.vue'

const { total, perPage, label = 'Pages' } = defineProps<{
  total: number
  perPage: number
  label?: string
}>()

const page = defineModel<number>('page', { required: true })

const pageCount = computed(() => Math.max(1, Math.ceil(total / Math.max(1, perPage))))
const current = computed(() => Math.min(Math.max(1, page.value || 1), pageCount.value))
const first = computed(() => total ? (current.value - 1) * perPage + 1 : 0)
const last = computed(() => Math.min(total, current.value * perPage))

const slots = computed<(number | 'gap-start' | 'gap-end')[]>(() => {
  const count = pageCount.value
  const at = current.value
  if (count <= 7) {
    return Array.from({ length: count }, (_, index) => index + 1)
  }
  if (at <= 4) {
    return [1, 2, 3, 4, 5, 'gap-end', count]
  }
  if (at >= count - 3) {
    return [1, 'gap-start', count - 4, count - 3, count - 2, count - 1, count]
  }
  return [1, 'gap-start', at - 1, at, at + 1, 'gap-end', count]
})

function go(target: number) {
  if (target >= 1 && target <= pageCount.value && target !== current.value) {
    page.value = target
  }
}

const square = 'cwa:grid cwa:size-hit cwa:shrink-0 cwa:place-items-center cwa:text-label cwa:tabular-nums cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:ease-out cwa:motion-reduce:transition-none cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg'
const wide = 'cwa:inline-flex cwa:h-hit cwa:shrink-0 cwa:items-center cwa:px-4 cwa:text-label cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg'

function stepClasses(disabled: boolean) {
  return disabled ? 'cwa:cursor-not-allowed cwa:text-fg-muted cwa:opacity-50' : 'cwa:cursor-pointer cwa:text-fg cwa:hover:bg-button'
}
</script>

<template>
  <nav
    :aria-label="label"
    data-testid="pagination"
    class="cwa:flex cwa:items-center cwa:justify-between cwa:gap-4"
  >
    <p
      data-testid="pagination-range"
      class="cwa:m-0 cwa:text-helper cwa:tabular-nums cwa:text-fg-muted cwa:max-sm:hidden"
    >
      {{ first }}–{{ last }} of {{ total }}
    </p>
    <div class="cwa:flex cwa:items-center cwa:max-sm:hidden">
      <button
        type="button"
        aria-label="Previous page"
        :aria-disabled="current <= 1 ? 'true' : undefined"
        data-testid="pagination-previous"
        :class="[square, stepClasses(current <= 1)]"
        @click="go(current - 1)"
      >
        <ChevronGlyph class="cwa:size-3 cwa:rotate-90" />
      </button>
      <template
        v-for="slot in slots"
        :key="slot"
      >
        <span
          v-if="typeof slot !== 'number'"
          aria-hidden="true"
          class="cwa:grid cwa:size-hit cwa:place-items-center cwa:text-fg-muted"
        >…</span>
        <button
          v-else
          type="button"
          :aria-label="`Page ${slot}`"
          :aria-current="slot === current ? 'page' : undefined"
          data-testid="pagination-page"
          :class="[square, slot === current ? 'cwa:cursor-default cwa:bg-accent cwa:text-white' : 'cwa:cursor-pointer cwa:text-fg cwa:hover:bg-button']"
          @click="go(slot)"
        >
          {{ slot }}
        </button>
      </template>
      <button
        type="button"
        aria-label="Next page"
        :aria-disabled="current >= pageCount ? 'true' : undefined"
        data-testid="pagination-next"
        :class="[square, stepClasses(current >= pageCount)]"
        @click="go(current + 1)"
      >
        <ChevronGlyph class="cwa:size-3 cwa:-rotate-90" />
      </button>
    </div>
    <div class="cwa:flex cwa:w-full cwa:items-center cwa:justify-between cwa:sm:hidden">
      <button
        type="button"
        :aria-disabled="current <= 1 ? 'true' : undefined"
        data-testid="pagination-phone-previous"
        :class="[wide, 'cwa:bg-button', stepClasses(current <= 1)]"
        @click="go(current - 1)"
      >
        Previous
      </button>
      <span class="cwa:text-label cwa:tabular-nums cwa:text-fg-secondary">Page {{ current }} of {{ pageCount }}</span>
      <button
        type="button"
        :aria-disabled="current >= pageCount ? 'true' : undefined"
        data-testid="pagination-phone-next"
        :class="[wide, 'cwa:bg-button', stepClasses(current >= pageCount)]"
        @click="go(current + 1)"
      >
        Next
      </button>
    </div>
  </nav>
</template>

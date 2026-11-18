<script setup lang="ts">
import { useId } from 'vue'

const { title, description, columns = 1 } = defineProps<{
  title?: string
  description?: string
  columns?: 1 | 2
}>()

const headingId = useId()
</script>

<template>
  <section
    :aria-labelledby="title ? headingId : undefined"
    data-testid="form-section"
    class="cwa:@container cwa:border-line cwa:not-first:mt-section cwa:not-first:border-t cwa:not-first:pt-section"
  >
    <div
      v-if="title"
      class="cwa:mb-section-head cwa:flex cwa:flex-wrap cwa:items-start cwa:justify-between cwa:gap-x-4 cwa:gap-y-2"
    >
      <div class="cwa:min-w-0">
        <h3
          :id="headingId"
          class="cwa:m-0 cwa:text-section cwa:text-fg-secondary"
        >
          {{ title }}
        </h3>
        <p
          v-if="description"
          class="cwa:mt-1 cwa:mb-0 cwa:text-helper cwa:text-fg-muted"
        >
          {{ description }}
        </p>
      </div>
      <slot name="action" />
    </div>
    <div
      class="cwa:grid cwa:grid-cols-1 cwa:gap-y-stack"
      :class="{ 'cwa:gap-x-4 cwa:@lg:grid-cols-2': columns === 2 }"
    >
      <slot />
    </div>
  </section>
</template>

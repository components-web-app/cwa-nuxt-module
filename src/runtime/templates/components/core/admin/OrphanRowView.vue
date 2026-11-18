<script setup lang="ts">
import Spinner from '../../ui/Spinner.vue'

const { loading, error, data, label } = defineProps<{
  loading: boolean
  error?: string
  data?: unknown
  label: string
}>()
</script>

<template>
  <div
    class="cwa:mt-3"
    data-testid="orphaned-row-view"
    :aria-busy="loading ? 'true' : undefined"
  >
    <p
      v-if="loading"
      class="cwa:m-0 cwa:flex cwa:items-center cwa:gap-2 cwa:text-helper cwa:text-fg-muted"
    >
      <Spinner size="sm" />Loading…
    </p>
    <p
      v-else-if="error"
      class="cwa:m-0 cwa:text-helper cwa:text-danger-fg"
    >
      {{ error }}
    </p>
    <pre
      v-else
      tabindex="0"
      :aria-label="label"
      data-testid="orphaned-row-data"
      class="cwa:m-0 cwa:max-h-96 cwa:overflow-auto cwa:bg-field cwa:p-4 cwa:font-mono cwa:text-helper cwa:text-fg-secondary cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg"
    >{{ JSON.stringify(data, null, 2) }}</pre>
  </div>
</template>

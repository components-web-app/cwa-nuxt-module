<script setup lang="ts">
import type { RemoteFieldChange } from '#cwa/resources/model-editors'

const { change } = defineProps<{
  change: RemoteFieldChange
}>()
</script>

<template>
  <span
    data-testid="remote-change"
    class="cwa:flex cwa:shrink-0 cwa:items-center cwa:gap-x-2 cwa:whitespace-nowrap cwa:text-sm cwa:text-amber-300"
  >
    <span>{{ change.name }} changed this</span>
    <span aria-hidden="true">·</span>
    <button
      type="button"
      data-testid="remote-change-accept"
      class="cwa:underline cwa:hover:text-white"
      @click="change.accept()"
    >Use theirs</button>
    <span aria-hidden="true">/</span>
    <button
      type="button"
      data-testid="remote-change-keep"
      class="cwa:underline cwa:hover:text-white"
      @click="change.keep()"
    >Keep mine</button>
  </span>
</template>

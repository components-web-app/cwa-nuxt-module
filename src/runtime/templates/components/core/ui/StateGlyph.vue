<script setup lang="ts">
export type GlyphKind = 'error' | 'conflict' | 'saved' | 'draft' | 'live' | 'scheduled' | 'new' | 'group' | 'info'

const { kind, accent = false } = defineProps<{
  kind: GlyphKind
  accent?: boolean
}>()

const colours: Record<GlyphKind, string> = {
  error: 'cwa:text-danger-fg',
  conflict: 'cwa:text-warning',
  saved: 'cwa:text-success',
  draft: 'cwa:text-fg-muted',
  live: 'cwa:text-success',
  scheduled: 'cwa:text-accent-fg',
  new: 'cwa:text-fg-muted',
  group: 'cwa:text-fg-muted',
  info: 'cwa:text-fg-muted',
}
</script>

<template>
  <svg
    viewBox="0 0 16 16"
    aria-hidden="true"
    class="cwa:size-4 cwa:shrink-0"
    :class="accent ? 'cwa:text-accent-fg' : colours[kind]"
    :data-glyph="kind"
    fill="currentColor"
  >
    <path
      v-if="kind === 'error'"
      d="M8 1.5 15.5 14.5H.5Z M7.2 6h1.6v4.2H7.2Z M7.2 11.2h1.6v1.6H7.2Z"
      fill-rule="evenodd"
    />
    <path
      v-else-if="kind === 'conflict'"
      d="M8 .8 15.2 8 8 15.2.8 8Z M7.2 4.2h1.6v4.6H7.2Z M7.2 10h1.6v1.6H7.2Z"
      fill-rule="evenodd"
    />
    <path
      v-else-if="kind === 'saved'"
      d="M6.2 12.6 1.8 8.2l1.6-1.6 2.8 2.8 6.4-6.4 1.6 1.6Z"
    />
    <circle
      v-else-if="kind === 'draft'"
      cx="8"
      cy="8"
      r="4"
    />
    <path
      v-else-if="kind === 'live'"
      d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 1.6a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8ZM8 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
      fill-rule="evenodd"
    />
    <path
      v-else-if="kind === 'scheduled'"
      d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm-.8 3v4.1l3.1 2 .9-1.3-2.4-1.6V4.5Z"
      fill-rule="evenodd"
    />
    <circle
      v-else-if="kind === 'new'"
      cx="8"
      cy="8"
      r="5.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-dasharray="2.4 1.9"
    />
    <path
      v-else-if="kind === 'group'"
      d="M2 3h12v2.4H2Zm0 3.8h12v2.4H2Zm0 3.8h12V13H2Z"
    />
    <path
      v-else
      d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm-.9 5.8v5h1.8v-5Zm0-2.8v1.8h1.8V4Z"
      fill-rule="evenodd"
    />
  </svg>
</template>

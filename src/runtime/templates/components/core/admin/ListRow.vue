<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

export interface ListRowType {
  label: string
  colour: 'static' | 'dynamic'
}

const { to, title, type, sub, dim = false } = defineProps<{
  to?: RouteLocationRaw
  title: string
  type?: ListRowType
  sub?: string
  dim?: boolean
}>()

defineSlots<{
  default?(): any
  phone?(): any
}>()
</script>

<template>
  <div
    role="row"
    data-testid="list-row"
    class="cwa:relative cwa:grid cwa:min-h-16 cwa:grid-cols-(--cwa-list-columns) cwa:items-center cwa:gap-x-4 cwa:border-b cwa:border-line cwa:px-4 cwa:py-2.5 cwa:max-md:min-h-[4.25rem] cwa:max-md:grid-cols-[minmax(0,1fr)_auto]"
    :class="[{ 'cwa:hover:bg-field-hover/50': to }, { 'cwa:text-fg-muted': dim }]"
  >
    <div
      role="cell"
      class="cwa:flex cwa:min-w-0 cwa:flex-col cwa:gap-0.5"
    >
      <span class="cwa:flex cwa:min-w-0 cwa:items-center cwa:gap-2">
        <NuxtLink
          v-if="to"
          :to="to"
          data-testid="list-row-link"
          class="cwa:truncate cwa:text-control cwa:font-medium cwa:text-fg cwa:outline-1 cwa:outline-transparent cwa:after:absolute cwa:after:inset-0 cwa:after:content-[''] cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
          :class="{ 'cwa:text-fg-muted': dim }"
        >{{ title }}</NuxtLink>
        <span
          v-else
          class="cwa:truncate cwa:text-control cwa:font-medium"
          data-testid="list-row-title"
        >{{ title }}</span>
        <span
          v-if="type"
          role="img"
          :aria-label="type.label"
          :data-type="type.colour"
          data-testid="list-row-type"
          class="cwa:size-2 cwa:shrink-0 cwa:rounded-full"
          :class="type.colour === 'static' ? 'cwa:bg-type-static' : 'cwa:bg-type-dynamic'"
        />
      </span>
      <span
        v-if="sub"
        data-testid="list-row-sub"
        class="cwa:truncate cwa:text-helper cwa:text-fg-muted"
        :class="{ 'cwa:max-md:hidden': $slots.phone }"
      >{{ sub }}</span>
      <span
        v-if="$slots.phone"
        data-testid="list-row-phone"
        class="cwa:flex cwa:min-w-0 cwa:items-center cwa:gap-1.5 cwa:text-helper cwa:text-fg-muted cwa:md:hidden"
      >
        <slot name="phone" />
      </span>
    </div>
    <slot />
  </div>
</template>

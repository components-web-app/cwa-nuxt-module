<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import PenIcon from '../../ui/icon/PenIcon.vue'
import EyeIcon from '../../ui/icon/EyeIcon.vue'
import { buttonLooks } from '../../ui/kit-looks'

export interface ListRowType {
  label: string
  colour: 'static' | 'dynamic'
}

const { to, view, actions = false, name, title, type, sub, dim = false } = defineProps<{
  to?: RouteLocationRaw
  view?: RouteLocationRaw
  actions?: boolean
  name?: string
  title: string
  type?: ListRowType
  sub?: string
  dim?: boolean
}>()

defineSlots<{
  default?(): any
  phone?(): any
  actions?(): any
}>()

const actionClass = `cwa:grid cwa:size-8 cwa:shrink-0 cwa:place-items-center cwa:pointer-coarse:size-hit cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:ease-out cwa:motion-reduce:transition-none cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg ${buttonLooks.ghost.accent.rest} ${buttonLooks.ghost.accent.hover}`

const typeLooks: Record<ListRowType['colour'], string> = {
  static: 'cwa:bg-type-static cwa:outline-type-static',
  dynamic: 'cwa:bg-type-dynamic cwa:outline-type-dynamic',
}
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
          :tabindex="actions ? -1 : undefined"
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
          class="cwa:ms-1 cwa:size-2 cwa:shrink-0 cwa:rounded-full cwa:outline-1 cwa:outline-offset-2"
          :class="typeLooks[type.colour]"
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
    <div
      v-if="actions || $slots.actions"
      role="cell"
      data-testid="list-row-actions"
      class="cwa:relative cwa:z-[1] cwa:flex cwa:min-w-0 cwa:items-center cwa:justify-end cwa:gap-2"
    >
      <slot name="actions" />
      <NuxtLink
        v-if="actions && to"
        :to="to"
        :aria-label="`Edit ${name ?? title}`"
        :title="`Edit ${name ?? title}`"
        data-testid="list-row-edit"
        :class="actionClass"
      >
        <PenIcon
          aria-hidden="true"
          class="cwa:size-5"
        />
      </NuxtLink>
      <NuxtLink
        v-if="actions && view"
        :to="view"
        :aria-label="`View ${name ?? title}`"
        :title="`View ${name ?? title}`"
        data-testid="list-row-view"
        :class="actionClass"
      >
        <EyeIcon
          aria-hidden="true"
          class="cwa:h-5 cwa:w-auto"
        />
      </NuxtLink>
    </div>
  </div>
</template>

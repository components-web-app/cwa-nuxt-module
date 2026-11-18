<script setup lang="ts">
import { Comment, Fragment, Text, inject, useId } from 'vue'
import type { VNode } from 'vue'
import { sectionHeadingKey } from '../core/ui/field-keys'

const { title, description, columns = 1 } = defineProps<{
  title?: string
  description?: string
  columns?: 1 | 2
}>()

const slots = defineSlots<{
  default?: () => VNode[]
  action?: () => unknown
}>()

function countItems(nodes: unknown[] | undefined): number {
  return (nodes ?? []).reduce<number>((count, node) => {
    if (!node || typeof node !== 'object') return count
    const vnode = node as VNode
    if (vnode.type === Comment) return count
    if (vnode.type === Text && !String(vnode.children ?? '').trim()) return count
    if (vnode.type === Fragment) return count + countItems(vnode.children as unknown[])
    return count + 1
  }, 0)
}

function gridClasses() {
  if (columns !== 2) return []
  const count = countItems(slots.default?.())
  if (count < 2) return ['cwa:gap-x-4']
  return ['cwa:gap-x-4', 'cwa:@lg:grid-cols-2', ...(count % 2 ? ['cwa:@lg:*:first:col-span-2'] : [])]
}

const headingId = useId()
const heading = inject(sectionHeadingKey, 'h3')
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
        <component
          :is="heading"
          :id="headingId"
          class="cwa:m-0 cwa:text-section cwa:text-fg-secondary"
        >
          {{ title }}
        </component>
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
      data-testid="form-section-grid"
      class="cwa:grid cwa:grid-cols-1 cwa:gap-y-stack"
      :class="gridClasses()"
    >
      <slot />
    </div>
  </section>
</template>

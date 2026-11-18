<script setup lang="ts">
import { computed } from 'vue'
import { adminResourceIcons, adminResources } from '#build/cwa-admin-resources'

const GENERIC = 'lucide:component'

const { name, dynamic = false, chip = false } = defineProps<{
  name: string
  dynamic?: boolean
  chip?: boolean
}>()

const entry = computed(() => adminResources[name])
const icon = computed(() => adminResourceIcons[entry.value?.icon ?? GENERIC] ?? adminResourceIcons[GENERIC])
const skeleton = computed(() => !chip && entry.value?.skeleton ? adminResourceIcons[entry.value.skeleton] : undefined)
</script>

<template>
  <span
    v-if="dynamic"
    aria-hidden="true"
    data-lead="dynamic"
    class="cwa:block cwa:size-3 cwa:shrink-0 cwa:bg-type-dynamic"
  />
  <img
    v-else-if="entry?.image && !chip"
    :src="entry.image"
    alt=""
    data-lead="image"
    class="cwa:block cwa:h-8 cwa:w-12 cwa:object-cover cwa:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--cwa-color-fg)_12%,transparent)]"
  >
  <span
    v-else-if="skeleton"
    aria-hidden="true"
    data-lead="skeleton"
    class="cwa:block cwa:h-8 cwa:w-12 cwa:[&>svg]:size-full"
    v-html="skeleton"
  />
  <span
    v-else
    aria-hidden="true"
    data-lead="icon"
    class="cwa:block cwa:size-4 cwa:shrink-0 cwa:text-fg-muted cwa:[&>svg]:size-full"
    v-html="icon"
  />
</template>

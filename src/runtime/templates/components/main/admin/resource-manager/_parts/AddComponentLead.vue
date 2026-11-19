<script setup lang="ts">
import { computed } from 'vue'
import { adminResourceIcons, adminResources } from '#build/cwa-admin-resources'

const GENERIC = 'lucide:component'

const { name, dynamic = false, chip = false, heading = false } = defineProps<{
  name: string
  dynamic?: boolean
  chip?: boolean
  heading?: boolean
}>()

const entry = computed(() => adminResources[name])
const icon = computed(() => adminResourceIcons[entry.value?.icon ?? GENERIC] ?? adminResourceIcons[GENERIC])
const skeleton = computed(() => !chip && !heading && entry.value?.skeleton ? adminResourceIcons[entry.value.skeleton] : undefined)
</script>

<template>
  <span
    v-if="dynamic"
    aria-hidden="true"
    data-lead="dynamic"
    class="cwa:block cwa:size-3 cwa:shrink-0 cwa:rounded-full cwa:bg-type-dynamic"
  />
  <span
    v-else-if="skeleton"
    aria-hidden="true"
    data-lead="skeleton"
    class="cwa:block cwa:h-8 cwa:w-12 cwa:[&>svg]:size-full"
    v-html="skeleton"
  />
  <span
    v-else-if="icon"
    aria-hidden="true"
    data-lead="icon"
    class="cwa:block cwa:shrink-0 cwa:text-fg-muted cwa:[&>svg]:size-full"
    :class="heading ? 'cwa:size-5' : 'cwa:size-4'"
    v-html="icon"
  />
</template>

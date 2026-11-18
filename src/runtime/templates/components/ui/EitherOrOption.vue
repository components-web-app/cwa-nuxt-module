<script setup lang="ts">
import { computed, inject } from 'vue'
import { eitherOrKey, tabMetaOnlyKey } from '../core/ui/field-keys'
import CwaReveal from '../core/ui/Reveal.vue'

const { label, fields } = defineProps<{
  label: string
  fields: string[]
}>()

const group = inject(eitherOrKey, undefined)
const metaOnly = inject(tabMetaOnlyKey, false)
const index = group?.register(label, fields) ?? -1
const shown = computed(() => metaOnly || !group || group.active.value === index)
</script>

<template>
  <CwaReveal :when="shown">
    <slot />
  </CwaReveal>
</template>

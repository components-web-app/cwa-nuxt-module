<script setup lang="ts">
import { computed, inject } from 'vue'
import { eitherOrKey, tabMetaOnlyKey } from '../core/ui/field-keys'

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
  <slot v-if="shown" />
</template>

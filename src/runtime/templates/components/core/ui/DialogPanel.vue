<script setup lang="ts">
import { provide } from 'vue'
import { formSurfaceKey } from './field-keys'

const { tab, unsaved, register } = defineProps<{
  tab: string
  unsaved: (field: string) => boolean
  register: (field: string, label: string, tab: string) => () => void
}>()

provide(formSurfaceKey, {
  unsaved: field => unsaved(field),
  register: (field, label) => register(field, label, tab),
})
</script>

<template>
  <slot />
</template>

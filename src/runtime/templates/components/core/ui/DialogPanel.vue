<script setup lang="ts">
import { provide } from 'vue'
import { dialogSubViewKey, formSurfaceKey } from './field-keys'
import type { DialogSubViewClaim } from './field-keys'

const { tab, unsaved, register, claim } = defineProps<{
  tab: string
  unsaved: (field: string) => boolean
  register: (field: string, label: string, tab: string) => () => void
  claim: (entry: DialogSubViewClaim) => () => void
}>()

provide(dialogSubViewKey, {
  footer: get => claim({ tab, footer: get }),
  guard: guard => claim({ tab, guard }),
})

provide(formSurfaceKey, {
  unsaved: field => unsaved(field),
  register: (field, label) => register(field, label, tab),
})
</script>

<template>
  <slot />
</template>

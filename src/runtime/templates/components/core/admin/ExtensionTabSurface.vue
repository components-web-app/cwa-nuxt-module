<script setup lang="ts">
import { provide } from 'vue'
import { fieldGroupKey, formSurfaceKey } from '#cwa/templates/components/core/ui/field-keys'

provide(fieldGroupKey, { model: () => undefined, undo: () => undefined })
provide(formSurfaceKey, { unsaved: () => false, register: () => () => {} })
</script>

<template>
  <slot />
</template>

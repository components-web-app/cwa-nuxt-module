<script setup lang="ts">
import { provide } from 'vue'
import { formSurfaceKey } from './field-keys'

provide(formSurfaceKey, { unsaved: () => false, register: () => () => {} })
</script>

<template>
  <slot />
</template>

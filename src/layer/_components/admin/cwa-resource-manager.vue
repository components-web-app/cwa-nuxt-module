<script lang="ts" setup>
import { useCwa } from '#imports'

const $cwa = useCwa()
const current = $cwa.admin.componentManager.currentStackItem
const stack = $cwa.admin.componentManager.resourceStack
</script>

<template>
  <div>
    {{ stack.length }}: {{ current }}
  </div>
</template>

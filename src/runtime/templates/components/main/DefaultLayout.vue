<script lang="ts" setup>
defineSlots<{
  default(): any
}>()
</script>

<template>
  <div
    id="cwa:default-layout"
    class="cwa:flex cwa:flex-col cwa:h-full"
  >
    <slot />
  </div>
</template>

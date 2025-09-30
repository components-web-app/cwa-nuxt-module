<script lang="ts" setup>
defineSlots<{
  default(): any
}>()
</script>

<template>
  <div class="cwa:flex cwa:justify-center cwa:px-8">
    <div class="cwa:w-full cwa:max-w-2xl">
      <slot />
    </div>
  </div>
</template>

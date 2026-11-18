<template>
  <div
    class="cwa:mx-auto cwa:w-full cwa:max-w-6xl cwa:px-4 cwa:pt-10 cwa:pb-4 cwa:sm:px-8"
    data-testid="list-heading"
  >
    <slot />
    <h1 class="cwa:m-0 cwa:text-[1.75rem] cwa:leading-tight cwa:font-semibold cwa:text-fg">
      {{ title }}
    </h1>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  title: string
}>()
defineSlots<{
  default?(): any
}>()
</script>

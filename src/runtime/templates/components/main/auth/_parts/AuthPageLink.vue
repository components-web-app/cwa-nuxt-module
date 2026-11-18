<template>
  <NuxtLink
    :to="props.linkTo"
    class="cwa:inline-flex cwa:min-h-target cwa:items-center cwa:text-label cwa:text-accent-fg cwa:underline cwa:underline-offset-4 cwa:outline-1 cwa:outline-transparent cwa:hover:text-fg cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
  >
    {{ props.linkText }}
  </NuxtLink>
</template>

<script setup lang="ts">
const props = defineProps<{ linkText: string, linkTo: string }>()
</script>

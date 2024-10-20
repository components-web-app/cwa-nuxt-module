<template>
  <div class="cwa-text-sm">
    <NuxtLink
      :to="props.linkTo"
      class="cwa-font-medium cwa-text-neutral-400 hover:cwa-text-neutral-200"
    >
      {{ props.linkText }}
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ linkText: string, linkTo: string }>()
</script>

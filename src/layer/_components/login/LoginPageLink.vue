<template>
  <div class="cwa-text-sm">
    <NuxtLink :to="props.linkTo" class="cwa-font-medium cwa-text-neutral-400 hover:cwa-text-neutral-200">
      {{ props.linkText }}
    </NuxtLink>
  </div>
</template>

<script setup>
const props = defineProps({
  linkText: {
    type: String,
    required: true
  },
  linkTo: {
    type: String,
    required: true
  }
})
</script>

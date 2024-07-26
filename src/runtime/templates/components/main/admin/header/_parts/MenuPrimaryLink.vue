<template>
  <NuxtLink to="#" class="cwa-font-medium cwa-text-neutral-400 hover:cwa-text-white cwa-flex cwa-space-x-2 cwa-items-center">
    <div class="cwa-w-10">
      <slot />
    </div>
    <span>
      {{ label }}
    </span>
  </NuxtLink>
</template>

<script setup lang="ts">
defineProps<{ label: string }>()
</script>

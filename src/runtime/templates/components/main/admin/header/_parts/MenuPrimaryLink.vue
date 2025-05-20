<template>
  <NuxtLink
    to="#"
    class="cwa:font-medium cwa:text-neutral-400 cwa:hover:text-white cwa:flex cwa:gap-x-2 cwa:items-center"
  >
    <div class="cwa:w-10">
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

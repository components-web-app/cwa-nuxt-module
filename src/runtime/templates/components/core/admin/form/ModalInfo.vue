<template>
  <div class="cwa-flex cwa-flex-col space-space-y-1">
    <span class="cwa-text-stone-400">
      {{ label }}
    </span>
    <span class="cwa-truncate">
      {{ content }}
    </span>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  label: string
  content: string
}>()
</script>

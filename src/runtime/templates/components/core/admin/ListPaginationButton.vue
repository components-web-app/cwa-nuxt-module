<template>
  <li class="cwa-border-r last:cwa-border-0 cwa-border-stone-600">
    <button
      :disabled="!!disabled"
      class="cwa-py-1.5 cwa-px-3 cwa-transition-colors cwa-font-bold"
      :class="[disabled ? 'cwa-opacity-50' : 'hover:cwa-bg-stone-700 hover:cwa-text-light', selected ? 'cwa-text-light cwa-bg-stone-700' : 'cwa-text-stone-400']"
    >
      <slot />
    </button>
  </li>
</template>

<script setup lang="ts">
defineProps<{
  disabled?: boolean
  selected?: boolean
}>()
</script>

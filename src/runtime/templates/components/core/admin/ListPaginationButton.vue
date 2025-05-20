<template>
  <li class="cwa:border-r cwa:last:border-0 cwa:border-stone-600">
    <button
      :disabled="!!disabled"
      class="cwa:py-1.5 cwa:px-3 cwa:transition-colors cwa:font-bold cwa:cursor-pointer"
      :class="[disabled ? 'cwa:opacity-50' : 'cwa:hover:bg-stone-700 cwa:hover:text-light', selected ? 'cwa:text-light cwa:bg-stone-700' : 'cwa:text-stone-400']"
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

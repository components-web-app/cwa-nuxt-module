<template>
  <div class="cwa:flex cwa:flex-col cwa:gap-y-1">
    <span class="cwa:text-stone-400">
      {{ label }}
    </span>
    <div class="cwa:flex cwa:items-center cwa:gap-x-4">
      <span
        v-if="content"
        class="cwa:truncate"
      >
        {{ content }}
      </span>
      <slot />
    </div>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  label: string
  content?: string
}>()
</script>

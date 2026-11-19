<script setup lang="ts">
defineSlots<{
  default: () => any
  actions?: () => any
  detail?: () => any
}>()
</script>

<template>
  <li class="cwa:border-b cwa:border-line cwa:py-3 cwa:last:border-b-0">
    <div class="cwa:flex cwa:flex-wrap cwa:items-center cwa:gap-x-4 cwa:gap-y-2">
      <div class="cwa:flex cwa:min-w-0 cwa:flex-1 cwa:basis-60 cwa:flex-col cwa:gap-y-0.5">
        <slot />
      </div>
      <div
        v-if="$slots.actions"
        class="cwa:flex cwa:shrink-0 cwa:gap-2"
      >
        <slot name="actions" />
      </div>
    </div>
    <slot name="detail" />
  </li>
</template>

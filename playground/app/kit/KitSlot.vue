<script setup lang="ts">
const { name, from } = defineProps<{
  name: string
  from: string
}>()
</script>

<template>
  <aside
    class="kit-slot"
    :data-kit-slot="name"
    data-testid="kit-slot"
  >
    <strong>Slot for {{ name }}</strong> · arrives with {{ from }}; wire it in here after the merge.
  </aside>
</template>

<style scoped>
.kit-slot {
  flex: 1 1 100%;
  padding: 0.5rem 0.75rem;
  box-shadow: inset 3px 0 0 var(--cwa-color-accent-fg);
  background: var(--cwa-color-surface-raised);
  color: var(--cwa-color-fg-muted);
  font-size: 0.8125rem;
}

strong {
  color: var(--cwa-color-fg-secondary);
  font-weight: 600;
}
</style>

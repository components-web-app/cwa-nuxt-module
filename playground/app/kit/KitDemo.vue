<script setup lang="ts">
const { component, state, wide = false, bare = false } = defineProps<{
  component: string
  state: string
  wide?: boolean
  bare?: boolean
}>()
</script>

<template>
  <slot v-if="bare" />
  <figure
    v-else
    class="kit-demo"
    :class="{ 'kit-demo-wide': wide }"
    :data-component="component"
    :data-state="state"
  >
    <div class="kit-demo-stage">
      <slot />
    </div>
    <figcaption>
      <code>{{ component }}</code> · {{ state }}
    </figcaption>
  </figure>
</template>

<style scoped>
.kit-demo {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
  max-width: 100%;
  margin: 0;
}

.kit-demo-wide {
  flex: 1 1 100%;
}

.kit-demo-stage {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

@media (max-width: 40rem) {
  .kit-demo-stage > :deep(*) {
    flex-shrink: 1;
    flex-wrap: wrap;
    max-width: 100%;
  }
}

figcaption {
  color: var(--cwa-color-fg-muted);
  font-size: 0.75rem;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--cwa-color-fg-secondary);
}
</style>

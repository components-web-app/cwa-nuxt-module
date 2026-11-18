<script setup lang="ts">
const { id, title, intro } = defineProps<{
  id: string
  title: string
  intro?: string
}>()

defineSlots<{
  controls?: () => any
  default?: () => any
}>()
</script>

<template>
  <section
    :aria-labelledby="id"
    class="kit-sim"
    :data-testid="id"
  >
    <h2 :id="id">
      {{ title }}
    </h2>
    <p
      v-if="intro"
      class="kit-sim-intro"
    >
      {{ intro }}
    </p>
    <div
      v-if="$slots.controls"
      class="kit-sim-controls"
      role="group"
      :aria-label="`${title}: simulation`"
      :data-testid="`${id}-controls`"
    >
      <slot name="controls" />
    </div>
    <div class="kit-sim-demos">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.kit-sim h2 {
  margin: 2.5rem 0 1rem;
  font-size: 1.125rem;
  font-weight: 650;
  line-height: 1.5rem;
  color: var(--cwa-color-fg-secondary);
}

.kit-sim-intro {
  max-width: 48rem;
  margin: 0 0 0.75rem;
  color: var(--cwa-color-fg-muted);
}

.kit-sim-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  max-width: 100%;
  margin-bottom: 1rem;
  padding: 0.75rem;
  overflow-x: auto;
  background: var(--cwa-color-surface-raised);
}

.kit-sim-demos {
  display: flex;
  max-width: 100%;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1rem 1.5rem;
}
</style>

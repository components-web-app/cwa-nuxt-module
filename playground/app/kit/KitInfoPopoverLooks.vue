<script setup lang="ts">
import { infoPanel } from '../../../src/runtime/templates/components/core/ui/field-looks'
import { kitThemeStyle } from '../../../src/tailwind/kit-tokens'

const themes = ['dark', 'light'] as const
const looks = [
  { name: 'dark', title: 'Dark, white text (the default)' },
  { name: 'info', title: 'Info tint, accent edge' },
] as const
</script>

<template>
  <div
    class="looks"
    data-testid="kit-info-popover-looks"
  >
    <template
      v-for="theme in themes"
      :key="theme"
    >
      <figure
        v-for="look in looks"
        :key="look.name"
        class="look"
        :style="kitThemeStyle(theme)"
        :data-testid="`kit-info-look-${look.name}-${theme}`"
      >
        <figcaption>{{ look.title }}, {{ theme }} theme</figcaption>
        <div
          role="note"
          :aria-label="`Reference, ${look.name} look`"
          :class="['cwa:p-popover cwa:text-control', look.name === 'dark' ? infoPanel : 'cwa:shadow-popover']"
          :style="look.name === 'info' ? { background: 'var(--cwa-color-accent-tint)', boxShadow: 'inset 3px 0 0 var(--cwa-color-accent-fg), var(--cwa-shadow-popover)', color: 'var(--cwa-color-fg)' } : undefined"
        >
          <strong>Reference</strong>
          <p>Only admins see this. It names the component in lists.</p>
        </div>
        <div class="field">
          Hero banner
        </div>
      </figure>
    </template>
  </div>
</template>

<style scoped>
.looks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1rem;
}

.look {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 1rem;
  background: var(--cwa-color-surface);
  color: var(--cwa-color-fg);
}

figcaption {
  font-size: 0.8125rem;
  color: var(--cwa-color-fg-muted);
}

p {
  margin: 0.375rem 0 0;
}

.field {
  padding: 0.5rem 0.75rem;
  background: var(--cwa-color-field);
}
</style>
